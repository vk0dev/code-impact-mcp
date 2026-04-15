# CodeImpact MCP

[![npm](https://img.shields.io/npm/v/@vk0/code-impact-mcp)](https://www.npmjs.com/package/@vk0/code-impact-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![CI](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/vk0dev/code-impact-mcp/actions/workflows/ci.yml)

**Compuerta de seguridad pre-commit ligera para agentes de IA.** Responde "es seguro este cambio?" con un veredicto PASS/WARN/BLOCK en segundos — sin base de datos, sin configuraciones complejas.

[English](./README.md) | [日本語](./README.ja.md) | [中文](./README.zh-CN.md) | [Русский](./README.ru.md)

## Por que / Cuando usarlo

Usa este servidor MCP cuando:

- El usuario pregunta: **"Que se rompe si cambio este archivo?"**
- El usuario pregunta: **"Es seguro hacer commit de esta refactorizacion?"**
- El usuario pregunta: **"Revisa el radio de impacto antes de hacer push"**
- El usuario pregunta: **"Que depende de este modulo?"**
- Un agente necesita una **compuerta pre-commit rapida** antes de modificar multiples archivos
- Un agente quiere una **puntuacion de riesgo numerica (0-1)** para un cambio propuesto
- Necesitas analisis de dependencias **sin configurar una base de datos o tree-sitter**

CodeImpact MCP construye un grafo de dependencias ligero usando ts-morph y te da una respuesta acotada: PASS, WARN o BLOCK. Sin nube, sin clave API, ejecucion 100% local.

## Instalacion

### Claude Code

```bash
claude mcp add code-impact-mcp -- npx -y @vk0/code-impact-mcp
```

### Claude Desktop

Agrega a `claude_desktop_config.json`:

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

Agrega a `.cursor/mcp.json`:

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

Agrega a la configuracion MCP de Cline:

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

## Herramientas

### `gate_check`

Compuerta de seguridad pre-commit. Analiza los cambios especificados y devuelve un **veredicto PASS/WARN/BLOCK** con razones. Usalo como ayuda de decision acotada antes de hacer commit de cambios en multiples archivos. BLOCK significa que el riesgo supera el umbral. WARN significa que se recomienda revision humana. PASS significa riesgo bajo segun el grafo.

### `analyze_impact`

Analiza el radio de impacto de cambiar archivos especificos. Devuelve que archivos se verian afectados directa y transitivamente, con una puntuacion de riesgo (0-1). Usalo ANTES de hacer commit de cambios en multiples archivos para entender que podria romperse. NO modifica ningun archivo.

### `get_dependencies`

Obtiene las relaciones import e importedBy de un archivo especifico. Muestra de que depende este archivo y que depende de el. Usalo para entender el acoplamiento antes de refactorizar.

### `refresh_graph`

Reconstruye el grafo de dependencias desde cero. Llamalo despues de adiciones/eliminaciones significativas de archivos, o si los resultados parecen desactualizados. Devuelve estadisticas del grafo incluyendo cantidad de archivos, aristas, tiempo de construccion y dependencias circulares detectadas.

## Ejemplo de conversacion

**Usuario:** "Quiero refactorizar `src/routes.ts` — es seguro?"

**El agente llama a** `gate_check`:
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
  "verdict": "WARN",
  "recommendation": "Proceed only with targeted review of affected files.",
  "riskScore": 0.35,
  "reasons": ["Risk score 0.35 is approaching threshold. Review affected files."],
  "affectedFiles": 8,
  "circularDependencies": 0
}
```

**Agente:** "La compuerta devolvio WARN — 8 archivos dependen de routes.ts. Revisare los archivos afectados antes de hacer cambios."

## Como funciona

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

1. **Analisis:** ts-morph escanea el proyecto buscando imports ESM, re-exports y requires de CommonJS
2. **Grafo:** Construye un grafo de dependencias en memoria (sin base de datos, sin persistencia)
3. **Recorrido:** Recorrido BFS de dependencias inversas desde los archivos modificados
4. **Puntuacion:** Riesgo = archivos afectados / total de archivos (0-1)
5. **Veredicto:** PASS (< 60% del umbral), WARN (60-100%), BLOCK (> umbral)

Soporta: imports ESM, re-exports ESM, CommonJS `require()`, resolucion `.js` → `.ts` estilo NodeNext.

## Comparacion

| Caracteristica | CodeImpact MCP | Codegraph | Depwire | dependency-mcp |
|----------------|:---:|:---:|:---:|:---:|
| Compuerta pre-commit (PASS/WARN/BLOCK) | **Si** | No | No | No |
| Puntuacion de riesgo numerica (0-1) | **Si** | No | Health score | No |
| Cero configuracion (sin base de datos) | **Si** | Requiere SQLite | Requiere config | Si |
| Tiempo de instalacion | **Segundos** | Minutos | Minutos | Segundos |
| Licencia | **MIT** | MIT | **BSL 1.1** | MIT |
| Numero de herramientas | 4 | 30+ | 10 | 3 |
| Soporte de lenguajes | TS/JS | 11 lenguajes | Multi | Multi |
| Deteccion de dependencias circulares | **Si** | Si | Si | No |
| Salida optimizada para agentes | **Si** | Parcial | Parcial | Parcial |
| Local-first / sin nube | **Si** | Si | Si | Si |

**Cuando elegir CodeImpact MCP:** Quieres una respuesta rapida y acotada (PASS/WARN/BLOCK) antes de hacer commit — no una herramienta completa de exploracion de codigo. Cero configuracion, licencia MIT, funciona en segundos.

**Cuando elegir Codegraph/Depwire:** Necesitas exploracion profunda del codigo en multiples lenguajes con almacenamiento persistente y visualizacion.

## Preguntas frecuentes

**P: Accede a la red?**
R: No. CodeImpact MCP es 100% local. Lee los archivos del proyecto via ts-morph y nunca realiza solicitudes de red. Sin claves API, sin nube, sin telemetria.

**P: Modificara mi codigo?**
R: No. Las 4 herramientas son de solo lectura (anotadas con `readOnlyHint: true`). Analizan pero nunca escriben.

**P: Que tan precisa es la puntuacion de riesgo?**
R: La puntuacion de riesgo es una heuristica basada en el grafo (archivos afectados / total de archivos). No conoce el comportamiento en tiempo de ejecucion, los tests ni las migraciones de datos. Tratala como una senal de triaje, no como una garantia.

**P: Soporta proyectos solo con JavaScript?**
R: Si. Funciona con archivos TypeScript y JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`, `.mts`, `.cts`, `.mjs`, `.cjs`).

**P: Que tan rapido es?**
R: La construccion del grafo tipicamente toma 1-5 segundos dependiendo del tamano del proyecto. Las llamadas individuales a herramientas contra un grafo en cache son casi instantaneas.

**P: Se cachea el grafo?**
R: Si, el grafo se cachea en memoria por par (projectRoot, tsconfigPath). Usa `refresh_graph` para reconstruirlo despues de cambios significativos.

## Limitaciones

- Solo TypeScript/JavaScript (sin soporte multilenguaje)
- No distingue entre imports de runtime e imports solo de tipos
- El grafo es solo en memoria (no persiste entre reinicios del servidor)
- La puntuacion de riesgo es estructural, no semantica — no sabe cuales archivos son "importantes"
- Sin salida de visualizacion (solo texto/JSON)

## Registro de cambios

Consulta [CHANGELOG.md](./CHANGELOG.md) para el historial de versiones.

## Licencia

[MIT](./LICENSE) — libre para usar en cualquier proyecto, comercial o personal.

## Contribuciones

Issues y PRs son bienvenidos en [github.com/vk0dev/code-impact-mcp](https://github.com/vk0dev/code-impact-mcp).
