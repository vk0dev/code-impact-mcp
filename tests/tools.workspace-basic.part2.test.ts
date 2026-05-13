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
  it("aggregates per-workspace gate results for npm workspaces", async () => {
    await withFixtureProject("monorepo-npm", async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(
        await server.handlers.get("gate_check")!({
          projectRoot: root,
          files: ["apps/web/src/core.ts"],
          threshold: 0.5,
        }),
      );

      expect(payload.verdict).toBe("BLOCK");
      expect(payload.workspaces.map((workspace: any) => [workspace.workspace, workspace.verdict])).toEqual([
        ["apps/docs", "PASS"],
        ["apps/web", "BLOCK"],
      ]);
      expect(payload.directlyAffected).toEqual(["apps/web/src/service.ts"]);
      expect(payload.transitivelyAffected).toEqual(["apps/web/src/feature.ts"]);
      expect(payload.affectedFiles).toBe(2);
    });
  }, 45_000);
});
