import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import {
  DOCUMENTED_INSTALL_SURFACES,
  findDocumentedInstallSurfaces,
  getAuditSeverityCounts,
  hasBlockingAuditVulnerabilities,
} from "../scripts/release-check.mjs";

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

  it("stays green on the current repo head", () => {
    expect(() =>
      execFileSync(process.execPath, ["scripts/release-check.mjs"], {
        cwd: process.cwd(),
        stdio: "pipe",
        encoding: "utf8",
      }),
    ).not.toThrow();
  });
});
