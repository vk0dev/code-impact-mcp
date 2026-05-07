# Quickstart: Claude Desktop in under 10 minutes

Use this when you want the fastest truthful path from install to a real `gate_check` or `analyze_impact` call without reading the full README.

## 1. Add the MCP server

Claude Desktop reads `claude_desktop_config.json` from:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add this server entry:

```json
{
  "mcpServers": {
    "code-impact-mcp": {
      "command": "npx",
      "args": ["-y", "@vk0/code-impact-mcp"]
    }
  }
}
```

Then fully restart Claude Desktop.

## 2. Open the repository you want to analyze

This server is local-first. It reads the repo from the working directory Claude launches it in, so use it inside the project you actually want to check.

## 3. Ask one of these first questions

Start with a bounded question:

- `Run gate_check on src/routes.ts with threshold 0.5.`
- `Analyze impact for src/services/billing.ts.`
- `Detect cycles in this repo.`

## 4. What to expect

### `gate_check`

Typical output shape:

```json
{
  "verdict": "WARN",
  "riskScore": 0.29,
  "reasons": [
    "Risk score 0.29 is approaching threshold. Review affected files."
  ]
}
```

Use it for the decision first:

- `PASS` = low graph-based risk
- `WARN` = review before commit
- `BLOCK` = too much blast radius or a changed-file cycle

### `analyze_impact`

Typical output shape:

```json
{
  "changedFiles": ["src/services/billing.ts"],
  "directlyAffected": ["src/api/checkout.ts"],
  "transitivelyAffected": ["src/index.ts"],
  "riskScore": 0.43,
  "totalAffected": 2
}
```

Use it when you want the affected-file fanout before deciding whether the change is worth it.

## 5. Good first workflow

A practical first pass is:

1. run `analyze_impact` on the file you want to touch
2. if the fanout looks wide, run `gate_check`
3. if `gate_check` mentions cycles, run `detect_cycles`

## Related docs

- [How to read `analyze_impact` and `gate_check` output](./read-analyze-impact-output.md)
- [Pre-commit gate recipe with the shipped install-hook helper](./pre-commit-gate-recipe.md)
- [Docs and quick recipes index](./README.md)
