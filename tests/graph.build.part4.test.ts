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
  it("resolves NodeNext-style .js specifiers back to TypeScript source files", () => {
    withTempProject(
      {
        "src/routes/index.ts": "import { helper } from '../utils/helper.js';\nexport const route = helper;\n",
        "src/utils/helper.ts": "export const helper = true;\n",
      },
      (root) => {
        const graph = buildGraph(root);
        expect(graph.nodes.get('src/routes/index.ts')?.imports).toEqual(['src/utils/helper.ts']);
        expect(graph.reverseDeps.get('src/utils/helper.ts')).toEqual(new Set(['src/routes/index.ts']));
      },
    );
  });
});
