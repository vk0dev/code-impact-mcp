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
  it("exposes get_dependencies on top of the graph foundation", async () => {
    await withTempProject(
      {
        "src/a.ts": "export const a = 1;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const handler = server.handlers.get("get_dependencies");
        expect(handler).toBeDefined();

        const payload = parseToolResult(await handler!({ projectRoot: root, file: "src/a.ts" }));
        expect(payload).toMatchObject({
          file: "src/a.ts",
          imports: [],
          importedBy: ["src/b.ts"],
          fanIn: 1,
          fanOut: 0,
          isHighCoupling: false,
          couplingRole: "leaf",
        });
        expect(payload.summary).toContain("leaf");
        expect(payload.summary).toContain("1 incoming");
        expect(payload.explanation).toContain("structural dependency view");
      },
    );
  });
});
