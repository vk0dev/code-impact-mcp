# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**Быстрый dependency-gate перед коммитом для AI-assisted изменений.** Отвечает на вопрос «это безопасно коммитить?» через PASS/WARN/BLOCK за секунды, чтобы ловить рискованный blast radius до плохого коммита, а не после. Без базы данных и тяжёлой настройки.

[日本語](./README.ja.md) | [中文](./README.zh-CN.md) | [English](./README.md) | [Español](./README.es.md)

## Best for

- **Проверка рефакторинга перед коммитом:** когда меняете общий файл, роут или модуль и нужен быстрый PASS/WARN/BLOCK ответ.
- **Мультифайловые правки агентом, включая monorepo:** когда AI-агент собирается тронуть несколько файлов или workspace-пакетов и нужен ограниченный dependency-aware gate до коммита.
- **Triage blast radius без инфраструктуры:** когда нужен быстрый risk score и список затронутых файлов без базы, graph-сервиса или тяжёлого governance-слоя.

## Not for

Это **не** full policy platform, не compliance suite и не visualization-heavy graph product.

Инструмент сделан для быстрых локальных commit-time safety checks, а не для repo-wide governance workflows, persistent graph exploration или executive reporting.

## Why / When to use

Используйте этот MCP server, когда:

- пользователь спрашивает: **«Что сломается, если я изменю этот файл?»**
- пользователь спрашивает: **«Безопасно ли коммитить этот рефакторинг?»**
- пользователь просит: **«Проверь blast radius перед push»**
- пользователь спрашивает: **«Что зависит от этого модуля?»**
- агенту нужен **быстрый pre-commit gate** перед изменением нескольких файлов
- агенту нужен **числовой risk score (0-1)** для предлагаемого изменения
- нужен dependency analysis **без настройки базы данных или tree-sitter**

CodeImpact MCP строит лёгкий dependency graph на ts-morph и даёт ограниченный ответ: PASS, WARN или BLOCK. Zero cloud, no API key, local-first. Сегодня это означает полную поддержку TypeScript/JavaScript плюс узкий file-level Python path для `analyze_impact` и `gate_check`, включая import-graph blast radius и тот же verdict framing, без заявлений о широкой multi-language coverage.

Если нужен **быстрый ограниченный pre-commit gate для AI-generated code changes**, а не тяжёлая governance-платформа, это и есть canonical MCP server для такого сценария. Zero cloud, no API key, local-first.

## Installation

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Optional pre-commit hook helper

Если у вас уже используется Husky, можно подключить ограниченный gate runner без ручной правки hook:

```bash
npx -y @vk0/code-impact-mcp install-hook
```

Если `.husky/` уже существует, команда создаёт или обновляет только помеченный блок `code-impact-mcp` внутри `.husky/pre-commit` и не трогает остальное содержимое hook. Если Husky ещё не инициализирован, команда останавливается с понятным сообщением вместо того, чтобы разворачивать hook-инфраструктуру за вас.

### Claude Desktop

Добавьте в `claude_desktop_config.json`:

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

Добавьте в `.cursor/mcp.json`:

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

Добавьте в настройки MCP серверов Cline:

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

Pre-commit safety gate. Анализирует указанные изменения и возвращает **PASS/WARN/BLOCK verdict** с причинами. Используйте как ограниченный decision aid перед коммитом мультифайловых изменений, включая workspace-aware проверки для pnpm/package.json workspaces и lerna-style monorepos. BLOCK означает, что risk превышает threshold или изменённый файл участвует в обнаруженном cycle. WARN означает, что нужен human review, включая случаи, когда cycles есть в графе в другом месте. PASS означает низкий graph-based risk.

### `detect_cycles`

Возвращает компактные strongly connected components для circular dependencies в текущем TS/JS graph. Используйте перед рефакторингом или release gating, когда нужен короткий список cycle hotspots, а не полная graph visualization.

### `analyze_impact`

Анализирует blast radius изменения конкретных файлов. Возвращает, какие файлы будут затронуты напрямую и транзитивно, с risk score (0-1). Используйте ДО коммита мультифайловых изменений, чтобы понять, что может сломаться. Код не изменяет.

![analyze_impact demo](docs/demo-analyze-impact.gif)

### `get_dependencies`

Показывает отношения import и importedBy для конкретного файла. Помогает понять, от чего зависит файл и что зависит от него, перед рефакторингом.

### `refresh_graph`

Перестраивает dependency graph с нуля. Вызывайте после существенных добавлений/удалений файлов или если результат выглядит устаревшим. Возвращает статистику графа, включая число файлов, рёбер, время сборки и обнаруженные circular dependencies.

## Example conversation

**Пользователь:** «Я хочу отрефакторить `src/routes.ts` — это безопасно?»

**Агент вызывает** `gate_check`:
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

