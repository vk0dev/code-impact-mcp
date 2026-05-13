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
  it("warns in gate_check when cycles exist elsewhere in the graph", async () => {
    await withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
        "src/c.ts": "export const c = 1;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("gate_check")!({
            projectRoot: root,
            files: ["src/c.ts"],
            threshold: 0.9,
          }),
        );

        expect(payload.verdict).toBe("WARN");
        expect(payload.explanation).toContain("review is warranted");
        expect(payload.circularDependencies).toBe(1);
        expect(payload.cycleExamples).toEqual([["src/a.ts", "src/b.ts"]]);
        expect(payload.affectedCycles).toEqual([]);
        expect(payload.scanSummary).toContain("1 cycle");
      },
    );
  });
});
