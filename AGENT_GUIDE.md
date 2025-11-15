# Meridian Agent System for OpenCode

## Overview

Meridian for OpenCode provides **agent-aware behavior** that adapts based on which OpenCode agent is active. This allows you to use different planning and implementation workflows while maintaining consistent project memory, tasks, and coding standards.

## Agents Explained

In OpenCode, **agents** are different operational modes with:
- Distinct system prompts
- Different tool availability
- Custom temperature settings
- Specialized behavior

Agents replace the deprecated `mode` concept in OpenCode.

## Shipped Agents

### `meridian-plan` Agent (Recommended for Planning)

**Location:** `.opencode/agent/meridian-plan.md`

**Purpose:** Structured planning with tool restrictions to prevent premature implementation.

**Model Configuration:**
- **Default:** Uses OpenCode's configured default model
- **Override:** Uncomment `model:` in the agent file to use a specific model
- **Examples:** `claude-sonnet-4`, `gpt-4o`, `gemini-2.5-flash`, `o1`, etc.

**Tool Configuration:**
```yaml
# Enabled - Analysis only
read: true       # Read files
grep: true       # Search code
glob: true       # Find files
list: true       # List directories
todowrite: true  # Structure plans
webfetch: true   # Research docs
websearch: true  # Search online

# Disabled - No modifications
write: false     # Cannot create files
edit: false      # Cannot modify code
bash: false      # Cannot run commands
patch: false     # Cannot patch files
```

**Behavior:**
- ✅ Analyzes codebase thoroughly
- ✅ Creates structured plans with TodoWrite
- ✅ Reviews memory, tasks, and coding guides
- ✅ Asks clarifying questions
- ✅ Enforces task creation on exit (via plugin hook)
- ❌ Cannot modify code or run commands

**When to Use:**
- Planning new features
- Analyzing complex problems
- Reviewing architecture decisions
- Creating task briefs

**Switching:**
```bash
# Press Tab in OpenCode to cycle agents
# Or use agent menu to select "meridian-plan"
```

## Standard OpenCode Agents

### `build` Agent (Default)

**Tool Configuration:** All tools enabled

**Meridian Behavior:**
- ✅ Full memory-curator access
- ✅ Full task-manager access
- ✅ Context preservation hooks
- ✅ Session idle/stop reminders
- ❌ No automatic task creation prompts

**When to Use:**
- Active development
- Implementing approved plans
- Bug fixes
- Refactoring

### `plan` Agent (Built-in)

**Tool Configuration:** OpenCode's default restrictions (write/edit/bash disabled)

**Meridian Behavior:**
- ✅ Full memory-curator access
- ✅ Full task-manager access
- ✅ Context preservation hooks
- ✅ Session idle/stop reminders
- ❌ No automatic task creation prompts

**When to Use:**
- General planning (without Meridian-specific workflow)
- Quick analysis
- Exploratory work

## Creating Custom Agents

You can create your own agents with custom Meridian behavior:

### Example: `meridian-review` Agent

**File:** `.opencode/agent/meridian-review.md`

```markdown
---
# model: <optional - uses OpenCode default>
# Uncomment to override with specific model:
# model: claude-sonnet-4
# model: gpt-4o

temperature: 0.1
tools:
  write: false
  edit: false
  bash: false
  read: true
  grep: true
  glob: true
---

# Meridian Review Agent

You are in code review mode. Analyze code for:
- Security vulnerabilities
- Performance issues
- Code quality standards (see .meridian/CODE_GUIDE.md)
- Architectural consistency (see .meridian/memory.jsonl)

Provide constructive feedback with references to:
- Coding standards violations
- Past architectural decisions
- Similar patterns in the codebase

Do NOT modify code. Only provide review comments.
```

**All custom agents** get standard Meridian features:
- Memory management
- Task tracking
- Context preservation
- Session hooks

## Agent Detection in Plugin

The Meridian plugin tracks which agent is active using the `chat.message` hook:

```typescript
"chat.message": async (input, output) => {
  if (input.agent) {
    currentAgent = input.agent;  // "build", "plan", "meridian-plan", etc.
  }
},
```

