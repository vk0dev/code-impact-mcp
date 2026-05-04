# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**面向 AI 辅助代码修改的快速 pre-commit dependency gate。** 它会在几秒内用 PASS/WARN/BLOCK 回答“这个现在可以安全提交吗？”，帮助你在坏提交发生前发现风险 blast radius，而不是事后补救。无需数据库，也不需要重型配置。

[English](./README.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Best for

- **提交前重构检查：** 当你要改共享文件、路由或模块，并且想快速得到 PASS/WARN/BLOCK 结论时。
- **代理执行多文件修改（包括 monorepo）：** 当 AI 代理即将修改多个文件或 workspace 级包，而你想在提交前先做一次有边界的依赖关系闸门检查时。
- **无基础设施的 blast-radius triage：** 当你想快速拿到 risk score 和受影响文件摘要，而不想搭建数据库、graph service 或重型治理层时。

## Not for

这 **不是** full policy platform、compliance suite，也不是以可视化为核心的代码图谱产品。

它面向快速的本地提交时安全检查，而不是 repo 级治理、持久化图谱探索或管理层汇报。

## Why / When to use

在以下场景使用这个 MCP server：

- 用户问：**“如果我改这个文件，会有什么东西坏掉？”**
- 用户问：**“这个重构现在安全提交吗？”**
- 用户要求：**“在 push 前看一下 blast radius”**
- 用户问：**“哪些东西依赖这个模块？”**
- 代理在修改多个文件前需要一个**快速的 pre-commit gate**
- 代理想得到一个**数值 risk score（0-1）**
- 你想做**dependency analysis**，但不想搭建数据库或 tree-sitter

CodeImpact MCP 使用 ts-morph 构建轻量级 dependency graph，并给出有边界的结论：PASS、WARN 或 BLOCK。Zero cloud, no API key, local-first。当前它仍以 TypeScript/JavaScript 的完整支持为主，同时为 `analyze_impact` 和 `gate_check` 提供一个有边界的 file-level Python path，能返回 import-graph blast radius 和同样的 verdict framing，但这并不意味着宽泛的多语言平台能力。

如果你需要的是 **面向 AI 生成代码修改的快速、有限边界的 pre-commit gate**，而不是沉重的代码治理平台，那么它就是这个场景下的 canonical MCP server。Zero cloud, no API key, local-first.

## Installation

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Optional pre-commit hook helper

v1.6.0 新增了一个安全的 Husky-only helper，用来接入这个有边界的 gate runner，而不用手动改 pre-commit hook。

如果你已经在使用 Husky，可以直接接入这个有边界的 gate runner，而不用手动改 hook：

```bash
npx -y @vk0/code-impact-mcp install-hook
```

![install-hook demo: helper 只插入带标记的 code-impact-mcp 片段，并且重复运行仍保持 idempotent](docs/demo-install-hook.gif)

如果 `.husky/` 已存在，这个命令只会创建或更新 `.husky/pre-commit` 里带 `code-impact-mcp` 标记的那一段，重复运行仍保持 idempotent，不会动其他 hook 内容。如果 Husky 还没初始化，它会停下来并给出可执行的提示，而不是替你搭建整套 hook 基础设施。

### Claude Desktop

把下面内容加入 `claude_desktop_config.json`：

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

把下面内容加入 `.cursor/mcp.json`：

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

把下面内容加入 Cline 的 MCP server 配置：

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

Pre-commit safety gate。它会分析指定改动，并返回带原因的 **PASS/WARN/BLOCK verdict**。在提交多文件修改之前，把它当作一个有边界的决策辅助工具，也包括对 pnpm/package.json workspaces 和 lerna-style monorepos 的 workspace-aware analysis。BLOCK 表示风险超过阈值，或者被修改的文件参与了检测到的 cycle。WARN 表示建议人工复核，包括图中其他位置存在 cycle 的情况。PASS 表示图谱层面的风险较低。

### `detect_cycles`

返回当前 TS/JS 图中的 circular dependencies 的紧凑 strongly connected components。适合在重构或 release gating 前快速查看 cycle hotspot 列表，而不是做完整的图谱可视化。

### `analyze_impact`

分析修改特定文件的 blast radius。返回直接和传递性受影响的文件，以及 risk score（0-1）。适合在提交多文件修改前评估可能的破坏范围。不会修改任何文件。

![analyze_impact demo](docs/demo-analyze-impact.gif)

### `get_dependencies`

获取某个文件的 import 与 importedBy 关系。用来在重构前理解这个文件依赖谁，以及谁依赖它。

### `refresh_graph`

从头重建 dependency graph。适合在大量新增/删除文件后，或者当结果看起来过期时调用。返回图统计信息，包括文件数、边数、构建时间以及检测到的 circular dependencies。

## Example conversation

**用户：** “我想重构 `src/routes.ts`，这样安全吗？”

**Agent 调用** `gate_check`：
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

**结果：**
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

**Agent：** “gate check 返回了 BLOCK，`routes.ts` 处在一个 cycle 里，所以在继续之前应该先把这段依赖关系拆开。”

![gate_check demo](docs/demo-gate-check.gif)

**Agent 调用** `detect_cycles`：
```json
{
  "projectRoot": "/Users/you/projects/my-app"
}
```

**结果：**
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

1. **Parse：** ts-morph 扫描项目中的 ESM imports、re-exports 和 CommonJS require
2. **Graph：** 构建内存中的 dependency graph（无数据库、无持久化）
3. **Analyze：** 从被修改文件出发，对 reverse dependencies 做 BFS traversal
4. **Score：** 风险 = 受影响文件数 / 文件总数（0-1）
5. **Verdict：** PASS（< 阈值的 60%）、WARN（60-100%）、BLOCK（> 阈值）

支持：ESM imports、ESM re-exports、CommonJS `require()`、NodeNext 风格的 `.js` → `.ts` 解析。

## Comparison

| 替代方案 | 最擅长 | CodeImpact MCP 的区别 |
| --- | --- | --- |
| **CodeImpact MCP** | 面向 TS/JS 仓库的一次性 pre-commit verdict | **这个仓库专门优化一个 gate answer：** 在 merge 或 agent 交接前给出 PASS / WARN / BLOCK。 |
| **CodeGraphContext** | 面向长链 reasoning 的丰富 context retrieval 和 repository understanding | CodeGraphContext 更适合让 agent 读取更多代码上下文并进行推理。CodeImpact 刻意更窄，它不是 context provider，而是快速本地 gate verdict。 |
| **Depwire** | multi-language dependency intelligence、stored analysis、deeper dependency health workflows | Depwire 更宽、更重。CodeImpact 保持 zero setup、MIT license，并专注于快速本地 pre-commit decision，而不是更大的 dependency platform。 |
| **code-graph-mcp** | 通过更宽的 MCP tool surface 做 graph exploration 和 codebase inspection | CodeImpact 不打算成为 graph explorer。它适合需要立即启动、范围清晰、verdict-first workflow 的场景。 |
| **RepoGraph** | repository graph browsing、graph-first discovery、visual exploration | RepoGraph 类工具更适合探索。CodeImpact 更适合你已经知道 touched files，只想快速拿到 PASS / WARN / BLOCK 结论的时候。 |
| **code-pathfinder** | 仓库内的 code navigation 和 path tracing | code-pathfinder 关注的是找到代码路径。CodeImpact 关注的是在 commit 前用一个明确 gate result 挡住高风险改动。 |

**什么时候选 CodeImpact MCP：** 你想要一个 zero setup、MIT 许可、几秒内完成的 fast local gate。它提供 single verdict、numeric risk score 和 pre-commit answer。

**什么时候选 context-provider / graph-explorer：** 你需要更广的 repository reasoning、graph traversal、visualization 或 persistent multi-language analysis。这些工具帮助 agent 理解代码库，CodeImpact 帮你 gate change。

## FAQ

**Q: 它会访问网络吗？**
A: 不会。CodeImpact MCP 是 100% local-first。它通过 ts-morph 读取你的项目文件，不会发起网络请求。没有 API key、没有 cloud、没有 telemetry。

**Q: 它会修改我的代码吗？**
A: 不会。5 个 tools 都是只读的（`readOnlyHint: true`）。它们只做分析，不会写入。

**Q: risk score 有多准确？**
A: 它是基于图谱的启发式指标（受影响文件 / 总文件数）。它不了解 runtime behavior、tests 或 data migrations。请把它当作 triage signal，而不是保证。

**Q: 目前支持哪些语言？**
A: 完整支持仍然集中在 TypeScript 和 JavaScript（`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`）。另外，`analyze_impact` 和 `gate_check` 还有一个有边界的 Python path，但它只停留在 file/module 级 impact，不应被理解为宽泛的多语言平台能力。

**Q: 速度怎么样？**
A: 图构建通常需要 1-5 秒，取决于项目大小。基于缓存图的单次 tool call 几乎是即时的。

**Q: 图会缓存吗？**
A: 会。图会按 `(projectRoot, tsconfigPath)` 键在内存中缓存。发生重大变更后，请使用 `refresh_graph` 重新构建。

## Limitations

- 完整 graph depth 仍然最适合 TypeScript/JavaScript；Python support 被有意限制在本地 file/module-level impact，而不是完整的多语言平台
- 不区分 runtime imports 和 type-only imports
- 图只存在于内存中（server 重启后不会持久化）
- risk score 只看结构，不看语义，无法判断哪些文件“更重要”
- 没有 visualization output（只有 text/JSON）

## Changelog

版本历史见 [CHANGELOG.md](./CHANGELOG.md)。

## License

[MIT](./LICENSE) — 可用于任何商业或个人项目。

## Contributing

欢迎提交 issues 和 PR： [github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp)
