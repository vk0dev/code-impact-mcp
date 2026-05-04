#!/usr/bin/env node
// CLI entry. Default behavior is to start the MCP server on stdio (which is
// what every MCP client expects). With `--help` we print configuration
// guidance for people who run `npx -y @vk0/code-impact-mcp --help` to find
// out what this thing is, they get an answer instead of a hung process.

import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { registerTools } from "./tools/index.js";
import { installHook } from "./cli/install-hook.js";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };

type ToolHandler = (input: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

class FakeServer {
  handlers = new Map<string, ToolHandler>();

  registerTool(name: string, _config: unknown, handler: ToolHandler) {
    this.handlers.set(name, handler);
  }
}

export const HELP = `code-impact-mcp — pre-commit dependency safety gate (MCP server)

USAGE
  npx -y @vk0/code-impact-mcp               Start the MCP server on stdio.
  npx -y @vk0/code-impact-mcp --help        Show this help.
  npx -y @vk0/code-impact-mcp --version     Show the package version.
  npx -y @vk0/code-impact-mcp install-hook  Install the managed hook block when safe.

WHAT IT IS
  A Model Context Protocol (MCP) server. It is meant to be configured as an MCP
  tool, not run interactively. Once configured, your client (e.g. Claude Code,
  Cursor, Cline) can call its 5 tools:

    gate_check         PASS/WARN/BLOCK verdict on a planned change
    analyze_impact     blast-radius analysis: which files would be affected
    detect_cycles      compact circular dependency scan
    get_dependencies   import / importedBy edges for a file
    refresh_graph      rebuild the cached dependency graph

CONFIGURE in Claude Desktop  (~/Library/Application Support/Claude/claude_desktop_config.json)
  {
    "mcpServers": {
      "code-impact": {
        "command": "npx",
        "args": ["-y", "@vk0/code-impact-mcp"]
      }
    }
  }

CONFIGURE in Claude Code
  claude mcp add --transport stdio code-impact -- npx -y @vk0/code-impact-mcp

HOOK INSTALL
  install-hook manages a marked code-impact-mcp block inside .husky/pre-commit:
    npx -y @vk0/code-impact-mcp install-hook
  The installed hook then runs:
    npx -y @vk0/code-impact-mcp run-hook
  If Husky exists, it installs or updates only the managed block.
  If Husky is absent, it prints a safe snippet instead of scaffolding hook infra.
  It refuses to overwrite unrelated hook content and remains idempotent for the managed block.

LINKS
  npm:  https://www.npmjs.com/package/@vk0/code-impact-mcp
  repo: https://github.com/vk0dev/code-impact-mcp
`;

export function renderVersion(): string {
  return `${pkg.name} ${pkg.version}\n`;
}

export function resolveCliMode(args: string[]): "help" | "version" | "install-hook" | "run-hook" | "server" {
  if (args.includes("--help") || args.includes("-h")) return "help";
  if (args.includes("--version") || args.includes("-v")) return "version";
  if (args[0] === "install-hook") return "install-hook";
  if (args[0] === "run-hook") return "run-hook";
  return "server";
}

export function handleCliArgs(args: string[], write: (text: string) => void): "help" | "version" | "install-hook" | "run-hook" | "server" {
  const mode = resolveCliMode(args);
  if (mode === "help") write(HELP);
  if (mode === "version") write(renderVersion());
  return mode;
}

export function parseStagedFiles(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => /\.(?:[cm]?[jt]sx?)$/i.test(file));
}

export function collectStagedFiles(cwd: string): string[] {
  return parseStagedFiles(
    execFileSync("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMR"], {
      cwd,
      encoding: "utf8",
    }),
  );
}

export async function runInstalledHook(
  cwd: string,
  write: (text: string) => void,
  collectFiles: (cwd: string) => string[] = collectStagedFiles,
): Promise<number> {
  const files = collectFiles(cwd);
  if (files.length === 0) {
    write("code-impact-mcp: no staged TS/JS files, skipping gate.\n");
    return 0;
  }

  const server = new FakeServer();
  registerTools(server as any);
  const handler = server.handlers.get("gate_check");
  if (!handler) throw new Error("gate_check handler not registered");

  const result = await handler({ projectRoot: cwd, files, threshold: 0.5 });
  const payload = JSON.parse(result.content[0]?.text ?? "{}");
  write(`code-impact-mcp: ${payload.verdict} for ${files.length} staged file(s).\n`);
  if (payload.scanSummary) write(`${payload.scanSummary}\n`);
  if (Array.isArray(payload.reasons)) {
    for (const reason of payload.reasons) write(`- ${reason}\n`);
  }
  return payload.verdict === "BLOCK" ? 1 : 0;
}

export async function executeCliMode(
  mode: "help" | "version" | "install-hook" | "run-hook" | "server",
  options: { cwd: string; write: (text: string) => void; collectFiles?: (cwd: string) => string[] },
): Promise<number> {
  if (mode === "help" || mode === "version") return 0;

  if (mode === "install-hook") {
    const result = installHook(options.cwd, pkg.name);
    if (result.status === "print-only") {
      options.write(`${result.message}\n\n${result.snippet}\n`);
      return 0;
    }
    if (result.status === "refused") {
      options.write(`${result.message}\n\nSuggested snippet:\n${result.snippet}\n`);
      return 1;
    }
    if (result.status === "created") {
      options.write(`Created ${result.hookPath}\n`);
      return 0;
    }
    if (result.status === "updated") {
      options.write(`Updated ${result.hookPath}\n`);
      return 0;
    }
    options.write(`Already installed in ${result.hookPath}\n`);
    return 0;
  }

  if (mode === "run-hook") {
    return runInstalledHook(options.cwd, options.write, options.collectFiles);
  }

  await import("./server.js");
  return 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const mode = handleCliArgs(process.argv.slice(2), (text) => process.stdout.write(text));
  const exitCode = await executeCliMode(mode, { cwd: process.cwd(), write: (text) => process.stdout.write(text) });
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
