import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync, existsSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";

/**
 * Meridian Plugin for OpenCode
 * 
 * Provides structured task management, memory curation, and context preservation
 * across sessions. Enforces coding standards and maintains project knowledge.
 */
export const MeridianPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  const meridianDir = join(directory, ".meridian");
  const configPath = join(meridianDir, "config.yaml");
  const needsContextReviewFlag = join(meridianDir, ".needs-context-review");

  /**
   * Read and parse config.yaml to determine project type and TDD mode
   */
  function getProjectConfig(): { projectType: string; tddMode: boolean } {
    let projectType = "standard";
    let tddMode = false;

    if (existsSync(configPath)) {
      try {
        const configContent = readFileSync(configPath, "utf-8");
        for (const line of configContent.split("\n")) {
          const stripped = line.trim();
          if (stripped.startsWith("project_type:")) {
            const value = stripped.split(":")[1]?.trim().toLowerCase();
            if (["hackathon", "standard", "production"].includes(value)) {
              projectType = value;
            }
          } else if (stripped.startsWith("tdd_mode:")) {
            const value = stripped.split(":")[1]?.trim().toLowerCase();
            tddMode = ["true", "yes", "on", "1"].includes(value);
          }
        }
      } catch (error) {
        // Keep defaults on parse error
      }
    }

    return { projectType, tddMode };
  }

  /**
   * Build the list of CODE_GUIDE files based on project configuration
   */
  function buildCodeGuideFilesList(): string {
    const { projectType, tddMode } = getProjectConfig();
    let files = `- \`${directory}/.meridian/CODE_GUIDE.md\``;

    if (projectType === "hackathon") {
      files += `\n- \`${directory}/.meridian/CODE_GUIDE_ADDON_HACKATHON.md\``;
    } else if (projectType === "production") {
      files += `\n- \`${directory}/.meridian/CODE_GUIDE_ADDON_PRODUCTION.md\``;
    }

    if (tddMode) {
      files += `\n- \`${directory}/.meridian/CODE_GUIDE_ADDON_TDD.md\``;
    }

    return files;
  }

  /**
   * Read a file safely, returning a placeholder if missing
   */
  function readFileSafe(path: string): string {
    if (existsSync(path)) {
      return readFileSync(path, "utf-8");
    }
    return `(missing: ${path})\n`;
  }

  /**
   * Create the context review flag
   */
  function createContextReviewFlag(): void {
    try {
      writeFileSync(needsContextReviewFlag, "", "utf-8");
    } catch (error) {
      // Ignore errors
    }
  }

  /**
   * Remove the context review flag
   */
  function removeContextReviewFlag(): void {
    try {
      if (existsSync(needsContextReviewFlag)) {
        unlinkSync(needsContextReviewFlag);
      }
    } catch (error) {
      // Ignore errors
    }
  }

  return {
    /**
     * Session initialization hook
     * Loads project context, rules, and tasks into the session
     */
    event: async ({ event }) => {
      // Handle session start (startup or clear)
      if (event.type === "session.start") {
        const { projectType, tddMode } = getProjectConfig();
        const codeGuideFiles = buildCodeGuideFilesList();

        // Load agent operating manual
        const promptPath = join(meridianDir, "prompts", "agent-operating-manual.md");
        const promptContent = readFileSafe(promptPath);

        // Build initialization message
        const initMessage = `${promptContent}
[SYSTEM]:

NEXT STEPS:
1. Read the following files before starting your work:
${codeGuideFiles}
   - \`${directory}/.meridian/memory.jsonl\`
   - \`${directory}/.meridian/task-backlog.yaml\`

2. Read all additional relevant documents listed in \`${directory}/.meridian/relevant-docs.md\`.

3. Review all uncompleted tasks in \`${directory}/.meridian/tasks/\` — you MUST read ALL files within each task folder.

4. Ask the user what they would like to work on.

IMPORTANT:
Claude must always complete all steps listed in this system message before doing anything else. Even if the user sends any message after this system message, Claude must first perform everything described above and only then handle the user's request.
`;

        // Create context review flag
        createContextReviewFlag();

        // Return the initialization context
        console.log("[Meridian] Project environment loaded. Core rules, guides, tasks, and memory are now active.");
        return initMessage;
      }

      // Handle session resume/compact
      if (event.type === "session.resume" || event.type === "session.compact") {
        const codeGuideFiles = buildCodeGuideFilesList();

        const reloadMessage = `This conversation was recently compacted. There are important files and documentation that must always remain in your context. Please read them before continuing your work. These files are:

- \`${directory}/.meridian/prompts/agent-operating-manual.md\`
- \`${directory}/.meridian/memory.jsonl\`
${codeGuideFiles}
- \`${directory}/.meridian/relevant-docs.md\`
- \`${directory}/.meridian/task-backlog.yaml\`

Check \`${directory}/.meridian/task-backlog.yaml\` for any uncompleted tasks. For each uncompleted task, go to the corresponding folder at \`${directory}/.meridian/tasks/TASK-###/\` and read **all** files within that folder.

**Synchronize your current work before proceeding**  
To avoid losing context due to compaction, first persist any changes you made just before the conversation was compacted:

1. Identify the current task.
2. In \`${directory}/.meridian/tasks/TASK-###/\`, update **all three files**:
   - \`TASK-###.yaml\` — ensure \`status\`, \`updated_at\`, acceptance criteria, deliverables, and \`links\` reflect the latest changes.
   - \`TASK-###-plan.md\` — append an **"Amendment <ISO timestamp> — Session reload sync"** section capturing any newly approved steps or adjustments.
   - \`TASK-###-context.md\` — add a timestamped entry summarizing what changed right before compaction. Mark any durable insights with \`MEMORY:\` for later addition via \`memory-curator\`.

After reviewing and synchronizing, also review all files referenced in \`${directory}/.meridian/relevant-docs.md\`. Once you have reviewed everything, you may continue your work.
`;

        // Create context review flag
        createContextReviewFlag();

        console.log("[Meridian] Session restored. Key project files were reloaded.");
        return reloadMessage;
      }

      // Handle session idle/stop
      if (event.type === "session.idle") {
        const stopMessage = `[SYSTEM]: Before stopping, check whether you need to update \`${directory}/.meridian/task-backlog.yaml\`, \`${directory}/.meridian/tasks/TASK-###/{TASK-###.yaml,TASK-###-plan.md,TASK-###-context.md}\` (for the current task), or \`${directory}/.meridian/memory.jsonl\` using the \`memory-curator\` skill, as well as any other documents that should reflect what you accomplished during this session. If nothing significant happened, you may skip the update. If you were working on a task, update the status, session progress and next steps in \`${directory}/.meridian/tasks/TASK-###/TASK-###.yaml\` with details such as: the current implementation step, key decisions made, issues discovered, complex problems solved, and any other important information from this session. Save information that would be difficult to rediscover in future sessions.

If you consider the current work "finished" or close to completion, you MUST ensure the codebase is clean before stopping: run the project's tests, lint, and build commands. If any of these fail, you must fix the issues and rerun them until they pass before stopping. If they already passed recently and no further changes were made, you may state that they are already clean and stop.

If you have nothing to update, your response to this hook must be exactly the same as the message that was blocked. If you did update something, resend the same message you sent before you were interrupted by this hook. Before marking a task as complete, review the 'Definition of Done' section in \`${directory}/.meridian/prompts/agent-operating-manual.md\`.`;

        console.log("[Meridian] Before stopping, Claude is updating task files, backlog, and memory.");
        return stopMessage;
      }
    },

    /**
     * Pre-tool execution hook
     * Blocks tool usage until context review is complete after session reload
     */
    "tool.execute.before": async (input, output) => {
      // Check if context review is needed
      if (existsSync(needsContextReviewFlag)) {
        removeContextReviewFlag();

        throw new Error(
          `[SYSTEM]: You were recently given a system message instructing you to review important files and documentation. This hook exists as a guardrail to ensure you complete that review before performing any tool actions.

If you triggered this hook *while already reviewing that system message* — that's okay. You did everything correctly. We're sorry for the interruption; this guardrail can occasionally activate while you are doing exactly what you should.

Please continue reviewing the files listed in the system message and disregard this warning. The guardrail has now been cleared, and you will not see this warning again during this review cycle.

After you finish reviewing the required files, you may automatically resume your work—no user confirmation is needed.`
        );
      }

      // Plan mode exit reminder
      if (input.tool === "ExitPlanMode") {
        throw new Error(
          `[SYSTEM]: If the user has approved the plan, you must create a task in \`${directory}/.meridian/task-backlog.yaml\` and generate a task brief using the \`task-manager\` skill. Do not create a task if it is only a small change or a bug fix. Before creating any new task brief or adding an entry to task-backlog.yaml, you MUST use the \`task-manager\` skill.`
        );
      }
    },
  };
};