**Результат:**
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

**Агент:** «Gate check вернул BLOCK — `routes.ts` участвует в cycle, сначала надо распутать эту зависимость.»

![gate_check demo](docs/demo-gate-check.gif)

**Агент вызывает** `detect_cycles`:
```json
{
  "projectRoot": "/Users/you/projects/my-app"
}
```

**Результат:**
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

1. **Parse:** ts-morph сканирует проект на ESM imports, re-exports и CommonJS require
2. **Graph:** строит in-memory dependency graph без базы и persistence
3. **Analyze:** делает BFS traversal по reverse dependencies от изменённых файлов
4. **Score:** Risk = affected files / total files (0-1)
5. **Verdict:** PASS (< 60% threshold), WARN (60-100%), BLOCK (> threshold)

Поддерживается: ESM imports, ESM re-exports, CommonJS `require()`, NodeNext-style `.js` → `.ts` resolution.

## Comparison

| Альтернатива | Лучше всего подходит для | Чем отличается CodeImpact MCP |
| --- | --- | --- |
| **CodeImpact MCP** | Быстрого pre-commit verdict для TS/JS-репозиториев | **Этот репозиторий оптимизирован под один gate answer:** PASS / WARN / BLOCK перед merge или handoff другому агенту. |
| **CodeGraphContext** | Богатого context retrieval и repository understanding для длинного reasoning | CodeGraphContext помогает агенту читать больше контекста и рассуждать по репозиторию. CodeImpact намеренно уже: это не context provider, а fast local gate verdict. |
| **Depwire** | Multi-language dependency intelligence, stored analysis и более глубоких dependency health workflows | Depwire шире и тяжелее. CodeImpact остаётся zero setup, MIT license и сфокусирован на быстром local pre-commit decision, а не на большой dependency platform. |
| **code-graph-mcp** | Graph exploration и codebase inspection через более широкий MCP tool surface | CodeImpact не пытается быть graph explorer. Он выигрывает, когда нужен мгновенный bounded verdict-first workflow. |
| **RepoGraph** | Repository graph browsing, graph-first discovery и visual exploration | Инструменты класса RepoGraph лучше для исследования. CodeImpact лучше, когда touched files уже известны и нужен быстрый PASS / WARN / BLOCK ответ. |
| **code-pathfinder** | Code navigation и path tracing внутри репозитория | code-pathfinder помогает искать пути по коду. CodeImpact помогает остановить risky edits до commit одним явным gate result. |

**Когда выбирать CodeImpact MCP:** когда нужен fast local gate без setup, с MIT license и ответом за секунды. Он сфокусирован на single verdict, numeric risk score и pre-commit answer.

**Когда выбирать context-provider / graph-explorer альтернативы:** когда нужны более широкие repository reasoning, graph traversal, visualization или persistent multi-language analysis. Эти инструменты помогают думать о кодовой базе, а CodeImpact помогает gate change.

## FAQ

**Q: Он ходит в сеть?**
A: Нет. CodeImpact MCP полностью local-first. Он читает файлы проекта через ts-morph и не делает сетевых запросов. Никаких API key, cloud и telemetry.

**Q: Он изменяет код?**
A: Нет. Все 5 tools read-only (`readOnlyHint: true`). Они анализируют, но не пишут.

**Q: Насколько точен risk score?**
A: Это graph-based heuristic (affected files / total files). Он не знает про runtime behavior, tests или data migrations. Воспринимайте его как triage signal, а не гарантию.

**Q: Какие языки поддерживаются сегодня?**
A: Полная поддержка по-прежнему сосредоточена на TypeScript и JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`). Также есть ограниченный Python path для `analyze_impact` и `gate_check`, но он остаётся на уровне file/module impact и не превращает продукт в broad multi-language platform.

**Q: Насколько быстро он работает?**
A: Сборка графа обычно занимает 1-5 секунд в зависимости от размера проекта. Отдельные tool calls по уже закэшированному графу почти мгновенны.

**Q: Кэширует ли он граф?**
A: Да. Graph кэшируется in-memory по паре `(projectRoot, tsconfigPath)`. Используйте `refresh_graph`, чтобы пересобрать его после существенных изменений.

## Limitations

- Полная graph depth по-прежнему strongest для TypeScript/JavaScript; Python support намеренно ограничен local file/module-level impact, а не full multi-language platform
- Нет различия между runtime imports и type-only imports
- Граф только in-memory (без persistence после restart сервера)
- Risk score структурный, а не семантический — он не знает, какие файлы «важнее»
- Нет visualization output (только text/JSON)

## Changelog

Смотрите [CHANGELOG.md](./CHANGELOG.md) для истории релизов.

## License

[MIT](./LICENSE) — можно использовать в любых проектах, коммерческих и личных.

## Contributing

Issues и PRs приветствуются: [github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp).
