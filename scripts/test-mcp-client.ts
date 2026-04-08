/**
 * MCP smoke test: connects to the server and lists available tools.
 * Usage: tsx scripts/test-mcp-client.ts [url]
 */
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";

const url = process.argv[2] ?? "http://localhost:3000/mcp";

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: "smoke-test", version: "1.0.0" });

  await client.connect(transport);
  console.log("Connected to MCP server");

  const { tools } = await client.listTools();
  console.log(`Found ${tools.length} tool(s):`);
  for (const tool of tools) {
    console.log(`  - ${tool.name}: ${tool.description?.slice(0, 80)}`);
  }

  // Call hello tool as basic smoke test
  const helloTool = tools.find((t) => t.name === "hello");
  if (helloTool) {
    const result = await client.callTool({
      name: "hello",
      arguments: { name: "smoke-test" },
    });
    console.log("hello result:", JSON.stringify(result.content));
  }

  await client.close();
  console.log("Smoke test PASSED");
}

main().catch((err) => {
  console.error("Smoke test FAILED:", err.message);
  process.exit(1);
});
