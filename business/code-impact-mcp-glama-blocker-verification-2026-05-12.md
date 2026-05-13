# code-impact-mcp Glama blocker verification — 2026-05-12

Verdict: `READY_FOR_OPERATOR_ACTION`

## Goal
Точечно проверить, есть ли у `code-impact-mcp` реальная live Glama product page сейчас, что именно блокирует already-open PR `punkpeye/awesome-mcp-servers#5907`, нужен ли какой-либо repo-side patch, и какой самый маленький следующий operator action честно двигает lane.

## Sources checked

### Repo truth
- `/Users/vkdev/.openclaw/workspace/plans/code-impact-mcp.md`
- `/Users/vkdev/projects/code-impact-mcp/README.md`
- `/Users/vkdev/projects/code-impact-mcp/server.json`

### Public Glama surfaces
- `https://glama.ai/mcp/servers/vk0dev/code-impact-mcp`
- `https://glama.ai/mcp/servers/io.github.vk0dev/code-impact-mcp`
- `https://glama.ai/mcp/servers/vk0dev-code-impact-mcp`
- `https://glama.ai/api/mcp/v1/servers?query=code-impact-mcp`

### awesome-mcp-servers PR thread
- `https://github.com/punkpeye/awesome-mcp-servers/pull/5907`
- `gh pr view 5907 --repo punkpeye/awesome-mcp-servers --json number,title,state,url,body,comments,reviews,reviewDecision,author`
- `gh pr view 5907 --repo punkpeye/awesome-mcp-servers --comments`

## Findings

### 1) Is there a real live Glama product page for code-impact-mcp right now?
Yes. The Glama listing is live again at `https://glama.ai/mcp/servers/vk0dev-code-impact-mcp`.

Evidence:
- Older candidate paths such as `https://glama.ai/mcp/servers/vk0dev/code-impact-mcp` and `https://glama.ai/mcp/servers/io.github.vk0dev/code-impact-mcp` were historical dead ends and should no longer be treated as the canonical target.
- Current accepted repo truth and latest follow-up docs now align on the live canonical listing URL `https://glama.ai/mcp/servers/vk0dev-code-impact-mcp`.
- What remains unresolved is not live-listing existence, but whether Glama exposes a stable badge-ready / canonical badge path suitable for PR proof.

Conclusion:
- Public proof now supports a real live Glama listing for `code-impact-mcp`.
- Public proof still does not establish a stable canonical badge URL to add as a verified badge target yet.

### 2) What exact blocker is preventing PR #5907 from moving?
The current blocker is explicitly stated in the PR thread by the Glama check bot.

Quoted expectation from `https://github.com/punkpeye/awesome-mcp-servers/pull/5907#issuecomment-4381056372`:

> 1. **Ensure your server is listed on Glama.** If it isn't already, submit it at https://glama.ai/mcp/servers and verify that it passes all checks ...
>
> 2. **Update your PR** by adding a Glama score badge after the server description, using this format:
>
> `[![OWNER/REPO MCP server](https://glama.ai/mcp/servers/OWNER/REPO/badges/score.svg)](https://glama.ai/mcp/servers/OWNER/REPO)`

Interpretation:
- The PR is blocked not by README wording or repo metadata drift, but by the still-unresolved Glama badge-ready / canonical badge path.
- The Glama listing is live again, but that alone does not satisfy the current maintainer/operator expectation for PR follow-up.

### 3) Is any repo-side patch actually justified now?
No repo-side patch is justified now.

Evidence:
- The repo already states the truthful status in `README.md:11`: the Glama listing is live again at `https://glama.ai/mcp/servers/vk0dev-code-impact-mcp`, but the badge-ready path is still unresolved, so PR `#5907` cannot yet be finalized with a stable badge URL.
- `server.json:3-18` is coherent and already points at the canonical repo/package identity for current release `1.6.7`.
- No field-level Glama rejection was found in this pass; the remaining gap is proof of a stable badge/canonical badge path, not absence of a live listing.

Conclusion:
- Do **not** open a coder task from this check.
- There is no exact file path that honestly needs patching yet.

### 4) What is the smallest next operator action?
The smallest next operator action is:

1. Re-check whether Glama now exposes a stable canonical badge URL for `vk0dev/code-impact-mcp` at `https://glama.ai/mcp/servers/vk0dev-code-impact-mcp`.
2. If that stable badge path is publicly proven, update the already-existing PR `#5907` rather than opening a duplicate PR.

This is smaller and more truthful than a repo patch, because the current blocker is badge-proof maturity of the external artifact, not absence of the listing itself.

### 5) Verdict enum
`READY_FOR_OPERATOR_ACTION`

Why:
- There is one concrete next step.
- That step belongs to operator/manual marketplace handling, not coder work.
- A repo patch should reopen only after Glama yields one of these artifacts:
  - a real listing URL and badge URL that need to be inserted somewhere specific, or
  - a field-level metadata rejection mapped to one exact repo file.

## Recommendation

Stop looking for repo churn here. The live blocker is now narrower and external: the Glama listing exists, but PR `punkpeye/awesome-mcp-servers#5907` still needs stable badge-ready / canonical badge proof before it can be advanced. The next bounded action is vk-side verification of a stable canonical badge URL for the already-live listing, then a PR comment/update on the already-existing PR rather than any duplicate PR. If that follow-up exposes a named metadata issue or one exact insertion target, only then reopen a coder task with exact file targets.
