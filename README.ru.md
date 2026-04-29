# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/vk0dev/code-impact-mcp/ci.yml?branch=main)](https://github.com/vk0dev/code-impact-mcp/actions)

> **Локальный MCP-сервер для графа зависимостей и blast-radius анализа.** Помогает агенту оценивать влияние изменений, находить циклы, проверять риск и принимать более безопасные решения перед правкой кода.

**Языки:** [English](./README.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · Русский · [Español](./README.es.md)

---

## Когда использовать

Используйте CodeImpact MCP, когда агенту нужно понять, **что сломает изменение**, а не просто найти символ.

Типовые случаи:

- проверка blast radius перед рефакторингом
- graph-aware gate перед коммитом
- поиск циклических зависимостей
- работа с монорепой, где связи между пакетами неочевидны
- сравнение нескольких кандидатов на изменение по уровню риска

## Установка

Все варианты используют `npx`, глобальная установка не нужна.

### Claude Desktop

Отредактируйте конфиг Claude Desktop:

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

Или через `.mcp.json` в корне проекта:

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

### Cursor / Cline

Используйте тот же `command: "npx"` и `args: ["-y", "@vk0/code-impact-mcp"]` в MCP-конфиге клиента.

### Проверка

Спросите у клиента, какие инструменты предоставляет `code-impact`. Должны быть видны **5 инструментов**:

- `gate_check`
- `analyze_impact`
- `find_path`
- `refresh_graph`
- `detect_cycles`

## Инструменты

### `gate_check`

Pre-commit safety gate. Анализирует указанные изменения и возвращает **PASS / WARN / BLOCK** с учётом blast radius, критических узлов и циклов. Текущая формулировка cycle-aware: существующие циклы и новые cycle-risk сигналы могут поднять результат до WARN или BLOCK, а не просто дать нейтральную справку.

![gate_check demo](./docs/demo-gate-check.gif)

### `analyze_impact`

Показывает, какие файлы, модули и узлы затрагивает изменение, и помогает оценить радиус воздействия до редактирования.

### `find_path`

Ищет путь зависимости между двумя узлами, чтобы объяснить, почему один компонент влияет на другой.

### `refresh_graph`

Полностью перестраивает граф зависимостей из текущего состояния репозитория. Полезно после крупных изменений структуры или переключения ветки.

### `detect_cycles`

Находит циклы зависимостей и помогает отличать нормальный связанный граф от реального structural risk. Это часть текущего 5-tool surface, и cycle detection больше не является скрытым или внепродуктовым состоянием.

![cycle detection demo](./docs/demo-cycles.gif)

## Пример диалога

```text
Вы: Проверь, безопасно ли менять src/api/router.ts.

Агент: [calls gate_check]
       WARN. Изменение заденет несколько downstream-модулей,
       и рядом уже есть цикл в dependency graph.

Вы: Покажи, почему router связан с billing.

Агент: [calls find_path]
       Нашёл путь зависимости через api -> services -> billing.
```

## Сравнение

CodeImpact MCP полезен, когда нужен **локальный, agent-callable, graph-aware** анализ, а не просто grep по импортам.

- По сравнению с простыми search/index инструментами он даёт blast-radius и path reasoning.
- По сравнению с heavyweight платформами он работает локально и быстрее встраивается в agent workflow.
- По сравнению с прежним состоянием продукта локализованные README теперь тоже отражают текущий **5-tool surface**, включая `detect_cycles`.

## FAQ

**Это только для монореп?**
Нет. Особенно полезно в монорепах, но работает и на обычных репозиториях.

**Что делает `gate_check` сейчас?**
Это cycle-aware gate, который возвращает PASS, WARN или BLOCK в зависимости от риска изменений, а не только по размеру diff.

**Нужно ли обновлять граф вручную?**
Обычно нет. Но после крупных структурных изменений полезно вызвать `refresh_graph`.

**Почему в списке инструментов 5, а не 4?**
Потому что текущий продукт включает `detect_cycles` как полноценный инструмент surface.

## Разработка

```bash
npm ci
npm run build
npm test
npm run lint
```

## Changelog

См. [CHANGELOG.md](./CHANGELOG.md).

## Лицензия

[MIT](./LICENSE) © vk0.dev
