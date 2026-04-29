
## [1.1.2] — 2026-04-29

### Fixed
- Corrected the release smoke and CLI version test drift that blocked the 1.1.1 publish workflow after the cycle-detection release line.

## [1.1.1] — 2026-04-29

### Fixed
- Updated `scripts/dogfood_smoke.mjs` to include the new `detect_cycles` tool so release CI smoke stays aligned with the current public tool set.

## [1.1.0] — 2026-04-29

### Added
- `detect_cycles` MCP tool with compact strongly-connected-component output for circular dependency inspection.
- `gate_check` cycle awareness with WARN for graph-wide cycles and BLOCK when changed files participate in a cycle.

### Fixed
- CLI `--help` and `--version` handling is stabilized in release output paths.

## [1.0.4] — 2026-04-29

### Fixed
- Triggered a no-op patch release after the CI OIDC registry publish path landed so tag pushes can republish to the Official MCP Registry without local device-flow OAuth.

## [1.0.3] — 2026-04-29

### Fixed
- `--help` and `--version` now print useful output instead of nothing. Previously running `npx -y @vk0/code-impact-mcp --help` produced an empty response, which made it impossible to discover the configuration steps without reading the README. The default stdio MCP behavior is unchanged.

## [1.0.2] — 2026-04-22

### Added
- Cycle diagnostics surfaced in gate output (`feat(gate): surface cycle diagnostics`, ec22f20) — closes P4 parity gap vs code-graph-mcp.
- Output scanability polish for gate verdicts (`feat(output): polish scanability cues`, 8e9e3fe).
- MCPize deploy step in publish workflow.

### Changed
- Sharpened README positioning with Best for / Not for sections — leads with fast PASS/WARN/BLOCK pre-commit gate value.


All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-04-15

### Changed
- **Breaking:** Switched from HTTP/Express transport to stdio transport for standard MCP client compatibility
- Bumped version to 1.0.0 — first production-ready release

### Added
- `createServer()` factory and `createSandboxServer` export for Smithery compatibility
- `src/index.ts` barrel export for clean API surface
- MCP client smoke test (`scripts/dogfood_smoke.mjs`)
- Full CI/CD pipeline: matrix Node 18/20/22, publish with provenance, GitHub Release, MCP Registry, Smithery
- GitHub Pages workflow for landing page
- Dependabot configuration (weekly, major-version-safe)
- `server.json` for Official MCP Registry
- `.claude-plugin/plugin.json` for Claude Code discovery
- 17 npm keywords for marketplace discoverability
- `homepage`, `bugs`, `engines`, `publishConfig` in package.json

### Removed
- Express dependency and HTTP transport
- `@types/express` dev dependency

## [0.1.1] - 2026-04-10

### Added
- Initial MCP Registry submission preparation
- server.json metadata

## [0.1.0] - 2026-04-09

### Added
- Initial implementation with 4 MCP tools: `analyze_impact`, `get_dependencies`, `gate_check`, `refresh_graph`
- ts-morph based dependency graph builder
- ESM, CJS, and re-export edge detection
- Cycle detection
- Risk scoring (0-1) based on blast radius
- 16 unit tests covering graph building, impact analysis, and tool behavior

[1.0.0]: https://github.com/vk0dev/code-impact-mcp/compare/v0.1.1...v1.0.0
[0.1.1]: https://github.com/vk0dev/code-impact-mcp/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/vk0dev/code-impact-mcp/releases/tag/v0.1.0
