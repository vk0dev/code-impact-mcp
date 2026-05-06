# MCP Hive submission packet for code-impact-mcp
**Date:** 2026-05-06  
**Status:** READY_FOR_MANUAL_SUBMISSION  
**Scope:** operator packet only, no external submission performed here

This packet supersedes the older draft packet and folds in the current repo truth after v1.6.0.

## Canonical project identity
- **Product name:** CodeImpact MCP
- **npm package:** `@vk0/code-impact-mcp`
- **MCP server name:** `io.github.vk0dev/code-impact-mcp`
- **Current version:** `1.6.0`
- **Repository:** https://github.com/vk0dev/code-impact-mcp
- **Homepage:** https://vk0dev.github.io/code-impact-mcp
- **Primary install:** `npx -y @vk0/code-impact-mcp`

## Current short descriptions
### package.json
> Lightweight pre-commit safety gate for AI agents. Answers 'is this change safe?' with PASS/WARN/BLOCK verdict in seconds. Zero setup, no database.

### server.json
> Dependency graph and blast-radius analysis for local TypeScript/JavaScript repos.

## Current shipped feature truth
Use only these claims in MCP Hive submission text.

- Local-first pre-commit safety gate for AI-assisted code changes
- PASS/WARN/BLOCK decision-first output instead of graph-explorer positioning
- Core tools: `gate_check`, `detect_cycles`, `analyze_impact`, `get_dependencies`, `refresh_graph`
- Monorepo/workspace-aware checks for pnpm/package.json workspaces and lerna-style repos
- Safe Husky-only `install-hook` helper shipped in v1.6.0
- Python support is **bounded** and should be described narrowly: a file-level path for `analyze_impact` and `gate_check`, not full parity with the TS/JS graph surface
- No cloud dependency, no API key, no database requirement

## Safe wording for install-hook helper
Use this framing, not stronger wording:
- `install-hook` is a safe Husky-only helper
- It refuses to modify unrelated `.husky/pre-commit` content unless a managed `code-impact-mcp` block already exists
- Reruns are idempotent only inside that owned block
- If Husky is not initialized, it stops with an actionable message instead of scaffolding hook infrastructure

## Marketplace / discovery truth
Do not over-claim beyond the following:
- **npm:** live
- **Official MCP Registry metadata:** live via `server.json`
- **awesome-mcp-servers:** external PR exists, but not merged/live as a listing claim
- **Glama:** still pending a real listing URL for the blocked external PR lane
- **MCP Hive:** manual submission next step, not a currently claimed live listing

## Suggested operator-facing summary
Use a concise product summary close to this wording:

> CodeImpact MCP is a local-first MCP server that gives AI coding agents a fast PASS/WARN/BLOCK dependency gate before commit. It focuses on TypeScript/JavaScript repos, surfaces blast radius and compact cycle hotspots, supports monorepo-aware checks, and includes a safe Husky-only install-hook helper. Python support is intentionally narrower and limited to a file-level path for impact/gate checks.

## Asset checklist for manual MCP Hive submission
### Primary visuals
- `docs/demo-gate-check.gif`
- `docs/demo-blast-radius.gif`

### Secondary visuals
- `docs/demo-detect-cycles.gif`
- `docs/demo-install-hook.gif`
- `docs/demo-get-dependencies.gif`
- `docs/demo-refresh-graph.gif`
- `docs/demo-python-analyze-impact.gif`

### Matching cast sources
- `docs/demo-gate-check.cast`
- `docs/demo-blast-radius.cast`
- `docs/demo-detect-cycles.cast`
- `docs/demo-install-hook.cast`
- `docs/demo-get-dependencies.cast`
- `docs/demo-refresh-graph.cast`
- `docs/demo-python-analyze-impact.cast`

## Pre-submit operator checklist
- Confirm `package.json` version still matches `server.json` version
- Confirm README discovery note still says MCP Hive is submit-next, not live
- Confirm install command remains `npx -y @vk0/code-impact-mcp`
- Use only shipped demo assets listed above
- Do not mention Glama as live unless a real listing URL exists
- Do not describe Python as full graph-surface support

## Repo verification snapshot used for this packet
- `package.json` version: `1.6.0`
- `server.json` version: `1.6.0`
- `CHANGELOG.md` contains `1.6.0` entry with `install-hook` helper
- README already carries the current discovery truthfulness note
- Demo assets present under `docs/` for gate, blast radius, cycles, install-hook, get_dependencies, refresh_graph, and bounded Python path

## Verdict
**READY_FOR_MANUAL_SUBMISSION**

No additional repo metadata change was required during this packet refresh. If a future operator pass finds a marketplace-specific form mismatch, open a new bounded task against the exact field/file rather than broadening this packet.
