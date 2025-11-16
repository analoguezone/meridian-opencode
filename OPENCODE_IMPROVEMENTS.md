# Meridian for OpenCode - Improvement Opportunities

## Executive Summary

Now that Meridian is working in OpenCode with a fresh session, we can leverage OpenCode-specific features to make it better than the Claude Code version. This document identifies improvements categorized by impact and implementation effort.

## 🔴 Critical Improvements (High Impact, Should Do)

### 1. **Fix Custom Tool Return Value Bug** (OpenCode Bug Report)

**Current Problem:**
- Custom tool return values don't reach the AI
- Causes infinite loops when tools are called
- We worked around this by disabling task-manager in build mode

**Solution:**
- Report bug to OpenCode team with reproduction case
- Once fixed, re-enable task-manager in all agents
- Remove workarounds

**Files to Update:**
- `.opencode/agent/build.md` - Re-enable task-manager
- Remove session state tracking hacks

---

### 2. **Add `tool.execute.after` Hooks for Auditing**

**Current State:**
- We only use `tool.execute.before`
- No visibility into tool execution results
- No audit trail of tool usage

**Improvement:**
Add post-execution hooks to:
- Log all task-manager calls to `.meridian/audit.jsonl`
- Track which agent called which tools when
- Detect failed tool executions
- Auto-update task context when tools modify files

**Implementation:**
```typescript
"tool.execute.after": async (input, output, result) => {
  // Log to audit trail
  const auditEntry = {
    timestamp: new Date().toISOString(),
    agent: currentAgent,
    tool: input.tool,
    args: input.args,
    success: !result.error,
    result: result.error || "success"
  };

  appendFileSync(join(meridianDir, "audit.jsonl"),
    JSON.stringify(auditEntry) + "\n");

  // Auto-update task context for certain tools
  if (input.tool === "task-manager" && !result.error) {
    // Automatically update TASK-###-context.md with timestamp
  }
}
```

**Benefits:**
- Debug issues faster
- Track task progression automatically
- Compliance/audit trail for team workflows

---

### 3. **Session State Persistence**

**Current Problem:**
- `idleMessageInjected` flag resets on plugin reload
- `currentAgent` tracking can get out of sync
- Session resume doesn't restore plugin state

**Solution:**
Store plugin state in `.opencode/.meridian-session-state.json`:

```typescript
interface SessionState {
  lastAgent: string;
  idleMessageInjected: boolean;
  lastContextReview: string; // ISO timestamp
  activeTask: string | null;  // TASK-002
}

// Load on plugin init
const stateFile = join(directory, ".opencode/.meridian-session-state.json");
let sessionState = loadState(stateFile);

// Save on state changes
function saveState() {
  writeFileSync(stateFile, JSON.stringify(sessionState, null, 2));
}
```

**Benefits:**
- Survive OpenCode restarts
- Detect stale sessions
- Better zombie instruction detection

---

### 4. **Smart Context Loading with Compression**

**Current Problem:**
- All context files loaded on every session start
- Large projects = huge context injection
- No prioritization of recent vs old memory

**Solution:**
Implement smart context loading:

```typescript
function buildSmartContext(activeTask?: string) {
  const context = {
    // Always load (critical)
    coreRules: readFileSafe(agentManualPath),
    codeGuide: readFileSafe(codeGuidePath),

    // Conditional (task-specific)
    activeTaskFiles: activeTask ? loadTaskFiles(activeTask) : null,

    // Recent only (last 30 days)
    recentMemory: loadRecentMemory(30),

    // Summary only (older memory)
    memorySummary: summarizeOldMemory()
  };
}
```

**Benefits:**
- Faster session start
- Less token usage
- More relevant context

---

## 🟡 High Value Improvements (Medium Effort)

### 5. **Agent-Specific Tool Descriptions**

**Current Problem:**
- Tool descriptions are the same in all agents
- Confusing when tool is disabled in some agents

