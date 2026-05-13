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


describe("analyze_impact Python adapter", () => {
  it("routes Python changed files through the Python graph path", async () => {
    const root = mkdtempSync(join(tmpdir(), "impact-python-tool-"));
    mkdirSync(join(root, "pkg", "sub"), { recursive: true });
    writeFileSync(join(root, "pkg", "__init__.py"), "");
    writeFileSync(join(root, "pkg", "util.py"), ["def helper():", "    return 1", ""].join(String.raw`\n`));
    writeFileSync(join(root, "pkg", "sub", "__init__.py"), "");
    writeFileSync(join(root, "pkg", "sub", "worker.py"), ["from ..util import helper", ""].join(String.raw`\n`));

    try {
      const server = new FakeServer();
      registerTools(server as any);
      const payload = parseToolResult(
        await server.handlers.get("analyze_impact")!({
          projectRoot: root,
          files: ["pkg/util.py"],
        }),
      );
      expect(payload.directlyAffected).toContain("pkg/sub/worker.py");
      expect(payload.transitivelyAffected).toEqual([]);
      expect(payload.changedFiles).toEqual(["pkg/util.py"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
