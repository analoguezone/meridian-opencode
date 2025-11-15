# Meridian for OpenCode

A sophisticated task planning, memory guidance, and governance system for OpenCode. Meridian provides structured workflows, persistent project memory, and strict coding standards enforcement across AI coding sessions.

## Overview

Meridian addresses critical challenges in AI-assisted development:

- **Context Loss**: AI conversations get compacted, losing critical project knowledge
- **Inconsistency**: Different sessions produce different approaches to similar problems
- **Memory Gaps**: Important architectural decisions and lessons learned disappear
- **Lack of Continuity**: No persistent understanding of project state and ongoing work

## Features

### 🧠 Persistent Memory System
- **JSONL-based memory**: Timestamped architectural decisions and lessons learned
- **Structured entries**: Tagged, searchable, and linked to tasks and files
- **Append-only audit trail**: Never lose historical context

### 📋 Structured Task Management
- **Formal task briefs**: YAML-based task definitions with clear objectives and acceptance criteria
- **Approved plans**: Frozen plans that require re-approval for changes
- **Progress tracking**: Timestamped context logs for each task
- **Task backlog**: Single source of truth for all project tasks

### 📚 Coding Standards Enforcement
- **Baseline guide**: 120 rules for frontend/backend development
- **Project-specific addons**: Hackathon, Production, and TDD modes
- **Dynamic loading**: Rules adapt based on project configuration
- **Immutable rules**: File-based governance prevents accidental changes

### 🔒 Session Continuity
- **Context preservation**: Automatic reload of critical files after compaction
- **Guardrails**: Blocks tool usage until context review is complete
- **Workflow enforcement**: Cannot exit plan mode without creating formal tasks
- **Pre-stop validation**: Ensures project state is updated before session ends

## Installation

1. **Copy the `.meridian` directory** to your project root:
   ```bash
   cp -r .meridian /path/to/your/project/
   ```

2. **Copy the `.opencode` directory** to your project root:
   ```bash
   cp -r .opencode /path/to/your/project/
   ```

3. **Install plugin dependencies**:
   ```bash
   cd /path/to/your/project/.opencode/plugin
   npm install
   # or
   bun install
   ```

4. **Configure your project** by editing `.meridian/config.yaml`:
   ```yaml
   # Project type affects which code guide add-on is loaded:
   # - hackathon   → use CODE_GUIDE_ADDON_HACKATHON.md
   # - standard    → baseline only
   # - production  → use CODE_GUIDE_ADDON_PRODUCTION.md
   project_type: standard

   # Optional: Test-Driven Development mode.
   # When true, inject CODE_GUIDE_ADDON_TDD.md and follow its rules.
   tdd_mode: false
   ```

## Directory Structure

```
.meridian/
├── config.yaml                      # Project configuration
├── memory.jsonl                     # Persistent memory entries
├── task-backlog.yaml               # Task index and status
├── relevant-docs.md                # Additional documentation to review
├── CODE_GUIDE.md                   # Baseline coding standards (120 rules)
├── CODE_GUIDE_ADDON_HACKATHON.md  # Hackathon mode overrides
├── CODE_GUIDE_ADDON_PRODUCTION.md # Production mode enhancements
├── CODE_GUIDE_ADDON_TDD.md        # TDD workflow rules
├── prompts/
│   └── agent-operating-manual.md  # Agent behavior and responsibilities
├── tasks/
│   ├── TASK-000-template/         # Template for new tasks
│   │   ├── TASK-000.yaml
│   │   ├── TASK-000-plan.md
│   │   └── TASK-000-context.md
│   └── TASK-001/                  # Example task
│       ├── TASK-001.yaml
│       ├── TASK-001-plan.md
│       └── TASK-001-context.md
└── docs/                          # Project-specific documentation

.opencode/
├── agent/
│   └── meridian-plan.md         # Meridian Plan agent definition
└── plugin/
    ├── package.json
    ├── tsconfig.json
    ├── meridian.ts               # Main plugin with hooks
    └── tools.ts                  # Custom tools (memory-curator, task-manager)
```

## Usage

### Starting a Session

When you start OpenCode in a project with Meridian:

1. The plugin automatically loads project context
2. OpenCode reads all coding guides, memory, and tasks
3. You're prompted to specify what you'd like to work on

### Using the Meridian Plan Agent (Recommended)

Meridian ships with a specialized **`meridian-plan`** agent for structured planning:

**To switch to Meridian Plan agent:**
```bash
# In OpenCode, cycle through agents with Tab
# Or select "meridian-plan" from the agent menu
```

**In `meridian-plan` agent:**
- ✅ Read and analyze code (read, grep, glob, list)
- ✅ Research documentation (webfetch, websearch)
- ✅ Plan with TodoWrite
- ❌ Cannot modify code (write, edit, bash disabled)
- ✅ Prompts for task creation when exiting
- 🎯 Uses OpenCode's default model (configurable in `.opencode/agent/meridian-plan.md`)

**Workflow:**
1. Switch to `meridian-plan` agent
2. Discuss requirements and analyze codebase
3. OpenCode creates a detailed plan
4. Approve the plan
5. Exit plan mode → Meridian prompts for task creation
6. Switch back to `build` agent for implementation

**Customizing the Agent:**
Edit `.opencode/agent/meridian-plan.md` to override model, temperature, or tools:
```yaml
---
# Uncomment to use specific model instead of default:
# model: claude-sonnet-4
# model: gpt-4o
# model: gemini-2.5-flash

temperature: 0.2  # Adjust between 0.0-1.0
tools:
  # Customize which tools are available
---
```

