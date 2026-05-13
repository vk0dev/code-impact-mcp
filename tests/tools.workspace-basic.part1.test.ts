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

describe("registerTools workspace basics", { timeout: 60_000 }, () => {
  it("aggregates per-workspace gate results for pnpm workspaces", async () => {
    await withFixtureProject("monorepo-pnpm", async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(
        await server.handlers.get("gate_check")!({
          projectRoot: root,
          files: ["packages/app-a/src/a.ts"],
          threshold: 0.9,
        }),
      );

      expect(payload.verdict).toBe("BLOCK");
      expect(payload.workspaces).toHaveLength(2);
      expect(payload.workspaces.map((workspace: any) => [workspace.workspace, workspace.verdict])).toEqual([
        ["packages/app-a", "BLOCK"],
        ["packages/app-b", "PASS"],
      ]);
      expect(payload.reasons).toContain(
        "[packages/app-a] Changed files participate in a circular dependency. Example: src/a.ts → src/b.ts.",
      );
    });
  }, 45_000);
});
