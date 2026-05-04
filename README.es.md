# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**Puerta rápida de dependencias antes del commit para cambios asistidos por IA.** Responde a “¿esto es seguro de commitear?” con PASS/WARN/BLOCK en segundos, para detectar blast radius riesgoso antes de un mal commit, no después. Sin base de datos ni configuración pesada.

[日本語](./README.ja.md) | [中文](./README.zh-CN.md) | [Русский](./README.ru.md) | [English](./README.md)

## Best for

- **Checks de refactor antes del commit:** cuando cambias un archivo compartido, una ruta o un módulo y necesitas una respuesta rápida PASS/WARN/BLOCK.
- **Ediciones multiarchivo por agentes, incluso en monorepos:** cuando un agente de IA va a tocar varios archivos o paquetes por workspace y quieres una puerta acotada con dependencias antes del commit.
- **Triage de blast radius sin infraestructura:** cuando necesitas un risk score rápido y un resumen de archivos afectados sin montar base de datos, graph service o un layer pesado de governance.

## Not for

Esto **no** es una full policy platform, una suite de compliance ni un producto de graph visualization pesada.

Está pensado para checks locales y rápidos al momento del commit, no para governance de repositorio completo, exploración persistente del grafo o reporting ejecutivo.

## Why / When to use

Usa este servidor MCP cuando:

- el usuario pregunta: **“¿Qué se rompe si cambio este archivo?”**
- el usuario pregunta: **“¿Es seguro commitear este refactor?”**
- el usuario pide: **“Revisa el blast radius antes de hacer push”**
- el usuario pregunta: **“¿Qué depende de este módulo?”**
- un agente necesita una **puerta rápida pre-commit** antes de modificar varios archivos
- un agente quiere un **risk score numérico (0-1)** para un cambio propuesto
- necesitas dependency analysis **sin montar base de datos ni tree-sitter**

CodeImpact MCP construye un dependency graph ligero con ts-morph y te da una respuesta acotada: PASS, WARN o BLOCK. Zero cloud, no API key, local-first. Hoy eso significa soporte completo para TypeScript/JavaScript más una ruta Python acotada a nivel file-level para `analyze_impact` y `gate_check`, incluyendo import-graph blast radius y el mismo verdict framing, sin convertir el producto en una plataforma amplia multi-language.

Si necesitas **una puerta pre-commit rápida y acotada para cambios de código generados por IA**, y no una plataforma pesada de code governance, este es el servidor MCP canónico para ese caso. Zero cloud, no API key, local-first.

## Installation

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Optional pre-commit hook helper

Si ya usas Husky, puedes añadir el gate runner acotado sin cablear el hook a mano:

```bash
npx -y @vk0/code-impact-mcp install-hook
```

Si `.husky/` ya existe, el comando crea o actualiza solo el bloque marcado `code-impact-mcp` dentro de `.husky/pre-commit` y deja intacto el resto del contenido del hook. Si Husky todavía no está inicializado, el comando se detiene con un mensaje accionable en lugar de crear la infraestructura de hooks por ti.

### Claude Desktop

Añade esto a `claude_desktop_config.json`:

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

Añade esto a `.cursor/mcp.json`:

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

Añádelo a la configuración de servidores MCP de Cline:

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

Puerta de seguridad pre-commit. Analiza cambios especificados y devuelve un **PASS/WARN/BLOCK verdict** con razones. Úsalo como ayuda de decisión acotada antes de commitear cambios en varios archivos, incluyendo análisis workspace-aware para pnpm/package.json workspaces y monorepos estilo lerna. BLOCK significa que el riesgo supera el threshold o que un archivo modificado participa en un ciclo detectado. WARN significa que se recomienda revisión humana, incluso si hay ciclos en otra parte del grafo. PASS significa riesgo bajo basado en el grafo.

### `detect_cycles`

Devuelve componentes fuertemente conectados compactos para dependencias circulares en el grafo TS/JS actual. Úsalo antes de refactors o release gating cuando quieras una lista corta de hotspots de ciclos y no una visualización completa del grafo.

### `analyze_impact`

Analiza el blast radius de cambiar archivos específicos. Devuelve qué archivos se verían afectados directa y transitivamente, con un risk score (0-1). Úsalo ANTES de commitear cambios en varios archivos para entender qué podría romperse. No modifica archivos.

![analyze_impact demo](docs/demo-analyze-impact.gif)

### `get_dependencies`

Obtiene las relaciones import e importedBy para un archivo específico. Muestra de qué depende el archivo y qué depende de él. Úsalo para entender el acoplamiento antes de refactorizar.

### `refresh_graph`

Reconstruye el dependency graph desde cero. Llámalo después de adiciones/eliminaciones importantes de archivos o si los resultados parecen obsoletos. Devuelve estadísticas del grafo, incluido número de archivos, aristas, tiempo de construcción y dependencias circulares detectadas.

## Example conversation

**Usuario:** "Quiero refactorizar `src/routes.ts` — ¿es seguro?"

**El agente llama** `gate_check`:
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

**Resultado:**
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

