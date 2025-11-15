# Debugging Meridian OpenCode Plugin

## Verifying Plugin Loading

### 1. Check Plugin Directory Structure

Your plugin should be located at `.opencode/plugin/` with these files:
- `index.ts` - Main entry point (exports both plugins)
- `meridian.ts` - Core Meridian plugin with event hooks
- `tools.ts` - Memory curator and task manager tools
- `package.json` - Must have `main` field pointing to `index.ts`

### 2. Plugin Console Output

When OpenCode starts, you should see console output like:

```
============================================================
🚀 Meridian Plugin Loading
============================================================
📁 Project: your-project-name
📂 Directory: /path/to/project
🌿 Worktree: /path/to/worktree
⚙️  Config: /path/to/.meridian/config.yaml
============================================================
🛠️  Meridian Tools Plugin Loading
   Memory: /path/to/.meridian/memory.jsonl
   Tasks: /path/to/.meridian/tasks
   Backlog: /path/to/.meridian/task-backlog.yaml
```

### 3. Where to Find Console Output

**The issue**: `console.log()` from plugins may not appear in the OpenCode UI.

**Where plugin logs might appear**:
- OpenCode terminal/stdout (if running from CLI)
- Debug console in VS Code (if OpenCode extension)
- System logs (check OpenCode's log directory)

**Try running OpenCode with verbose/debug flags** (if available):
```bash
opencode --verbose
opencode --debug
```

### 4. Test Plugin Loading Manually

You can test if your plugin syntax is correct by running:

```bash
cd .opencode/plugin
npx tsx test-plugin.ts
```

This will verify the TypeScript compiles and exports are correct.

### 5. Verify Custom Tools Are Loaded

In OpenCode, the custom tools should appear:
- `memory-curator` - For managing project memory
- `task-manager` - For creating and managing tasks

You can check if they're available by asking Claude to list available tools.

### 6. Check Event Hooks

The plugin registers these event hooks:
- `chat.message` - Tracks agent changes
- `event` - Handles session lifecycle (created, compacted, idle)
- `tool.execute.before` - Guards for context review and task creation

**Note**: The current OpenCode API limitation means event hooks **cannot inject messages** into the session. Messages are only logged to console.

### 7. Common Issues

**Plugin not loading:**
- Verify `package.json` has `"main": "index.ts"`
- Check that all dependencies are installed: `npm install`
- Verify TypeScript compiles: `npx tsc --noEmit`
- Check file permissions on `.opencode/plugin/` directory

**Console logs not visible:**
- Console output from plugins may not appear in UI
- Try running OpenCode from terminal to see stdout
- Look for OpenCode log files in `~/.config/opencode/logs/` (if exists)

**Tools not appearing:**
- Verify `MeridianToolsPlugin` is exported in `index.ts`
- Check that the plugin returns the `tool` object correctly
- Restart OpenCode completely

### 8. Enable TypeScript Debug Output

Add this to `tsconfig.json` temporarily:
```json
{
  "compilerOptions": {
    "listFiles": true,
    "traceResolution": true
  }
}
```

Then run: `npx tsc --noEmit` to see what files TypeScript is processing.

### 9. Contact & Support

If plugins still don't load:
- Check [OpenCode GitHub Issues](https://github.com/sst/opencode/issues)
- Join [OpenCode Discord](https://opencode.ai/discord)
- Review [OpenCode Documentation](https://opencode.ai/docs/plugins/)
