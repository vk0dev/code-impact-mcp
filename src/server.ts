import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { registerTools } from "./tools/index.js";

const server = new McpServer(
  { name: "code-impact-mcp", version: "0.1.0" },
  { instructions: "TODO: Describe how to use this server effectively." },
);

registerTools(server);

const app = express();
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "code-impact-mcp", version: "0.1.0" });
});

// MCP endpoint (stateless)
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
  console.log(`code-impact-mcp MCP server running on port ${port}`);
});
