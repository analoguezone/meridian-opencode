# Changelog

All notable changes to Meridian for OpenCode will be documented in this file.

## [1.0.0] - 2025-01-15

### Added
- Initial release of Meridian for OpenCode
- Complete TypeScript plugin system replacing Python hooks
- Custom tools for memory-curator and task-manager
- Full compatibility with existing Meridian data structures
- Session lifecycle hooks (start, resume, compact, idle)
- Pre-tool execution guards for context review
- Automatic context loading based on project configuration
- Support for all project modes (standard, hackathon, production, TDD)

### Features

#### Core Plugin (meridian.ts)
- Session initialization with dynamic guide loading
- Context preservation after compaction
- Pre-stop validation and cleanup
- Context review flag management
- Project configuration parsing (YAML)
- File-based governance system

#### Tools Plugin (tools.ts)
- `memory-curator` tool for structured memory management
  - Auto-incrementing memory IDs
  - Tag and link support
  - JSONL append-only format
  - Validation and deduplication
- `task-manager` tool for task creation
  - Template-based task scaffolding
  - Automatic file renaming
  - Task ID generation
  - Backlog integration

#### Documentation
- Comprehensive README with feature overview
- Detailed installation guide (INSTALL.md)
- Migration guide from Claude Code (MIGRATION.md)
- Quick start guide (QUICKSTART.md)
- Inline code documentation

#### Data Compatibility
- 100% compatible with Meridian for Claude Code
- No migration needed for existing data
- Same file formats and structures
- Identical workflow and commands

### Technical Details

#### Dependencies
- `@opencode-ai/plugin` - OpenCode plugin SDK
- `@types/node` - Node.js type definitions
- `typescript` - TypeScript compiler

#### File Structure
```
.opencode/plugin/
├── package.json          # Dependencies and metadata
├── tsconfig.json         # TypeScript configuration
├── index.ts             # Main entry point
├── meridian.ts          # Core plugin with hooks
└── tools.ts             # Custom tools

.meridian/
├── config.yaml                      # Project configuration
├── memory.jsonl                     # Memory entries
├── task-backlog.yaml               # Task index
├── relevant-docs.md                # Additional docs
├── CODE_GUIDE.md                   # Baseline (120 rules)
├── CODE_GUIDE_ADDON_HACKATHON.md  # Hackathon mode
├── CODE_GUIDE_ADDON_PRODUCTION.md # Production mode
├── CODE_GUIDE_ADDON_TDD.md        # TDD mode
├── prompts/
│   └── agent-operating-manual.md  # Agent behavior
├── tasks/
│   └── TASK-000-template/         # Task template
└── docs/                          # Project docs
```

#### Hook Mapping from Claude Code

| Claude Code Hook | OpenCode Implementation |
|------------------|------------------------|
| `SessionStart` (startup) | `event.type === "session.start"` |
| `SessionStart` (compact) | `event.type === "session.resume"` |
| `Stop` | `event.type === "session.idle"` |
| `PreToolUse` | `tool.execute.before` |
| `PostToolUse` (ExitPlanMode) | `tool.execute.before` with tool check |

#### Tool Mapping from Claude Code

| Claude Code | OpenCode |
|-------------|----------|
| `add_memory_entry.py` | `memory-curator` custom tool |
| `create-task.py` | `task-manager` custom tool |

### Preserved Features

All features from Meridian for Claude Code are preserved:

- ✅ Persistent memory system (JSONL)
- ✅ Structured task management (YAML + MD)
- ✅ Coding standards enforcement (120 rules)
- ✅ Project mode configuration (standard/hackathon/production)
- ✅ TDD mode support
- ✅ Session continuity and context preservation
- ✅ Pre-stop validation
- ✅ Context review guards
- ✅ Task backlog management
- ✅ Memory tagging and linking
- ✅ Template-based task creation

### Improvements Over Python Version

#### Performance
- Faster file operations with native Node.js APIs
- Compiled TypeScript vs interpreted Python
- Better async/await patterns
- Reduced startup time

#### Type Safety
- Full TypeScript type checking
- Compile-time error detection
- Better IDE support and autocomplete
- Safer refactoring

#### Integration
- Native OpenCode plugin system
- Consistent with OpenCode ecosystem
- Better tool integration
- Standard event handling

#### Maintainability
- Single language (TypeScript) for all logic
- Modern async patterns
- Better error handling
- Easier to extend and customize

### Breaking Changes

None - this is a new implementation with full backward compatibility.

### Migration Notes

For users migrating from Meridian for Claude Code:

1. Copy your existing `.meridian` directory (no changes needed)
2. Install the OpenCode plugin
3. All data (memory, tasks, guides) works as-is
4. Workflow remains identical
5. See MIGRATION.md for detailed guide

### Known Issues

None at release.

### Future Enhancements

Potential future additions:

- [ ] Memory search and query tools
- [ ] Task dependency tracking
- [ ] Automated task status updates
- [ ] Memory entry suggestions
- [ ] Task templates for common patterns
- [ ] Integration with project management tools
- [ ] Memory visualization
- [ ] Task timeline and burndown charts
- [ ] Code quality metrics integration
- [ ] Automated guide compliance checking

### Contributors

- Initial TypeScript port and OpenCode integration

### License

This is a port of the Meridian system for OpenCode. Original concept and design by the Meridian project.

---

## Version History

### [1.0.0] - 2025-01-15
- Initial release

---

## Upgrade Guide

### From Claude Code to OpenCode

See MIGRATION.md for complete upgrade instructions.

**Summary:**
1. Backup your `.meridian` directory
2. Copy to OpenCode project
3. Install plugin
4. Start using - no data changes needed

### Future Versions

Upgrade instructions will be added here as new versions are released.

---

## Support

For issues, questions, or contributions:
- Check the documentation (README.md, INSTALL.md, MIGRATION.md)
- Review the agent operating manual
- Examine the coding guides
- Check OpenCode plugin documentation

---

## Acknowledgments

- Meridian project for the original concept and design
- OpenCode team for the plugin system
- Community contributors for feedback and testing
