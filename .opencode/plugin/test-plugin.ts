/**
 * Test script to verify Meridian plugins load correctly
 *
 * Run with: npx tsx test-plugin.ts
 * Or: bun run test-plugin.ts
 */

import { MeridianPlugin, MeridianToolsPlugin } from "./index";

async function testPlugins() {
  console.log("🧪 Testing Meridian Plugin Loading...\n");

  // Mock OpenCode context
  const mockContext = {
    project: { name: "test-project" },
    directory: process.cwd(),
    worktree: process.cwd(),
    client: {} as any, // Mock client
    $: {} as any, // Mock Bun shell
  };

  try {
    console.log("1️⃣  Testing MeridianPlugin...");
    const meridianHooks = await MeridianPlugin(mockContext);
    console.log("✅ MeridianPlugin loaded successfully!");
    console.log("   Hooks:", Object.keys(meridianHooks).join(", "));
    console.log();

    console.log("2️⃣  Testing MeridianToolsPlugin...");
    const toolsHooks = await MeridianToolsPlugin(mockContext);
    console.log("✅ MeridianToolsPlugin loaded successfully!");
    console.log("   Hooks:", Object.keys(toolsHooks).join(", "));

    if (toolsHooks.tool) {
      console.log("   Tools:", Object.keys(toolsHooks.tool).join(", "));
    }
    console.log();

    console.log("🎉 All plugins loaded successfully!");
    console.log();
    console.log("If you don't see these plugins in OpenCode:");
    console.log("- Check OpenCode's console/terminal output for the startup logs");
    console.log("- Verify OpenCode is running from the correct directory");
    console.log("- Try restarting OpenCode completely");
    console.log("- Run OpenCode with verbose/debug flags if available");

  } catch (error) {
    console.error("❌ Plugin loading failed!");
    console.error(error);
    process.exit(1);
  }
}

testPlugins();