**Solution:**
Use OpenCode's tool schema to provide agent-aware descriptions:

```typescript
const taskManagerDescription = currentAgent === "build"
  ? `⚠️ DISABLED in build mode. Use in meridian-plan mode or edit files directly.`
  : `Create OR update development tasks...`;

"task-manager": tool({
  description: taskManagerDescription,
  // ...
})
```

**Benefits:**
- Clear guidance per agent
- Prevent confusion
- Better DX

---

### 6. **Automatic Task Transition Detection**

**Current Problem:**
- Manual task status updates
- Forget to update backlog
- No automatic tracking

**Solution:**
Use tool.execute.after to detect task completions:

```typescript
"tool.execute.after": async (input, output, result) => {
  // Detect tests passing = task might be done
  if (input.tool === "Bash" &&
      input.args.command?.includes("test") &&
      !result.error) {

    // Check if working on a task
    const activeTask = detectActiveTask();
    if (activeTask) {
      // Suggest marking as done
      await client.session.prompt({
        body: {
          noReply: false,
          parts: [{
            type: "text",
            text: `[SYSTEM]: Tests passed! Consider marking ${activeTask} as done if implementation is complete.`
          }]
        }
      });
    }
  }
}
```

**Benefits:**
- Automatic workflow hints
- Catch forgotten updates
- Smoother task flow

---

### 7. **Task Dependency Tracking**

**Current Enhancement:**
Add dependencies to task-backlog.yaml:

```yaml
tasks:
  - id: TASK-003
    title: "Add authentication"
    depends_on: [TASK-001, TASK-002]  # ← NEW
    blocked_by: []                     # ← NEW
    status: todo
```

**Implementation:**
- Update task-manager tool schema
- Add validation: can't start task until deps done
- Show dependency graph in task list

**Benefits:**
- Better project planning
- Prevent out-of-order work
- Visual task dependencies

---

### 8. **Memory Search Tool**

**Current Gap:**
- memory.jsonl grows large
- Hard to find relevant memories
- No search capability

**Solution:**
Add custom `memory-search` tool:

```typescript
"memory-search": tool({
  description: "Search memory.jsonl for relevant past decisions",
  args: {
    query: tool.schema.string().describe("Search query (tags, summary text, or TASK ID)"),
    limit: tool.schema.number().optional().describe("Max results (default 5)")
  },
  async execute(args, ctx) {
    const memories = readMemoryFile();
    const results = memories
      .filter(m => matchesQuery(m, args.query))
      .slice(0, args.limit || 5);

    return formatMemoryResults(results);
  }
})
```

**Benefits:**
- Find past decisions quickly
- Avoid repeating mistakes
- Better knowledge reuse

---

## 🟢 Nice-to-Have Improvements (Polish)

### 9. **Task Templates by Type**

**Current:**
- Single TASK-000-template for all tasks
- Same structure for features, bugs, refactors

**Enhancement:**
Multiple templates:
```
.meridian/tasks/
├── templates/
│   ├── feature/
│   ├── bugfix/
│   ├── refactor/
│   └── spike/
```

**Benefits:**
- Faster task creation
- Better defaults per task type
- Consistent structure

---

### 10. **Interactive Task Selection**

**If OpenCode supports rich UI:**

```typescript
// Show task picker when user says "work on task"
const activeTasks = getActiveTasksFromBacklog();
const taskList = activeTasks.map(t =>
  `- ${t.id}: ${t.title} (${t.status})`
).join("\n");

// Could show as buttons/menu in OpenCode UI
```

**Benefits:**
- Faster context switching
- Visual task list
- Better UX

---

### 11. **Git Integration Hooks**

**Opportunity:**
Track commits per task:

