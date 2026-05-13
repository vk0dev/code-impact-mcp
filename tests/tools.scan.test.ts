import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import { registerTools } from "../src/tools/index.js";

type ToolHandler = (input: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

class FakeServer {
  handlers = new Map<string, ToolHandler>();

  registerTool(name: string, _config: unknown, handler: ToolHandler) {
    this.handlers.set(name, handler);
  }
}

function withTempProject(files: Record<string, string>, run: (root: string) => Promise<void> | void) {
  const root = mkdtempSync(join(tmpdir(), "code-impact-tools-"));
  try {
    for (const [relativePath, content] of Object.entries(files)) {
      const target = join(root, relativePath);
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, content);
    }
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function parseToolResult(result: { content: Array<{ type: string; text: string }> }) {
  expect(result.content).toHaveLength(1);
  expect(result.content[0]?.type).toBe("text");
  return JSON.parse(result.content[0]!.text);
}

const fixturesRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures");

function withFixtureProject(fixtureName: string, run: (root: string) => Promise<void> | void) {
  const root = mkdtempSync(join(tmpdir(), `code-impact-fixture-${fixtureName}-`));
  try {
    cpSync(join(fixturesRoot, fixtureName), root, { recursive: true });
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("registerTools scanability and errors", { timeout: 60_000 }, () => {
  it("returns a bounded error for invalid projectRoot", async () => {
    const server = new FakeServer();
    registerTools(server as any);

    const payload = parseToolResult(
      await server.handlers.get("get_dependencies")!({
        projectRoot: "/definitely/missing/code-impact-project",
        file: "src/a.ts",
      }),
    );

    expect(payload.code).toBe("INVALID_PROJECT_ROOT");
    expect(payload.error).toContain("Project root does not exist");
  });

  it("adds scan-friendly grouping for broad impact results", async () => {
    await withTempProject(
      {
        "src/gateway/hooks.ts": "export const hooks = 1;\n",
        "src/App.tsx": "import { hooks } from './gateway/hooks'; export const app = hooks;\n",
        "src/main.tsx": "import { hooks } from './gateway/hooks'; export const main = hooks;\n",
        "src/pages/Home.tsx": "import { hooks } from '../gateway/hooks'; export const home = hooks;\n",
        "src/pages/Settings.tsx": "import { hooks } from '../gateway/hooks'; export const settings = hooks;\n",
        "src/pages/Logs.tsx": "import { hooks } from '../gateway/hooks'; export const logs = hooks;\n",
        "src/components/Nav.tsx": "import { hooks } from '../gateway/hooks'; export const nav = hooks;\n",
        "src/components/Status.tsx": "import { hooks } from '../gateway/hooks'; export const status = hooks;\n",
        "src/components/Chart.tsx": "import { hooks } from '../gateway/hooks'; export const chart = hooks;\n",
        "src/analytics/events.ts": "import { hooks } from '../gateway/hooks'; export const events = hooks;\n",
        "src/analytics/panel.ts": "import { hooks } from '../gateway/hooks'; export const panel = hooks;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("analyze_impact")!({ projectRoot: root, files: ["src/gateway/hooks.ts"] }),
        );

        expect(payload.totalAffected).toBe(10);
        expect(payload.scanSummary).toContain("10 affected");
        expect(payload.scanSummary).toContain("src/components (3)");
        expect(payload.impactBreakdown.directCount).toBe(10);
        expect(payload.impactBreakdown.directScan.totalFiles).toBe(10);
        expect(payload.impactBreakdown.directScan.displayMode).toBe("grouped");
        expect(payload.impactBreakdown.directScan.topDirectories).toEqual([
          { directory: "src/components", count: 3 },
          { directory: "src/pages", count: 3 },
          { directory: "src", count: 2 },
          { directory: "src/analytics", count: 2 },
        ]);
        expect(payload.impactBreakdown.directScan.directoryGroups[0]).toEqual({
          directory: "src/components",
          count: 3,
          examples: [
            "src/components/Chart.tsx",
            "src/components/Nav.tsx",
            "src/components/Status.tsx",
          ],
          remainingExamples: 0,
        });
        expect(payload.impactBreakdown.directScan.firstFiles).toEqual([
          "src/App.tsx",
          "src/analytics/events.ts",
          "src/analytics/panel.ts",
          "src/components/Chart.tsx",
          "src/components/Nav.tsx",
          "src/components/Status.tsx",
          "src/main.tsx",
          "src/pages/Home.tsx",
        ]);
        expect(payload.impactBreakdown.directScan.summaryLine).toContain("src/components (3)");
        expect(payload.impactBreakdown.directScan.remainingFiles).toBe(2);
      },
    );
  });



});
