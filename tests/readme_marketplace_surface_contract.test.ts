import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const readmes = [
  "README.md",
  "README.ru.md",
  "README.ja.md",
  "README.zh-CN.md",
  "README.es.md",
] as const;

function read(name: string): string {
  return readFileSync(path.join(repoRoot, name), "utf8");
}

function expectMarketplaceContract(text: string) {
  expect(text).toContain("Official MCP Registry");
  expect(text).toContain("server.json");
  expect(text).toContain("Glama");
  expect(text).toContain("MCP Hive");

  expect(text).toMatch(/manual/i);
  expect(text).not.toContain("Glama is live");
  expect(text).not.toContain("Glama already live");
  expect(text).not.toContain("MCP Hive is live");
  expect(text).not.toContain("MCP Hive already live");
  expect(text).not.toContain("Glama verified-live");
  expect(text).not.toContain("MCP Hive verified-live");
}

function expectRootReadmeGlamaBoundary(text: string) {
  expect(text).toContain("Glama recovery is visible in factory metrics");
  expect(text).toContain("public canonical badge-ready path is still unresolved");
  expect(text).toContain("cannot yet be finalized with a stable badge URL");
  expect(text).toContain("punkpeye/awesome-mcp-servers#5907");
  expect(text).not.toContain("Glama still needs a real manual listing plus badge");
}

describe("README marketplace/distribution surface", () => {
  for (const readme of readmes) {
    it(`${readme} keeps the current truthful marketplace wording`, () => {
      const text = read(readme);
      expectMarketplaceContract(text);
      if (readme === "README.md") {
        expectRootReadmeGlamaBoundary(text);
      }
    });
  }
});
