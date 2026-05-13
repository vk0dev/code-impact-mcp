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
});
