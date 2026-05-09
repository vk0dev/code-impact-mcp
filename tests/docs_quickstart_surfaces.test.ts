import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), "utf8");
}

describe("docs quickstart/discovery surfaces", () => {
  it("docs index keeps the current install-hook helper and bounded Python wedge truth", () => {
    const docsIndex = read("docs/README.md");

    expect(docsIndex).toContain("install-hook");
    expect(docsIndex).toContain("Python support is a **bounded file-level wedge**");
    expect(docsIndex).toContain("analyze_impact");
    expect(docsIndex).toContain("gate_check");
    expect(docsIndex).toContain("analyze_impact");
    expect(docsIndex).toContain("gate_check");
    expect(docsIndex).not.toContain("full multi-language parity");
    expect(docsIndex).not.toContain("Initialized Husky");
    expect(docsIndex).not.toContain("Bootstrapping Husky");
  });

  it("root README still points users to the current quick discovery surfaces", () => {
    const readme = read("README.md");

    expect(readme).toContain("docs/README.md");
    expect(readme).toContain("install-hook helper");
    expect(readme).toContain("bounded Python gate wedge");
    expect(readme).toContain("gate_check");
    expect(readme).toContain("analyze_impact");
  });

  it("quickstart docs stay on real current user paths", () => {
    const quickstart = read("docs/quickstart-claude-desktop.md");
    const recipe = read("docs/pre-commit-gate-recipe.md");

    expect(quickstart).toContain("claude_desktop_config.json");
    expect(quickstart).toContain("@vk0/code-impact-mcp");
    expect(quickstart).toContain('"command": "npx"');
    expect(recipe).toContain("npm run demo:install-hook");
    expect(recipe).toContain("npx -y @vk0/code-impact-mcp install-hook");
    expect(recipe).toContain("helper refuses");
    expect(recipe).toContain("Husky");
    expect(recipe).not.toContain("bootstraps Husky for you");
  });
});