**Agente:** "El gate check devolvió BLOCK: `routes.ts` forma parte de un ciclo, así que primero hay que desenredar esa dependencia."

![gate_check demo](docs/demo-gate-check.gif)

**El agente llama** `detect_cycles`:
```json
{
  "projectRoot": "/Users/you/projects/my-app"
}
```

**Resultado:**
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

1. **Parse:** ts-morph escanea tu proyecto en busca de ESM imports, re-exports y CommonJS require
2. **Graph:** construye un dependency graph en memoria (sin base de datos ni persistence)
3. **Analyze:** ejecuta un BFS traversal de reverse dependencies desde los archivos modificados
4. **Score:** Riesgo = archivos afectados / total de archivos (0-1)
5. **Verdict:** PASS (< 60% del threshold), WARN (60-100%), BLOCK (> threshold)

Soporta: ESM imports, ESM re-exports, CommonJS `require()`, y resolución NodeNext-style `.js` → `.ts`.

## Comparison

| Alternativa | Mejor para | En qué se diferencia CodeImpact MCP |
| --- | --- | --- |
| **CodeImpact MCP** | Un pre-commit verdict rápido para repos TS/JS | **Este repositorio está optimizado para una sola gate answer:** PASS / WARN / BLOCK antes de hacer merge o devolver trabajo a otro agente. |
| **CodeGraphContext** | Context retrieval rico y repository understanding para reasoning más largo | CodeGraphContext ayuda a que el agente razone con más contexto del repositorio. CodeImpact es más estrecho a propósito: no actúa como context provider, sino como fast local gate verdict. |
| **Depwire** | Multi-language dependency intelligence, stored analysis y workflows más profundos de dependency health | Depwire es más amplio y pesado. CodeImpact se mantiene zero setup, con licencia MIT, y enfocado en una decisión local rápida antes del commit, no en una gran dependency platform. |
| **code-graph-mcp** | Graph exploration y codebase inspection con una MCP tool surface más amplia | CodeImpact no intenta ser un graph explorer. Gana cuando quieres un verdict-first workflow acotado que arranca al instante. |
| **RepoGraph** | Repository graph browsing, graph-first discovery y visual exploration | Las herramientas tipo RepoGraph son mejores para explorar. CodeImpact es mejor cuando ya conoces los touched files y solo necesitas un PASS / WARN / BLOCK rápido. |
| **code-pathfinder** | Code navigation y path tracing dentro del repositorio | code-pathfinder está pensado para encontrar rutas por el código. CodeImpact está pensado para frenar risky edits antes del commit con un gate result explícito. |

**Cuándo elegir CodeImpact MCP:** cuando quieres un fast local gate, sin setup, con licencia MIT y respuesta en segundos. Se centra en single verdict, numeric risk score y pre-commit answer.

**Cuándo elegir alternativas context-provider / graph-explorer:** cuando necesitas repository reasoning más amplio, graph traversal, visualización o persistent multi-language analysis. Esas herramientas ayudan al agente a razonar sobre el codebase; CodeImpact ayuda a gate the change.

## FAQ

**Q: ¿Accede a la red?**
A: No. CodeImpact MCP es 100% local-first. Lee los archivos de tu proyecto mediante ts-morph y nunca hace solicitudes de red. Sin API keys, sin cloud y sin telemetry.

**Q: ¿Modifica mi código?**
A: No. Las 5 tools son read-only (`readOnlyHint: true`). Analizan, pero no escriben.

**Q: ¿Qué tan preciso es el risk score?**
A: Es una heurística basada en el grafo (archivos afectados / total de archivos). No conoce runtime behavior, tests ni data migrations. Tómalo como señal de triage, no como garantía.

**Q: ¿Qué lenguajes soporta hoy?**
A: El soporte completo sigue centrado en TypeScript y JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`). Además, `analyze_impact` y `gate_check` tienen una ruta Python acotada, pero se queda en impacto a nivel file/module y no implica una plataforma amplia multi-language.

**Q: ¿Qué tan rápido es?**
A: La construcción del grafo suele tardar de 1 a 5 segundos según el tamaño del proyecto. Las tool calls individuales contra un grafo cacheado son casi instantáneas.

**Q: ¿Hace caché del grafo?**
A: Sí. El grafo se cachea en memoria por par `(projectRoot, tsconfigPath)`. Usa `refresh_graph` para reconstruirlo tras cambios importantes.

## Limitations

- La graph depth completa sigue siendo más fuerte en TypeScript/JavaScript; el soporte Python está limitado a impacto local a nivel file/module y no a una plataforma completa multi-language
- No distingue entre runtime imports y type-only imports
- El grafo existe solo en memoria (sin persistence tras reiniciar el servidor)
- El risk score es estructural, no semántico; no sabe qué archivos son “más importantes”
- No hay visualization output (solo texto/JSON)

## Changelog

Consulta [CHANGELOG.md](./CHANGELOG.md) para el historial de versiones.

## License

[MIT](./LICENSE) — libre de usar en cualquier proyecto, comercial o personal.

## Contributing

Issues y PRs bienvenidos en [github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp).
