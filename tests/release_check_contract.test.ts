import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

async function ensureBuildOutput() {
  await execFileAsync("npm", ["run", "build"], {
    cwd: process.cwd(),
    stdio: "pipe",
    encoding: "utf8",
  });
}

import {
  DOCUMENTED_INSTALL_SURFACES,
  findDocumentedInstallSurfaces,
  getAuditSeverityCounts,
  hasBlockingAuditVulnerabilities,
} from "../scripts/release-check.mjs";

const repoRoot = process.cwd();

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

describe("release-check contract", () => {
  it("accepts the four documented install surfaces without requiring named Cursor/Cline snippets", () => {
    const readme = [
      "### Claude Desktop",
      "### Claude Code",
      "### Other stdio MCP clients",
      "### JSON config example for stdio clients",
    ].join("\n");

    expect(DOCUMENTED_INSTALL_SURFACES).toEqual([
      "Claude Desktop",
      "Claude Code",
      "Other stdio MCP clients",
      "JSON config example for stdio clients",
    ]);
    expect(findDocumentedInstallSurfaces(readme)).toEqual(DOCUMENTED_INSTALL_SURFACES);
    expect(findDocumentedInstallSurfaces(readme)).not.toContain("Cursor");
    expect(findDocumentedInstallSurfaces(readme)).not.toContain("Cline");
  });

  it("fails cleanly when npm audit metadata reports high or critical vulnerabilities", () => {
    const audit = {
      metadata: {
        vulnerabilities: {
          high: 1,
          critical: 0,
        },
      },
    };

    expect(getAuditSeverityCounts(audit)).toEqual({ high: 1, critical: 0 });
    expect(hasBlockingAuditVulnerabilities(audit)).toBe(true);
  });

  it("keeps Smithery manifest metadata aligned with the shipped package truth", () => {
    const pkg = readJson<{ version: string; description: string }>("package.json");
    const manifest = readJson<{
      payload: {
        serverCard: {
          serverInfo: { version: string; description: string };
          tools: Array<{ name: string }>;
        };
      };
    }>(".smithery/shttp/manifest.json");
    const toolSource = readFileSync(path.join(repoRoot, "src", "tools", "index.ts"), "utf8");
    const toolNamesInSource = [...toolSource.matchAll(/registerTool\(\s*"([^"]+)"/g)].map((match) => match[1]);
    const manifestToolNames = manifest.payload.serverCard.tools.map((tool) => tool.name);

    expect(manifest.payload.serverCard.serverInfo.version).toBe(pkg.version);
    expect(manifest.payload.serverCard.serverInfo.description).toBe(pkg.description);
    expect(manifestToolNames).toEqual(toolNamesInSource);
    expect(manifestToolNames).toContain("detect_cycles");
  });

  it("keeps Smithery publish workflow pinned to the canonical server identity", () => {
    const workflow = readFileSync(path.join(repoRoot, ".github", "workflows", "publish.yml"), "utf8");

    expect(workflow).toContain("vars.SMITHERY_SERVER_NAME || 'vk0dev/code-impact-mcp'");
    expect(workflow).not.toContain("unfucker/code-impact-mcp");
  });

  it(
    "stays green on the current repo head after a normal build",
    async () => {
      await ensureBuildOutput();

      await expect(
        execFileAsync(process.execPath, ["scripts/release-check.mjs"], {
          cwd: process.cwd(),
          stdio: "pipe",
          encoding: "utf8",
        }),
      ).resolves.toBeDefined();
    },
    30000,
  );
});
