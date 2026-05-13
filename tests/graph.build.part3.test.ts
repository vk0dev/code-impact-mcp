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

describe("buildGraph", { timeout: 30_000 }, () => {
  it("ignores external packages outside repo scope", () => {
    withTempProject(
      {
        "src/main.ts": "import { Project } from 'ts-morph';\nconst fs = require('node:fs');\nexport { Project };\n",
      },
      (root) => {
        const graph = buildGraph(root);
        expect(graph.nodes.get("src/main.ts")?.imports).toEqual([]);
        expect(graph.edges).toEqual([]);
      },
    );
  });
});
