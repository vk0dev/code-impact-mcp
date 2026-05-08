import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const castPath = path.join(repoRoot, "docs", "demo-install-hook.cast");
const gifPath = path.join(repoRoot, "docs", "demo-install-hook.gif");
const scriptPath = path.join(repoRoot, "scripts", "demo-install-hook.mjs");

function read(pathname: string): string {
  return readFileSync(pathname, "utf8");
}

describe("install-hook demo asset contract", () => {
  it("keeps the tracked demo trio present for fresh clones", () => {
    expect(existsSync(scriptPath)).toBe(true);
    expect(existsSync(castPath)).toBe(true);
    expect(existsSync(gifPath)).toBe(true);
    expect(statSync(castPath).size).toBeGreaterThan(0);
    expect(statSync(gifPath).size).toBeGreaterThan(0);
  });

  it("records the current refusal and suggested snippet behavior", () => {
    const cast = read(castPath);

    expect(cast).toContain('"command":"node scripts/demo-install-hook.mjs"');
    expect(cast).toContain("Refusing to overwrite existing pre-commit hook");
    expect(cast).toContain("Suggested snippet:");
    expect(cast).toContain("# BEGIN code-impact-mcp");
    expect(cast).toContain("npx -y @vk0/code-impact-mcp run-hook");
    expect(cast).not.toContain("Initialized Husky");
    expect(cast).not.toContain("Bootstrapping Husky");
  });

  it("live demo script still shows refusal-first helper behavior", () => {
    const output = execFileSync("node", [scriptPath], {
      cwd: repoRoot,
      encoding: "utf8",
    });

    expect(output).toContain("Refusing to overwrite existing pre-commit hook");
    expect(output).toContain("Suggested snippet:");
    expect(output).toContain("# BEGIN code-impact-mcp");
    expect(output).toContain("npx -y @vk0/code-impact-mcp run-hook");
    expect(output).not.toContain("Initialized Husky");
    expect(output).not.toContain("Bootstrapping Husky");
  }, 20000);
});
