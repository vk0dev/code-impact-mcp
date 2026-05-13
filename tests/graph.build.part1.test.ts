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
  it("collects ESM import and re-export edges inside repo scope", () => {
    withTempProject(
      {
        "src/index.ts": `import { feature } from './feature';\nexport { helper } from './shared/helper';\nexport default feature;\n`,
        "src/feature.ts": `export const feature = true;\n`,
        "src/shared/helper.ts": `export const helper = 1;\n`,
      },
      (root) => {
        const graph = buildGraph(root);
        const indexNode = graph.nodes.get("src/index.ts");

        expect(indexNode).toBeDefined();
        expect(indexNode?.imports).toEqual(["src/feature.ts", "src/shared/helper.ts"]);
        expect(indexNode?.exports).toContain("default");
        expect(graph.edges).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ from: "src/index.ts", to: "src/feature.ts", kind: "esm-import" }),
            expect.objectContaining({ from: "src/index.ts", to: "src/shared/helper.ts", kind: "esm-reexport" }),
          ]),
        );
      },
    );
  }, 30_000);
});
