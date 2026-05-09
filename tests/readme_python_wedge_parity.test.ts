import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const readme = readFileSync(path.join(repoRoot, "README.md"), "utf8");

describe("root README Python wedge and install-hook discovery", () => {
  it("keeps the bounded Python wedge tied to the install-hook helper story", () => {
    expect(readme).toContain("Python stays limited to a narrower file-level path for `analyze_impact` and `gate_check`");
    expect(readme).toContain("npm run demo:install-hook");
    expect(readme).toContain("Need quick recipes for the install-hook helper, the bounded Python gate wedge");
    expect(readme).toContain("docs/README.md");
    expect(readme).toContain("code-impact-mcp install-hook");

    expect(readme).not.toContain("full multi-language parity");
    expect(readme).not.toContain("Python support matches the full TS/JS graph surface");
    expect(readme).not.toContain("automatic Husky init");
  });
});
