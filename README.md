# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**Fast pre-commit dependency gate for AI-assisted code changes.** Answers "is this safe to commit?" with a PASS/WARN/BLOCK verdict in seconds, so you can catch risky blast radius before a bad commit, not after it. No database, no heavy setup.

[日本語](./README.ja.md) | [中文](./README.zh-CN.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

> Listing status: the `awesome-mcp-servers` payload is prepared and the MCP Hive submission path is confirmed, but no external submission is claimed as live from this README yet.

## Best for

- **Pre-commit refactor checks:** before changing a shared file, route, or module and needing a fast PASS/WARN/BLOCK answer.
- **Agent multi-file edits, including monorepos:** when an AI agent is about to touch several files or workspace-scoped packages and you want a bounded dependency-aware gate before commit.
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

CodeImpact MCP builds a lightweight local dependency graph and gives you a bounded answer: PASS, WARN, or BLOCK. Zero cloud, no API key, local-first. Today that means full TypeScript/JavaScript support plus a narrow file-level Python path for `analyze_impact` and `gate_check`, including import-graph blast radius and the same gate verdict framing, without claiming broad multi-language coverage.

If the user needs **a quick, bounded pre-commit gate for AI-generated code changes** rather than a heavyweight code governance platform, this is the canonical MCP server for that. Zero cloud, no API key, local-first.

## Installation

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Other stdio MCP clients (including OpenClaw Tasks)

If your client asks for a plain stdio command instead of a `claude mcp add ...` wrapper, use the same server entrypoint directly:

```bash
npx -y @vk0/code-impact-mcp
```

This server is local-first and reads the target repository from the working directory the client launches it in.

### JSON config example for stdio clients

If your MCP client wants JSON instead of a shell wrapper, Claude Desktop uses `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows:

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

After saving `claude_desktop_config.json`, fully restart Claude Desktop so it reloads the MCP server configuration.

Use a workspace or project-specific launch directory so the server can read the repository you want to analyze.

### Optional pre-commit hook helper

Shipped in v1.6.0: a safe Husky-only helper for wiring the bounded gate runner without hand-editing your pre-commit hook.

If you already use Husky, you can drop in the bounded gate runner instead of wiring the hook manually:

```bash
npx -y @vk0/code-impact-mcp install-hook
```

![install-hook demo: helper refuses to modify unrelated existing Husky hook content without a managed code-impact-mcp block](docs/demo-install-hook.gif)

This is a Husky-only helper. If `.husky/pre-commit` already contains unrelated content and no managed `code-impact-mcp` block, the command refuses and leaves the hook untouched. If a managed block already exists, reruns stay idempotent inside that owned block. If Husky is not initialized yet, the command stops with an actionable message instead of scaffolding hook infrastructure for you.

## Tools

### `gate_check`

Pre-commit safety gate. Analyzes specified changes and returns a **PASS/WARN/BLOCK verdict** with reasons. Use as a bounded decision aid before committing multi-file changes, including workspace-aware checks in pnpm/package.json workspaces and lerna-style monorepos. BLOCK means risk exceeds threshold or a changed file participates in a detected cycle. WARN means human review recommended, including graphs that contain cycles elsewhere. PASS means low graph-based risk.

### `detect_cycles`

Return compact strongly connected components for circular dependencies in the current TS/JS graph. Use before refactors or release gating when you want a short list of cycle hotspots instead of a full graph visualization.

![detect_cycles demo: surfaces compact cycle hotspots instead of a full graph dump](docs/demo-detect-cycles.gif)

### `analyze_impact`

Analyze the blast radius of changing specific files. Returns which files would be directly and transitively affected, with a risk score (0-1). Use BEFORE committing multi-file changes to understand what might break. Does NOT modify any files.

![analyze_impact demo](docs/demo-blast-radius.gif)

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

![gate_check demo: single changed file triggers a decision-first BLOCK verdict before commit](docs/demo-gate-check.gif)

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

If you are choosing a tool for an agent or reviewer, the key question is simple: do you need to **explore the graph**, or do you need to **gate one proposed change**?

| Alternative | Best at | Where it wins | Where CodeImpact MCP wins |
| --- | --- | --- | --- |
| **CodeImpact MCP** | Fast single-verdict dependency gating for TS/JS repos | Immediate PASS/WARN/BLOCK decision, local-first workflow, zero setup | Best fit when the job is "is this safe to commit?" rather than "help me explore the whole repo" |
| **code-graph-mcp** | Wider graph inspection through an MCP tool surface | Better when the agent wants to traverse relationships and inspect the code graph from multiple angles | Better when you want one bounded pre-commit verdict instead of a graph-exploration session |
| **Depwire** | Broader dependency intelligence across larger dependency workflows | Better when you need a heavier platform view, deeper dependency management, or wider language coverage | Better when you want a small MIT tool that runs locally and answers the gating question quickly |
| **RepoGraph** | Graph-first browsing and repository discovery | Better when the user is still learning the codebase and wants to inspect structure interactively | Better when the touched files are already known and you only need blast-radius triage plus a gate result |
| **CodeGraphContext** | Repository context retrieval for longer-form agent reasoning | Better when the agent needs broad code context for planning, synthesis, or explanation | Better when you want decision-first output, not a general context provider |

**Choose CodeImpact MCP when:** you already know the files in play and want a fast, local, MIT-licensed answer with a risk score and a clear PASS/WARN/BLOCK verdict.

**Choose one of the alternatives when:** the main job is graph exploration, repo understanding, wider dependency workflow coverage, or context retrieval for longer reasoning loops.

## FAQ

**Q: Does it access the network?**
A: No. CodeImpact MCP is 100% local-first. It reads your project files via ts-morph and never makes network requests. No API keys, no cloud, no telemetry.

**Q: Will it modify my code?**
A: No. All 5 tools are read-only (annotated with `readOnlyHint: true`). They analyze but never write.

**Q: How accurate is the risk score?**
A: The risk score is a graph-based heuristic (affected files / total files). It does not know about runtime behavior, tests, or data migrations. Treat it as a triage signal, not a guarantee.

**Q: What languages does it support today?**
A: Full support is still centered on TypeScript and JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`). There is also a bounded Python path for `analyze_impact` and `gate_check` when changed files are `.py`, but it stays at file/module-level impact instead of broad multi-language platform coverage.

**Q: How fast is it?**
A: Graph building typically takes 1-5 seconds depending on project size. Individual tool calls against a cached graph are near-instant.

**Q: Does it cache the graph?**
A: Yes, the graph is cached in-memory per (projectRoot, tsconfigPath) pair. Use `refresh_graph` to rebuild after significant changes.

## Limitations

- Full graph depth is still strongest for TypeScript/JavaScript; Python support is intentionally bounded to local file/module-level impact, not a full multi-language platform.
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
