# Implementation Notes: Agent-Aware Meridian

## What Was Implemented

### 1. Custom `meridian-plan` Agent

**File:** `.opencode/agent/meridian-plan.md`

**Key Features:**
- Tool restrictions: Read-only access (no write/edit/bash)
- Analysis tools: read, grep, glob, list, webfetch, websearch
- Planning tools: todowrite enabled
- Custom system prompt for planning workflow
- Temperature: 0.2 (focused, deterministic)
- Model: claude-sonnet-4

**Purpose:**
Provides a specialized planning mode that prevents premature code changes while allowing thorough analysis and structured planning.

### 2. Agent-Aware Plugin

**File:** `.opencode/plugin/meridian.ts`

**Key Changes:**
1. **Agent tracking** via `chat.message` hook
   - Detects current agent (build, plan, meridian-plan, custom)
   - Logs agent switches for debugging

2. **Conditional behavior** in `tool.execute.before` hook
   - Context review guard: Active in ALL agents
   - Task creation enforcement: ONLY in `meridian-plan` agent
   - Other agents: Full features without restrictions

3. **Universal hooks** remain active across all agents:
   - Session start/resume/compact context loading
   - Session idle/stop cleanup reminders
   - Memory and task tools always available

**Benefits:**
- Meridian features work in ANY agent (build, plan, custom)
- Planning workflow only enforced when user explicitly chooses `meridian-plan`
- No interference with user's preferred workflows
- Flexible and extensible

### 3. Documentation

**New Files:**
- `AGENT_GUIDE.md` - Complete guide to agent system
- `IMPLEMENTATION_NOTES.md` - This file

**Updated Files:**
- `README.md` - Added meridian-plan usage instructions
- Updated directory structure to show `.opencode/agent/`

## Architecture Decisions

### Why Agent-Aware Instead of Mode-Based?

**Original Meridian (Claude Code):**
```json
{
  "permissions": { "defaultMode": "plan" }
}
```
- Forces Plan mode on session start
- Every session begins in planning workflow
- User must exit to Build mode

**OpenCode Version:**
```
- No "defaultMode" support in OpenCode
- Agent system is more flexible
- User chooses when to use planning workflow
```

**Decision:** Create optional `meridian-plan` agent
- Users opt-in to planning workflow
- Doesn't interfere with normal development
- Can create multiple specialized agents

### Why Conditional Hook Instead of Always Enforcing?

**Alternative Approach (Rejected):**
Always enforce task creation when ExitPlanMode is called

**Problem:**
- User uses built-in `plan` agent for quick analysis
- Doesn't want task creation enforcement
- Gets annoying prompts

**Solution Chosen:**
Only enforce when `currentAgent === "meridian-plan"`

**Benefits:**
- `meridian-plan`: Full Meridian planning workflow
- `plan`: Standard OpenCode planning
- `build`: Standard OpenCode implementation
- Custom agents: Full Meridian features, no enforcement

### Why Track Agent in chat.message Hook?

**Available Hooks:**
- ✅ `chat.message`: Has `input.agent` field
- ✅ `chat.params`: Has `input.agent` field
- ❌ `event`: No agent information
- ❌ `tool.execute.before`: No agent information

**Decision:** Use `chat.message` to track agent
- Store in plugin-scoped variable
- Access in `tool.execute.before` hook
- Simple, reliable, works across all tool calls

## Edge Cases Handled

### 1. Agent Tracking Initialization
```typescript
let currentAgent: string = "build";  // Default to build
```
If user never sends a message, assumes build agent.

### 2. Agent Switch Detection
```typescript
if (previousAgent !== currentAgent) {
  console.log(...);  // Only log on change
}
```
Avoids spamming console with repeated agent messages.

### 3. ExitPlanMode in Other Agents
```typescript
if (input.tool === "ExitPlanMode" && currentAgent === "meridian-plan") {
  // Only block in meridian-plan
}
// Falls through for other agents - no restriction
```

### 4. Context Review Guard Universal
```typescript
if (existsSync(needsContextReviewFlag)) {
  // Applies to ALL agents
  removeContextReviewFlag();
  throw new Error(...);
}
```
Critical safety feature - never bypassed.

## Testing Scenarios

### Scenario 1: Using meridian-plan Agent
1. Start OpenCode
2. Switch to `meridian-plan` agent (Tab)
3. Discuss feature planning
4. Agent creates plan with TodoWrite
5. User approves
6. Exit plan mode (Tab)
7. **Expected:** Meridian prompts for task creation
8. Create task
9. Switch to `build` agent
10. Implement