**Conditional Behavior:**
```typescript
// Only enforce task creation in meridian-plan agent
if (input.tool === "ExitPlanMode" && currentAgent === "meridian-plan") {
  throw new Error("Create formal task before exiting...");
}

// All other agents: No restrictions
// But memory, tasks, context features still active
```

## Workflow Examples

### Feature Development Workflow

```
1. Start in `build` agent
2. User: "I want to add authentication"
3. Switch to `meridian-plan` agent (Tab key)
4. OpenCode: Analyzes requirements, reads relevant code
5. OpenCode: Creates plan with TodoWrite
6. User: Approves plan
7. Exit plan mode (Tab key)
8. Meridian plugin: Prompts for task creation
9. OpenCode: Creates TASK-042 folder with plan
10. Switch to `build` agent
11. OpenCode: Implements from plan
12. OpenCode: Updates task context and memory
```

### Bug Fix Workflow (No Planning Needed)

```
1. Stay in `build` agent
2. User: "Fix the login button styling"
3. OpenCode: Makes fix directly
4. OpenCode: Creates task if non-trivial (optional)
5. OpenCode: Updates memory if architectural lesson learned
```

### Research Workflow

```
1. Switch to `meridian-plan` agent
2. User: "How should we implement rate limiting?"
3. OpenCode: Searches codebase, reviews memory
4. OpenCode: Researches best practices (webfetch)
5. OpenCode: Presents options with tradeoffs
6. User: "Let's discuss further" (no task created)
7. Switch back to `build` agent
```

## Best Practices

### When to Use `meridian-plan`

✅ **Use meridian-plan for:**
- New feature planning
- Complex architectural changes
- Multi-step refactoring
- Cross-cutting concerns
- When you want enforced task creation

❌ **Don't use meridian-plan for:**
- Simple bug fixes
- Obvious changes
- Exploratory code reading
- Quick questions

### Agent Switching Tips

1. **Don't stay in meridian-plan too long** - Switch to `build` to implement
2. **Use Tab to cycle** - Fastest way to switch agents
3. **Create custom agents** - For specialized workflows (review, docs, etc.)
4. **Check agent indicator** - Bottom-right corner shows current agent

## Troubleshooting

### "Cannot write files" in meridian-plan

**Expected behavior** - meridian-plan disables write tools by design.

**Solution:** Switch to `build` agent to implement.

### Task creation prompt every time I exit plan mode

**Only happens in `meridian-plan` agent** - Other agents don't have this restriction.

**Solution:**
- Use standard `plan` agent if you don't want the prompt
- Or create a custom agent without the restriction

### Memory/Task tools not working

**Check:** All agents should have memory-curator and task-manager tools.

**Solution:** Verify `.opencode/plugin/tools.ts` is loaded correctly.

## Configuring Models per Agent

Each agent can use a different model. Edit the agent file frontmatter:

```yaml
---
# Use fast model for planning
model: gemini-2.5-flash
temperature: 0.3

# Or use reasoning model for complex analysis
# model: o1
# temperature: 0.2

# Or use default OpenCode model (omit model field)
---
```

**Available Models:**
Any model configured in your OpenCode installation, such as:
- `claude-sonnet-4`, `claude-opus-4`
- `gpt-4o`, `gpt-4.1`, `o1`, `o3-mini`
- `gemini-2.5`, `gemini-2.5-flash`
- Custom OpenRouter/Azure endpoints

**Pro Tip:** Use faster/cheaper models for planning agents, reserve expensive models for implementation.

## Advanced: Agent-Specific Prompts

You can inject agent-specific context in the plugin:

```typescript
"chat.message": async (input, output) => {
  if (input.agent === "meridian-plan") {
    // Inject additional planning guidance
    await client.session.prompt({
      path: { id: input.sessionID },
      body: {
        parts: [{ type: "text", text: "Review .meridian/memory.jsonl for patterns..." }],
        noReply: true
      }
    });
  }
}
```

## Summary

- **`meridian-plan`**: Structured planning with enforced workflow
- **`build`**: Full implementation with Meridian features
- **`plan`**: Standard planning without Meridian enforcement
- **Custom agents**: Your own workflows with Meridian features

All agents get:
- Memory management ✓
- Task tracking ✓
- Context preservation ✓
- Coding standards ✓

Only `meridian-plan` enforces:
- Tool restrictions ✓
- Task creation on exit ✓
