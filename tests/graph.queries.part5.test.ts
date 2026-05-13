import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { analyzeImpact, buildGraph, detectCycles, detectWorkspacePackages, summarizeCycles } from "../src/graph.js";

function withTempProject(files: Record<string, string>, run: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), "code-impact-graph-"));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const target = join(root, relativePath);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, content);
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("graph queries", { timeout: 30_000 }, () => {
  it("detects workspace package roots from pnpm-workspace.yaml", () => {
    withTempProject(
      {
        "pnpm-workspace.yaml": "packages:\n  - 'packages/*'\n",
        "packages/app-a/package.json": '{"name":"app-a"}',
        "packages/app-b/package.json": '{"name":"app-b"}',
      },
      (root) => {
        const workspaces = detectWorkspacePackages(root);
        expect(workspaces.map((workspace) => workspace.relativeRoot)).toEqual([
          'packages/app-a',
          'packages/app-b',
        ]);
      },
    );
  });
});
