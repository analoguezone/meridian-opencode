# Migrating from Meridian for Claude Code to OpenCode

This guide helps you migrate your existing Meridian setup from Claude Code to OpenCode.

## Overview

The OpenCode version of Meridian preserves **100% of your data and workflow**:

- ✅ All `.meridian/` files are compatible (no changes needed)
- ✅ Memory entries (`memory.jsonl`) work identically
- ✅ Task structure and backlog are unchanged
- ✅ Coding guides are carbon copies
- ✅ Workflow and commands are the same

**What changes:**
- Python hooks → TypeScript plugins
- Bash scripts → OpenCode custom tools
- Claude-specific hooks → OpenCode event system

## Migration Steps

### 1. Backup Your Current Setup

```bash
# Backup your existing Meridian data
cd /path/to/your/claude-project
tar -czf meridian-backup-$(date +%Y%m%d).tar.gz .meridian .claude
```

### 2. Copy Your Data

```bash
# Copy your existing .meridian directory
cp -r /path/to/your/claude-project/.meridian /path/to/your/opencode-project/

# Your data is now preserved:
# - memory.jsonl (all entries intact)
# - task-backlog.yaml (all tasks intact)
# - tasks/ (all task folders intact)
# - All coding guides (unchanged)
```

### 3. Install OpenCode Plugin

```bash
# Copy the OpenCode plugin
cd /path/to/your/opencode-project
cp -r /path/to/meridian-opencode/.opencode ./

# Install dependencies
cd .opencode/plugin
npm install
# or: bun install
```

### 4. Verify Configuration

Check your config is valid:

```bash
cat .meridian/config.yaml
```

Should look like:

```yaml
project_type: standard  # or hackathon, production
tdd_mode: false         # or true
```

### 5. Test the Migration

Start OpenCode:

```bash
cd /path/to/your/opencode-project
opencode
```

You should see:
```
[Meridian] Project environment loaded. Core rules, guides, tasks, and memory are now active.
```

Verify OpenCode reads your existing data:
- Memory entries
- Task backlog
- Coding guides
- Task folders

## Feature Comparison

### What Works Exactly the Same

| Feature | Claude Code | OpenCode | Notes |
|---------|-------------|----------|-------|
| Memory entries | ✅ | ✅ | Same JSONL format |
| Task structure | ✅ | ✅ | Same YAML/MD files |
| Coding guides | ✅ | ✅ | Carbon copy |
| Task backlog | ✅ | ✅ | Same YAML format |
| Project modes | ✅ | ✅ | Same config |
| TDD mode | ✅ | ✅ | Same workflow |

### What's Different (Implementation Only)

| Feature | Claude Code | OpenCode |
|---------|-------------|----------|
| Hooks | Python scripts | TypeScript plugins |
| Tools | Bash + Python | TypeScript custom tools |
| Session events | Claude hooks | OpenCode event system |
| Context loading | File reads in Python | File reads in TypeScript |

### Hook Mapping

| Claude Code Hook | OpenCode Equivalent |
|------------------|---------------------|
| `SessionStart` (startup/clear) | `event.type === "session.start"` |
| `SessionStart` (compact/resume) | `event.type === "session.resume"` or `"session.compact"` |
| `Stop` | `event.type === "session.idle"` |
| `PreToolUse` | `tool.execute.before` |
| `PostToolUse` (ExitPlanMode) | `tool.execute.before` with `input.tool === "ExitPlanMode"` |

### Tool Mapping

| Claude Code | OpenCode |
|-------------|----------|
| `add_memory_entry.py` | `memory-curator` custom tool |
| `create-task.py` | `task-manager` custom tool |

## Data Compatibility

### Memory Entries

**Format is identical:**

```json
{"id":"mem-0001","timestamp":"2025-11-12T05:55:31Z","summary":"**Decision:** ...","tags":["architecture"],"links":["TASK-001"]}
```

**No migration needed** - your existing `memory.jsonl` works as-is.

### Task Files

**Structure is identical:**

```
.meridian/tasks/TASK-001/
├── TASK-001.yaml
├── TASK-001-plan.md
└── TASK-001-context.md
```

**No migration needed** - all task folders work as-is.

### Task Backlog

**Format is identical:**

```yaml
tasks:
  - id: TASK-001
    title: "Example task"
    priority: P1
    status: in_progress
    path: ".meridian/tasks/TASK-001/"
```

**No migration needed** - your backlog works as-is.

### Coding Guides

**Content is identical** - all guides are carbon copies:

- `CODE_GUIDE.md` (120 rules)
- `CODE_GUIDE_ADDON_HACKATHON.md`
- `CODE_GUIDE_ADDON_PRODUCTION.md`
- `CODE_GUIDE_ADDON_TDD.md`

**No migration needed** - guides work as-is.

## Workflow Comparison

### Creating Tasks

**Claude Code:**
```
1. Discuss plan in Plan Mode
2. Get approval
3. Claude runs: python3 .claude/skills/task-manager/scripts/create-task.py
4. Claude populates files
5. Claude updates backlog
```

