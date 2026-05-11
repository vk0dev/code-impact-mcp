import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const README_PATH = path.join(process.cwd(), 'README.md');

function readme() {
  return readFileSync(README_PATH, 'utf8');
}

describe('README comparison table contract', () => {
  it('keeps the current truthful comparison set and decision-first wedge in the root README', () => {
    const text = readme();

    expect(text).toContain('| **CodeImpact MCP** | Decision-first dependency gating for proposed TS/JS changes, including monorepos |');
    expect(text).toContain('Immediate PASS/WARN/BLOCK output');
    expect(text).toContain('built-in `detect_cycles`');
    expect(text).toContain('direct Husky install-hook helper');
    expect(text).toContain('Best fit when the job is "is this safe to commit?" rather than "help me explore the whole repo"');

    expect(text).toContain('| **code-graph-mcp** | Hosted or prebuilt code-graph inspection through an MCP surface |');
    expect(text).toContain('| **Depwire** | Broader dependency intelligence and architecture workflows across a wider language/tooling surface |');
    expect(text).toContain('| **RepoGraph** | Repository-level graph retrieval for SWE-style context gathering |');
    expect(text).toContain('| **CodeGraphContext** | Broader local code graph and context platform with dual CLI + MCP entrypoints |');
    expect(text).toContain('| **MCP Hive style marketplace follow-up** | Manual marketplace/discovery submission after the repo truth is already stable |');

    expect(text).toContain('Better when you want a fast local PASS/WARN/BLOCK gate for known file changes, not a broader graph/context platform');
    expect(text).toContain('Choose CodeImpact MCP when:');
    expect(text).toContain('Choose one of the alternatives when:');

    expect(text).not.toContain('broad orchestration platform');
    expect(text).not.toContain('hosted control plane');
    expect(text).not.toContain('general-purpose repo understanding platform from CodeImpact MCP');
  });
});
