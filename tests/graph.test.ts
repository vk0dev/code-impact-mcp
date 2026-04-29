import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

describe("buildGraph", () => {
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
  });

  it("collects CommonJS require edges and resolves index files", () => {
    withTempProject(
      {
        "src/main.js": "const util = require('./lib');\nmodule.exports = util;\n",
        "src/lib/index.js": "exports.answer = 42;\n",
      },
      (root) => {
        const graph = buildGraph(root);

        expect(graph.nodes.get("src/main.js")?.imports).toEqual(["src/lib/index.js"]);
        expect(graph.edges).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ from: "src/main.js", to: "src/lib/index.js", kind: "cjs-require" }),
          ]),
        );
        expect(graph.reverseDeps.get("src/lib/index.js")).toEqual(new Set(["src/main.js"]));
      },
    );
  });

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

describe("graph queries", () => {
  it("analyzes impact through reverse dependencies", () => {
    withTempProject(
      {
        "src/a.ts": "export const a = 1;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
        "src/c.ts": "import { b } from './b'; export const c = b;\n",
      },
      (root) => {
        const graph = buildGraph(root);
        const impact = analyzeImpact(graph, "src/a.ts");

        expect(impact.directDependents).toEqual(["src/b.ts"]);
        expect(impact.allDependents).toEqual(["src/b.ts", "src/c.ts"]);
        expect(impact.blastRadius).toBe(2);
      },
    );
  });

  it("detects simple cycles", () => {
    withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
      },
      (root) => {
        const graph = buildGraph(root);
        const cycles = detectCycles(graph);

        expect(cycles.length).toBe(1);
        expect(cycles[0]).toEqual(["src/a.ts", "src/b.ts"]);
      },
    );
  });

  it("does not include the changed file itself in impacted dependents when cycles exist", () => {
    withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
        "src/c.ts": "import { a } from './a'; export const c = a;\n",
      },
      (root) => {
        const graph = buildGraph(root);
        const impact = analyzeImpact(graph, 'src/a.ts');

        expect(impact.directlyAffected).toEqual(['src/b.ts', 'src/c.ts']);
        expect(impact.transitivelyAffected).toEqual([]);
        expect(impact.allDependents).toEqual(['src/b.ts', 'src/c.ts']);
      },
    );
  });

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
  });

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
