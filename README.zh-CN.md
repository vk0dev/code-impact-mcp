# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/vk0dev/code-impact-mcp/ci.yml?branch=main)](https://github.com/vk0dev/code-impact-mcp/actions)

> **本地依赖图与 blast radius 分析 MCP。** 帮助 agent 在改代码之前判断影响范围、路径关系、循环依赖和风险等级。

**语言:** [English](./README.md) · [日本語](./README.ja.md) · 简体中文 · [Русский](./README.ru.md) · [Español](./README.es.md)

---

## 何时使用

当 agent 需要回答的不是“这个符号在哪”，而是 **“改这里会影响什么”** 时，就该用 CodeImpact MCP。

- 重构前做 blast radius 判断
- 提交前做 graph-aware gate
- 检测循环依赖
- 在 monorepo 中解释跨包影响路径
- 比较多个改动候选的风险

## 安装

全部通过 `npx` 运行，不需要全局安装。

### Claude Desktop

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "code-impact": {
      "command": "npx",
      "args": ["-y", "@vk0/code-impact-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport stdio code-impact -- npx -y @vk0/code-impact-mcp
```

或通过 `.mcp.json`:

```json
{
  "mcpServers": {
    "code-impact": {
      "command": "npx",
      "args": ["-y", "@vk0/code-impact-mcp"]
    }
  }
}
```

### 验证

询问 `code-impact` 暴露了哪些工具，应该看到当前 **5 个工具**：

- `gate_check`
- `analyze_impact`
- `find_path`
- `refresh_graph`
- `detect_cycles`

## 工具

### `gate_check`

提交前安全门。分析指定改动并返回 **PASS / WARN / BLOCK**。当前 wording 是 cycle-aware 的，也就是说一旦检测到现有循环依赖或新增 cycle-risk，结果可能升级为 WARN 或 BLOCK，而不只是普通提醒。

![gate_check demo](./docs/demo-gate-check.gif)

### `analyze_impact`

分析改动会波及哪些文件、模块和节点。

### `find_path`

找出两个节点之间的依赖路径，用来解释“为什么这里会影响那里”。

### `refresh_graph`

从当前仓库状态重新构建依赖图。适合大规模结构变化后使用。

### `detect_cycles`

检测循环依赖。当前产品状态已经不是旧的 4-tool 版本，而是包含 `detect_cycles` 的 **5 个工具 surface**。

![cycle detection demo](./docs/demo-cycles.gif)

## 对比

CodeImpact MCP 适合需要 **本地、可被 agent 直接调用、并且真正理解依赖图** 的分析场景。

- 比简单的 import 搜索更擅长 blast radius 和 path reasoning
- 比重型外部平台更轻、更容易嵌入 agent workflow
- 与当前英文 README 一致，比较 framing 已经包含 cycle detection 与 5-tool surface

## FAQ

**只适用于 monorepo 吗？**
不是。monorepo 会更受益，但普通仓库也适用。

**`gate_check` 现在怎么判定？**
它会基于改动风险和循环依赖情况返回 PASS / WARN / BLOCK。

**为什么现在是 5 个工具？**
因为 `detect_cycles` 已经是正式工具，不再是旧状态里缺失的一项。

## 开发

```bash
npm ci
npm run build
npm test
npm run lint
```

## Changelog

见 [CHANGELOG.md](./CHANGELOG.md)。

## 许可证

[MIT](./LICENSE) © vk0.dev
