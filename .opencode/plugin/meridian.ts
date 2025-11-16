import type { Plugin } from "@opencode-ai/plugin";
import { readFileSync, existsSync, writeFileSync, unlinkSync, appendFileSync } from "fs";
import { join } from "path";
import { subDays, parseISO, isAfter } from "date-fns";

/**
 * Meridian Plugin for OpenCode
 *
 * Provides structured task management, memory curation, and context preservation
 * across sessions. Enforces coding standards and maintains project knowledge.
 *
 * Special Behavior in meridian-plan agent:
 * - Enforces planning workflow restrictions
 * - Prompts for task creation when exiting plan mode
 * - Tool restrictions defined in .opencode/agent/meridian-plan.md
 *
 * Standard Behavior in all other agents (build/plan/custom):
 * - Memory management active (memory-curator tool)
 * - Task management active (task-manager tool)
 * - Context preservation on session reload
 * - Session idle/stop hooks for cleanup
 */
// Session state interface
interface SessionState {
  lastAgent: string;
  idleMessageInjected: boolean;
  lastContextReview: string | null;
  activeTask: string | null;
  sessionStarted: string;
}

export const MeridianPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  const meridianDir = join(directory, ".meridian");
  const configPath = join(meridianDir, "config.yaml");
  const needsContextReviewFlag = join(meridianDir, ".needs-context-review");
  const auditPath = join(meridianDir, "audit.jsonl");
  const sessionStatePath = join(directory, ".opencode", ".meridian-session-state.json");

  /**
   * Load session state from disk
   */
  function loadSessionState(): SessionState {
    if (existsSync(sessionStatePath)) {
      try {
        const content = readFileSync(sessionStatePath, "utf-8");
        return JSON.parse(content);
      } catch (error) {
        // Invalid JSON, use defaults
      }
    }

    // Default state
    return {
      lastAgent: "build",
      idleMessageInjected: false,
      lastContextReview: null,
      activeTask: null,
      sessionStarted: new Date().toISOString()
    };
  }

  /**
   * Save session state to disk
   */
  function saveSessionState(state: SessionState): void {
    try {
      writeFileSync(sessionStatePath, JSON.stringify(state, null, 2), "utf-8");
    } catch (error) {
      // Silently fail if can't save
    }
  }

  // Load or initialize session state
  const sessionState = loadSessionState();

  // Track current agent/mode for conditional behavior
  let currentAgent: string = sessionState.lastAgent;

  // Prevent duplicate idle message injection
  let idleMessageInjected = sessionState.idleMessageInjected;

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

  /**
   * Load and filter memory entries by recency
   * Returns recent (last 30 days) and old memory separately
   */
  function loadSmartMemory(recentDays: number = 30): { recent: any[]; old: any[] } {
    const memoryPath = join(meridianDir, "memory.jsonl");
    const recent: any[] = [];
    const old: any[] = [];

    if (!existsSync(memoryPath)) {
      return { recent, old };
    }

    try {
      const content = readFileSync(memoryPath, "utf-8");
      const lines = content.trim().split("\n").filter(line => line.trim());
      const cutoffDate = subDays(new Date(), recentDays);

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);

          // Parse timestamp from entry
          const entryDate = entry.timestamp ? parseISO(entry.timestamp) : null;

          if (entryDate && isAfter(entryDate, cutoffDate)) {
            recent.push(entry);
          } else {
            old.push(entry);
          }
        } catch (parseError) {
          // Skip invalid JSON lines
        }
      }
    } catch (error) {
      // Return empty arrays on error
    }

    return { recent, old };
  }

  /**
   * Summarize old memory entries into a compact format
   */
  function summarizeOldMemory(oldMemory: any[]): string {
    if (oldMemory.length === 0) {
      return "(No older memory entries)";
    }

    // Group by tags
    const byTag: Record<string, number> = {};
    const keyInsights: string[] = [];

    for (const entry of oldMemory) {
      // Count tags
      if (entry.tags && Array.isArray(entry.tags)) {
        for (const tag of entry.tags) {
          byTag[tag] = (byTag[tag] || 0) + 1;
        }
      }

      // Collect summaries of important entries (those with "architecture" or "decision" tags)
      if (entry.tags?.includes("architecture") || entry.tags?.includes("decision")) {
        keyInsights.push(`- ${entry.summary} (${entry.id || "unknown"})`);
      }
    }

    let summary = `**Older Memory Summary** (${oldMemory.length} entries):\n\n`;

    if (Object.keys(byTag).length > 0) {
      summary += "**Topics covered:**\n";
      const sortedTags = Object.entries(byTag)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10 tags
      for (const [tag, count] of sortedTags) {
        summary += `- ${tag}: ${count} entries\n`;
      }
      summary += "\n";
    }

    if (keyInsights.length > 0) {
      summary += "**Key architectural decisions:**\n";
      summary += keyInsights.slice(0, 5).join("\n"); // Top 5 insights
      if (keyInsights.length > 5) {
        summary += `\n- ... and ${keyInsights.length - 5} more\n`;
      }
    }

    return summary;
  }

  /**
   * Format recent memory entries for context injection
   */
  function formatRecentMemory(recentMemory: any[]): string {
    if (recentMemory.length === 0) {
      return "(No recent memory entries)";
    }

    let formatted = `**Recent Memory** (last 30 days, ${recentMemory.length} entries):\n\n`;

    for (const entry of recentMemory) {
      formatted += `**${entry.id || "MEMORY"}** (${entry.timestamp || "unknown date"}):\n`;
      formatted += `${entry.summary || "(no summary)"}\n`;

      if (entry.tags && entry.tags.length > 0) {
        formatted += `Tags: ${entry.tags.join(", ")}\n`;
      }

      if (entry.links && entry.links.length > 0) {
        formatted += `Links: ${entry.links.join(", ")}\n`;
      }

      formatted += "\n";
    }

    return formatted;
  }

  return {
    /**
     * Track current agent/mode for conditional behavior
     * This allows Meridian to adapt its behavior based on which agent is active
     */
    "chat.message": async (input, output) => {
      if (input.agent) {
        const previousAgent = currentAgent;
        currentAgent = input.agent;

        // Save agent change to session state
        sessionState.lastAgent = currentAgent;
        saveSessionState(sessionState);
      }
    },

    /**
     * Session initialization hook
     * Loads project context, rules, and tasks into the session
     * Active in ALL agents (build, plan, meridian-plan, custom)
     *
     * Uses client.session.prompt() with noReply: true to inject messages without triggering AI response
     */
    event: async ({ event }) => {
      // Handle session created (startup)
      if (event.type === "session.created") {
        const sessionID = event.properties.info.id;
        const { projectType, tddMode } = getProjectConfig();
        const codeGuideFiles = buildCodeGuideFilesList();

        // Load agent operating manual
        const promptPath = join(meridianDir, "prompts", "agent-operating-manual.md");
        const promptContent = readFileSafe(promptPath);

        // Load smart memory (recent vs old)
        const { recent: recentMemory, old: oldMemory } = loadSmartMemory(30);
        const recentMemoryText = formatRecentMemory(recentMemory);
        const oldMemorySummary = summarizeOldMemory(oldMemory);

        // Build initialization message with smart context loading
        const initMessage = `${promptContent}
[SYSTEM]:

**PROJECT MEMORY:**

${recentMemoryText}

${oldMemorySummary}

---

NEXT STEPS:
1. Read the following files before starting your work:
${codeGuideFiles}
   - \`${directory}/.meridian/task-backlog.yaml\`

2. Read all additional relevant documents listed in \`${directory}/.meridian/relevant-docs.md\`.

3. Review all uncompleted tasks in \`${directory}/.meridian/tasks/\` — you MUST read ALL files within each task folder.

4. Ask the user what they would like to work on.

IMPORTANT:
Claude must always complete all steps listed in this system message before doing anything else. Even if the user sends any message after this system message, Claude must first perform everything described above and only then handle the user's request.
`;

        // Create context review flag
        createContextReviewFlag();

        // Inject initialization message into session
        try {
          await client.session.prompt({
            path: { id: sessionID },
            body: {
              noReply: true,
              parts: [{ type: "text", text: initMessage }],
            },
          });
        } catch (error) {
          // Silently fail - message injection is optional
        }
      }

      // Handle session compacted (context reload)
      if (event.type === "session.compacted") {
        const sessionID = event.properties.sessionID;
        const codeGuideFiles = buildCodeGuideFilesList();

        // Load smart memory (recent vs old)
        const { recent: recentMemory, old: oldMemory } = loadSmartMemory(30);
        const recentMemoryText = formatRecentMemory(recentMemory);
        const oldMemorySummary = summarizeOldMemory(oldMemory);

        const reloadMessage = `This conversation was recently compacted. There are important files and documentation that must always remain in your context.

**PROJECT MEMORY:**

${recentMemoryText}

${oldMemorySummary}

---

**Files to read before continuing:**
- \`${directory}/.meridian/prompts/agent-operating-manual.md\`
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

        // Inject reload message into session
        try {
          await client.session.prompt({
            path: { id: sessionID },
            body: {
              noReply: true,
              parts: [{ type: "text", text: reloadMessage }],
            },
          });
        } catch (error) {
          // Silently fail - message injection is optional
        }
      }

      // Handle session idle/stop
      if (event.type === "session.idle") {
        // Guard against duplicate idle messages
        if (idleMessageInjected) {
          return;
        }
        idleMessageInjected = true;

        // Save state
        sessionState.idleMessageInjected = true;
        saveSessionState(sessionState);

        const sessionID = event.properties.sessionID;

        const stopMessage = `[SYSTEM]: Before stopping, check whether you need to update task files or memory based on what you accomplished during this session:

**Task File Updates (if you were working on a task):**
- Update \`${directory}/.meridian/tasks/TASK-###/TASK-###.yaml\` with: current implementation step, key decisions made, issues discovered, complex problems solved, and next steps
- Update \`${directory}/.meridian/tasks/TASK-###/TASK-###-context.md\` with session notes

**Memory Documentation (if you made significant architectural decisions):**
- Use \`memory-curator\` tool to document important patterns, decisions, or lessons learned

**Code Quality (if you consider the work finished):**
- Run the project's tests, lint, and build commands
- Fix any failures before marking the task as complete
- Review 'Definition of Done' in \`${directory}/.meridian/prompts/agent-operating-manual.md\`

**If nothing significant happened:** Skip the updates and respond with the same message that was blocked.

**If you did update something:** Resend the same message you sent before this hook interrupted you.`;

        // Inject idle/stop reminder into session
        // Note: noReply is FALSE here because we want Claude to respond and take action
        try {
          await client.session.prompt({
            path: { id: sessionID },
            body: {
              noReply: false, // Claude should respond and update tasks/memory
              parts: [{ type: "text", text: stopMessage }],
            },
          });
        } catch (error) {
          // Silently fail - message injection is optional
        }
      }
    },

    /**
     * Pre-tool execution hook
     *
     * Behavior varies by agent:
     * - ALL agents: Context review guard (blocks tools until context is reviewed)
     * - meridian-plan agent ONLY: Enforces task creation workflow when exiting plan mode
     * - Other agents: No special restrictions
     */
    "tool.execute.before": async (input, output) => {
      // Check if context review is needed (applies to ALL agents)
      if (existsSync(needsContextReviewFlag)) {
        removeContextReviewFlag();

        throw new Error(
          `[SYSTEM]: You were recently given a system message instructing you to review important files and documentation. This hook exists as a guardrail to ensure you complete that review before performing any tool actions.

If you triggered this hook *while already reviewing that system message* — that's okay. You did everything correctly. We're sorry for the interruption; this guardrail can occasionally activate while you are doing exactly what you should.

Please continue reviewing the files listed in the system message and disregard this warning. The guardrail has now been cleared, and you will not see this warning again during this review cycle.

After you finish reviewing the required files, you may automatically resume your work—no user confirmation is needed.`
        );
      }

      // Meridian Plan mode exit reminder (ONLY when in meridian-plan agent)
      if (input.tool === "ExitPlanMode" && currentAgent === "meridian-plan") {
        throw new Error(
          `[SYSTEM]: You are exiting Meridian Plan mode. If the user has approved the plan, you should create a formal task using the \`task-manager\` tool:

task-manager({
  taskBrief: "YAML content with objective, scope, acceptance criteria, deliverables, etc.",
  planContent: "Your detailed implementation plan (markdown)",
  contextContent: "Initial context notes explaining key decisions (markdown)",
  backlogEntry: "Brief one-line summary for the backlog"
})

Do NOT create a task if this was only a small change, bug fix, or exploratory discussion. Only create tasks for non-trivial planned work that requires formal tracking.

After creating the task (or if no task is needed), you may proceed to build mode for implementation.`
        );
      }

      // For all other agents (build, plan, custom): No ExitPlanMode restrictions
      // Memory, tasks, and context features remain fully active
    },

    /**
     * Post-tool execution hook
     * Logs all tool executions to audit trail
     * Detects task transitions and updates session state
     */
    "tool.execute.after": async (input: { tool: string; sessionID: string; callID: string }, output: { title: string; output: string; metadata: any }) => {
      const timestamp = new Date().toISOString();

      // Determine success from output (no error in output typically means success)
      const hasError = output.output?.includes("Error") || output.output?.includes("❌");

      // Create audit entry
      const auditEntry = {
        timestamp,
        agent: currentAgent,
        tool: input.tool,
        success: !hasError,
        output: output.output?.substring(0, 200) // First 200 chars
      };

      // Append to audit log
      try {
        appendFileSync(auditPath, JSON.stringify(auditEntry) + "\n", "utf-8");
      } catch (error) {
        // Silently fail if can't write audit log
      }

      // Detect active task from task-manager calls
      if (input.tool === "task-manager" && !hasError) {
        // Try to extract taskId from output
        const taskIdMatch = output.output?.match(/TASK-\d+/);
        if (taskIdMatch) {
          sessionState.activeTask = taskIdMatch[0];
          sessionState.lastContextReview = timestamp;
          saveSessionState(sessionState);
        }
      }

      // Detect test completion - could suggest task update
      if (input.tool === "Bash" &&
          output.output?.includes("test") &&
          !hasError &&
          sessionState.activeTask) {
        // Tests passed - this could mean task is ready to complete
        // Note: We don't auto-inject here to avoid infinite loops
        // The session.idle hook will prompt for updates
      }
    },
  };
};
