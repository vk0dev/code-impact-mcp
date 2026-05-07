# How to read `analyze_impact` and `gate_check` output

These tools are meant to help you decide whether to commit now, refactor first, or slow down and review.

## Example `analyze_impact` result

```json
{
  "changedFiles": ["src/shared/logger.ts"],
  "directlyAffected": [
    "src/services/formatter.ts",
    "src/shared/config.ts"
  ],
  "transitivelyAffected": [
    "src/api/handler.ts",
    "src/index.ts"
  ],
  "riskScore": 0.57,
  "totalAffected": 4
}
```

## How to read it

### `changedFiles`
The files you told the tool you plan to change.

### `directlyAffected`
Files that depend on the changed file immediately.

Think: if you change `src/shared/logger.ts`, these files touch it directly and are the first places most likely to feel the change.

### `transitivelyAffected`
Files that depend on the direct dependents further up the chain.

Think: these are the wider blast radius, not the first domino.

### `riskScore`
A graph-based heuristic from `0` to `1`.

- lower = more isolated change
- higher = wider structural fanout

It is a triage signal, not a guarantee about runtime behavior.

### `totalAffected`
Quick count of all direct + transitive dependents.

Use this when you need a fast answer like, “Is this a 2-file change or a repo-shape change?”

## Example `gate_check` result

```json
{
  "verdict": "BLOCK",
  "riskScore": 0.35,
  "reasons": [
    "Changed files participate in a circular dependency. Example: src/router.ts → src/routes.ts"
  ],
  "affectedFiles": 8,
  "circularDependencies": 1
}
```

## How to act on `gate_check`

### `PASS`
Proceed. The graph-based risk is low enough for the threshold you chose.

### `WARN`
Slow down and review.

Good reasons to continue anyway:
- the change is still small and well-tested
- you expected a medium blast radius
- the repo already has known graph complexity in this area

### `BLOCK`
Treat this as “refactor the shape first” or “split the change”.

Common reasons:
- too many affected files for your chosen threshold
- one of the changed files participates in a detected cycle

## Simple decision recipe

- Want to understand scope first? Start with `analyze_impact`.
- Want a commit-time go/no-go signal? Run `gate_check`.
- Want to understand why a cycle warning appeared? Run `detect_cycles`.

## What these tools do not know

They do not know:
- runtime behavior
- test coverage quality
- data migrations
- semantic importance of a file

That means a low score is helpful, but not permission to skip judgment.

## Related docs

- [Claude Desktop quickstart](./quickstart-claude-desktop.md)
- [Pre-commit gate recipe](./pre-commit-gate-recipe.md)
