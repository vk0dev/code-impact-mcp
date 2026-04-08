# code-impact-mcp

Impact analysis and blast radius for agent-driven code changes. Analyzes dependency graphs to predict what breaks before you commit.

## Installation

### Claude Code Plugin
```
/plugin install code-impact-mcp@vk0-plugins
```

### NPM (standalone MCP server)
```bash
npx @vk0/code-impact-mcp
```

### Remote HTTP
Add to `.mcp.json`:
```json
{
  "code-impact-mcp": {
    "type": "http",
    "url": "https://code-impact-mcp.vk0.dev/mcp"
  }
}
```

## Tools

<!-- TODO: Document each tool -->

### hello
**Input:** `name` (string) — Name to greet
**Output:** Greeting message
**When to use:** Testing connectivity only. Replace with real tools.

## Configuration

No configuration required.

## Limitations

- This is a scaffold — replace placeholder tools with real functionality.

## Changelog

### 0.1.0
- Initial scaffold
