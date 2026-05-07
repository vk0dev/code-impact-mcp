# Pre-commit gate recipe

Use this when you already have Husky and want the shortest truthful path to a bounded pre-commit gate.

## What this recipe assumes

- you already use Husky
- you want the shipped `install-hook` helper, not a custom hook rewrite
- you want a dry-run first, then the real helper

## 1. Preview the managed snippet

From the project repo where you want the hook:

```bash
npm run demo:install-hook
```

This is a dry-run preview. It shows the managed `code-impact-mcp` block without writing `.husky` files.

## 2. Apply the helper

```bash
npx -y @vk0/code-impact-mcp install-hook
```

## 3. What the helper actually does

It only manages the `code-impact-mcp` block inside `.husky/pre-commit`.

It is intentionally narrow:

- reruns are idempotent inside that managed block
- unrelated hook logic outside the managed block is left alone
- if `.husky/pre-commit` contains unrelated content and no managed block, the helper refuses instead of rewriting it
- if Husky is not initialized, the helper stops with an actionable message instead of scaffolding hook infrastructure for you

## 4. A safe first-use workflow

1. run `npm run demo:install-hook`
2. confirm the snippet matches your expectations
3. run `npx -y @vk0/code-impact-mcp install-hook`
4. inspect `.husky/pre-commit`
5. make a small test change and run your normal commit flow

## 5. When to use this recipe

Good fit:
- you want a decision-first pre-commit gate
- your repo already has Husky
- you do not want to hand-edit the hook every time

Not a fit:
- you want the tool to bootstrap Husky for you
- you want it to manage non-`pre-commit` hook files
- you want a broader policy platform instead of a bounded gate helper

## 6. Pair it with the tool outputs

The best loop is:

- use `analyze_impact` while planning a refactor
- use `gate_check` before commit
- if the gate mentions a cycle, use `detect_cycles` to see the compact hotspot set

## Related docs

- [Claude Desktop quickstart](./quickstart-claude-desktop.md)
- [How to read `analyze_impact` and `gate_check` output](./read-analyze-impact-output.md)
