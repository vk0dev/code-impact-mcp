# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**AI支援コード変更のための高速な pre-commit dependency gate。** 「これは安全にコミットできるか？」に PASS/WARN/BLOCK で数秒以内に答え、危険な blast radius を悪いコミットの前に見つけます。データベース不要、重いセットアップ不要。

[English](./README.md) | [中文](./README.zh-CN.md) | [Русский](./README.ru.md) | [Español](./README.es.md)

## Best for

- **コミット前のリファクタ確認:** 共有ファイル、ルート、モジュールを変更する前に PASS/WARN/BLOCK を素早く知りたいとき。
- **エージェントによる複数ファイル編集（monorepo 含む）:** AIエージェントが複数ファイルや workspace 単位のパッケージを触る前に、依存関係を踏まえた bounded gate が欲しいとき。
- **インフラなしの blast-radius triage:** データベースや graph service、重い governance layer なしで risk score と影響ファイル要約が欲しいとき。

## Not for

これは **full policy platform** でも **compliance suite** でも **可視化中心のコードグラフ製品** でもありません。

目的はローカルで素早い commit-time safety check であり、repo-wide governance、永続的なグラフ探索、経営向けレポートではありません。

## Why / When to use

次のようなときにこの MCP server を使います。

- ユーザーが **「このファイルを変えると何が壊れる？」** と聞くとき
- ユーザーが **「このリファクタは安全にコミットできる？」** と聞くとき
- ユーザーが **「push 前に blast radius を見て」** と頼むとき
- ユーザーが **「このモジュールに依存しているものは？」** と聞くとき
- エージェントが複数ファイルを変更する前に **高速な pre-commit gate** が必要なとき
- 提案変更に対して **数値 risk score (0-1)** が欲しいとき
- データベースや tree-sitter を用意せずに **dependency analysis** したいとき

CodeImpact MCP は ts-morph で軽量な dependency graph を作り、PASS / WARN / BLOCK という bounded answer を返します。Zero cloud, no API key, local-first. 現在は TypeScript/JavaScript をフルサポートしつつ、`analyze_impact` と `gate_check` には import-graph blast radius を返す狭い file-level Python path もありますが、広い multi-language coverage をうたうものではありません。

AI生成コード変更に対して **重い governance platform ではなく、高速で bounded な pre-commit gate** が欲しいなら、これがその用途の canonical MCP server です。Zero cloud, no API key, local-first.

## Installation

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Optional pre-commit hook helper

v1.6.0 では、pre-commit hook を手で編集せずに bounded gate runner を配線できる安全な Husky-only helper が追加されました。

すでに Husky を使っている場合は、hook を手で配線し直さずに bounded gate runner を追加できます。

```bash
npx -y @vk0/code-impact-mcp install-hook
```

![install-hook demo: helper は印付きの code-impact-mcp ブロックだけを挿入し、再実行しても idempotent のままです](docs/demo-install-hook.gif)

`.husky/` がすでに存在する場合、このコマンドは `.husky/pre-commit` 内の `code-impact-mcp` と印の付いたブロックだけを作成または更新し、再実行しても idempotent のまま、他の hook 内容はそのまま残します。Husky がまだ初期化されていない場合は、hook 基盤を勝手に作らず、実行可能なメッセージを返して停止します。

### Claude Desktop

`claude_desktop_config.json` に追加します。

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

`.cursor/mcp.json` に追加します。

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

Cline の MCP server 設定に追加します。

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

Pre-commit safety gate。指定した変更を解析し、理由付きで **PASS/WARN/BLOCK verdict** を返します。複数ファイル変更をコミットする前の bounded decision aid として使ってください。pnpm/package.json workspaces や lerna-style monorepos に対する workspace-aware analysis も含みます。BLOCK は risk が threshold を超えた、または変更ファイルが検出された cycle に参加していることを意味します。WARN は、グラフの別の場所に cycles がある場合を含め、人手レビュー推奨です。PASS はグラフベースのリスクが低いことを意味します。

### `detect_cycles`

現在の TS/JS graph にある circular dependencies を compact な strongly connected components として返します。リファクタ前や release gating 前に、完全な graph visualization ではなく cycle hotspot の短い一覧が欲しいときに使います。

### `analyze_impact`

特定ファイル変更の blast radius を分析します。直接的・推移的に影響を受けるファイルと risk score (0-1) を返します。複数ファイル変更をコミットする前に、何が壊れそうか把握するために使います。ファイルは変更しません。

![analyze_impact demo](docs/demo-analyze-impact.gif)

### `get_dependencies`

特定ファイルの import / importedBy 関係を返します。リファクタ前に、そのファイルが何に依存し、何から依存されているかを把握できます。

### `refresh_graph`

dependency graph をゼロから再構築します。大きなファイル追加・削除のあとや、結果が古そうに見えるときに呼び出してください。ファイル数、edge 数、build time、検出した circular dependencies を返します。

## Example conversation

