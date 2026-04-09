# CodeImpact MCP — PRD

**Status: approved**
**Owner:** vk
**Date:** 2026-04-08

## Problem Statement

AI coding agents (Claude Code, Cursor, Copilot) regularly break dependencies during multi-file refactoring because they don't see the cascade effects of their changes. A function renamed in one file silently breaks 12 imports elsewhere. This is the #1 complaint in the Claude Code community (GitHub Issue #42796, 596 HN points).

## North Star

Every agent has a pre-commit safety net that shows blast radius before changes are committed.

## Scope

### In Scope
- TypeScript/JavaScript dependency graph via AST parsing (ts-morph)
- 4 MCP tools: `analyze_impact`, `get_dependencies`, `gate_check`, `refresh_graph`
- ESM and CommonJS import resolution
- Cycle detection (Tarjan's SCC)
- Risk scoring (fan-out × depth)
- MIT license, open source

### Out of Scope (v1)
- Python/Go/Rust support (v2)
- AI-powered suggestions (Pro tier, later)
- Web dashboard
- CI/CD integration
- Monorepo support beyond basic path resolution

## Core User Flow

1. Agent starts refactoring task
2. Agent calls `refresh_graph` on the project
3. Before committing, agent calls `analyze_impact` with changed files
4. Gets structured response: affected files, risk score, cascade chain
5. If high risk → agent calls `gate_check` for PASS/WARN/FAIL verdict
6. Agent adjusts changes or proceeds based on verdict

## Competition

| Competitor | Why we win |
|---|---|
| SYKE (2 stars, Elastic License) | MIT license, better UX, focused toolset |
| Codegraph (30 tools, CLI) | 4 focused tools vs 30 unfocused, MCP-native |
| SonarQube MCP | No enterprise subscription required |

## Success Metrics

- Graph builds <5s on 500-file project
- analyze_impact finds 80%+ affected files correctly
- 3+ dogfood sessions show agent uses tools naturally
- Published on NPM + Smithery + Official MCP Registry
