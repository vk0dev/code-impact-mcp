import path from "node:path";
import process from "node:process";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const cwd = process.cwd();

// Create a minimal fixture project for smoke testing
const fixtureRoot = mkdtempSync(path.join(tmpdir(), "code-impact-smoke-"));
const srcDir = path.join(fixtureRoot, "src");
mkdirSync(srcDir, { recursive: true });

writeFileSync(
  path.join(srcDir, "a.ts"),
  `import { b } from "./b.js";\nexport const a = b + 1;\n`,
);
writeFileSync(
  path.join(srcDir, "b.ts"),
  `export const b = 42;\n`,
);
writeFileSync(
  path.join(srcDir, "c.ts"),
  `import { a } from "./a.js";\nconsole.log(a);\n`,
);

const transport = new StdioClientTransport({
  command: "node",
  args: ["dist/server.js"],
  cwd,
  stderr: "inherit",
});

const client = new Client({
  name: "code-impact-mcp-dogfood",
  version: "0.1.0",
});

async function run() {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  const expected = ["analyze_impact", "gate_check", "get_dependencies", "refresh_graph"];

  if (JSON.stringify(toolNames) !== JSON.stringify(expected)) {
    throw new Error(`Expected tools ${expected.join(", ")}, got ${toolNames.join(", ")}`);
  }

  console.log("Tools OK:", toolNames.join(", "));

  // refresh_graph
  const refreshResult = await client.callTool({
    name: "refresh_graph",
    arguments: { projectRoot: fixtureRoot },
  });
  const refreshPayload = JSON.parse(refreshResult.content[0].text);
  console.log("refresh_graph OK:", refreshPayload.files, "files,", refreshPayload.edges, "edges");

  // get_dependencies
  const depResult = await client.callTool({
    name: "get_dependencies",
    arguments: { projectRoot: fixtureRoot, file: "src/b.ts" },
  });
  const depPayload = JSON.parse(depResult.content[0].text);
  console.log("get_dependencies OK:", depPayload.file, "fanIn:", depPayload.fanIn, "fanOut:", depPayload.fanOut);

  // analyze_impact
  const impactResult = await client.callTool({
    name: "analyze_impact",
    arguments: { projectRoot: fixtureRoot, files: ["src/b.ts"] },
  });
  const impactPayload = JSON.parse(impactResult.content[0].text);
  console.log("analyze_impact OK: risk", impactPayload.riskScore, "affected", impactPayload.totalAffected);

  // gate_check
  const gateResult = await client.callTool({
    name: "gate_check",
    arguments: { projectRoot: fixtureRoot, files: ["src/b.ts"], threshold: 0.5 },
  });
  const gatePayload = JSON.parse(gateResult.content[0].text);
  console.log("gate_check OK: verdict", gatePayload.verdict);

  console.log("\nAll 4 tools passed smoke test.");
  await client.close();
}

run().catch(async (error) => {
  console.error(
    "dogfood_smoke failed:",
    error instanceof Error ? error.stack ?? error.message : String(error),
  );
  try {
    await client.close();
  } catch {}
  process.exit(1);
});
