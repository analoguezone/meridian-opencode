import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "fs";
import { join, basename } from "path";
import { execSync } from "child_process";

/**
 * Meridian Tools Plugin
 * Provides memory-curator and task-manager custom tools
 */
export const MeridianToolsPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  const meridianDir = join(directory, ".meridian");
  const memoryPath = join(meridianDir, "memory.jsonl");
  const tasksDir = join(meridianDir, "tasks");
  const backlogPath = join(meridianDir, "task-backlog.yaml");

  /**
   * Read the last non-empty line from a file efficiently
   */
  function tailLastLine(filePath: string): string | null {
    if (!existsSync(filePath)) return null;

    try {
      const content = readFileSync(filePath, "utf-8");
      const lines = content.split("\n").filter((line) => line.trim());
      return lines.length > 0 ? lines[lines.length - 1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate the next memory ID
   */
  function getNextMemoryId(): string {
    const lastLine = tailLastLine(memoryPath);
    if (lastLine) {
      try {
        const obj = JSON.parse(lastLine);
        const match = obj.id?.match(/^mem-(\d{4,})$/);
        if (match) {
          const nextNum = parseInt(match[1], 10) + 1;
          return `mem-${nextNum.toString().padStart(4, "0")}`;
        }
      } catch (error) {
        // Fall through to full scan
      }
    }

    // Full scan fallback
    let maxNum = 0;
    if (existsSync(memoryPath)) {
      try {
        const content = readFileSync(memoryPath, "utf-8");
        const lines = content.split("\n").filter((line) => line.trim());
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            const match = obj.id?.match(/^mem-(\d{4,})$/);
            if (match) {
              maxNum = Math.max(maxNum, parseInt(match[1], 10));
            }
          } catch (error) {
            continue;
          }
        }
      } catch (error) {
        // Ignore
      }
    }

    return `mem-${(maxNum + 1).toString().padStart(4, "0")}`;
  }

  /**
   * Get current UTC timestamp in ISO format
   */
  function getUtcTimestamp(): string {
    return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  }

  /**
   * Split and deduplicate tags/links
   */
  function splitAndDedupe(items: string[]): string[] {
    const result: string[] = [];
    const seen = new Set<string>();

    for (const item of items) {
      const parts = item.split(/[,\s]+/).filter((p) => p.trim());
      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          result.push(trimmed);
        }
      }
    }

    return result;
  }

  /**
   * Update or add task entry in backlog
   */
  function updateBacklog(taskId: string, entry: string): void {
    if (!existsSync(backlogPath)) {
      // Create initial backlog if missing
      writeFileSync(backlogPath, `tasks:\n${entry}\n`, "utf-8");
      return;
    }

    const backlogContent = readFileSync(backlogPath, "utf-8");
    const lines = backlogContent.split("\n");

    // Find if task already exists
    const taskIdPattern = new RegExp(`^\\s*-\\s*id:\\s*${taskId}\\s*$`, 'm');
    const match = backlogContent.match(taskIdPattern);

    if (match) {
      // Replace existing entry
      // Find the start and end of this task entry
      const startIdx = lines.findIndex(line => line.match(new RegExp(`^\\s*-\\s*id:\\s*${taskId}\\s*$`)));
      if (startIdx === -1) return;

      // Find next task or end of file
      let endIdx = startIdx + 1;
      while (endIdx < lines.length && !lines[endIdx].match(/^\s*-\s*id:/)) {
        endIdx++;
      }

      // Replace the entry
      const before = lines.slice(0, startIdx).join("\n");
      const after = lines.slice(endIdx).join("\n");
      const newContent = before + (before ? "\n" : "") + entry + (after ? "\n" + after : "");
      writeFileSync(backlogPath, newContent, "utf-8");
    } else {
      // Append new entry
      const content = backlogContent.trim();
      writeFileSync(backlogPath, content + "\n" + entry + "\n", "utf-8");
    }
  }

  /**
   * Remove task entry from backlog
   */
  function removeFromBacklog(taskId: string): void {
    if (!existsSync(backlogPath)) return;

    const backlogContent = readFileSync(backlogPath, "utf-8");
    const lines = backlogContent.split("\n");

    // Find the task entry
    const startIdx = lines.findIndex(line => line.match(new RegExp(`^\\s*-\\s*id:\\s*${taskId}\\s*$`)));
    if (startIdx === -1) return;

    // Find next task or end of file
    let endIdx = startIdx + 1;
    while (endIdx < lines.length && !lines[endIdx].match(/^\s*-\s*id:/)) {
      endIdx++;
    }

    // Remove the entry
    const before = lines.slice(0, startIdx).join("\n");
    const after = lines.slice(endIdx).join("\n");
    const newContent = (before + (after ? "\n" + after : "")).trim();
    writeFileSync(backlogPath, newContent + "\n", "utf-8");
  }

  /**
   * Get the next task ID
   */
  function getNextTaskId(): string {
    if (!existsSync(tasksDir)) {
      throw new Error(`Tasks directory not found: ${tasksDir}`);
    }

    const taskIds: number[] = [];
    const items = readdirSync(tasksDir, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory() && item.name.startsWith("TASK-")) {
        const match = item.name.match(/^TASK-(\d+)$/);
        if (match) {
          taskIds.push(parseInt(match[1], 10));
        }
      }
    }

    const nextId = taskIds.length === 0 ? 1 : Math.max(...taskIds) + 1;
    return `TASK-${nextId.toString().padStart(3, "0")}`;
  }

  /**
   * Rename template files in the task directory
   */
  function renameTemplateFiles(destDir: string, taskId: string): void {
    const exts = [".yaml", ".yml", ".md"];
    const items = readdirSync(destDir, { withFileTypes: true });

    for (const item of items) {
      if (!item.isFile()) continue;

      const ext = item.name.substring(item.name.lastIndexOf("."));
      if (!exts.includes(ext.toLowerCase())) continue;

      if (item.name.includes("TASK-000")) {
        const newName = item.name.replace("TASK-000", taskId);
        const oldPath = join(destDir, item.name);
        const newPath = join(destDir, newName);

        if (existsSync(newPath)) {
          throw new Error(`Cannot rename '${item.name}' to '${newName}': target already exists.`);
        }

        renameSync(oldPath, newPath);
      }
    }
  }

  return {
    tool: {
      /**
       * Memory Curator Tool
       * Adds structured memory entries to memory.jsonl
       */
      "memory-curator": tool({
        description: `Manage architectural decisions and insights in memory.jsonl. Use when you need to document strategic decisions, lessons learned, fixed problems, or architectural insights. Append-only audit trail for project knowledge.

When to Use (Triage Test):
Create a memory entry ONLY if at least one is true:
1) Will this decision meaningfully affect how we build other features?
2) Is this a pattern we'll want to repeat across the codebase?
3) Does this prevent a category of future mistakes?

If NO to all three → do NOT create an entry. Put implementation detail into the task context instead.

Summary Format (consistent & skimmable):
Write summary as concise Markdown using these bolded labels in this order:
- **Decision:** <The decision or principle in a single sentence.>
- **Problem:** <What made this necessary; symptoms, constraints, or failure mode.>
- **Alternatives:** <Narrow list of serious options considered and why rejected.>
- **Trade-offs:** <What we accept (complexity, perf, coupling) and why it's OK.>
- **Impact/Scope:** <Which services/modules/patterns this affects now and later.>
- **Pattern:** <If reusable, name it; 1–2 rules of thumb to apply next time.>

Keep to ~6–10 lines total.`,
        args: {
          summary: tool.schema.string().describe("Short markdown summary of the memory item using the format above"),
          tags: tool.schema.array(tool.schema.string()).describe("Tags (kebab-case): architecture, data-model, api, contracts, security, performance, reliability, observability, testing, tooling, build, release, i18n, a11y, cost, decision, pattern, lesson, tradeoff, deprecation, migration, nextjs, react, node, prisma, postgres, redis, s3, graphql, openapi"),
          links: tool.schema.array(tool.schema.string()).describe("Links: TASK IDs, critical file paths, PR URLs, or design docs. Prefer relative repo paths."),
        },
        async execute(args, ctx) {
          if (!args.summary || !args.summary.trim()) {
            throw new Error("Summary is required and cannot be empty");
          }

          // Ensure parent directory exists
          if (!existsSync(meridianDir)) {
            mkdirSync(meridianDir, { recursive: true });
          }

          const entry = {
            id: getNextMemoryId(),
            timestamp: getUtcTimestamp(),
            summary: args.summary.trim(),
            tags: splitAndDedupe(args.tags || []),
            links: splitAndDedupe(args.links || []),
          };

          // Append to file
          const jsonLine = JSON.stringify(entry) + "\n";
          writeFileSync(memoryPath, jsonLine, { flag: "a", encoding: "utf-8" });

          return `Added ${entry.id} at ${entry.timestamp} → ${memoryPath}\n${JSON.stringify(entry, null, 2)}`;
        },
      }),

      /**
       * Task Manager Tool
       * Creates and manages development tasks
       */
      "task-manager": tool({
        description: `Create OR update development tasks after the user approves a plan. Initializes folders/files, populates them with task details, and updates the backlog.

When to Use:
- CREATE: After user approves a NEW plan (omit taskId parameter)
- UPDATE: To update an existing task (provide taskId parameter)

Do NOT use for brainstorming or unapproved ideas.

Task Structure:
Each task lives at: .meridian/tasks/TASK-###/

Files managed:
- TASK-###.yaml — Task brief (objective, scope, constraints, acceptance criteria, deliverables, risks, out of scope, links)
- TASK-###-plan.md — Exact plan approved by the user
- TASK-###-context.md — Relevant context (why decisions were made), key files, progress notes

Parameters:
- taskId: (optional) If provided, UPDATE this task instead of creating new one (e.g., "TASK-002")
- taskBrief: YAML content for TASK-###.yaml (objective, scope, constraints, etc.)
- planContent: Markdown content for TASK-###-plan.md (the approved plan)
- contextContent: Markdown content for TASK-###-context.md (initial context notes)
- backlogEntry: Brief summary for task-backlog.yaml entry

Examples:
- Create new: task-manager({ taskBrief: "...", planContent: "..." })
- Update existing: task-manager({ taskId: "TASK-002", taskBrief: "...", planContent: "..." })`,
        args: {
          taskId: tool.schema.string().optional().describe("Task ID to update (e.g., 'TASK-002'). If omitted, creates new task."),
          taskBrief: tool.schema.string().optional().describe("YAML content for TASK-###.yaml (task brief)"),
          planContent: tool.schema.string().optional().describe("Markdown content for TASK-###-plan.md (approved plan)"),
          contextContent: tool.schema.string().optional().describe("Markdown content for TASK-###-context.md (initial context)"),
          backlogEntry: tool.schema.string().optional().describe("Brief summary for task-backlog.yaml"),
        },
        async execute(args, ctx) {
          const timestamp = new Date().toISOString();

          // Determine if we're creating or updating
          const isUpdate = !!args.taskId;
          const taskId = isUpdate ? args.taskId! : getNextTaskId();
          const templateDir = join(tasksDir, "TASK-000-template");
          const destDir = join(tasksDir, taskId);

          if (isUpdate) {
            // UPDATE MODE: Task must exist
            if (!existsSync(destDir)) {
              throw new Error(`Task '${taskId}' not found at '${destDir}'. Cannot update non-existent task.`);
            }

            // Update only the files that have new content
            const filesUpdated = [];

            if (args.taskBrief) {
              const taskBriefPath = join(destDir, `${taskId}.yaml`);
              writeFileSync(taskBriefPath, args.taskBrief, "utf-8");
              filesUpdated.push("YAML brief");
            }

            if (args.planContent) {
              const planPath = join(destDir, `${taskId}-plan.md`);
              writeFileSync(planPath, args.planContent, "utf-8");
              filesUpdated.push("plan");
            }

            if (args.contextContent) {
              const contextPath = join(destDir, `${taskId}-context.md`);
              writeFileSync(contextPath, args.contextContent, "utf-8");
              filesUpdated.push("context");
            }

            // Update backlog if entry provided (do this BEFORE the early return check)
            if (args.backlogEntry) {
              try {
                updateBacklog(taskId, args.backlogEntry);
                filesUpdated.push("backlog");
              } catch (error) {
                throw new Error(`❌ BACKLOG UPDATE FAILED for ${taskId}\nError: ${error instanceof Error ? error.message : String(error)}`);
              }
            }

            if (filesUpdated.length === 0) {
              return `⚠️ Task ${taskId} not modified (no content provided).\nPath: ${destDir}`;
            }

            return `✅ Task ${taskId} updated successfully at ${timestamp}\nUpdated: ${filesUpdated.join(", ")}\nPath: ${destDir}`;
          } else {
            // CREATE MODE: Task must NOT exist
            if (!existsSync(templateDir)) {
              throw new Error(
                `Template directory not found at '${templateDir}'. Please create a 'TASK-000-template' folder with the desired contents.`
              );
            }

            if (existsSync(destDir)) {
              throw new Error(`Task '${taskId}' already exists at '${destDir}'. Use taskId parameter to update it.`);
            }

            // Copy template directory
            try {
              mkdirSync(destDir, { recursive: true });
              const items = readdirSync(templateDir, { withFileTypes: true });

              for (const item of items) {
                const srcPath = join(templateDir, item.name);
                const dstPath = join(destDir, item.name);

                if (item.isFile()) {
                  const content = readFileSync(srcPath, "utf-8");
                  writeFileSync(dstPath, content, "utf-8");
                }
              }
            } catch (error) {
              throw new Error(`Failed to copy template: ${error}`);
            }

            // Rename template files
            renameTemplateFiles(destDir, taskId);

            // Populate files with provided content (if any)
            if (args.taskBrief) {
              const taskBriefPath = join(destDir, `${taskId}.yaml`);
              writeFileSync(taskBriefPath, args.taskBrief, "utf-8");
            }

            if (args.planContent) {
              const planPath = join(destDir, `${taskId}-plan.md`);
              writeFileSync(planPath, args.planContent, "utf-8");
            }

            if (args.contextContent) {
              const contextPath = join(destDir, `${taskId}-context.md`);
              writeFileSync(contextPath, args.contextContent, "utf-8");
            }

            const filesPopulated = [];
            if (args.taskBrief) filesPopulated.push("YAML brief");
            if (args.planContent) filesPopulated.push("plan");
            if (args.contextContent) filesPopulated.push("context");

            // Add to backlog if entry provided
            if (args.backlogEntry) {
              updateBacklog(taskId, args.backlogEntry);
              filesPopulated.push("backlog");
            }

            const populatedMsg = filesPopulated.length > 0
              ? `\nPopulated: ${filesPopulated.join(", ")}`
              : "\nUsing template defaults";

            return `✅ Task ${taskId} created successfully at ${timestamp}${populatedMsg}\nPath: ${destDir}`;
          }
        },
      }),

      /**
       * Task Deleter Tool
       * Deletes tasks and removes them from backlog
       */
      "task-deleter": tool({
        description: `Delete a task folder and remove it from the backlog.

Use this to clean up:
- Accidentally created tasks (like TASK-003 created by mistake)
- Abandoned or obsolete tasks
- Duplicate tasks

WARNING: This permanently deletes the task folder and all its contents!

Parameters:
- taskId: Task ID to delete (e.g., "TASK-003")

Example:
- task-deleter({ taskId: "TASK-003" })`,
        args: {
          taskId: tool.schema.string().describe("Task ID to delete (e.g., 'TASK-003')"),
        },
        async execute(args, ctx) {
          const taskId = args.taskId;
          const destDir = join(tasksDir, taskId);

          if (!existsSync(destDir)) {
            throw new Error(`Task '${taskId}' not found at '${destDir}'. Cannot delete non-existent task.`);
          }

          // Remove from backlog first
          removeFromBacklog(taskId);

          // Delete the task folder
          rmSync(destDir, { recursive: true, force: true });

          return `✅ Task deleted successfully: ${taskId}\nRemoved from: ${destDir}\nRemoved from backlog`;
        },
      }),
    },
  };
};
