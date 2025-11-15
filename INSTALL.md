# Meridian for OpenCode - Installation Guide

## Quick Start

### 1. Prerequisites

- OpenCode installed and configured
- Node.js or Bun for plugin dependencies
- A project directory where you want to use Meridian

### 2. Installation Steps

#### Option A: New Project Setup

```bash
# Navigate to your project
cd /path/to/your/project

# Copy Meridian files
cp -r /path/to/meridian-opencode/.meridian ./
cp -r /path/to/meridian-opencode/.opencode ./

# Install plugin dependencies
cd .opencode/plugin
npm install
# or: bun install

# Configure your project
nano .meridian/config.yaml
```

#### Option B: Global Installation (All Projects)

```bash
# Copy plugin to global OpenCode config
mkdir -p ~/.config/opencode/plugin
cp /path/to/meridian-opencode/.opencode/plugin/* ~/.config/opencode/plugin/

# Install dependencies globally
cd ~/.config/opencode/plugin
npm install
# or: bun install

# For each project, copy the .meridian directory
cd /path/to/your/project
cp -r /path/to/meridian-opencode/.meridian ./
nano .meridian/config.yaml
```

### 3. Configuration

Edit `.meridian/config.yaml`:

```yaml
# Choose your project type
project_type: standard  # Options: standard, hackathon, production

# Enable TDD mode if desired
tdd_mode: false  # Options: true, false
```

### 4. Verify Installation

Start OpenCode in your project:

```bash
cd /path/to/your/project
opencode
```

You should see:
```
[Meridian] Project environment loaded. Core rules, guides, tasks, and memory are now active.
```

OpenCode will then read:
- `.meridian/CODE_GUIDE.md`
- `.meridian/memory.jsonl`
- `.meridian/task-backlog.yaml`
- Any active addon guides based on your config

## Project Type Configuration

### Standard Mode (Default)

Best for: Most projects, balanced approach

```yaml
project_type: standard
tdd_mode: false
```

**What you get:**
- 120 baseline coding rules
- Structured task management
- Memory system
- No additional constraints

### Hackathon Mode

Best for: Rapid prototyping, demos, MVPs

```yaml
project_type: hackathon
tdd_mode: false
```

**What you get:**
- Baseline rules + relaxed constraints
- Faster iteration
- Minimal testing requirements
- Security floor still enforced

**Key differences:**
- Flat project structure acceptable
- Client-side fetching allowed
- Larger components temporarily OK
- Skip theming/dark mode
- One E2E test sufficient

### Production Mode

Best for: Production systems, critical applications

```yaml
project_type: production
tdd_mode: false
```

**What you get:**
- Baseline rules + stricter requirements
- Enhanced security (CSP, COOP/COEP, SRI)
- Comprehensive observability
- Strict testing requirements

**Key differences:**
- Mandatory design system
- Strict TypeScript config
- Rate limiting required
- Idempotency keys for mutations
- OpenTelemetry traces/metrics

### TDD Mode (Can combine with any type)

Best for: Test-driven development workflow

```yaml
project_type: standard  # or hackathon, or production
tdd_mode: true
```

**What you get:**
- Red → Green → Refactor workflow enforced
- Tests written before code
- Characterization tests for refactors
- Regression tests for bugs

**Overrides all other testing rules** - TDD is mandatory when enabled.

## Customization

### Coding Standards

Edit the guides to match your team's standards:

```bash
# Baseline (always loaded)
.meridian/CODE_GUIDE.md

# Addons (loaded based on config)
.meridian/CODE_GUIDE_ADDON_HACKATHON.md
.meridian/CODE_GUIDE_ADDON_PRODUCTION.md
.meridian/CODE_GUIDE_ADDON_TDD.md
```

### Agent Behavior

Customize how OpenCode operates:

```bash
.meridian/prompts/agent-operating-manual.md
```

This file controls:
- Core behavior (reactive vs proactive)
- Task management workflow
- Documentation and memory practices
- Code quality standards
- Security and privacy floor
- Interaction style