**OpenCode:**
```
1. Discuss plan in Plan Mode
2. Get approval
3. OpenCode uses: task-manager custom tool
4. OpenCode populates files
5. OpenCode updates backlog
```

**Result:** Identical task structure and workflow.

### Adding Memory

**Claude Code:**
```bash
python3 .claude/skills/memory-curator/scripts/add_memory_entry.py \
  --summary "..." \
  --tags architecture,api \
  --links TASK-001
```

**OpenCode:**
```
Use the memory-curator tool with:
- summary: "..."
- tags: ["architecture", "api"]
- links: ["TASK-001"]
```

**Result:** Identical memory entries.

### Session Lifecycle

**Claude Code:**
1. `claude-init.py` runs on startup
2. Loads context from files
3. Creates `.needs-context-review` flag
4. `post-compact-guard.py` blocks tools until review
5. `pre-stop-update.py` prompts before stopping

**OpenCode:**
1. `MeridianPlugin` event handler runs on session.start
2. Loads context from files
3. Creates `.needs-context-review` flag
4. `tool.execute.before` blocks tools until review
5. `event.type === "session.idle"` prompts before stopping

**Result:** Identical behavior and guarantees.

## Customization Migration

### If You Modified Python Hooks

**Claude Code:**
```python
# .claude/hooks/claude-init.py
def main():
    # Your custom logic
    pass
```

**OpenCode:**
```typescript
// .opencode/plugin/meridian.ts
export const MeridianPlugin: Plugin = async ({ ... }) => {
  return {
    event: async ({ event }) => {
      if (event.type === "session.start") {
        // Your custom logic
      }
    },
  };
};
```

### If You Modified Skills

**Claude Code:**
```python
# .claude/skills/memory-curator/scripts/add_memory_entry.py
def append_entry(path, summary, tags, links):
    # Your custom logic
    pass
```

**OpenCode:**
```typescript
// .opencode/plugin/tools.ts
"memory-curator": tool({
  async execute(args, ctx) {
    // Your custom logic
  },
}),
```

### If You Modified Guides

**No changes needed** - edit the same files:

```bash
.meridian/CODE_GUIDE.md
.meridian/CODE_GUIDE_ADDON_HACKATHON.md
.meridian/CODE_GUIDE_ADDON_PRODUCTION.md
.meridian/CODE_GUIDE_ADDON_TDD.md
.meridian/prompts/agent-operating-manual.md
```

## Troubleshooting Migration

### Memory IDs Don't Continue

If your last memory entry was `mem-0042` and OpenCode creates `mem-0001`:

**Cause:** The ID detection logic couldn't read the last line.

**Fix:**
```bash
# Check the last line is valid JSON
tail -1 .meridian/memory.jsonl | jq .

# If invalid, manually fix or remove the last line
# The next entry will use the correct ID
```

### Tasks Not Found

If OpenCode doesn't see your tasks:

**Cause:** Task folder naming or backlog format issue.

**Fix:**
```bash
# Verify task folders match backlog
ls -la .meridian/tasks/

# Verify backlog format
cat .meridian/task-backlog.yaml

# Ensure IDs match exactly (case-sensitive)
```

### Context Not Loading

If OpenCode doesn't load your guides:

**Cause:** File paths or config issue.

**Fix:**
```bash
# Verify all files exist
ls -la .meridian/CODE_GUIDE.md
ls -la .meridian/prompts/agent-operating-manual.md
ls -la .meridian/config.yaml

# Check config is valid YAML
cat .meridian/config.yaml
```

### Plugin Not Running

If you don't see the Meridian startup message:

**Cause:** Plugin not loaded or dependencies missing.

**Fix:**
```bash
# Verify plugin files exist
ls -la .opencode/plugin/meridian.ts
ls -la .opencode/plugin/tools.ts

# Install dependencies
cd .opencode/plugin
npm install

# Check for TypeScript errors
npx tsc --noEmit
```

## Rollback Plan

If you need to go back to Claude Code:

```bash
# Your original .meridian data is unchanged
# Just switch back to Claude Code

# Restore from backup if needed
cd /path/to/your/claude-project
tar -xzf meridian-backup-YYYYMMDD.tar.gz
```

## Benefits of OpenCode Version

### Performance
- TypeScript is faster than Python for file operations
- Native async/await for better concurrency
- Compiled code vs interpreted scripts

### Type Safety
- Full TypeScript type checking
- Catch errors at development time
- Better IDE support

### Integration
- Native OpenCode plugin system
- Better tool integration
- Consistent with OpenCode ecosystem

### Maintainability
- Single language (TypeScript) for all logic
- Modern async patterns
- Better error handling

## Next Steps

After migration:

1. ✅ Verify all memory entries are accessible
2. ✅ Check all tasks are visible
3. ✅ Test creating a new task
4. ✅ Test adding a memory entry
5. ✅ Customize guides if needed
6. ✅ Update team documentation

## Support

For migration issues:
- Check this migration guide
- Review INSTALL.md for setup details
- Examine the main README.md
- Compare your `.meridian` structure with the template

## Feedback

If you encounter migration issues not covered here, please document them so we can improve this guide.
