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
  it("summarizes cycle hotspots compactly and deterministically", () => {
    withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
      },
      (root) => {
        const graph = buildGraph(root);
        const cycles = detectCycles(graph);

        expect(summarizeCycles(cycles)).toEqual({
          count: 1,
          hotspots: ['src/a.ts', 'src/b.ts'],
          examples: [
            {
              path: ['src/a.ts', 'src/b.ts'],
              summary: 'src/a.ts → src/b.ts',
            },
          ],
        });
      },
    );
  }, 30_000);
});
