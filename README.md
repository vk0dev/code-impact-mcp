# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**Fast pre-commit dependency gate for AI-assisted code changes.** Answers "is this safe to commit?" with a PASS/WARN/BLOCK verdict in seconds, so you can catch risky blast radius before a bad commit, not after it. No database, no heavy setup.

[日本語](./README.ja.md) | [中文](./README.zh-CN.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Best for

- **Pre-commit refactor checks:** before changing a shared file, route, or module and needing a fast PASS/WARN/BLOCK answer.
- **Agent multi-file edits:** when an AI agent is about to touch several files and you want a bounded dependency-aware gate before commit.
- **Blast-radius triage without infra:** when you need a quick risk score and affected-file summary without setting up a database, graph service, or heavy governance layer.

## Not for

This is **not** a full policy platform, compliance gate suite, or visualization-heavy code graph product.

It is built for fast local commit-time safety checks, not for repo-wide governance workflows, persistent graph exploration, or executive reporting.

## Why / When to use

Use this MCP server when:

- The user asks: **"What will break if I change this file?"**
- The user asks: **"Is this refactoring safe to commit?"**
- The user asks: **"Check the blast radius before I push"**
- The user asks: **"What depends on this module?"**
- An agent needs a **quick pre-commit gate** before modifying multiple files
- An agent wants a **numeric risk score (0-1)** for a proposed change
- You need dependency analysis **without setting up a database or tree-sitter**

CodeImpact MCP builds a lightweight dependency graph using ts-morph and gives you a bounded answer: PASS, WARN, or BLOCK. Zero cloud, no API key, local-first.

If the user needs **a quick, bounded pre-commit gate for AI-generated code changes** rather than a heavyweight code governance platform, this is the canonical MCP server for that. Zero cloud, no API key, local-first.

## Install

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

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

### Cursor

Add to `.cursor/mcp.json`:

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

### Cline

Add to Cline MCP settings:

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

## Tools

### `gate_check`

Pre-commit safety gate. Analyzes specified changes and returns a **PASS/WARN/BLOCK verdict** with reasons. Use as a bounded decision aid before committing multi-file changes. BLOCK means risk exceeds threshold or a changed file participates in a detected cycle. WARN means human review recommended, including graphs that contain cycles elsewhere. PASS means low graph-based risk.

### `detect_cycles`

Return compact strongly connected components for circular dependencies in the current TS/JS graph. Use before refactors or release gating when you want a short list of cycle hotspots instead of a full graph visualization.

### `analyze_impact`

Analyze the blast radius of changing specific files. Returns which files would be directly and transitively affected, with a risk score (0-1). Use BEFORE committing multi-file changes to understand what might break. Does NOT modify any files.

### `get_dependencies`

Get the import and importedBy relationships for a specific file. Shows what this file depends on and what depends on it. Use to understand coupling before refactoring a file.

### `refresh_graph`

Rebuild the dependency graph from scratch. Call this after significant file additions/deletions, or if results seem stale. Returns graph statistics including file count, edge count, build time, and circular dependencies detected.

## Example conversation

**User:** "I want to refactor `src/routes.ts` — is it safe?"

**Agent calls** `gate_check`:
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

**Result:**
```json
{
  "verdict": "BLOCK",
  "scanSummary": "BLOCK, 8 affected across src/routes (4), src/pages (2), src (2)",
  "recommendation": "Refactor the circular dependency before shipping this change.",
  "riskScore": 0.35,
  "reasons": [
    "Changed files participate in a circular dependency. Example: src/router.ts → src/routes.ts"
  ],
  "affectedFiles": 8,
  "circularDependencies": 1,
  "affectedCycles": [["src/router.ts", "src/routes.ts"]]
}
```

**Agent:** "The gate check returned BLOCK — routes.ts is part of a cycle, so I should untangle that before making more changes."

**Agent calls** `detect_cycles`:
```json
{
  "projectRoot": "/Users/you/projects/my-app"
}
```

**Result:**
```json
{
  "cycleCount": 2,
  "hotspots": ["src/router.ts", "src/routes.ts"],
  "cycles": [
    ["src/router.ts", "src/routes.ts"],
    ["src/cache/index.ts", "src/cache/store.ts"]
  ]
}
```

## How it works

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Agent asks  │────▶│  ts-morph     │────▶│  In-memory    │
│  "safe to    │     │  parses       │     │  dependency   │
│   change?"   │     │  imports      │     │  graph        │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                    ┌──────────────┐     ┌───────▼───────┐
                    │  PASS/WARN/  │◀────│  BFS traverse  │
                    │  BLOCK       │     │  reverse deps  │
                    │  + risk 0-1  │     │  + risk score  │
                    └──────────────┘     └───────────────┘
```

1. **Parse:** ts-morph scans your project for ESM imports, re-exports, and CommonJS requires
2. **Graph:** Builds an in-memory dependency graph (no database, no persistence)
3. **Analyze:** BFS traversal of reverse dependencies from changed files
4. **Score:** Risk = affected files / total files (0-1)
5. **Verdict:** PASS (< 60% of threshold), WARN (60-100%), BLOCK (> threshold)

Supports: ESM imports, ESM re-exports, CommonJS `require()`, NodeNext-style `.js` → `.ts` resolution.

## Comparison

| Feature | CodeImpact MCP | Codegraph | Depwire | dependency-mcp |
|---------|:---:|:---:|:---:|:---:|
| Pre-commit gate (PASS/WARN/BLOCK) | **Yes** | No | No | No |
| Numeric risk score (0-1) | **Yes** | No | Health score | No |
| Zero setup (no database) | **Yes** | SQLite required | Setup required | Yes |
| Install time | **Seconds** | Minutes | Minutes | Seconds |
| License | **MIT** | MIT | **BSL 1.1** | MIT |
| Number of tools | 5 | 30+ | 10 | 3 |
| Language support | TS/JS | 11 languages | Multi | Multi |
| Circular dependency detection | **Yes** | Yes | Yes | No |
| Agent-optimized output | **Yes** | Partial | Partial | Partial |
| Local-first / zero cloud | **Yes** | Yes | Yes | Yes |

**When to choose CodeImpact MCP:** You want a quick, bounded answer (PASS/WARN/BLOCK) before committing — not a full codebase exploration tool. Zero setup, MIT license, works in seconds.

**When to choose Codegraph/Depwire:** You need deep codebase exploration across many languages with persistent storage and visualization.

## FAQ

**Q: Does it access the network?**
A: No. CodeImpact MCP is 100% local-first. It reads your project files via ts-morph and never makes network requests. No API keys, no cloud, no telemetry.

**Q: Will it modify my code?**
A: No. All 5 tools are read-only (annotated with `readOnlyHint: true`). They analyze but never write.

**Q: How accurate is the risk score?**
A: The risk score is a graph-based heuristic (affected files / total files). It does not know about runtime behavior, tests, or data migrations. Treat it as a triage signal, not a guarantee.

**Q: Does it support JavaScript-only projects?**
A: Yes. It works with TypeScript and JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`).

**Q: How fast is it?**
A: Graph building typically takes 1-5 seconds depending on project size. Individual tool calls against a cached graph are near-instant.

**Q: Does it cache the graph?**
A: Yes, the graph is cached in-memory per (projectRoot, tsconfigPath) pair. Use `refresh_graph` to rebuild after significant changes.

## Limitations

- TypeScript/JavaScript only (no multi-language support)
- No distinction between runtime imports and type-only imports
- Graph is in-memory only (no persistence across server restarts)
- Risk score is structural, not semantic — it doesn't know which files are "important"
- No visualization output (text/JSON only)

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for release history.

## License

[MIT](./LICENSE) — free to use in any project, commercial or personal.

## Contributing

Issues and PRs welcome at [github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp).