**ユーザー:** "`src/routes.ts` をリファクタしたい。安全？"

**エージェントが** `gate_check` **を呼ぶ:**
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

**結果:**
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

**エージェント:** "gate check は BLOCK でした。`routes.ts` は cycle に入っているので、まずその依存関係をほどく必要があります。"

![gate_check demo](docs/demo-gate-check.gif)

**エージェントが** `detect_cycles` **を呼ぶ:**
```json
{
  "projectRoot": "/Users/you/projects/my-app"
}
```

**結果:**
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

1. **Parse:** ts-morph が ESM imports、re-exports、CommonJS require を走査
2. **Graph:** インメモリ dependency graph を構築（DB なし、永続化なし）
3. **Analyze:** 変更ファイルから reverse dependencies を BFS traversal
4. **Score:** Risk = affected files / total files (0-1)
5. **Verdict:** PASS (< threshold の 60%)、WARN (60-100%)、BLOCK (> threshold)

対応: ESM imports、ESM re-exports、CommonJS `require()`、NodeNext-style `.js` → `.ts` resolution。

## Comparison

| 代替ツール | 得意なこと | CodeImpact MCP の違い |
| --- | --- | --- |
| **CodeImpact MCP** | TS/JS リポジトリ向けの高速な pre-commit verdict | **このリポジトリは 1 つの gate answer に最適化されています:** merge や agent handoff の前に PASS / WARN / BLOCK を返します。 |
| **CodeGraphContext** | 長い reasoning のための豊富な context retrieval と repository understanding | CodeGraphContext は agent が広い code context を読んで考えるのに向いています。CodeImpact は意図的に狭く、context provider ではなく fast local gate verdict を返します。 |
| **Depwire** | multi-language dependency intelligence、stored analysis、deeper dependency health workflows | Depwire はより広くて重い選択肢です。CodeImpact は zero setup、MIT license、fast local pre-commit decision に集中します。 |
| **code-graph-mcp** | graph exploration と広い MCP tool surface による codebase inspection | CodeImpact は graph explorer を目指していません。すぐ起動して bounded な verdict-first workflow が欲しいときに向いています。 |
| **RepoGraph** | repository graph browsing、graph-first discovery、visual exploration | RepoGraph 系は探索向けです。CodeImpact は touched files が分かっていて PASS / WARN / BLOCK を素早く出したいときに強いです。 |
| **code-pathfinder** | repository 内の code navigation と path tracing | code-pathfinder は code path を見つけるためのものです。CodeImpact は risky edits を commit 前に止めるための single gate result です。 |

**CodeImpact MCP を選ぶとき:** zero setup のまま、MIT license で、数秒で動く fast local gate が欲しいとき。single verdict、numeric risk score、pre-commit answer に集中しています。

**context-provider / graph-explorer を選ぶとき:** repository reasoning、graph traversal、visualization、persistent multi-language analysis が必要なとき。そうしたツールは考える助けになり、CodeImpact は change を gate します。

## FAQ

**Q: ネットワークにアクセスしますか？**
A: いいえ。CodeImpact MCP は 100% local-first です。ts-morph でプロジェクトファイルを読み取るだけで、ネットワークリクエストは行いません。API key も cloud も telemetry もありません。

**Q: コードを書き換えますか？**
A: いいえ。5つの tools はすべて read-only (`readOnlyHint: true`) です。解析はしますが、書き込みはしません。

**Q: risk score はどれくらい正確ですか？**
A: graph-based heuristic（affected files / total files）です。runtime behavior、tests、data migrations は分かりません。保証ではなく triage signal として扱ってください。

**Q: 現在どの言語をサポートしていますか？**
A: フルサポートの中心は引き続き TypeScript / JavaScript（`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`）です。加えて `analyze_impact` と `gate_check` には bounded な Python path がありますが、file/module 単位の impact に限られ、広い multi-language platform を意味しません。

**Q: どれくらい速いですか？**
A: グラフ構築はプロジェクト規模によりますが通常 1〜5 秒です。キャッシュ済みグラフに対する individual tool call はほぼ瞬時です。

**Q: グラフはキャッシュされますか？**
A: はい。グラフは `(projectRoot, tsconfigPath)` ペアごとにインメモリでキャッシュされます。大きな変更後は `refresh_graph` で再構築してください。

## Limitations

- フル graph depth は引き続き TypeScript/JavaScript が最も強く、Python support は意図的に local file/module-level impact に限定されます。full multi-language platform ではありません
- runtime imports と type-only imports を区別しない
- グラフはインメモリのみ（サーバー再起動後の persistence なし）
- risk score は構造ベースであり、意味的ではない。どのファイルが「重要」かは分からない
- visualization output はない（text/JSON のみ）

## Changelog

リリース履歴は [CHANGELOG.md](./CHANGELOG.md) を参照してください。

## License

[MIT](./LICENSE) — 商用・個人を問わず利用できます。

## Contributing

Issue と PR を歓迎します: [github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp)