### Scenario 2: Using Standard plan Agent
1. Start OpenCode
2. Switch to `plan` agent (Tab)
3. Quick analysis
4. Exit plan mode (Tab)
5. **Expected:** No task creation prompt
6. Continue working

### Scenario 3: Using build Agent (No Planning)
1. Start OpenCode (defaults to `build`)
2. Make quick fix
3. **Expected:** No restrictions, no prompts
4. Optional: Use `task-manager` manually if needed

### Scenario 4: Session Resume
1. Work in any agent
2. Session gets compacted
3. **Expected:** Context reload in ALL agents
4. Review context before continuing
5. Agent-specific behavior resumes

## Migration from Original Meridian

### What Changed
- ❌ No automatic Plan mode on startup
- ✅ Explicit `meridian-plan` agent
- ✅ All other agents have full Meridian features
- ✅ Task creation enforcement is opt-in

### What Stayed the Same
- ✅ Memory system (`memory-curator`)
- ✅ Task system (`task-manager`)
- ✅ Context preservation on resume/compact
- ✅ Session idle/stop hooks
- ✅ Coding standards enforcement
- ✅ Project configuration (config.yaml)

### User Experience Difference
**Original:** "Meridian forces me into planning mode"
**OpenCode Version:** "I choose when to use Meridian planning"

## Future Enhancements

### Possible Additions

1. **More Specialized Agents:**
   - `meridian-review`: Code review focus
   - `meridian-docs`: Documentation focus
   - `meridian-refactor`: Refactoring focus

2. **Agent-Specific Memory Queries:**
   ```typescript
   if (currentAgent === "meridian-review") {
     // Auto-load security memory entries
   }
   ```

3. **Agent Recommendations:**
   ```typescript
   if (userMessage.includes("plan") && currentAgent !== "meridian-plan") {
     console.log("Tip: Use meridian-plan agent for structured planning");
   }
   ```

4. **Configuration-Based Agent Behavior:**
   ```yaml
   # .meridian/config.yaml
   agents:
     meridian-plan:
       auto_create_tasks: true
       require_approval: true
   ```

## Performance Considerations

### Agent Tracking Overhead
- Minimal: Single variable assignment per message
- No file I/O
- No async operations
- Negligible performance impact

### Hook Execution Order
1. `chat.message` runs on every message → Updates `currentAgent`
2. `tool.execute.before` runs before each tool → Reads `currentAgent`
3. No race conditions (single-threaded event loop)

## Security Considerations

### Tool Restrictions
- Enforced by OpenCode, not plugin
- Agent configuration in `.opencode/agent/meridian-plan.md`
- Cannot be bypassed by plugin code
- User can modify their own agent files (expected)

### Context Review Flag
- Prevents tool usage until context reviewed
- File-based flag (`.meridian/.needs-context-review`)
- Removed on first tool attempt
- Applies to ALL agents (security feature)

## Known Limitations

1. **Cannot force default agent**
   - OpenCode has no `defaultAgent` config
   - User must manually select agent
   - Could add console reminder

2. **Agent detection relies on chat.message**
   - If user never sends message, stays in "build"
   - Acceptable: Session without messages is inactive

3. **No agent-specific memory queries**
   - All agents see same memory entries
   - Future enhancement opportunity

## Comparison with Original Meridian

| Feature | Original (Claude Code) | OpenCode Version |
|---------|------------------------|------------------|
| **Default mode** | Forced Plan mode | User's choice (build) |
| **Planning enforcement** | Always (in Plan mode) | Opt-in (meridian-plan agent) |
| **Memory system** | ✅ Active | ✅ Active (all agents) |
| **Task system** | ✅ Active | ✅ Active (all agents) |
| **Context preservation** | ✅ Active | ✅ Active (all agents) |
| **Tool restrictions** | Via settings.json | Via agent definition |
| **Flexibility** | Limited (2 modes) | High (unlimited agents) |
| **User control** | Must use Plan mode | Choose workflow |

## Conclusion

The OpenCode version of Meridian is **more flexible** than the original while maintaining all core features:

**Retained:**
- Memory management across sessions
- Task scaffolding and tracking
- Context preservation on compaction
- Coding standards enforcement
- Session lifecycle hooks

**Improved:**
- User control over workflow
- Support for custom agents
- No forced planning mode
- Extensible agent system
- Cleaner separation of concerns

**Trade-off:**
- Users must explicitly choose `meridian-plan` agent
- No automatic planning mode on startup
- Requires user awareness of agent system

**Recommendation:**
Document in README and provide clear instructions for when to use `meridian-plan` agent.
