#!/usr/bin/env node
// CLI entry. Default behavior is to start the MCP server on stdio (which is
// what every MCP client expects). With `--help` we print configuration
// guidance for people who run `npx -y @vk0/code-impact-mcp --help` to find
// out what this thing is — they get an answer instead of a hung process.

const HELP = `code-impact-mcp — pre-commit dependency safety gate (MCP server)

USAGE
  npx -y @vk0/code-impact-mcp           Start the MCP server on stdio.
  npx -y @vk0/code-impact-mcp --help    Show this help.
  npx -y @vk0/code-impact-mcp --version Show the package version.

WHAT IT IS
  A Model Context Protocol (MCP) server. It is meant to be configured as a
  tool inside an MCP client, not run interactively. Once configured, your
  client (e.g. Claude Code, Cursor, Cline) can call its 4 tools:

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

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  process.stdout.write(HELP);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write("@vk0/code-impact-mcp 1.0.2\n");
  process.exit(0);
}

// Default: start the MCP server.
await import("./server.js");
