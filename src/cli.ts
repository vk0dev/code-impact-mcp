#!/usr/bin/env node
// CLI entry. Default behavior is to start the MCP server on stdio (which is
// what every MCP client expects). With `--help` we print configuration
// guidance for people who run `npx -y @vk0/code-impact-mcp --help` to find
// out what this thing is, they get an answer instead of a hung process.

import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const pkg = require("../package.json") as { name: string; version: string };

export const HELP = `code-impact-mcp — pre-commit dependency safety gate (MCP server)

USAGE
  npx -y @vk0/code-impact-mcp           Start the MCP server on stdio.
  npx -y @vk0/code-impact-mcp --help    Show this help.
  npx -y @vk0/code-impact-mcp --version Show the package version.

WHAT IT IS
  A Model Context Protocol (MCP) server. It is meant to be configured as an MCP
  tool, not run interactively. Once configured, your client (e.g. Claude Code,
  Cursor, Cline) can call its 4 tools:

    gate_check         PASS/WARN/BLOCK verdict on a planned change
    analyze_impact     blast-radius analysis: which files would be affected
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

LINKS
  npm:  https://www.npmjs.com/package/@vk0/code-impact-mcp
  repo: https://github.com/vk0dev/code-impact-mcp
`;

export function renderVersion(): string {
  return `${pkg.name} ${pkg.version}\n`;
}

export function handleCliArgs(args: string[], write: (text: string) => void): "help" | "version" | "server" {
  if (args.includes("--help") || args.includes("-h")) {
    write(HELP);
    return "help";
  }

  if (args.includes("--version") || args.includes("-v")) {
    write(renderVersion());
    return "version";
  }

  return "server";
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  const mode = handleCliArgs(process.argv.slice(2), (text) => process.stdout.write(text));
  if (mode === "server") {
    await import("./server.js");
  }
}
