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
    expect(out).toContain("npx -y @vk0/code-impact-mcp install-hook");
    expect(out).toContain("npx -y @vk0/code-impact-mcp run-hook");
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

  it("creates a husky pre-commit hook block when husky exists", async () => {
    mkdirSync(join(root, ".husky"), { recursive: true });

    let out = "";
    const exitCode = await executeCliMode("install-hook", {
      cwd: root,
      write: (text) => {
        out += text;
      },
    });

    const hookPath = join(root, ".husky", "pre-commit");
    const hook = readFileSync(hookPath, "utf8");
    expect(exitCode).toBe(0);
    expect(out).toContain("Created");
    expect(hook).toContain("BEGIN code-impact-mcp");
    expect(hook).toContain("npx -y @vk0/code-impact-mcp run-hook");
  });

  it("appends or updates its own block without clobbering unrelated hook content", async () => {
    const hookDir = join(root, ".husky");
    mkdirSync(hookDir, { recursive: true });
    writeFileSync(join(hookDir, "pre-commit"), "#!/usr/bin/env sh\necho existing\n", "utf8");

    let firstOut = "";
    const firstExit = await executeCliMode("install-hook", {
      cwd: root,
      write: (text) => {
        firstOut += text;
      },
    });

    const hookPath = join(hookDir, "pre-commit");
    const firstHook = readFileSync(hookPath, "utf8");
    expect(firstExit).toBe(0);
    expect(firstOut).toContain("Updated");
    expect(firstHook).toContain("echo existing");
    expect(firstHook.match(/BEGIN code-impact-mcp/g)).toHaveLength(1);

    let secondOut = "";
    const secondExit = await executeCliMode("install-hook", {
      cwd: root,
      write: (text) => {
        secondOut += text;
      },
    });

    const secondHook = readFileSync(hookPath, "utf8");
    expect(secondExit).toBe(0);
    expect(secondOut).toContain("Already installed");
    expect(secondHook).toBe(firstHook);
    expect(secondHook.match(/BEGIN code-impact-mcp/g)).toHaveLength(1);
  });

  it("returns an actionable message when husky infra is absent", async () => {
    let out = "";
    const exitCode = await executeCliMode("install-hook", {
      cwd: root,
      write: (text) => {
        out += text;
      },
    });

    expect(exitCode).toBe(1);
    expect(out).toContain(".husky directory not found");
    expect(out).toContain("Initialize Husky first");
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
