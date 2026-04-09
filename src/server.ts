import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerTools } from "./tools/index.js";

const server = new McpServer(
  {
    name: "code-impact-mcp",
    version: "0.1.0",
    description: "Dependency graph, blast-radius analysis, and lightweight gate checks for local TypeScript and JavaScript repositories.",
  },
  {
    instructions:
      "Use this server to inspect code impact before changing a local repo. Start with get_dependencies for one file, then use analyze_impact for one or more changed files, and gate_check when you want a bounded PASS/WARN/BLOCK recommendation. Results are graph-based only and should be combined with test and runtime judgment.",
  },
);

registerTools(server);

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "code-impact-mcp",
    product: "CodeImpact MCP",
    summary: "Dependency graph, impact analysis, and gate-style checks for local TS/JS repos.",
    version: "0.1.0",
  });
});

app.post("/mcp", async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => transport.close());
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.log(`CodeImpact MCP server running on port ${port} (health: /health, transport: /mcp)`);
});
