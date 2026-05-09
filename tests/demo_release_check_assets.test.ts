import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const castPath = path.join(repoRoot, "docs", "demo-release-check.cast");
const gifPath = path.join(repoRoot, "docs", "demo-release-check.gif");
const scriptPath = path.join(repoRoot, "scripts", "demo-release-check.mjs");

describe("release-check demo asset contract", () => {
  it("tracks the release-check proof asset trio", () => {
    for (const assetPath of [castPath, gifPath, scriptPath]) {
      expect(existsSync(assetPath)).toBe(true);
      expect(statSync(assetPath).size).toBeGreaterThan(0);
    }
  });

  it(
    "demo script still proves the bounded shipped 1.6.4 release QA story",
    () => {
      const output = execFileSync(process.execPath, [scriptPath], {
        cwd: repoRoot,
        encoding: "utf8",
        stdio: "pipe",
      });

      expect(output).toContain("Release QA proof for the shipped 1.6.4 lane.");
      expect(output).toContain("$ npm run build");
      expect(output).toContain("$ node scripts/release-check.mjs");
      expect(output).toContain("All checks passed!");
      expect(output).toContain("Ready to release.");
      expect(output).not.toContain("Release checklist has failures.");
    },
    30000,
  );

  it("tracked cast still references the same bounded release QA proof story", () => {
    const cast = readFileSync(castPath, "utf8");

    expect(cast).toContain("Release QA proof for the shipped 1.6.4 lane.");
    expect(cast).toContain("npm run build");
    expect(cast).toContain("node scripts/release-check.mjs");
    expect(cast).toContain("All checks passed!");
    expect(cast).toContain("Ready to release.");
  });
});
