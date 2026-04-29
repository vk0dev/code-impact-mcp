# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/vk0dev/code-impact-mcp/ci.yml?branch=main)](https://github.com/vk0dev/code-impact-mcp/actions)

> **MCP local para análisis de dependencias y blast radius.** Ayuda al agente a evaluar impacto, rutas de dependencia, ciclos y nivel de riesgo antes de tocar código.

**Idiomas:** [English](./README.md) · [日本語](./README.ja.md) · [简体中文](./README.zh-CN.md) · [Русский](./README.ru.md) · Español

---

## Cuándo usarlo

Usa CodeImpact MCP cuando el agente necesite responder **“qué rompe este cambio”** y no solo **“dónde está este símbolo”**.

- revisar blast radius antes de refactors
- usar un gate graph-aware antes del commit
- detectar dependencias cíclicas
- entender impacto entre paquetes en monorepos
- comparar varias opciones de cambio por riesgo

## Instalación

Todo usa `npx`, sin instalación global.

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

O mediante `.mcp.json`:

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

### Verificación

Pregunta qué herramientas expone `code-impact`. Deben aparecer las **5 herramientas** actuales:

- `gate_check`
- `analyze_impact`
- `find_path`
- `refresh_graph`
- `detect_cycles`

## Herramientas

### `gate_check`

Gate de seguridad antes del commit. Analiza cambios específicos y devuelve **PASS / WARN / BLOCK**. El wording actual es cycle-aware: si hay ciclos existentes o señales de cycle-risk, el resultado puede subir a WARN o BLOCK.

![gate_check demo](./docs/demo-gate-check.gif)

### `analyze_impact`

Muestra qué archivos, módulos y nodos quedan afectados por un cambio.

### `find_path`

Encuentra la ruta de dependencia entre dos nodos para explicar por qué un componente impacta a otro.

### `refresh_graph`

Reconstruye el grafo de dependencias desde cero a partir del estado actual del repo.

### `detect_cycles`

Detecta dependencias cíclicas. El producto actual ya no es el surface antiguo de 4 herramientas: ahora el surface correcto es de **5 herramientas** e incluye `detect_cycles`.

![cycle detection demo](./docs/demo-cycles.gif)

## Comparación

CodeImpact MCP encaja cuando necesitas análisis **local, invocable por el agente y realmente consciente del grafo**.

- Más útil que una simple búsqueda de imports para blast radius y path reasoning.
- Más liviano que plataformas externas pesadas.
- Alineado con el README en inglés actual, incluyendo framing de comparación, soporte de monorepo y cycle detection.

## FAQ

**¿Es solo para monorepos?**
No. Ahí brilla más, pero también sirve en repos normales.

**¿Qué hace `gate_check` hoy?**
Devuelve PASS, WARN o BLOCK teniendo en cuenta el riesgo del cambio y los ciclos.

**¿Por qué ahora son 5 herramientas?**
Porque `detect_cycles` forma parte del surface actual y ya no debe omitirse en la documentación.

## Desarrollo

```bash
npm ci
npm run build
npm test
npm run lint
```

## Changelog

Consulta [CHANGELOG.md](./CHANGELOG.md).

## Licencia

[MIT](./LICENSE) © vk0.dev
