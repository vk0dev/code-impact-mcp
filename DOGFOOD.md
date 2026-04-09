# Dogfood Log

Real-world testing of this service with AI agents. Each session documents an actual use case.

**Required before publishing:** At least 3 sessions showing the tools work in real scenarios.

## Session Template

### Session N: [Brief description]
- **Date:** YYYY-MM-DD
- **Agent:** Claude Code / other
- **Task:** What was the agent trying to accomplish?
- **Tools used:** Which tools were called, in what order?
- **Result:** Did it work? Was the output useful?
- **Issues found:** What didn't work or could be better?
- **Improvements made:** What was fixed based on this session?

---

### Session 1: First real MCP-client dogfood on openclaw-tasks
- **Date:** 2026-04-08
- **Agent:** local MCP client session via Claude MCP config entry
- **Task:** Verify that CodeImpact MCP is actually installable in local MCP config and useful from a real client context, not just direct internal harness calls.
- **Tools used:**
  1. `get_dependencies` for `src/routes.ts`
  2. `analyze_impact` for `src/routes/index.ts`
  3. `gate_check` for `src/routes/index.ts` with threshold `0.2`
- **Result:**
  - The installed MCP server appeared correctly in the real client session.
  - `listTools` returned `analyze_impact`, `get_dependencies`, `gate_check`, and `refresh_graph`.
  - `get_dependencies` returned a useful structural view around `src/routes.ts`.
  - `analyze_impact` returned a believable small blast radius for `src/routes/index.ts`.
  - `gate_check` returned a readable bounded recommendation instead of raw graph data.
- **Issues found:**
  - The client path worked, but the first-run path is still slightly technical because it depends on a local `mcp-remote` bridge to the HTTP `/mcp` endpoint.
  - Output is useful already, but explanation depth is still intentionally compact.
- **Improvements made:**
  - No code change was required during this session.
  - The session mainly confirmed that the installed path is real and viable for the next dogfood/publish-prep step.

### Session 2: Real MCP-client dogfood on ai-digest
- **Date:** 2026-04-08
- **Agent:** local MCP client session via the installed Claude MCP config entry
- **Task:** Run the second real dogfood pass on a different TypeScript project and see whether the installed MCP path is still useful on a larger, more content-heavy codebase.
- **Project tested:** `/Users/vkdev/projects/ai-digest`
- **Scenario:** assess the impact of changing `lib/digest.ts`, which sits in the middle of the digest-generation pipeline.
- **Tools used:**
  1. `get_dependencies` for `lib/digest.ts`
  2. `analyze_impact` for `lib/digest.ts`
  3. `gate_check` for `lib/digest.ts` with threshold `0.08`
- **Result:**
  - The installed MCP server again appeared correctly in the real client session.
  - `get_dependencies` showed a meaningful structural picture for `lib/digest.ts`: 7 outgoing imports and 5 incoming dependents, including pipeline scripts and smoke tests.
  - `analyze_impact` returned a believable blast radius: 5 direct and 2 transitive affected files.
  - `gate_check` returned `WARN`, which felt directionally correct for a central pipeline file with a cycle still present in the graph.
- **What proved useful:**
  - The tool surface stayed understandable on a larger real repo, not just on a smaller service.
  - `get_dependencies` was the fastest way to see whether `lib/digest.ts` was truly central.
  - `analyze_impact` and `gate_check` together gave a practical “should I touch this casually?” answer.
- **What felt awkward:**
  - The installed path still depends on the local `mcp-remote` bridge, so setup ergonomics are not yet as simple as a one-command local install.
  - `gate_check` correctly warned, but the cycle note is still terse; it would be nicer if the output pointed to the actual cycle members.
- **Improvements made:**
  - No code change was required during this session.
  - This session mainly increased confidence that the installed MCP path remains useful on a second, larger TS project.

### Session 3: Wide-impact edge case on openclaw-monitor
- **Date:** 2026-04-09
- **Agent:** local MCP client session via the installed Claude MCP config entry
- **Task:** Run the hardest required dogfood slice, a wide-impact central-file scenario, and see whether the installed MCP path remains useful when the blast radius is broad instead of small.
- **Project tested:** `/Users/vkdev/projects/openclaw-monitor`
- **Wide-impact scenario:** treat `src/gateway/hooks.ts` as a rename-equivalent / central-change target because it fans into much of the UI surface.
- **Tools used:**
  1. `get_dependencies` for `src/gateway/hooks.ts`
  2. `analyze_impact` for `src/gateway/hooks.ts`
  3. `gate_check` for `src/gateway/hooks.ts` with threshold `0.12`
- **Result:**
  - The installed MCP server again appeared correctly in the real client session.
  - `get_dependencies` showed a clearly central module: 16 incoming and 2 outgoing dependency edges.
  - `analyze_impact` returned a genuinely broad result: 16 directly affected files and 5 transitive affected files, including `src/App.tsx`, multiple page-level components, analytics surfaces, and `src/main.tsx`.
  - `gate_check` returned `BLOCK`, which felt correct for a broad central-file change with 21 affected files.
- **What proved useful:**
  - The tool surface still held up under the wider-impact case instead of collapsing into noise.
  - `get_dependencies` made it obvious that this file is a risky refactor/rename target before any code was touched.
  - `analyze_impact` gave a concrete list that feels actionable for review planning.
  - `gate_check` finally showed strong value here: the `BLOCK` output matched the human sense that this is not a casual change.
- **What felt awkward:**
  - The output is useful, but once the blast radius gets this broad, a grouped or summarized presentation would be easier to scan than one long flat file list.
  - The installed path still works, but the bridge-based setup remains the main ergonomics tax.
- **Improvements made:**
  - No code change was required during this session.
  - This session materially increased confidence that the installed MCP path remains publish-ready even under the hardest dogfood slice currently planned.
