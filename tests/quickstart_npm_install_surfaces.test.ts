import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function read(relPath: string): string {
  return readFileSync(path.join(repoRoot, relPath), "utf8");
}

describe("npm install / Claude Desktop quickstart surfaces", () => {
  it("root install surface keeps the current package install contract", () => {
    const readme = read("README.md");

    expect(readme).toContain("@vk0/code-impact-mcp");
    expect(readme).toContain("npx -y @vk0/code-impact-mcp");
    expect(readme).toContain("claude_desktop_config.json");
    expect(readme).toContain("### Other stdio MCP clients");
    expect(readme).not.toContain("npm install -g @vk0/code-impact-mcp");
  });

  it("docs quickstart keeps the current Claude Desktop JSON config shape", () => {
    const quickstart = read("docs/quickstart-claude-desktop.md");

    expect(quickstart).toContain("claude_desktop_config.json");
    expect(quickstart).toContain('"command": "npx"');
    expect(quickstart).toContain('"args": ["-y", "@vk0/code-impact-mcp"]');
    expect(quickstart).toContain("fully restart Claude Desktop");
    expect(quickstart).not.toContain("global install");
  });

  it("docs index keeps the local-first quick discovery pointers narrow", () => {
    const docsIndex = read("docs/README.md");

    expect(docsIndex).toContain("already-shipped");
    expect(docsIndex).toContain("install-hook");
    expect(docsIndex).toContain("Python support is a **bounded file-level wedge**");
    expect(docsIndex).toContain("analyze_impact");
    expect(docsIndex).toContain("gate_check");
    expect(docsIndex).not.toContain("cloud dashboard");
  });
});