```typescript
// After successful commit
"tool.execute.after": async (input, output, result) => {
  if (input.tool === "Bash" &&
      input.args.command?.includes("git commit")) {

    const activeTask = detectActiveTask();
    if (activeTask) {
      // Auto-update task YAML with commit hash
      const commitHash = extractCommitHash(result);
      updateTaskFile(activeTask, {
        commits: [...existingCommits, commitHash]
      });
    }
  }
}
```

**Benefits:**
- Link commits to tasks
- Track progress automatically
- Better traceability

---

### 12. **Performance Metrics**

**Track:**
- Task completion time
- Planning vs implementation ratio
- Memory growth rate
- Tool usage patterns

**Store in:**
`.meridian/metrics.jsonl`

**Benefits:**
- Improve workflow
- Spot bottlenecks
- Team insights

---

## 🔵 OpenCode-Specific Opportunities

### 13. **Leverage OpenCode's Native Features**

**If OpenCode has:**
- **Workspace API**: Use for multi-repo Meridian
- **UI Elements**: Show task status in sidebar
- **LSP Integration**: Link TASK IDs in code comments
- **Terminal Integration**: Custom task commands
- **File Watchers**: Auto-update context on file changes

**Example:**
```typescript
// If OpenCode supports workspace API
const workspace = await client.workspace.getCurrent();
const allTasks = workspace.projects.flatMap(p =>
  loadTasksFrom(p.path)
);
```

---

### 14. **Multi-Agent Workflows**

**Current:**
- Single agent at a time
- Manual mode switching

**Enhancement:**
Coordinate multiple agents:

```typescript
// Planner creates tasks → Auto-switch to builder
if (currentAgent === "meridian-plan" &&
    taskJustCreated) {
  await client.session.prompt({
    body: {
      agent: "build", // Switch to build agent
      parts: [{
        type: "text",
        text: `Task ${newTaskId} created. Beginning implementation...`
      }]
    }
  });
}
```

---

### 15. **Plugin Composition**

**OpenCode Advantage:**
Can load multiple plugins:

```typescript
// .opencode/plugin/index.ts
export { MeridianPlugin } from "./meridian";
export { MeridianToolsPlugin } from "./tools";
export { MeridianUIPlugin } from "./ui";      // ← NEW
export { MeridianGitPlugin } from "./git";    // ← NEW
```

**Benefits:**
- Modular architecture
- Easy to enable/disable features
- Better maintainability

---

## 📋 Implementation Priority

### Phase 1: Critical Fixes (Week 1)
1. ✅ Fix infinite loop (DONE - workaround in place)
2. Add tool.execute.after hooks
3. Session state persistence
4. Report custom tool bug to OpenCode

### Phase 2: High Value (Week 2-3)
5. Smart context loading
6. Agent-specific tool descriptions
7. Memory search tool
8. Task dependency tracking

### Phase 3: Polish (Week 4+)
9. Task templates by type
10. Git integration hooks
11. Performance metrics
12. Automatic task transitions

### Phase 4: OpenCode-Specific (Future)
13. Investigate OpenCode UI capabilities
14. Multi-agent workflows
15. Plugin composition architecture

---

## OpenCode Advantages Over Claude Code

### 1. **Open Plugin System**
- Can inspect plugin code
- Community can contribute
- Easier debugging

### 2. **TypeScript Ecosystem**
- Rich type safety
- npm package ecosystem
- Better tooling

### 3. **More Flexible Hooks**
- tool.execute.before AND after
- chat.message for agent tracking
- More granular control

### 4. **Custom Tools**
- Full Node.js access
- Can use any npm package
- More powerful than bash scripts

### 5. **Better Error Messages**
- Errors ARE visible (unlike return values)
- Can throw rich error objects
- Better debugging

---

## Recommended Next Steps

1. **Test the current setup thoroughly** in a new session
2. **Implement Phase 1** (tool.execute.after hooks + state persistence)
3. **Document the OpenCode plugin API** limitations we've found
4. **Create example workflows** for common scenarios
5. **Build a test suite** for the plugins

Would you like me to implement any of these improvements?
