# Docs and quick recipes

Use this page when you want the shortest path to the already-shipped `@vk0/code-impact-mcp` workflows without reading the full root README.

## Start here

- If your main question is **"is this safe to commit?"**, start with the root [README](../README.md) tool examples for `gate_check`, `analyze_impact`, and `detect_cycles`.
- If you want a visual walkthrough first, open the shipped demo GIFs already referenced from the root README.

## Direct stdio config quickstart

If your MCP client wants a plain stdio entrypoint, use:

```bash
npx -y @vk0/code-impact-mcp
```

For Claude Desktop JSON config, use the `mcpServers` example in the root [README](../README.md) and save it in `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows, then fully restart Claude Desktop.

## Install-hook helper quickstart

`code-impact-mcp install-hook` is the bounded helper for wiring the pre-commit gate into an existing Husky setup.
Use `npm run demo:install-hook` when you want a dry-run preview of the managed Husky snippet without creating or modifying `.husky` files.

```bash
npx -y @vk0/code-impact-mcp install-hook
```

### What it does

- adds or refreshes the managed `code-impact-mcp` block in `.husky/pre-commit`
- keeps reruns idempotent when that managed block already exists
- gives you a direct path to pre-commit gate wiring without hand-editing the hook

### What it does when `.husky/` is absent

- it does **not** bootstrap Husky for you
- it stops with an actionable message instead of scaffolding hook infrastructure
- it does **not** rewrite arbitrary existing hook logic outside the managed block

For the full shipped truth and the demo asset, see the install-hook section in the [project README](../README.md).

## Bounded Python gate quickstart

Python support in CodeImpact MCP is intentionally narrow.

Current shipped truth:

- the full graph surface is still centered on TypeScript and JavaScript
- Python support is a **bounded file-level wedge** for `analyze_impact` and `gate_check`
- this is useful when changed files are `.py`, but it is **not** a broad multi-language platform claim

Use the Python wedge when you want a local pre-commit signal for touched Python files, not a repo-wide language-agnostic dependency platform.

## Core quick paths

### `gate_check`

Use `gate_check` when you want a decision-first PASS/WARN/BLOCK answer before commit.

Good fit:
- pre-commit review of touched files
- fast blast-radius triage with a gate verdict
- monorepo-aware checks on the shipped TS/JS graph surface

See the root [README gate_check example](../README.md) and the shipped [gate_check demo GIF](./demo-gate-check.gif).

### `analyze_impact`

Use `analyze_impact` when you want affected-file output and a bounded risk score before changing or merging code.

Good fit:
- checking direct and transitive blast radius
- comparing a few candidate files before refactoring
- using the bounded Python path on `.py` changes without claiming full graph parity

See the root [README analyze_impact example](../README.md) and the shipped [blast-radius demo GIF](./demo-blast-radius.gif).

## What this page does not replace

This page is a shortcut. For installation details, complete tool descriptions, comparison copy, and the full current product wording, go back to the [project README](../README.md).