### Using Standard Plan/Build Agents

You can also use OpenCode's built-in `plan` and `build` agents:

- **`plan` agent**: Planning mode with standard restrictions
- **`build` agent**: Full implementation mode
- **Any custom agent**: Full Meridian features (memory, tasks, context)

**Note:** The task creation reminder only triggers when exiting `meridian-plan` agent. Other agents have full Meridian features without planning workflow enforcement.

### Creating Tasks

Tasks are created using the `task-manager` tool:

1. Plan your work (in `meridian-plan` or any agent)
2. Get user approval for the plan
3. Call `task-manager` tool (or let Meridian prompt you)
4. Meridian scaffolds task files and updates backlog

### Adding Memory Entries

When you make architectural decisions or learn important lessons:

```
Use the memory-curator tool to document this decision:
- Decision: We chose to use Server Components by default
- Problem: Client components were causing unnecessary hydration overhead
- Alternatives: Considered client-only approach (rejected: performance)
- Trade-offs: Slightly more complex data fetching patterns
- Impact/Scope: All new routes in /app/*
- Pattern: Default to Server Components; add "use client" only when needed
```

OpenCode will use the `memory-curator` tool to add a structured entry to `memory.jsonl`.

### Reviewing Memory

Query memory entries using `jq`:

```bash
# All architecture decisions
jq -s '.[] | select(.tags != null and (.tags | index("architecture")))' .meridian/memory.jsonl

# Entries mentioning a task
jq -s '.[] | select(.links != null and (.links | index("TASK-090")))' .meridian/memory.jsonl

# Most recent 5 entries
tail -5 .meridian/memory.jsonl | jq -s '.'

# Security-related
jq -s '.[] | select(.tags != null and (.tags | index("security")))' .meridian/memory.jsonl
```

## Project Modes

### Standard Mode (Default)
- Baseline coding standards only
- Balanced approach for most projects
- 120 rules covering frontend and backend

### Hackathon Mode
- Relaxed standards for rapid prototyping
- Faster iteration, minimal testing
- Security floor still enforced
- Set `project_type: hackathon` in config.yaml

### Production Mode
- Stricter standards for robust systems
- Enhanced security, observability, and resilience
- Comprehensive testing requirements
- Set `project_type: production` in config.yaml

### TDD Mode
- Test-Driven Development workflow enforced
- Red → Green → Refactor cycle
- Can be combined with any project type
- Set `tdd_mode: true` in config.yaml

## Custom Tools

### memory-curator

Adds structured memory entries to `memory.jsonl`.

**When to use:**
- Architectural decisions that affect future features
- Patterns to repeat across the codebase
- Lessons that prevent future mistakes

**Arguments:**
- `summary`: Markdown summary with Decision, Problem, Alternatives, Trade-offs, Impact/Scope, Pattern
- `tags`: Array of kebab-case tags (architecture, security, performance, etc.)
- `links`: Array of TASK IDs, file paths, or URLs

### task-manager

Creates formal task folders with YAML definitions, plans, and context logs.

**When to use:**
- Immediately after user approves a plan
- For any non-trivial code changes

**What it does:**
- Creates `TASK-###` folder from template
- Scaffolds YAML, plan, and context files
- Updates task backlog

## Plugin Hooks

### Session Start
- Loads agent operating manual
- Injects coding guides based on project type
- Prompts to review memory and tasks
- Creates context review flag

### Session Resume/Compact
- Reloads critical project files
- Prompts to synchronize current work
- Ensures no context is lost

### Pre-Tool Execution
- Blocks tools until context review is complete
- Reminds to create tasks when exiting plan mode

### Session Idle/Stop
- Prompts to update task files and memory
- Ensures tests/lint/build pass before stopping
- Prevents incomplete work

## Best Practices

### Memory Management
- Only add entries that pass the triage test (affects future features, repeatable pattern, prevents mistakes)
- Keep summaries concise (6-10 lines)
- Use consistent formatting with bolded labels
- Tag appropriately for easy retrieval

### Task Management
- Create tasks for all non-trivial changes
- Freeze approved plans (amendments require re-approval)
- Update context logs with timestamped progress
- Mark tasks as `done` only when Definition of Done is met

### Coding Standards
- Read the baseline guide first
- Understand which addons are active
- Follow the security floor (never relaxed)
- Document exceptions in task context

## Troubleshooting

### Context Review Flag Persists
If the `.needs-context-review` flag isn't cleared:
```bash
rm .meridian/.needs-context-review
```

### Memory IDs Out of Sequence
The system auto-generates sequential IDs. If they're wrong, check for malformed JSON in `memory.jsonl`.

### Task Creation Fails
Ensure the `TASK-000-template` directory exists with all three files:
- `TASK-000.yaml`
- `TASK-000-plan.md`
- `TASK-000-context.md`

## Migration from Claude Code

If you're migrating from the original Meridian for Claude Code:

1. Copy your existing `.meridian` directory
2. Install the OpenCode plugin
3. Your memory, tasks, and guides are preserved
4. The workflow remains identical

## Contributing

Meridian is designed to be customized for your team's needs:

- Edit coding guides to match your standards
- Modify the agent operating manual for your workflow
- Adjust task templates for your process
- Add project-specific documentation to `.meridian/docs/`

## License

This is a port of the Meridian system for OpenCode. Original concept and design by the Meridian project.

## Support

For issues or questions:
- Check the `.meridian/prompts/agent-operating-manual.md` for agent behavior
- Review the coding guides for standards
- Examine existing memory entries for patterns
- Read task context logs for historical decisions
