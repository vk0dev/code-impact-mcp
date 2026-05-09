import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const readmes = ["README.ru.md", "README.ja.md", "README.zh-CN.md", "README.es.md"] as const;

function read(name: string): string {
  return readFileSync(path.join(repoRoot, name), "utf8");
}

function expectLocalizedInstallHookDemoTruth(text: string) {
  expect(text).toContain("npm run demo:install-hook");
  expect(text).toContain(".husky/pre-commit");
  expect(text).toContain("code-impact-mcp install-hook");
  expect(text).toMatch(/dry-run|dry run/i);
  expect(text).toMatch(/snippet|фрагмент|片段/iu);

  expect(text).not.toContain("Initialized Husky");
  expect(text).not.toContain("Bootstrapping Husky");
  expect(text).not.toContain("automatic Husky init");
  expect(text).not.toContain("automatic .husky init");
}

describe("localized README install-hook demo parity", () => {
  for (const readme of readmes) {
    it(`${readme} keeps the bounded install-hook demo truth`, () => {
      expectLocalizedInstallHookDemoTruth(read(readme));
    });
  }
});
