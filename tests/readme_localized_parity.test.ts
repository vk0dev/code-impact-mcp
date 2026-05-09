import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const locales = ["README.ru.md", "README.ja.md", "README.zh-CN.md", "README.es.md"] as const;

function read(name: string): string {
  return readFileSync(path.join(repoRoot, name), "utf8");
}

function expectInstallHookTruth(text: string) {
  expect(text).toContain("npm run demo:install-hook");
  expect(text).toContain("install-hook");
  expect(text).toContain("Husky");
  expect(text).toContain(".husky/pre-commit");
  expect(text).toContain("code-impact-mcp");
  expect(text).not.toContain("Initialized Husky");
  expect(text).not.toContain("Bootstrapping Husky");
}

function expectPythonWedgeTruth(text: string) {
  expect(text).toContain("Python");
  expect(text).toContain("analyze_impact");
  expect(text).toContain("gate_check");
  expect(text).not.toContain("full multi-language parity");
}

function expectMarketplaceTruth(text: string) {
  expect(text).toContain("Official MCP Registry");
  expect(text).toContain("server.json");
  expect(text).toContain("Glama");
  expect(text).toContain("MCP Hive");
  expect(text).not.toContain("MCP Hive live");
  expect(text).not.toContain("Glama live");
}

describe("localized README focused parity", () => {
  for (const locale of locales) {
    it(`${locale} keeps install-hook, Python wedge, and marketplace truth aligned`, () => {
      const text = read(locale);
      expectInstallHookTruth(text);
      expectPythonWedgeTruth(text);
      expectMarketplaceTruth(text);
    });
  }
});
