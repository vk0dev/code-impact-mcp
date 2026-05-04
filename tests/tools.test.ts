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

describe("registerTools", () => {
  it("exposes get_dependencies on top of the graph foundation", async () => {
    await withTempProject(
      {
        "src/a.ts": "export const a = 1;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const handler = server.handlers.get("get_dependencies");
        expect(handler).toBeDefined();

        const payload = parseToolResult(await handler!({ projectRoot: root, file: "src/a.ts" }));
        expect(payload).toMatchObject({
          file: "src/a.ts",
          imports: [],
          importedBy: ["src/b.ts"],
          fanIn: 1,
          fanOut: 0,
          isHighCoupling: false,
          couplingRole: "leaf",
        });
        expect(payload.summary).toContain("leaf");
        expect(payload.summary).toContain("1 incoming");
        expect(payload.explanation).toContain("structural dependency view");
      },
    );
  });

  it("returns a clear error for get_dependencies when file is missing", async () => {
    await withTempProject({ "src/a.ts": "export const a = 1;\n" }, async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(await server.handlers.get("get_dependencies")!({ projectRoot: root, file: "src/missing.ts" }));
      expect(payload.error).toContain("src/missing.ts");
    });
  });

  it("exposes analyze_impact with affected files and basic risk signal", async () => {
    await withTempProject(
      {
        "src/core.ts": "export const core = 1;\n",
        "src/service.ts": "import { core } from './core'; export const service = core;\n",
        "src/feature.ts": "import { service } from './service'; export const feature = service;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("analyze_impact")!({ projectRoot: root, files: ["src/core.ts"] }),
        );

        expect(payload.changedFiles).toEqual(["src/core.ts"]);
        expect(payload.directlyAffected).toEqual(["src/service.ts"]);
        expect(payload.transitivelyAffected).toEqual(["src/feature.ts"]);
        expect(payload.totalAffected).toBe(2);
        expect(payload.riskScore).toBeGreaterThan(0);
        expect(typeof payload.summary).toBe("string");
        expect(payload.scanSummary).toContain("affected");
        expect(payload.explanation).toContain("graph-based only");
        expect(payload.impactBreakdown.directCount).toBe(1);
        expect(payload.impactBreakdown.transitiveCount).toBe(1);
        expect(payload.impactBreakdown.directScan.firstFiles).toEqual(["src/service.ts"]);
      },
    );
  });

  it("exposes gate_check with a PASS verdict for low-risk changes", async () => {
    await withTempProject(
      {
        "src/core.ts": "export const core = 1;\n",
        "src/leaf.ts": "import { core } from './core'; export const leaf = core;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("gate_check")!({ projectRoot: root, files: ["src/leaf.ts"] }),
        );

        expect(payload.verdict).toBe("PASS");
        expect(payload.recommendation).toContain("Safe to proceed");
        expect(payload.explanation).toContain("not a runtime or test guarantee");
        expect(payload.affectedFiles).toBe(0);
      },
    );
  });

  it("exposes gate_check with a BLOCK verdict for high-impact changes", async () => {
    await withTempProject(
      {
        "src/core.ts": "export const core = 1;\n",
        "src/service.ts": "import { core } from './core'; export const service = core;\n",
        "src/feature.ts": "import { service } from './service'; export const feature = service;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("gate_check")!({
            projectRoot: root,
            files: ["src/core.ts"],
            threshold: 0.5,
          }),
        );

        expect(payload.verdict).toBe("BLOCK");
        expect(payload.recommendation).toContain("Hold the change");
        expect(payload.explanation).toContain("reaches too far");
        expect(payload.scanSummary).toContain("BLOCK");
        expect(payload.scanSummary).toContain("2 affected");
        expect(payload.directlyAffected).toEqual(["src/service.ts"]);
        expect(payload.transitivelyAffected).toEqual(["src/feature.ts"]);
        expect(payload.affectedFiles).toBe(2);
        expect(payload.impactBreakdown.directScan.topDirectories).toEqual([{ directory: "src", count: 1 }]);
        expect(payload.impactBreakdown.directScan.displayMode).toBe("flat");
        expect(payload.impactBreakdown.directScan.totalFiles).toBe(1);
      },
    );
  });

  it("warns in gate_check when cycles exist elsewhere in the graph", async () => {
    await withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
        "src/c.ts": "export const c = 1;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("gate_check")!({
            projectRoot: root,
            files: ["src/c.ts"],
            threshold: 0.9,
          }),
        );

        expect(payload.verdict).toBe("WARN");
        expect(payload.explanation).toContain("review is warranted");
        expect(payload.circularDependencies).toBe(1);
        expect(payload.cycleExamples).toEqual([["src/a.ts", "src/b.ts"]]);
        expect(payload.affectedCycles).toEqual([]);
        expect(payload.scanSummary).toContain("1 cycle");
      },
    );
  });

  it("blocks in gate_check when a changed file participates in a cycle", async () => {
    await withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("gate_check")!({
            projectRoot: root,
            files: ["src/a.ts"],
            threshold: 0.9,
          }),
        );

        expect(payload.verdict).toBe("BLOCK");
        expect(payload.circularDependencies).toBe(1);
        expect(payload.cycleExamples).toEqual([["src/a.ts", "src/b.ts"]]);
        expect(payload.affectedCycles).toEqual([["src/a.ts", "src/b.ts"]]);
        expect(payload.reasons.some((reason: string) => reason.includes("Changed files participate in a circular dependency"))).toBe(true);
      },
    );
  });

  it("exposes detect_cycles with compact SCC output", async () => {
    await withTempProject(
      {
        "src/a.ts": "import { b } from './b'; export const a = b;\n",
        "src/b.ts": "import { a } from './a'; export const b = a;\n",
        "src/c.ts": "export const c = 1;\n",
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("detect_cycles")!({ projectRoot: root }),
        );

        expect(payload.cycleCount).toBe(1);
        expect(payload.cycles).toEqual([["src/a.ts", "src/b.ts"]]);
        expect(payload.hotspots).toEqual(["src/a.ts", "src/b.ts"]);
      },
    );
  });

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

  it("aggregates per-workspace gate results for pnpm workspaces", async () => {
    await withFixtureProject("monorepo-pnpm", async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(
        await server.handlers.get("gate_check")!({
          projectRoot: root,
          files: ["packages/app-a/src/a.ts", "packages/app-b/src/index.ts"],
          threshold: 0.9,
        }),
      );

      expect(payload.verdict).toBe("BLOCK");
      expect(payload.workspaces).toHaveLength(2);
      expect(payload.workspaces.map((workspace: any) => [workspace.workspace, workspace.verdict])).toEqual([
        ["packages/app-a", "BLOCK"],
        ["packages/app-b", "PASS"],
      ]);
      expect(payload.reasons).toContain(
        "[packages/app-a] Changed files participate in a circular dependency. Example: src/a.ts → src/b.ts.",
      );
    });
  });

  it("aggregates per-workspace gate results for npm workspaces", async () => {
    await withFixtureProject("monorepo-npm", async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(
        await server.handlers.get("gate_check")!({
          projectRoot: root,
          files: ["apps/web/src/core.ts", "apps/docs/src/index.ts"],
          threshold: 0.5,
        }),
      );

      expect(payload.verdict).toBe("BLOCK");
      expect(payload.workspaces.map((workspace: any) => [workspace.workspace, workspace.verdict])).toEqual([
        ["apps/docs", "PASS"],
        ["apps/web", "BLOCK"],
      ]);
      expect(payload.directlyAffected).toEqual(["apps/web/src/service.ts"]);
      expect(payload.transitivelyAffected).toEqual(["apps/web/src/feature.ts"]);
      expect(payload.affectedFiles).toBe(2);
    });
  });

  it("uses the worst workspace verdict for mixed monorepos with cycle cases", async () => {
    await withFixtureProject("monorepo-mixed-cycle", async (root) => {
      const server = new FakeServer();
      registerTools(server as any);

      const payload = parseToolResult(
        await server.handlers.get("gate_check")!({
          projectRoot: root,
          files: [
            "packages/cycle-app/src/a.ts",
            "packages/warn-app/src/index.ts",
            "packages/pass-app/src/index.ts",
          ],
          threshold: 0.9,
        }),
      );

      expect(payload.verdict).toBe("BLOCK");
      expect(payload.workspaces.map((workspace: any) => [workspace.workspace, workspace.verdict])).toEqual([
        ["packages/cycle-app", "BLOCK"],
        ["packages/pass-app", "PASS"],
        ["packages/warn-app", "WARN"],
      ]);
      expect(payload.circularDependencies).toBe(2);
      expect(payload.reasons).toContain(
        "[packages/cycle-app] Changed files participate in a circular dependency. Example: src/a.ts → src/b.ts.",
      );
      expect(payload.reasons).toContain(
        "[packages/warn-app] The graph contains 1 circular dependency cycle(s). Example: src/a.ts → src/b.ts.",
      );
    });
  }, 15_000);

  it("returns a bounded error for broken tsconfig", async () => {
    await withTempProject(
      {
        "src/a.ts": "export const a = 1;\n",
        "tsconfig.bad.json": '{"compilerOptions": { "target": "ES2022", ',
      },
      async (root) => {
        const server = new FakeServer();
        registerTools(server as any);

        const payload = parseToolResult(
          await server.handlers.get("analyze_impact")!({
            projectRoot: root,
            files: ["src/a.ts"],
            tsconfigPath: "tsconfig.bad.json",
          }),
        );

        expect(payload.code).toBe("INVALID_TSCONFIG");
        expect(payload.error).toContain("Failed to load tsconfig");
        expect(payload.tsconfigPath).toBe("tsconfig.bad.json");
      },
    );
  });
});

describe("analyze_impact Python adapter", () => {
  it("routes Python changed files through the Python graph path", async () => {
    const root = mkdtempSync(join(tmpdir(), "impact-python-tool-"));
    mkdirSync(join(root, "pkg", "sub"), { recursive: true });
    writeFileSync(join(root, "pkg", "__init__.py"), "");
    writeFileSync(join(root, "pkg", "util.py"), ["def helper():", "    return 1", ""].join(String.raw`\n`));
    writeFileSync(join(root, "pkg", "sub", "__init__.py"), "");
    writeFileSync(join(root, "pkg", "sub", "worker.py"), ["from ..util import helper", ""].join(String.raw`\n`));

    try {
      const server = new FakeServer();
      registerTools(server as any);
      const payload = parseToolResult(
        await server.handlers.get("analyze_impact")!({
          projectRoot: root,
          files: ["pkg/util.py"],
        }),
      );
      expect(payload.directlyAffected).toContain("pkg/sub/worker.py");
      expect(payload.transitivelyAffected).toEqual([]);
      expect(payload.changedFiles).toEqual(["pkg/util.py"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
