import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

describe("root README tool/install surface", () => {
  it("keeps the current package install contract", () => {
    expect(readme).toContain("@vk0/code-impact-mcp");
    expect(readme).toContain("npx -y @vk0/code-impact-mcp");
    expect(readme).toContain("claude_desktop_config.json");
    expect(readme).not.toContain("npm install -g @vk0/code-impact-mcp");
  });

  it("keeps the current 5-tool capability surface", () => {
    expect(readme).toContain("analyze_impact");
    expect(readme).toContain("get_dependencies");
    expect(readme).toContain("detect_cycles");
    expect(readme).toContain("gate_check");
    expect(readme).toContain("refresh_graph");
  });

  it("does not drift into broader unsupported setup claims", () => {
    expect(readme).not.toContain("cloud dashboard");
    expect(readme).not.toContain("global-install-only");
    expect(readme).not.toContain("full multi-language parity");
  });
});
