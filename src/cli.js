import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

if (process.argv[2] !== "doctor") {
  console.log(
    "Usage: node src/cli.js doctor\nChecks MCP startup/list/capture profile. Does not launch a browser.",
  );
  if (process.argv[2] && !["--help", "-h"].includes(process.argv[2]))
    process.exitCode = 2;
} else {
  const client = new Client(
    { name: "mcp-browser-doctor", version: "2.0.0" },
    { capabilities: {} },
  );
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|HOME)$/i.test(
        key,
      ) ||
      key.startsWith("MCP_")
    )
      env[key] = value;
  }
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("./mcp-browser-server.js", import.meta.url))],
    env,
    stderr: "pipe",
  });
  const timer = setTimeout(() => {
    void transport.close();
    process.exitCode = 1;
  }, 20000);
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const result = await client.callTool({
      name: "browser.get_capture_profile",
      arguments: {},
    });
    if (result.isError) throw new Error("Profile check failed");
    console.log(
      JSON.stringify(
        {
          status: "ok",
          tools: tools.tools.length,
          liveModelCalls: 0,
          browserLaunched: false,
        },
        null,
        2,
      ),
    );
  } catch {
    console.error(
      "Doctor failed. Check configuration, runtime version, and installed dependencies.",
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
    await client.close().catch(() => {});
  }
}
