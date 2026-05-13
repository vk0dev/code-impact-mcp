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

describe("registerTools core gates", { timeout: 60_000 }, () => {
  it("exposes gate_check with a BLOCK verdict for high-impact changes", async () => {
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
          await server.handlers.get("gate_check")!({
            projectRoot: root,
            files: ["src/core.ts"],
            threshold: 0.5,
          }),
        );

        expect(payload.verdict).toBe("BLOCK");
        expect(payload.recommendation).toContain("Hold the change");
        expect(payload.explanation).toContain("reaches too far");
        expect(payload.scanSummary).toContain("BLOCK");
        expect(payload.scanSummary).toContain("2 affected");
        expect(payload.directlyAffected).toEqual(["src/service.ts"]);
        expect(payload.transitivelyAffected).toEqual(["src/feature.ts"]);
        expect(payload.affectedFiles).toBe(2);
        expect(payload.impactBreakdown.directScan.topDirectories).toEqual([{ directory: "src", count: 1 }]);
        expect(payload.impactBreakdown.directScan.displayMode).toBe("flat");
        expect(payload.impactBreakdown.directScan.totalFiles).toBe(1);
      },
    );
  });
});
