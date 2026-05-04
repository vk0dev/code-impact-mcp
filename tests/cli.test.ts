import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HELP, executeCliMode, handleCliArgs, parseStagedFiles, renderVersion } from "../src/cli";

describe("CLI help/version UX", () => {
  it("returns non-empty help text with usage guidance", () => {
    let out = "";
    const mode = handleCliArgs(["--help"], (text) => {
      out += text;
    });

    expect(mode).toBe("help");
    expect(out).toContain("USAGE");
    expect(out).toContain("gate_check");
    expect(out).toContain("install-hook");
    expect(out.trim().length).toBeGreaterThan(40);
    expect(out).toBe(HELP);
  });

  it("renders version from package metadata instead of a stale hardcoded string", () => {
    let out = "";
    const mode = handleCliArgs(["--version"], (text) => {
      out += text;
    });

    expect(mode).toBe("version");
    expect(out).toBe(renderVersion());
    expect(out).toMatch(/^@vk0\/code-impact-mcp \d+\.\d+\.\d+\n$/);
  });

  it("falls through to server mode for normal MCP startup", () => {
    const mode = handleCliArgs([], () => {
      throw new Error("should not write output in server mode");
    });

    expect(mode).toBe("server");
  });
});

describe("CLI install-hook", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "code-impact-cli-"));
  });

  it("creates a husky pre-commit hook that calls the bounded hook runner", async () => {
    let out = "";

    const exitCode = await executeCliMode("install-hook", {
      cwd: root,
      write: (text) => {
        out += text;
      },
    });

    const hookPath = join(root, ".husky", "pre-commit");
    expect(exitCode).toBe(0);
    expect(out).toContain("Created");
    expect(readFileSync(hookPath, "utf8")).toContain("npx -y @vk0/code-impact-mcp run-hook");
  });

  it("refuses to overwrite an existing hook silently", async () => {
    const hookDir = join(root, ".husky");
    mkdirSync(hookDir, { recursive: true });
    writeFileSync(join(hookDir, "pre-commit"), "#!/usr/bin/env sh\necho existing\n", "utf8");

    let out = "";
    const exitCode = await executeCliMode("install-hook", {
      cwd: root,
      write: (text) => {
        out += text;
      },
    });

    expect(exitCode).toBe(1);
    expect(out).toContain("Refusing to overwrite existing hook");
    expect(readFileSync(join(hookDir, "pre-commit"), "utf8")).toContain("echo existing");
  });
});

describe("CLI run-hook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("reports skip when no staged TS/JS files are present", async () => {
    let out = "";
    const exitCode = await executeCliMode("run-hook", {
      cwd: "/tmp/project",
      write: (text) => {
        out += text;
      },
      collectFiles: () => [],
    });

    expect(exitCode).toBe(0);
    expect(out).toContain("no staged TS/JS files");
  });

  it("filters staged files down to JS/TS paths", () => {
    expect(parseStagedFiles("src/a.ts\nREADME.md\nsrc/b.py\nweb/view.tsx\n")).toEqual([
      "src/a.ts",
      "web/view.tsx",
    ]);
  });
});
