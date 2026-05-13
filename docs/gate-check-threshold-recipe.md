# `gate_check` threshold recipe

Use this when the main question is not just "what verdict did I get?" but "what threshold should my team use for this kind of change?"

This recipe stays decision-first:
- `gate_check` is a **graph-based pre-commit signal**
- the threshold changes how quickly the tool escalates from PASS to WARN to BLOCK
- it does **not** know your tests, runtime behavior, migrations, traffic, or rollback plan

## The short version

- use **`0.3`** when you want a **tight blocker** for risky/shared surfaces
- use **`0.5`** when you want a **balanced default** for normal app work
- use **`0.7`** when you want a **looser review threshold** and do not want broad WARN/BLOCK noise during active refactors

Remember the shipped verdict rule:
- **PASS**: graph risk is below 60% of your chosen threshold
- **WARN**: graph risk is between 60% and 100% of your threshold, or the graph contains cycles elsewhere
- **BLOCK**: graph risk exceeds your threshold, or a changed file participates in a detected cycle

## How to choose `0.3` vs `0.5` vs `0.7`

### `0.3` — tight blocker

Good fit when:
- you are touching auth, billing, routing, shared config, or other high-blast-radius files
- your team wants early human review before changes spread
- you would rather stop too early than miss a risky change

What it means in practice:
- relatively small blast-radius changes can already move into WARN or BLOCK
- this is useful for conservative repos or protected branches

Example:
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/auth/policy.ts"],
  "threshold": 0.3
}
```

Use this when the team action is: "pause fast, review fast, then continue."

### `0.5` — balanced default

Good fit when:
- you want a sensible day-to-day default
- the repo has both shared modules and leaf features
- you want WARN to mean "look carefully" without turning every medium change into a stop sign

What it means in practice:
- clearly local changes still PASS
- medium spread changes usually WARN
- broad or cycle-touched changes BLOCK

Example:
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/routes.ts"],
  "threshold": 0.5
}
```

Use this when the team action is: "most work flows normally, but spread and coupling should slow us down."

### `0.7` — looser review threshold

Good fit when:
- you are in an active refactor or migration window
- the team expects temporarily broader graph movement
- you still want a gate, but do not want medium fan-out changes blocked too aggressively

What it means in practice:
- local and medium-spread changes are more likely to PASS or WARN
- truly broad changes still BLOCK
- cycle participation still BLOCKS, because that is separate from threshold looseness

Example:
```json
{
  "projectRoot": "/Users/you/projects/my-app",
  "files": ["src/shared/logger.ts"],
  "threshold": 0.7
}
```

Use this when the team action is: "keep moving, but still surface broad spread and cycle risk."

## What PASS, WARN, and BLOCK should change for humans

### PASS

Recommended action:
- proceed with normal review
- still run tests and build
- do not treat PASS as proof that runtime behavior is safe

PASS means the graph looks relatively contained for the threshold you chose.

### WARN

Recommended action:
- review the affected files before commit or merge
- check whether the change touches shared modules or unstable boundaries
- if cycles are present elsewhere, decide whether this is still an acceptable time to continue near that area

WARN means "slow down and inspect", not "drop everything."

### BLOCK

Recommended action:
- stop and shrink the change, split the work, or untangle the cycle first
- if the change is intentionally broad, require explicit human approval before continuing
- use `detect_cycles` when the reason mentions circular dependency participation

BLOCK means the current graph shape is too risky for the threshold you selected, or the changed file is already inside a cycle.

## Practical install-hook workflow for teams

If your team uses the shipped Husky helper, a good local-first workflow is:

1. preview the managed snippet with:
   ```bash
   npm run demo:install-hook
   ```
2. install the helper once:
   ```bash
   npx -y @vk0/code-impact-mcp install-hook
   ```
3. choose one team default threshold for normal commits, usually `0.5`
4. let developers rerun `gate_check` manually with `0.3` for sensitive changes or `0.7` during controlled refactors
5. when the hook returns WARN or BLOCK, inspect `analyze_impact` output before retrying the commit
6. when the gate mentions a cycle, run `detect_cycles` and decide whether to untangle now or split the change

A practical team rule can be:
- default branch work: `0.5`
- auth/billing/shared infra: manually check again at `0.3`
- planned refactor sprint: temporarily allow manual review at `0.7`

## One simple decision recipe

Use this if you want a fast default without overthinking it:

- **Start at `0.5`**
- if the repo is conservative or the file is central, retry mentally with **`0.3`** and ask whether you actually want a tighter stop line
- if the repo is in a broad refactor and WARN/BLOCK noise is slowing planned work, consider **`0.7`** for that window
- if the gate reports cycle participation, treat that as the real issue before debating thresholds

## Truthful caveat

`gate_check` is a structural graph signal.

It helps answer: "how far could this change spread through imports and reverse dependencies?"

It does **not** answer:
- whether tests pass
- whether runtime behavior is correct
- whether a migration is safe
- whether the business change is acceptable

Use it as a bounded decision aid before commit, not as a production guarantee.

## Related docs

- [Pre-commit gate recipe](./pre-commit-gate-recipe.md)
- [How to read `analyze_impact` and `gate_check` output](./read-analyze-impact-output.md)
- [Claude Desktop quickstart](./quickstart-claude-desktop.md)
