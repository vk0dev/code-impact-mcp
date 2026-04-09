# CodeImpact MCP

CodeImpact MCP helps you answer a practical question before changing code: **what else is likely to move if I touch this file?**

It builds a dependency graph for a local TypeScript/JavaScript repo, then exposes a small set of read-only MCP tools for:
- dependency lookup
- blast-radius analysis
- lightweight gate-style change review

Current status: local-first and dogfooded, not published yet.

## Tools

### `get_dependencies`
For one file, returns:
- what it imports
- what imports it
- exports
- fan-in / fan-out
- a simple high-coupling signal

### `analyze_impact`
For one or more changed files, returns:
- directly affected files
- transitively affected files
- total affected files
- cascade depth
- a graph-based risk score

### `gate_check`
For one or more changed files, returns a bounded recommendation:
- `PASS`
- `WARN`
- `BLOCK`

This is a **graph-only heuristic**, not a full engineering safety system. It does not know about tests, runtime behavior, data migrations, or production traffic.

## Installation

### Requirements
- Node.js 22+
- npm
- a local TypeScript/JavaScript repo you want to inspect

### Install

```bash
cd ~/projects/code-impact-mcp
npm install
```

### Build

```bash
npm run build
```

### Run locally

Development mode:

```bash
npm run dev
```

Compiled server mode:

```bash
npm run build
npm start
```

Optional quick transport smoke check after the server is up:

```bash
npm run smoke
```

## Fast local verification

```bash
npm test
npm run build
```

Focused graph/tool verification:

```bash
npx vitest run tests/graph.test.ts tests/tools.test.ts
```

## First useful local usage path

The simplest honest first run is:
1. point the tools at a real local repo
2. inspect one important file with `get_dependencies`
3. run `analyze_impact` on a likely change target
4. use `gate_check` for a quick pass/warn/block signal

Example target repo from local dogfooding:
- `~/projects/openclaw-tasks`

Example progression:
- `get_dependencies` for `src/routes.ts`
- `analyze_impact` for `src/routes/index.ts`
- `gate_check` for the same file with a chosen threshold

### Example request shapes

`get_dependencies`
```json
{
  "projectRoot": "/Users/you/projects/openclaw-tasks",
  "file": "src/routes.ts"
}
```

`analyze_impact`
```json
{
  "projectRoot": "/Users/you/projects/openclaw-tasks",
  "files": ["src/routes/index.ts"]
}
```

`gate_check`
```json
{
  "projectRoot": "/Users/you/projects/openclaw-tasks",
  "files": ["src/routes/index.ts"],
  "threshold": 0.2
}
```

## Tool behavior notes

### Path expectations
- `projectRoot` should be an absolute path to the repo root
- file inputs should be repo-relative paths like `src/routes.ts`
- `tsconfigPath` is optional and should be relative to `projectRoot`

### Resolver behavior
The graph currently supports:
- ESM imports
- ESM re-exports
- CommonJS `require(...)`
- NodeNext-style `.js` import specifiers that point back to `.ts` source files

### Error behavior
The tool layer returns bounded JSON errors instead of crashing for:
- invalid project roots
- broken or missing `tsconfig`
- missing files in the built graph

## What the outputs mean

### Risk score
The current `riskScore` is a simple graph-derived heuristic based on how many files are affected relative to graph size.

Treat it as:
- useful for quick comparison
- good enough for first-pass triage
- **not** a substitute for test/runtime knowledge

### `gate_check` recommendation
- `PASS` means low graph impact right now
- `WARN` means review is recommended before proceeding
- `BLOCK` means the current change shape looks too risky for the chosen threshold

A good mental model is: **CodeImpact tells you where to look next, not whether the code is truly safe.**

## Limitations
- explanation quality is still intentionally compact
- no distinction yet between runtime imports and type-only imports
- no CI integration yet
- no registry/publish flow yet
- no dashboard or reporting surface yet

## Current repo scripts

```bash
npm run dev     # run local MCP server with tsx
npm test        # vitest run
npm run build   # TypeScript compile to dist/
npm start       # run compiled MCP server
npm run smoke   # basic local MCP client smoke path
```

## Publish readiness
Current state is closer to publish than before, but still in polish mode.

Before any package/publish step, the priority remains:
- keep local-first install/run obvious
- keep tool output explanations understandable
- keep dogfooding on real repos

At this point the project looks close to controlled publish-prep, but should still be treated as local-first until that step is explicitly started.
