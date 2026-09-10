import fs from "node:fs";
import { fileURLToPath } from "node:url";
// Generate the default surface, independent of a developer's local MCP settings.
for (const key of Object.keys(process.env))
  if (key.startsWith("MCP_") || key.startsWith("GEMINI_CLI_MCP_"))
    delete process.env[key];
const { toolDescriptors } = await import("../src/server/create-server.js");
const header =
  "# Tool reference\n\nGenerated from runtime registration. Do not edit by hand.\n\nDefault availability is shown below. Mutation tools additionally require an\noperator capability and client confirmation. Unavailable legacy tools are not\nregistered even when called by name. Annotations are hints, not authority.\n\n";
const text =
  header +
  toolDescriptors
    .map(
      (tool) =>
        `## ${tool.name}\n\n${tool.description}\n\nDefault: **${tool.enabled ? "enabled" : "disabled"}**. Per-call confirmation: **${tool.confirmation ? "required" : "not required"}**.\n\nAnnotations: \`${JSON.stringify(tool.annotations)}\`\n\nInput schema:\n\n\`\`\`json\n${JSON.stringify(tool.inputSchema, null, 2)}\n\`\`\`\n\nOutput envelope schema (tool-specific fields vary):\n\n\`\`\`json\n${JSON.stringify(tool.outputSchema, null, 2)}\n\`\`\`\n`,
    )
    .join("\n");
const target = fileURLToPath(new URL("../docs/TOOLS.md", import.meta.url));
if (process.argv.includes("--check")) {
  if (fs.readFileSync(target, "utf8") !== text)
    throw new Error("Generated tool reference is stale");
} else fs.writeFileSync(target, text);
console.log(
  `Tool reference: ${toolDescriptors.length} descriptors; ${toolDescriptors.filter((tool) => tool.enabled).length} default-enabled.`,
);
