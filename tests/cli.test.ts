import { describe, expect, it } from "vitest";

import { HELP, handleCliArgs, renderVersion } from "../src/cli";

describe("CLI help/version UX", () => {
  it("returns non-empty help text with usage guidance", () => {
    let out = "";
    const mode = handleCliArgs(["--help"], (text) => {
      out += text;
    });

    expect(mode).toBe("help");
    expect(out).toContain("USAGE");
    expect(out).toContain("gate_check");
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
    expect(out).toContain("@vk0/code-impact-mcp 1.2.0");
  });

  it("falls through to server mode for normal MCP startup", () => {
    const mode = handleCliArgs([], () => {
      throw new Error("should not write output in server mode");
    });

    expect(mode).toBe("server");
  });
});
