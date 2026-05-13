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

describe("registerTools workspace mixed and tsconfig", { timeout: 60_000 }, () => {
  it("uses the worst workspace verdict for mixed monorepos with cycle cases", async () => {
    await withFixtureProject("monorepo-mixed-cycle", async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(
        await server.handlers.get("gate_check")!({
          projectRoot: root,
          files: [
            "packages/cycle-app/src/a.ts",
            "packages/warn-app/src/index.ts",
          ],
          threshold: 0.9,
        }),
      );

      expect(payload.verdict).toBe("BLOCK");
      expect(payload.workspaces.map((workspace: any) => [workspace.workspace, workspace.verdict])).toEqual([
        ["packages/cycle-app", "BLOCK"],
        ["packages/pass-app", "PASS"],
        ["packages/warn-app", "WARN"],
      ]);
      expect(payload.circularDependencies).toBe(2);
      expect(payload.reasons).toContain(
        "[packages/cycle-app] Changed files participate in a circular dependency. Example: src/a.ts → src/b.ts.",
      );
      expect(payload.reasons).toContain(
        "[packages/warn-app] The graph contains 1 circular dependency cycle(s). Example: src/a.ts → src/b.ts.",
      );
    });
  }, 60_000);
});
