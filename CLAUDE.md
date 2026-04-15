# @vk0/code-impact-mcp

Dependency graph and blast-radius analysis for agent-driven code changes. Predicts what breaks before you commit.

## Stack
- TypeScript, `@modelcontextprotocol/sdk`, Zod, ts-morph
- Vitest for unit tests

## Commands
- Install: `npm ci`
- Build: `npm run build`
- Test: `npm test`
- Lint: `npm run lint`
- Smoke test: `npm run smoke`

## Publishing
- See PUBLISHING.md for full marketplace playbook
- Version sync: `package.json`, `.claude-plugin/plugin.json`, `server.json`, `src/createServer.ts`
- Release: `git tag -a vX.Y.Z && git push --follow-tags` → CI publishes to npm + MCP Registry + Smithery

## Architecture
- `src/createServer.ts` — McpServer factory, exports `createServer()` and `createSandboxServer()` (Smithery)
- `src/server.ts` — CLI/stdio entry point, uses `createServer()`
- `src/index.ts` — Barrel exports for library usage
- `src/tools/index.ts` — 4 MCP tools registration
- `src/graph.ts` — ts-morph dependency graph builder, impact analysis, cycle detection

## Notes
- Analyzes TS/JS projects by parsing import/export relationships with ts-morph
- Graph is cached per (projectRoot, tsconfigPath) pair
- Local-first, zero network egress
