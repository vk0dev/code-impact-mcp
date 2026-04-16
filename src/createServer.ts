import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerTools } from "./tools/index.js";

export function createServer(): McpServer {
  const server = new McpServer(
    {
      name: "code-impact-mcp",
      version: "1.0.1",
      description:
        "Dependency graph, blast-radius analysis, and lightweight gate checks for local TypeScript and JavaScript repositories.",
    },
    {
      instructions:
        "Use this server to inspect code impact before changing a local repo. " +
        "Start with get_dependencies for one file, then use analyze_impact for " +
        "one or more changed files, and gate_check when you want a bounded " +
        "PASS/WARN/BLOCK recommendation. Results are graph-based only and should " +
        "be combined with test and runtime judgment.",
    },
  );
  registerTools(server);
  return server;
}

// Smithery requires this export for server scanning
export const createSandboxServer = createServer;
