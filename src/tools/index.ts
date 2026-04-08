import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerTools(server: McpServer): void {
  server.registerTool(
    "hello",
    {
      description:
        "Returns a greeting. Use this tool to verify the server is working. " +
        "Does NOT perform any real work — replace with actual tools.",
      inputSchema: {
        name: z.string().describe("Name to greet"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }),
  );

  // TODO: Add real tools here
}
