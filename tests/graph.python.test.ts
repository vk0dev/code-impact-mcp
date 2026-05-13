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

const fixtureRoot = resolve("test/fixtures");

describe("Python graph adapter", () => {
  it("resolves relative imports from fixture repos", () => {
    const root = resolve(fixtureRoot, "python-package-rel");
    const graph = buildGraph(root, undefined, { changedFiles: ["pkg/sub/worker.py"] });

    expect(graph.nodes.get("pkg/sub/worker.py")?.imports).toEqual([
      "pkg/sub/__init__.py",
      "pkg/util.py",
    ]);
  });

  it("maps package imports to __init__.py fixtures", () => {
    const root = resolve(fixtureRoot, "python-package-rel");
    const graph = buildGraph(root, undefined, { changedFiles: ["pkg/sub/worker.py"] });

    expect(graph.nodes.get("pkg/sub/worker.py")?.imports).toContain("pkg/sub/__init__.py");
    expect(graph.reverseDeps.get("pkg/sub/__init__.py")).toEqual(new Set(["pkg/sub/worker.py"]));
  });

  it("tolerates unresolved imports without overclaiming dependencies", () => {
    const root = resolve(fixtureRoot, "python-basic");
    const graph = buildGraph(root, undefined, { changedFiles: ["main.py"] });

    expect(graph.nodes.get("main.py")?.imports).toEqual(["pkg/fallback.py"]);
    expect(graph.nodes.get("main.py")?.imports).not.toContain("missing_lib");
  });

  it("uses Python adapter only when changed files are .py in mixed repos", () => {
    const root = resolve(fixtureRoot, "python-mixed-repo");

    const pythonGraph = buildGraph(root, undefined, { changedFiles: ["py_pkg/worker.py"] });
    expect(pythonGraph.nodes.has("py_pkg/worker.py")).toBe(true);
    expect(pythonGraph.nodes.has("src/index.ts")).toBe(false);

    const tsGraph = buildGraph(root, undefined, { changedFiles: ["src/index.ts"] });
    expect(tsGraph.nodes.has("src/index.ts")).toBe(true);
    expect(tsGraph.nodes.has("py_pkg/worker.py")).toBe(false);
  });
});
