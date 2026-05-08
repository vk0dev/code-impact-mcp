import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const english = read("README.md");
const locales = ["README.ru.md", "README.ja.md", "README.zh-CN.md", "README.es.md"] as const;

function read(name: string): string {
  return readFileSync(path.join(repoRoot, name), "utf8");
}

function expectContainsAll(text: string, markers: string[]) {
  for (const marker of markers) {
    expect(text).toContain(marker);
  }
}

describe("localized README parity guard", () => {
  it("english canonical surface still exposes the tracked markers", () => {
    expectContainsAll(english, [
      "Python stays limited to a narrower file-level path for `analyze_impact` and `gate_check`",
      "Official MCP Registry",
      "server.json",
      "Glama",
      "MCP Hive",
      "### Other stdio MCP clients",
      "### JSON config example for stdio clients",
      "Windows",
      "cmd /c",
      "npm run demo:install-hook",
      "code-impact-mcp install-hook",
      "This is a Husky-only helper.",
      "If Husky is not initialized yet, the command stops with an actionable message",
      "It does not bootstrap Husky",
    ]);
  });

  for (const locale of locales) {
    it(`${locale} keeps the tracked parity markers`, () => {
      const text = read(locale);
      expectContainsAll(text, [
        "Official MCP Registry",
        "server.json",
        "Glama",
        "MCP Hive",
        "Claude Code",
        "npx -y @vk0/code-impact-mcp",
        "claude_desktop_config.json",
        "npm run demo:install-hook",
        "code-impact-mcp install-hook",
        "docs/demo-install-hook.gif",
        "docs/demo-blast-radius.gif",
        "analyze_impact",
        "gate_check",
      ]);

      expect(text).not.toContain("docs/demo-analyze-impact.gif");
    });
  }
});