### Task Templates

Customize the task structure:

```bash
.meridian/tasks/TASK-000-template/TASK-000.yaml
.meridian/tasks/TASK-000-template/TASK-000-plan.md
.meridian/tasks/TASK-000-template/TASK-000-context.md
```

### Additional Documentation

Add project-specific docs:

```bash
.meridian/docs/
```

List them in:

```bash
.meridian/relevant-docs.md
```

OpenCode will read these files at session start.

## Plugin Development

### File Structure

```
.opencode/plugin/
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── meridian.ts          # Main plugin (hooks)
└── tools.ts             # Custom tools
```

### Modifying Hooks

Edit `.opencode/plugin/meridian.ts` to customize:

- **Session initialization**: What context is loaded
- **Session resume**: What happens after compaction
- **Pre-tool execution**: Guardrails and validations
- **Session stop**: Pre-stop checks

### Adding Custom Tools

Edit `.opencode/plugin/tools.ts` to add new tools or modify existing ones:

- `memory-curator`: Memory management
- `task-manager`: Task creation

Example of adding a new tool:

```typescript
"my-custom-tool": tool({
  description: "Description of what this tool does",
  args: {
    myArg: tool.schema.string().describe("Description of argument"),
  },
  async execute(args, ctx) {
    // Tool implementation
    return "Result";
  },
}),
```

## Troubleshooting

### Plugin Not Loading

Check that the plugin files are in the correct location:

```bash
# Project-specific
ls -la .opencode/plugin/

# Global
ls -la ~/.config/opencode/plugin/
```

Verify dependencies are installed:

```bash
cd .opencode/plugin
npm list
```

### Context Not Loading

Ensure all required files exist:

```bash
ls -la .meridian/CODE_GUIDE.md
ls -la .meridian/memory.jsonl
ls -la .meridian/task-backlog.yaml
ls -la .meridian/prompts/agent-operating-manual.md
```

Check the config file is valid YAML:

```bash
cat .meridian/config.yaml
```

### Tools Not Available

Verify the tools plugin is loaded:

```typescript
// In .opencode/plugin/tools.ts
export const MeridianToolsPlugin: Plugin = async ({ ... }) => {
  return {
    tool: {
      "memory-curator": tool({ ... }),
      "task-manager": tool({ ... }),
    },
  };
};
```

Check that both plugins are exported:

```bash
# Should see both MeridianPlugin and MeridianToolsPlugin
grep "export const" .opencode/plugin/*.ts
```

### Memory IDs Incorrect

If memory IDs are out of sequence, check for malformed JSON:

```bash
# Validate all lines are valid JSON
while IFS= read -r line; do
  echo "$line" | jq . > /dev/null || echo "Invalid JSON: $line"
done < .meridian/memory.jsonl
```

### Task Creation Fails

Ensure the template exists:

```bash
ls -la .meridian/tasks/TASK-000-template/
```

Should contain:
- `TASK-000.yaml`
- `TASK-000-plan.md`
- `TASK-000-context.md`

## Uninstallation

To remove Meridian from a project:

```bash
# Remove Meridian files
rm -rf .meridian
rm -rf .opencode

# Or keep the data but disable the plugin
mv .opencode .opencode.disabled
```

To remove globally:

```bash
rm -rf ~/.config/opencode/plugin/meridian.ts
rm -rf ~/.config/opencode/plugin/tools.ts
rm -rf ~/.config/opencode/plugin/package.json
rm -rf ~/.config/opencode/plugin/tsconfig.json
```

## Next Steps

After installation:

1. **Start OpenCode** in your project
2. **Review the loaded context** - OpenCode will read all guides and memory
3. **Create your first task** - Discuss a plan and let OpenCode create a task
4. **Add a memory entry** - Document an architectural decision
5. **Customize the guides** - Edit to match your team's standards

## Support

For issues:
- Check this installation guide
- Review the main README.md
- Examine the agent operating manual
- Check OpenCode plugin documentation at https://opencode.ai/docs/plugins
