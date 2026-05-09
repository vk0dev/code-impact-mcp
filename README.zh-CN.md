# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**面向 AI 辅助代码修改的快速 pre-commit dependency gate。** 它会在几秒内用 PASS/WARN/BLOCK 回答“这个现在可以安全提交吗？”，帮助你在坏提交发生前发现风险 blast radius，而不是事后补救。无需数据库，也不需要重型配置。

[English](./README.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

> Listing status：`awesome-mcp-servers` 的提交内容已经准备好，Official MCP Registry 的 package metadata 已经通过 `server.json` 处于 live 状态，Glama 在 external PR lane 继续推进前仍然需要真实 listing，而 MCP Hive 目前只是 manual submit-next 的 operator step，不是当前已声明 live 的 listing。这个 README 目前还不会声称任何新的 third-party listing 已经 verified-live。

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

CodeImpact MCP 使用 ts-morph 构建轻量级 dependency graph，并给出有边界的结论：PASS、WARN 或 BLOCK。Zero cloud, no API key, local-first。当前它仍以 TypeScript/JavaScript 的完整支持为主，而 Python 只在 `analyze_impact` 和 `gate_check` 中提供更窄的 file-level path，并不等同于完整的 TS/JS graph surface。

如果你需要的是 **面向 AI 生成代码修改的快速、有限边界的 pre-commit gate**，而不是沉重的代码治理平台，那么它就是这个场景下的 canonical MCP server。Zero cloud, no API key, local-first.

## Installation

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

Windows 用户如果在 Claude Code 的 shell 里无法正常解析普通 `npx`，可以改用 `cmd /c` 包裹这条命令。

### 其他 stdio MCP clients（包括 OpenClaw Tasks）

如果你的 client 需要的是普通 stdio 命令，而不是 `claude mcp add ...` 这种 wrapper，就直接使用同一个 server entrypoint：

```bash
npx -y @vk0/code-impact-mcp
```

这个 server 是 local-first 的，它会从 client 启动它时所在的 working directory 读取目标 repository。

### 面向 stdio clients 的 JSON 配置示例

如果你的 MCP client 需要 JSON 而不是 shell wrapper，Claude Desktop 在 macOS 上使用 `~/Library/Application Support/Claude/claude_desktop_config.json`，在 Windows 上使用 `%APPDATA%\Claude\claude_desktop_config.json`：

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

保存 `claude_desktop_config.json` 后，需要完整重启 Claude Desktop，才能让它重新加载 MCP server 配置。

请使用 workspace 或 project 级别的 launch directory，这样 server 才能读取你真正想分析的 repository。

最新 release note：v1.6.4 强化了 repo-local `release-check` 与 documented install-surface contract 的一致性，并补上了 regression coverage，让 release QA 持续对齐到已 shipped 的 Claude Code 和 plain stdio 路径。

## Tutorials

- [Claude Desktop 快速开始](./docs/quickstart-claude-desktop.md)
- [如何阅读 `analyze_impact` 和 `gate_check` 输出](./docs/read-analyze-impact-output.md)
- [pre-commit gate 配方](./docs/pre-commit-gate-recipe.md)

### Optional pre-commit hook helper

运行 `npm run demo:install-hook` 可以用 dry-run 方式预览 managed 的 Husky snippet（不会创建或修改 `.husky` 文件）。
它只会输出安全的 `.husky/pre-commit` 片段，不会自动初始化 Husky。

v1.6.0 新增了一个安全的 Husky-only helper，用来接入这个有边界的 gate runner，而不用手动改 pre-commit hook。

如果你已经在使用 Husky，`code-impact-mcp install-hook` 就是接入 pre-commit wiring 的直接路径，所以可以直接接入这个有边界的 gate runner，而不用手动改 hook：

```bash
npx -y @vk0/code-impact-mcp install-hook
```

![install-hook demo: helper 会拒绝修改没有 managed code-impact-mcp 片段的现有 Husky hook 内容](docs/demo-install-hook.gif)

这是一个 Husky-only helper。如果 `.husky/pre-commit` 已经包含无关内容，但其中没有 managed 的 `code-impact-mcp` 片段，这个命令会拒绝修改并保持 hook 原样不动。只有在 managed block 已经存在时，重复运行才会在这个 owned 区块内保持 idempotent。如果 Husky 还没初始化，它会停下来并给出可执行的提示，而不是替你搭建整套 hook 基础设施。它不会替你初始化 Husky，不会改写任意 hook 逻辑，也不会管理 `pre-commit` 之外的 hook 文件。

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

![detect_cycles demo: 展示紧凑的 cycle hotspot，而不是完整的 graph dump](docs/demo-detect-cycles.gif)

### `analyze_impact`

分析修改特定文件的 blast radius。返回直接和传递性受影响的文件，以及 risk score（0-1）。适合在提交多文件修改前评估可能的破坏范围。不会修改任何文件。

![analyze_impact demo](docs/demo-blast-radius.gif)

### `get_dependencies`

获取某个文件的 import 与 importedBy 关系。用来在重构前理解这个文件依赖谁，以及谁依赖它。

![get_dependencies demo: inspect direct imports and reverse dependents before refactoring a shared module](docs/demo-get-dependencies.gif)

### `refresh_graph`

从头重建 dependency graph。适合在大量新增/删除文件后，或者当结果看起来过期时调用。返回图统计信息，包括文件数、边数、构建时间以及检测到的 circular dependencies。

![refresh_graph demo: rebuild the local graph and return fresh file, edge, and cycle counts](docs/demo-refresh-graph.gif)

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

如果你在为 agent 或 reviewer 选工具，核心问题现在仍然很简单：你需要的是 **探索 graph 或更宽的代码上下文**，还是 **在 commit 前 gate 一次提议中的变更**？

| 替代方案 | 最擅长 | 它今天更强的地方 | CodeImpact MCP 更强的地方 |
| --- | --- | --- | --- |
| **CodeImpact MCP** | 面向提议中的 TS/JS 变更做 decision-first dependency gating，包括 monorepo | 即时 PASS/WARN/BLOCK 输出、内建 `detect_cycles`、workspace-aware gate checks、file-level blast-radius triage、针对 `analyze_impact` 与 `gate_check` 的 bounded Python support、local-first workflow，以及可直接接入的 Husky `install-hook` helper | 当你的问题是“这个现在能安全 commit 吗？”，而不是“帮我探索整个仓库”时最合适 |
| **code-graph-mcp** | 通过 MCP surface 使用 hosted 或 prebuilt 的 code graph inspection | 更适合 agent 需要 graph traversal、semantic graph queries，以及通过现有 DeepGraph 或 CodeGPT flow 访问 public/private graphs，而不是把本地 gate-first CLI 放在中心位置 | 更适合你只想要一个有边界、且附带 affected-file triage 的 pre-commit verdict，而不是一次 graph exploration session |
| **Depwire** | 覆盖更宽 language/tooling surface 的 dependency intelligence 与 architecture workflows | 当你需要 symbol-level analysis、browser visualization、security/health workflows，或比 CodeImpact 有意覆盖更宽的 multi-language platform 时更合适 | 当你想要一个保持 local-first、已经在 Official MCP Registry live、并能快速回答狭义 gating question 的小型 MIT 工具时更合适 |
| **RepoGraph** | 面向 SWE-style context gathering 的 repository-level graph retrieval | 当 workflow 更偏 research-heavy 或 retrieval-heavy，尤其是为了更大的 repo-understanding 循环去拿 line-level repo context，而不是做轻量级 commit-time check 时更合适 | 当 touched files 已经明确，只需要 bounded blast-radius triage 加一个 gate result 时更合适 |
| **CodeGraphContext** | 本地 graph database indexing 加上更宽的 CLI/MCP code understanding | 当 agent 需要 queryable local graph database、更宽的 multi-language context，以及比 decision-first gate 更长的 repository reasoning 时更合适 | 当你要的是来自本地 gate 的 decision-first output，而不是更宽的 graph-database workflow 时更合适 |
| **MCP Hive 风格的 marketplace follow-up** | 在 repo truth 已稳定后做手动 marketplace/discovery submit-next | 当主要工作是 directory workflow 所需的 packaging、screenshots 和 operator copy，而不是 dependency gate 本身时更合适 | 当你首先需要的是已经 shipped 的 product wedge，也就是 local verdicts、install-hook wiring，以及有边界的 Python impact checks，然后再做手动 listing follow-up 时更合适 |

**什么时候选 CodeImpact MCP：** 当你已经知道涉及哪些文件，并且想在 commit 前拿到一个快速、本地、MIT 许可的答案，里面包含 risk score、明确的 cycle surfacing、file-level blast-radius output、monorepo-aware checks、已经 shipped 的 Husky `install-hook` helper，以及清晰的 PASS/WARN/BLOCK verdict。

**什么时候选其他替代：** 当主要工作是 hosted/public graph access、graph exploration、仓库理解、更宽的 dependency workflow coverage、基于 graph database 的 context retrieval 来支撑更长 reasoning loop，或者在 core repo surface 已稳定后做 manual marketplace packaging。

## FAQ

**Q: 它会访问网络吗？**
A: 不会。CodeImpact MCP 是 100% local-first。它通过 ts-morph 读取你的项目文件，不会发起网络请求。没有 API key、没有 cloud、没有 telemetry。

**Q: 它会修改我的代码吗？**
A: 不会。5 个 tools 都是只读的（`readOnlyHint: true`）。它们只做分析，不会写入。

**Q: risk score 有多准确？**
A: 它是基于图谱的启发式指标（受影响文件 / 总文件数）。它不了解 runtime behavior、tests 或 data migrations。请把它当作 triage signal，而不是保证。

**Q: 目前支持哪些语言？**
A: 完整支持仍然集中在 TypeScript 和 JavaScript（`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`）。另外，`analyze_impact` 和 `gate_check` 还有一个有边界的 Python path，但它只停留在 file/module 级 impact，不应被理解为宽泛的多语言平台能力或 repo-wide 图谱探索能力。

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
