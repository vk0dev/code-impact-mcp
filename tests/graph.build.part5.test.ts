import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildGraph } from "../src/graph.js";

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
  it("collects .mts files from source directories without a tsconfig", () => {
    withTempProject(
      {
        "src/entry.mts": "import { helper } from './helper.mjs';\nexport const value = helper;\n",
        "src/helper.mts": "export const helper = 42;\n",
      },
      (root) => {
        const graph = buildGraph(root);

        expect(graph.nodes.get("src/entry.mts")?.imports).toEqual(["src/helper.mts"]);
        expect(graph.reverseDeps.get("src/helper.mts")).toEqual(new Set(["src/entry.mts"]));
      },
    );
  });
});
