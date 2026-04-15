# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**AIエージェント向けの軽量プリコミット安全ゲート。**「この変更は安全か？」という問いに、数秒でPASS/WARN/BLOCKの判定を返します。データベース不要、複雑なセットアップ不要。

[English](./README.md) | [中文](./README.zh-CN.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## なぜ使うのか / どんな時に使うのか

以下のような場面でこのMCPサーバーを使用してください：

- ユーザーが聞く：**「このファイルを変更したら何が壊れる？」**
- ユーザーが聞く：**「このリファクタリングはコミットしても安全？」**
- ユーザーが聞く：**「プッシュする前に影響範囲を確認して」**
- ユーザーが聞く：**「このモジュールに依存しているのは何？」**
- エージェントが複数ファイルを変更する前に**素早いプリコミットゲート**が必要な時
- エージェントが変更案に対する**数値リスクスコア（0-1）**が欲しい時
- **データベースやtree-sitterのセットアップなし**で依存関係分析が必要な時

CodeImpact MCPはts-morphを使って軽量な依存グラフを構築し、明確な判定を返します：PASS、WARN、またはBLOCK。クラウド不要、APIキー不要、完全ローカル動作。

## インストール

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Claude Desktop

`claude_desktop_config.json`に追加：

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

`.cursor/mcp.json`に追加：

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

ClineのMCP設定に追加：

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

## ツール

### `gate_check`

プリコミット安全ゲート。指定された変更を分析し、理由付きの**PASS/WARN/BLOCK判定**を返します。複数ファイルの変更をコミットする前の判断材料として使用してください。BLOCKはリスクが閾値を超えていることを意味します。WARNは人間によるレビューを推奨します。PASSはグラフベースのリスクが低いことを意味します。

### `analyze_impact`

特定ファイルの変更による影響範囲を分析します。直接的・間接的に影響を受けるファイルとリスクスコア（0-1）を返します。複数ファイルの変更をコミットする前に、何が壊れる可能性があるかを把握するために使用してください。ファイルの変更は一切行いません。

### `get_dependencies`

特定ファイルのimport/importedBy関係を取得します。そのファイルが何に依存しているか、何がそのファイルに依存しているかを表示します。リファクタリング前に結合度を把握するために使用してください。

### `refresh_graph`

依存グラフをゼロから再構築します。大量のファイル追加・削除後、または結果が古くなっている場合に呼び出してください。ファイル数、エッジ数、構築時間、検出された循環依存を含むグラフ統計を返します。

## 会話の例

**ユーザー：**「`src/routes.ts`をリファクタリングしたいんだけど、安全？」

**エージェントが** `gate_check`を呼び出す：
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

**結果：**
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

**エージェント：**「ゲートチェックの結果はWARNでした。routes.tsに依存しているファイルが8つあります。変更前に影響を受けるファイルを確認します。」

## 仕組み

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

1. **解析：** ts-morphがプロジェクト内のESM import、re-export、CommonJS requireをスキャン
2. **グラフ構築：** インメモリの依存グラフを構築（データベースなし、永続化なし）
3. **分析：** 変更ファイルから逆依存をBFS走査
4. **スコア算出：** リスク = 影響ファイル数 / 全ファイル数（0-1）
5. **判定：** PASS（閾値の60%未満）、WARN（60-100%）、BLOCK（閾値超過）

対応形式：ESM import、ESM re-export、CommonJS `require()`、NodeNext形式の`.js` → `.ts`解決。

## 比較

| 機能 | CodeImpact MCP | Codegraph | Depwire | dependency-mcp |
|------|:---:|:---:|:---:|:---:|
| プリコミットゲート（PASS/WARN/BLOCK） | **対応** | 非対応 | 非対応 | 非対応 |
| 数値リスクスコア（0-1） | **対応** | 非対応 | ヘルススコア | 非対応 |
| セットアップ不要（データベースなし） | **対応** | SQLite必須 | セットアップ必須 | 対応 |
| インストール時間 | **数秒** | 数分 | 数分 | 数秒 |
| ライセンス | **MIT** | MIT | **BSL 1.1** | MIT |
| ツール数 | 4 | 30+ | 10 | 3 |
| 言語サポート | TS/JS | 11言語 | 多言語 | 多言語 |
| 循環依存検出 | **対応** | 対応 | 対応 | 非対応 |
| エージェント最適化出力 | **対応** | 一部 | 一部 | 一部 |
| ローカルファースト / クラウド不要 | **対応** | 対応 | 対応 | 対応 |

**CodeImpact MCPを選ぶべき場面：** コミット前に素早く明確な回答（PASS/WARN/BLOCK）が欲しい場合。フルコードベース探索ツールではありません。セットアップ不要、MITライセンス、数秒で動作。

**Codegraph/Depwireを選ぶべき場面：** 永続ストレージとビジュアライゼーションを備えた、多言語対応の深いコードベース探索が必要な場合。

## FAQ

**Q: ネットワークにアクセスしますか？**
A: いいえ。CodeImpact MCPは100%ローカル動作です。ts-morphでプロジェクトファイルを読み取るだけで、ネットワークリクエストは一切行いません。APIキー不要、クラウド不要、テレメトリなし。

**Q: コードを変更しますか？**
A: いいえ。4つのツールすべてが読み取り専用です（`readOnlyHint: true`アノテーション付き）。分析のみで書き込みは行いません。

**Q: リスクスコアの精度は？**
A: リスクスコアはグラフベースのヒューリスティック（影響ファイル数 / 全ファイル数）です。ランタイムの挙動、テスト、データマイグレーションは考慮しません。保証ではなく、トリアージのシグナルとして扱ってください。

**Q: JavaScriptのみのプロジェクトに対応していますか？**
A: はい。TypeScriptとJavaScriptの両方に対応しています（`.ts`、`.tsx`、`.js`、`.jsx`、`.mts`、`.cts`、`.mjs`、`.cjs`）。

**Q: 速度は？**
A: グラフ構築はプロジェクトサイズに応じて通常1〜5秒です。キャッシュ済みグラフに対する個々のツール呼び出しはほぼ瞬時です。

**Q: グラフはキャッシュされますか？**
A: はい。グラフは(projectRoot, tsconfigPath)のペアごとにインメモリでキャッシュされます。大きな変更後はグラフを再構築するために`refresh_graph`を使用してください。

## 制限事項

- TypeScript/JavaScriptのみ対応（多言語サポートなし）
- ランタイムimportと型のみのimportの区別なし
- グラフはインメモリのみ（サーバー再起動時に永続化されない）
- リスクスコアは構造的であり意味論的ではない — どのファイルが「重要」かは判断しない
- ビジュアライゼーション出力なし（テキスト/JSONのみ）

## 変更履歴

リリース履歴は[CHANGELOG.md](./CHANGELOG.md)をご覧ください。

## ライセンス

[MIT](./LICENSE) — 商用・個人を問わずどのプロジェクトでも自由に使用できます。

## コントリビューション

Issue・PRは[github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp)までお願いします。
