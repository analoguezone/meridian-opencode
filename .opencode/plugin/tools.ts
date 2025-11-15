import type { Plugin } from "@opencode-ai/plugin";
import { tool } from "@opencode-ai/plugin";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "fs";
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

  // Plugin initialization logging
  console.log("🛠️  Meridian Tools Plugin Loading");
  console.log(`   Memory: ${memoryPath}`);
  console.log(`   Tasks: ${tasksDir}`);
  console.log(`   Backlog: ${backlogPath}`);

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
        description: `Create and manage development tasks after the user approves a plan. Initializes folders/files, updates the backlog, and keeps progress notes synchronized.

When to Use:
Use this skill IMMEDIATELY after the user approves a plan for code changes. It creates the task folder, scaffolds files, records the plan and context, and updates the backlog.

Do NOT use for brainstorming or unapproved ideas.

Task Structure:
Each task lives at: .meridian/tasks/TASK-###/

Files inside (exact names):
- TASK-###.yaml — Task brief (objective, scope, constraints, acceptance criteria, deliverables, risks, out of scope, links)
- TASK-###-plan.md — Exact plan approved by the user (freeze this; changes require re-approval)
- TASK-###-context.md — Relevant context (Why decisions were made), key files, timestamped progress notes

After creating the task, you MUST:
1. Read each file before writing (System limitation)
2. Fill TASK-###.yaml using the Task Brief YAML Template
3. Paste the approved plan into TASK-###-plan.md
4. Add an initial entry to TASK-###-context.md
5. Update .meridian/task-backlog.yaml with the new task entry`,
        args: {},
        async execute(args, ctx) {
          const taskId = getNextTaskId();
          const templateDir = join(tasksDir, "TASK-000-template");
          const destDir = join(tasksDir, taskId);

          if (!existsSync(templateDir)) {
            throw new Error(
              `Template directory not found at '${templateDir}'. Please create a 'TASK-000-template' folder with the desired contents.`
            );
          }

          if (existsSync(destDir)) {
            throw new Error(`Destination task directory already exists: '${destDir}'.`);
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

          return `✅ Task created successfully: ${taskId}. Read files in the folder before writing to them\nPath: ${destDir}`;
        },
      }),
    },
  };
};
