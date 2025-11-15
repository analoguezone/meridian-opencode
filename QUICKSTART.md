# Meridian for OpenCode - Quick Start Guide

Get up and running with Meridian in 5 minutes.

## 1. Install (2 minutes)

```bash
# Navigate to your project
cd /path/to/your/project

# Copy Meridian files
cp -r /path/to/meridian-opencode/.meridian ./
cp -r /path/to/meridian-opencode/.opencode ./

# Install plugin dependencies
cd .opencode/plugin && npm install && cd ../..
```

## 2. Configure (1 minute)

Edit `.meridian/config.yaml`:

```yaml
project_type: standard  # Options: standard, hackathon, production
tdd_mode: false         # Set to true for TDD workflow
```

## 3. Start OpenCode (1 minute)

```bash
opencode
```

You should see:
```
[Meridian] Project environment loaded. Core rules, guides, tasks, and memory are now active.
```

OpenCode will automatically:
- Read coding guides (120 baseline rules + any addons)
- Load memory entries
- Review task backlog
- Ask what you'd like to work on

## 4. Create Your First Task (1 minute)

**In OpenCode:**

```
I'd like to add user authentication to the app
```

**OpenCode will:**
1. Discuss the approach
2. Create a plan
3. Ask for approval

**You:**
```
Sounds good, let's do it
```

**OpenCode will:**
1. Use the `task-manager` tool
2. Create `TASK-001` folder
3. Generate task files
4. Update backlog
5. Start implementation

## 5. Add Your First Memory Entry (30 seconds)

**During implementation, when OpenCode makes an architectural decision:**

```
Document this decision using memory-curator:
We chose JWT tokens over sessions because we need stateless auth for our microservices architecture
```

**OpenCode will:**
1. Use the `memory-curator` tool
2. Add entry to `memory.jsonl`
3. Tag appropriately
4. Link to the current task

## That's It!

You're now using Meridian. Here's what happens automatically:

### Every Session Start
- ✅ Loads coding guides
- ✅ Reads memory entries
- ✅ Reviews tasks
- ✅ Ensures context continuity

### During Work
- ✅ Enforces coding standards
- ✅ Creates structured tasks
- ✅ Documents decisions
- ✅ Tracks progress

### Before Stopping
- ✅ Updates task status
- ✅ Saves progress notes
- ✅ Runs tests/lint/build
- ✅ Ensures clean state

## Common Workflows

### Planning a Feature

```
You: I want to add a shopping cart feature

OpenCode: [Creates plan with steps, acceptance criteria, risks]

You: Looks good, go ahead

OpenCode: [Uses task-manager to create TASK-002]
OpenCode: [Implements the feature]
OpenCode: [Updates task context with progress]
```

### Fixing a Bug

```
You: There's a bug in the checkout flow - users can't apply discount codes

OpenCode: [Investigates the issue]
OpenCode: [Creates a plan to fix it]

You: Approved

OpenCode: [Uses task-manager to create TASK-003]
OpenCode: [Writes failing test first if TDD mode enabled]
OpenCode: [Fixes the bug]
OpenCode: [Updates task and marks as done]
```

### Documenting a Decision

```
You: We need to decide between REST and GraphQL for our API

OpenCode: [Discusses trade-offs]

You: Let's go with GraphQL

OpenCode: [Uses memory-curator to document]
Entry: mem-0005
Decision: Use GraphQL for API layer
Problem: Need flexible querying for complex UI requirements
Alternatives: REST (rejected: too many endpoints), gRPC (rejected: browser support)
Trade-offs: More complex setup, but better DX and performance
Impact/Scope: All API routes in /api/graphql
Pattern: Use Apollo Server with code-first schema
```

### Reviewing Memory

```bash
# See all architectural decisions
jq -s '.[] | select(.tags | index("architecture"))' .meridian/memory.jsonl

# See decisions for a specific task
jq -s '.[] | select(.links | index("TASK-002"))' .meridian/memory.jsonl

# See recent entries
tail -5 .meridian/memory.jsonl | jq -s '.'
```

### Checking Task Status

```bash
# View backlog
cat .meridian/task-backlog.yaml

# Read a specific task
cat .meridian/tasks/TASK-001/TASK-001.yaml
cat .meridian/tasks/TASK-001/TASK-001-plan.md
cat .meridian/tasks/TASK-001/TASK-001-context.md
```

## Project Modes Explained

### Standard Mode (Default)
**Best for:** Most projects

```yaml
project_type: standard
```

- 120 baseline rules
- Balanced approach
- Structured workflow
- No extra constraints

### Hackathon Mode
**Best for:** Rapid prototyping, MVPs

```yaml
project_type: hackathon
```

- Relaxed standards
- Faster iteration
- Minimal testing
- Security still enforced

**Example relaxations:**
- Flat structure OK
- Client-side fetching allowed
- Larger components acceptable
- Skip dark mode/theming
- One E2E test sufficient

### Production Mode
**Best for:** Production systems

```yaml
project_type: production
```

- Stricter standards
- Enhanced security
- Comprehensive testing
- Full observability

**Example requirements:**
- Design system mandatory
- Strict TypeScript config
- Rate limiting required
- Idempotency keys for mutations
- OpenTelemetry traces

### TDD Mode
**Best for:** Test-driven development

```yaml
tdd_mode: true
```

- Red → Green → Refactor
- Tests before code
- Works with any project type

**Workflow:**
1. Write failing test
2. Implement minimal code to pass
3. Refactor while keeping tests green

## Tips for Success

### 1. Trust the System
- Let OpenCode create tasks
- Let OpenCode document decisions
- Review but don't micromanage

### 2. Keep Memory Focused
Only add entries that:
- Affect future features
- Define repeatable patterns
- Prevent future mistakes

### 3. Update Task Context
Add timestamped notes for:
- Key decisions
- Blockers encountered
- Links to PRs/commits
- Lessons learned

### 4. Review Before Stopping
OpenCode will prompt you to:
- Update task status
- Save progress notes
- Run tests/lint/build
- Document decisions

### 5. Customize for Your Team
Edit these files to match your standards:
- `.meridian/CODE_GUIDE.md`
- `.meridian/prompts/agent-operating-manual.md`
- `.meridian/tasks/TASK-000-template/`

## Troubleshooting

### "Plugin not loaded"
```bash
cd .opencode/plugin
npm install
```

### "Context not loading"
```bash
# Verify files exist
ls -la .meridian/CODE_GUIDE.md
ls -la .meridian/config.yaml
```

### "Tools not available"
```bash
# Check plugin exports
grep "export const" .opencode/plugin/*.ts
```

### "Memory IDs wrong"
```bash
# Validate JSON
jq . .meridian/memory.jsonl
```

## Next Steps

Now that you're set up:

1. **Read the guides** - Understand the coding standards
2. **Create a task** - Practice the workflow
3. **Add memory** - Document a decision
4. **Customize** - Adapt to your team's needs
5. **Share** - Get your team using Meridian

## Resources

- **README.md** - Full documentation
- **INSTALL.md** - Detailed installation guide
- **MIGRATION.md** - Migrating from Claude Code
- **.meridian/prompts/agent-operating-manual.md** - Agent behavior
- **.meridian/CODE_GUIDE.md** - Coding standards

## Support

Questions? Check:
1. This quick start guide
2. The main README.md
3. The installation guide
4. OpenCode docs: https://opencode.ai/docs/plugins

Happy coding with Meridian! 🚀
