import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { registerTools } from "../src/tools/index.js";

type ToolHandler = (input: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

class FakeServer {
  handlers = new Map<string, ToolHandler>();

  registerTool(name: string, _config: unknown, handler: ToolHandler) {
    this.handlers.set(name, handler);
  }
}

function withTempProject(files: Record<string, string>, run: (root: string) => Promise<void> | void) {
  const root = mkdtempSync(join(tmpdir(), "code-impact-tools-"));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const target = join(root, relativePath);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, content);
    }
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function parseToolResult(result: { content: Array<{ type: string; text: string }> }) {
  expect(result.content).toHaveLength(1);
  expect(result.content[0]?.type).toBe("text");
  return JSON.parse(result.content[0]!.text);
}

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

function withFixtureProject(fixtureName: string, run: (root: string) => Promise<void> | void) {
  const root = mkdtempSync(join(tmpdir(), `code-impact-fixture-${fixtureName}-`));
  try {
    cpSync(join(fixturesRoot, fixtureName), root, { recursive: true });
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("registerTools core dependencies", { timeout: 60_000 }, () => {
  it("exposes analyze_impact with affected files and basic risk signal", async () => {
    await withTempProject(
      {
        "src/core.ts": "export const core = 1;\n",
        "src/service.ts": "import { core } from './core'; export const service = core;\n",
        "src/feature.ts": "import { service } from './service'; export const feature = service;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("analyze_impact")!({ projectRoot: root, files: ["src/core.ts"] }),
        );

        expect(payload.changedFiles).toEqual(["src/core.ts"]);
        expect(payload.directlyAffected).toEqual(["src/service.ts"]);
        expect(payload.transitivelyAffected).toEqual(["src/feature.ts"]);
        expect(payload.totalAffected).toBe(2);
        expect(payload.riskScore).toBeGreaterThan(0);
        expect(typeof payload.summary).toBe("string");
        expect(payload.scanSummary).toContain("affected");
        expect(payload.explanation).toContain("graph-based only");
        expect(payload.impactBreakdown.directCount).toBe(1);
        expect(payload.impactBreakdown.transitiveCount).toBe(1);
        expect(payload.impactBreakdown.directScan.firstFiles).toEqual(["src/service.ts"]);
      },
    );
  });
});
