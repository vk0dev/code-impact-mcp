# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**面向 AI 代理的轻量级提交前安全门禁。** 几秒内回答"这个改动安全吗？"，给出 PASS/WARN/BLOCK 判定——无需数据库，无需复杂配置。

[English](./README.md) | [日本語](./README.ja.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## 为什么使用 / 适用场景

在以下场景中使用此 MCP 服务器：

- 用户问：**"改这个文件会影响什么？"**
- 用户问：**"这次重构提交安全吗？"**
- 用户问：**"推送前帮我看看影响范围"**
- 用户问：**"哪些模块依赖这个文件？"**
- 代理在修改多个文件前需要**快速的提交前门禁检查**
- 代理需要对变更方案给出**数值风险评分（0-1）**
- 需要依赖分析但**不想搭建数据库或 tree-sitter**

CodeImpact MCP 使用 ts-morph 构建轻量级依赖图，给出明确的判定：PASS、WARN 或 BLOCK。零云端依赖，无需 API 密钥，完全本地运行。

## 安装

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Claude Desktop

添加到 `claude_desktop_config.json`：

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

添加到 `.cursor/mcp.json`：

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

添加到 Cline MCP 设置中：

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

## 工具

### `gate_check`

提交前安全门禁。分析指定的变更并返回附带理由的 **PASS/WARN/BLOCK 判定**。在提交多文件变更前作为有界决策依据使用。BLOCK 表示风险超过阈值。WARN 表示建议人工审查。PASS 表示基于依赖图的风险较低。

### `analyze_impact`

分析变更特定文件的影响范围。返回直接和间接受影响的文件，以及风险评分（0-1）。在提交多文件变更前使用，以了解可能受影响的范围。不会修改任何文件。

### `get_dependencies`

获取特定文件的 import 和 importedBy 关系。显示该文件依赖了什么，以及什么依赖了它。在重构前用于了解耦合程度。

### `refresh_graph`

从头重建依赖图。在大量文件增删后，或结果看起来过时时调用。返回图的统计信息，包括文件数、边数、构建耗时和检测到的循环依赖。

## 对话示例

**用户：**"我想重构 `src/routes.ts`，安全吗？"

**代理调用** `gate_check`：
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
  "verdict": "WARN",
  "recommendation": "Proceed only with targeted review of affected files.",
  "riskScore": 0.35,
  "reasons": ["Risk score 0.35 is approaching threshold. Review affected files."],
  "affectedFiles": 8,
  "circularDependencies": 0
}
```

**代理：**"门禁检查结果为 WARN——有 8 个文件依赖 routes.ts。我会在修改前审查受影响的文件。"

## 工作原理

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

1. **解析：** ts-morph 扫描项目中的 ESM import、re-export 和 CommonJS require
2. **建图：** 构建内存中的依赖图（无数据库，无持久化）
3. **分析：** 从变更文件出发，BFS 遍历反向依赖
4. **评分：** 风险 = 受影响文件数 / 总文件数（0-1）
5. **判定：** PASS（< 阈值的 60%）、WARN（60-100%）、BLOCK（> 阈值）

支持：ESM import、ESM re-export、CommonJS `require()`、NodeNext 风格的 `.js` → `.ts` 解析。

## 对比

| 功能 | CodeImpact MCP | Codegraph | Depwire | dependency-mcp |
|------|:---:|:---:|:---:|:---:|
| 提交前门禁（PASS/WARN/BLOCK） | **支持** | 不支持 | 不支持 | 不支持 |
| 数值风险评分（0-1） | **支持** | 不支持 | 健康评分 | 不支持 |
| 零配置（无需数据库） | **支持** | 需要 SQLite | 需要配置 | 支持 |
| 安装时间 | **秒级** | 分钟级 | 分钟级 | 秒级 |
| 许可证 | **MIT** | MIT | **BSL 1.1** | MIT |
| 工具数量 | 4 | 30+ | 10 | 3 |
| 语言支持 | TS/JS | 11 种语言 | 多语言 | 多语言 |
| 循环依赖检测 | **支持** | 支持 | 支持 | 不支持 |
| 代理优化输出 | **支持** | 部分 | 部分 | 部分 |
| 本地优先 / 零云端 | **支持** | 支持 | 支持 | 支持 |

**选择 CodeImpact MCP 的场景：** 你需要在提交前快速得到明确的回答（PASS/WARN/BLOCK），而不是完整的代码库探索工具。零配置，MIT 许可证，秒级响应。

**选择 Codegraph/Depwire 的场景：** 你需要跨多种语言的深度代码库探索，配合持久化存储和可视化功能。

## 常见问题

**Q：会访问网络吗？**
A：不会。CodeImpact MCP 100% 本地运行。它通过 ts-morph 读取项目文件，从不发起网络请求。无需 API 密钥，无云端依赖，无遥测数据收集。

**Q：会修改我的代码吗？**
A：不会。全部 4 个工具均为只读（标注了 `readOnlyHint: true`）。只分析，不写入。

**Q：风险评分准确吗？**
A：风险评分是基于图的启发式算法（受影响文件数 / 总文件数）。它不考虑运行时行为、测试或数据迁移。请将其作为分诊信号，而非保证。

**Q：支持纯 JavaScript 项目吗？**
A：支持。它同时适用于 TypeScript 和 JavaScript 文件（`.ts`、`.tsx`、`.js`、`.jsx`、`.mts`、`.cts`、`.mjs`、`.cjs`）。

**Q：速度如何？**
A：依赖图构建通常需要 1-5 秒，取决于项目规模。对缓存图的单次工具调用几乎是即时的。

**Q：依赖图会缓存吗？**
A：会。依赖图按 (projectRoot, tsconfigPath) 组合在内存中缓存。重大变更后请使用 `refresh_graph` 重建图。

## 局限性

- 仅支持 TypeScript/JavaScript（不支持多语言）
- 不区分运行时 import 和仅类型 import
- 依赖图仅在内存中（服务器重启后不持久化）
- 风险评分是结构性的，非语义性的——不判断哪些文件更"重要"
- 无可视化输出（仅文本/JSON）

## 变更日志

发布历史详见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE)——可自由用于任何项目，无论商用还是个人。

## 贡献

欢迎提交 Issue 和 PR：[github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp)。
