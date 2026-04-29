# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/vk0dev/code-impact-mcp/ci.yml?branch=main)](https://github.com/vk0dev/code-impact-mcp/actions)

> **依存グラフと blast radius 分析のためのローカル MCP サーバー。** 変更前に影響範囲、リスク、循環依存を把握しやすくします。

**Languages:** [English](./README.md) · 日本語 · [简体中文](./README.zh-CN.md) · [Русский](./README.ru.md) · [Español](./README.es.md)

---

## 使いどころ

CodeImpact MCP は、エージェントが単にシンボルを探すのではなく、**この変更で何が壊れうるか**を知る必要があるときに使います。

- リファクタ前の blast radius 確認
- コミット前の graph-aware gate
- 循環依存の検出
- モノレポでの影響経路の確認
- 複数の変更候補をリスク比較したい場合

## インストール

すべて `npx` ベースで、グローバルインストールは不要です。

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

または `.mcp.json`:

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

### 動作確認

`code-impact` が公開しているツールを尋ねると、次の **5 ツール** が見えるはずです。

- `gate_check`
- `analyze_impact`
- `find_path`
- `refresh_graph`
- `detect_cycles`

## ツール

### `gate_check`

Pre-commit safety gate。指定した変更を解析し、**PASS / WARN / BLOCK** を返します。現在は cycle-aware で、循環依存や cycle-risk を踏まえて WARN や BLOCK まで引き上げることがあります。

![gate_check demo](./docs/demo-gate-check.gif)

### `analyze_impact`

変更がどのファイル、モジュール、ノードへ波及するかを示します。

### `find_path`

2 つのノード間の依存パスを見つけ、影響の理由を説明します。

### `refresh_graph`

依存グラフを現在のリポジトリ状態から再構築します。大きな構成変更後に便利です。

### `detect_cycles`

循環依存を検出します。現在の製品 surface は **4 ツールではなく 5 ツール** であり、`detect_cycles` は正式なツールです。

![cycle detection demo](./docs/demo-cycles.gif)

## 比較

CodeImpact MCP は、単なる import 検索ではなく **ローカルで agent が呼べる graph-aware 分析** が必要なときに向いています。

- 単純な検索ツールよりも blast radius と path reasoning が強い
- 重い外部プラットフォームよりローカル導入が簡単
- 現行 README の英語版と同じく、cycle detection を含む 5-tool surface を前提にしている

## FAQ

**モノレポ専用ですか？**
いいえ。モノレポで特に有用ですが、通常のリポジトリでも使えます。

**`gate_check` は今どう動きますか？**
現在は cycle-aware で、変更リスクに応じて PASS / WARN / BLOCK を返します。

**なぜ 5 ツールなのですか？**
現在の製品には `detect_cycles` が正式に含まれているためです。

## 開発

```bash
npm ci
npm run build
npm test
npm run lint
```

## Changelog

[CHANGELOG.md](./CHANGELOG.md) を参照してください。

## ライセンス

[MIT](./LICENSE) © vk0.dev
