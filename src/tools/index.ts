import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphBuildError, buildGraph, analyzeImpact, detectCycles, detectWorkspacePackages, summarizeCycles, type DependencyGraph } from "../graph.js";

let cachedGraph: DependencyGraph | null = null;
let cachedRoot: string | null = null;
let cachedTsconfigPath: string | undefined;

function getGraph(projectRoot: string, force = false, tsconfigPath?: string): DependencyGraph {
  if (!force && cachedGraph && cachedRoot === projectRoot && cachedTsconfigPath === tsconfigPath) {
    return cachedGraph;
  }
  cachedGraph = buildGraph(projectRoot, tsconfigPath);
  cachedRoot = projectRoot;
  cachedTsconfigPath = tsconfigPath;
  return cachedGraph;
}

function verdictRank(verdict: "PASS" | "WARN" | "BLOCK"): number {
  return verdict === "BLOCK" ? 2 : verdict === "WARN" ? 1 : 0;
}

function evaluateGate(graph: DependencyGraph, files: string[], threshold: number) {
  const impact = analyzeImpact(graph, files);
  const cycles = detectCycles(graph);
  let verdict: "PASS" | "WARN" | "BLOCK" = "PASS";
  const reasons: string[] = [];
  const totalAffected = impact.directlyAffected.length + impact.transitivelyAffected.length;

  if (impact.riskScore >= threshold) {
    verdict = "BLOCK";
    reasons.push(`Risk score ${impact.riskScore.toFixed(2)} exceeds threshold ${threshold.toFixed(2)}.`);
  } else if (impact.riskScore >= threshold * 0.6) {
    verdict = "WARN";
    reasons.push(`Risk score ${impact.riskScore.toFixed(2)} is approaching threshold.`);
  }

  const affectedCycles = cycles.filter((cycle) => files.some((f) => cycle.includes(f)));
  const cycleExamples = cycles.slice(0, 3);
  const cycleDiagnostics = cycles.length > 0 ? summarizeCycles(cycles) : undefined;
  if (affectedCycles.length > 0) {
    verdict = "BLOCK";
    reasons.push(`Changed files participate in a circular dependency. Example: ${formatCyclePreview(affectedCycles[0]!)}.`);
  } else if (cycles.length > 0) {
    if (verdictRank(verdict) < verdictRank("WARN")) verdict = "WARN";
    reasons.push(`The graph contains ${cycles.length} circular dependency cycle(s). Example: ${formatCyclePreview(cycleExamples[0]!)}.`);
  }

  if (reasons.length === 0) {
    reasons.push(`Changes affect ${impact.directlyAffected.length} direct dependents. Risk is low.`);
  }

  return {
    verdict,
    threshold,
    reasons,
    impact,
    cycles,
    affectedCycles,
    cycleExamples,
    cycleDiagnostics,
    totalAffected,
  };
}

function buildErrorPayload(error: unknown, projectRoot: string, tsconfigPath?: string) {
  if (error instanceof GraphBuildError) {
    return {
      error: error.message,
      code: error.code,
      projectRoot,
      ...(tsconfigPath ? { tsconfigPath } : {}),
    };
  }

  return {
    error: error instanceof Error ? error.message : String(error),
    code: "GRAPH_BUILD_FAILED",
    projectRoot,
    ...(tsconfigPath ? { tsconfigPath } : {}),
  };
}

function groupPathsByDirectory(files: string[]) {
  const counts = new Map<string, number>();

  for (const file of files) {
    const dir = path.posix.dirname(file);
    const key = dir === "." ? "(root)" : dir;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([directory, count]) => ({ directory, count }));
}

function buildImpactScanability(files: string[]) {
  const sorted = [...files].sort();
  const topDirectories = groupPathsByDirectory(sorted).slice(0, 5);
  const directoryGroups = topDirectories.map(({ directory, count }) => {
    const inDirectory = sorted.filter((file) => path.posix.dirname(file) === directory);
    const examples = inDirectory.slice(0, 3);
    return {
      directory,
      count,
      examples,
      remainingExamples: Math.max(0, inDirectory.length - examples.length),
    };
  });

  return {
    totalFiles: sorted.length,
    topDirectories,
    directoryGroups,
    firstFiles: sorted.slice(0, 8),
    remainingFiles: Math.max(0, sorted.length - 8),
    summaryLine: topDirectories
      .map(({ directory, count }) => `${directory} (${count})`)
      .join(", "),
    displayMode: sorted.length >= 8 || topDirectories.length >= 3 ? "grouped" : "flat",
  };
}

function buildDecisionSummary(verdictLabel: string, totalAffected: number, scan: ReturnType<typeof buildImpactScanability>) {
  const impactLabel = totalAffected === 0 ? "locally contained" : `${totalAffected} affected`;
  const scopeLabel = scan.summaryLine ? ` across ${scan.summaryLine}` : "";
  return `${verdictLabel}, ${impactLabel}${scopeLabel}`;
}

function buildRecommendation(verdict: "PASS" | "WARN" | "BLOCK") {
  return verdict === "BLOCK"
    ? "Hold the change until impact is reduced or explicitly reviewed."
    : verdict === "WARN"
      ? "Proceed only with targeted review of affected files."
      : "Safe to proceed based on current graph impact.";
}

function buildExplanation(verdict: "PASS" | "WARN" | "BLOCK", totalAffected: number, cycleCount: number) {
  if (verdict === "BLOCK") {
    return cycleCount > 0
      ? "The change is blocked because impact is high or a changed file is part of a circular dependency."
      : "The current graph shape suggests the change reaches too far for the chosen threshold.";
  }
  if (verdict === "WARN") {
    return cycleCount > 0
      ? "The graph contains circular dependencies, so human review is warranted even if changed files are outside the affected cycle."
      : "The change is not automatically blocked, but the graph suggests meaningful review is warranted.";
  }
  return "The current graph suggests a relatively contained change, though this is not a runtime or test guarantee.";
}

function formatCyclePreview(cycle: string[]) {
  return cycle.join(" → ");
}

function classifyCouplingRole(fanIn: number, fanOut: number, isHighCoupling: boolean) {
  if (isHighCoupling || fanIn >= 5) {
    return "central module";
  }
  if (fanIn > 0 && fanOut > 0) {
    return "bridge module";
  }
  if (fanIn > 0 && fanOut === 0) {
    return "leaf";
  }
  if (fanIn === 0 && fanOut > 0) {
    return "source module";
  }
  return "isolated module";
}

async function runTool<T>(projectRoot: string, tsconfigPath: string | undefined, fn: () => T | Promise<T>) {
  try {
    const payload = await fn();
    return {
      content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify(buildErrorPayload(error, projectRoot, tsconfigPath), null, 2) }],
    };
  }
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    "analyze_impact",
    {
      description:
        "Analyze the blast radius of changing specific files. Returns which files would be " +
        "directly and transitively affected, with a risk score (0-1). Use BEFORE committing " +
        "multi-file changes to understand what might break. Does NOT modify any files.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the project root directory"),
        files: z.array(z.string()).min(1).describe("Relative file paths that are being changed (e.g. ['src/utils/helpers.ts'])"),
        tsconfigPath: z.string().optional().describe("Optional tsconfig path relative to projectRoot"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectRoot, files, tsconfigPath }) =>
      runTool(projectRoot, tsconfigPath, () => {
        const graph = getGraph(projectRoot, false, tsconfigPath);
        const impact = analyzeImpact(graph, files);

        const totalAffected = impact.directlyAffected.length + impact.transitivelyAffected.length;
        const directScan = buildImpactScanability(impact.directlyAffected);
        const transitiveScan = buildImpactScanability(impact.transitivelyAffected);
        const summary =
          impact.riskScore >= 0.7
            ? `High graph impact: ${impact.directlyAffected.length} direct and ${impact.transitivelyAffected.length} transitive files may move.`
            : impact.riskScore >= 0.3
              ? `Medium graph impact: review the ${totalAffected} affected files before changing this area.`
              : `Low graph impact: the current change looks locally contained in graph terms.`;

        return {
          summary,
          scanSummary: buildDecisionSummary(impact.riskScore >= 0.7 ? "HIGH" : impact.riskScore >= 0.3 ? "MEDIUM" : "LOW", totalAffected, directScan),
          explanation:
            "This result is graph-based only. It does not account for tests, runtime behavior, migrations, or production traffic.",
          changedFiles: files,
          directlyAffected: impact.directlyAffected,
          transitivelyAffected: impact.transitivelyAffected,
          impactBreakdown: {
            directCount: impact.directlyAffected.length,
            transitiveCount: impact.transitivelyAffected.length,
            directScan,
            transitiveScan,
          },
          riskScore: impact.riskScore,
          totalAffected,
          cascadeDepth: impact.cascadeChain.reduce((max, c) => Math.max(max, c.length), 0),
        };
      }),
  );

  server.registerTool(
    "get_dependencies",
    {
      description:
        "Get the import and importedBy relationships for a specific file. Shows what this file " +
        "depends on and what depends on it. Use to understand coupling before refactoring a file.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the project root directory"),
        file: z.string().describe("Relative file path (e.g. 'src/server.ts')"),
        tsconfigPath: z.string().optional().describe("Optional tsconfig path relative to projectRoot"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectRoot, file, tsconfigPath }) =>
      runTool(projectRoot, tsconfigPath, () => {
        const graph = getGraph(projectRoot, false, tsconfigPath);
        const node = graph.nodes.get(file);

        if (!node) {
          return { error: `File '${file}' not found in dependency graph. Run refresh_graph first or check the path.` };
        }

        const fanIn = node.importedBy.length;
        const fanOut = node.imports.length;
        const isHighCoupling = fanIn > 10;
        const couplingRole = classifyCouplingRole(fanIn, fanOut, isHighCoupling);
        const edgeLabel = fanIn === 1 && fanOut === 0 ? "edge" : "edges";

        return {
          file: node.file,
          summary: `${node.file} is a ${couplingRole} with ${fanIn} incoming and ${fanOut} outgoing dependency ${edgeLabel}.`,
          explanation:
            "This is a structural dependency view. It does not distinguish runtime-only vs type-only usage yet.",
          imports: node.imports,
          importedBy: node.importedBy,
          exports: node.exports,
          fanIn,
          fanOut,
          isHighCoupling,
          couplingRole,
        };
      }),
  );

  server.registerTool(
    "detect_cycles",
    {
      description:
        "Return strongly connected components with more than one file from the current dependency graph. " +
        "Use it to inspect circular dependencies before refactors or release gates.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the project root directory"),
        tsconfigPath: z.string().optional().describe("Optional tsconfig path relative to projectRoot"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectRoot, tsconfigPath }) =>
      runTool(projectRoot, tsconfigPath, () => {
        const graph = getGraph(projectRoot, false, tsconfigPath);
        const cycles = detectCycles(graph);
        const summary = summarizeCycles(cycles);
        return {
          cycleCount: summary.count,
          hotspots: summary.hotspots,
          cycles,
        };
      }),
  );

  server.registerTool(
    "gate_check",
    {
      description:
        "Pre-commit safety gate. Analyzes specified changes and returns a PASS/WARN/BLOCK " +
        "verdict with reasons. Use as a bounded decision aid before committing multi-file changes. " +
        "BLOCK means current impact is too risky. WARN means human review recommended. PASS means low-risk.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the project root directory"),
        files: z.array(z.string()).min(1).describe("Relative file paths being changed"),
        threshold: z.number().min(0).max(1).default(0.5).describe("Risk threshold for BLOCK verdict (0-1, default 0.5)"),
        tsconfigPath: z.string().optional().describe("Optional tsconfig path relative to projectRoot"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectRoot, files, threshold, tsconfigPath }) =>
      runTool(projectRoot, tsconfigPath, () => {
        const workspaces = detectWorkspacePackages(projectRoot);
        if (workspaces.length === 0) {
          const result = evaluateGate(getGraph(projectRoot, false, tsconfigPath), files, threshold);
          const directScan = buildImpactScanability(result.impact.directlyAffected);
          const transitiveScan = buildImpactScanability(result.impact.transitivelyAffected);
          const scanSummary = [
            buildDecisionSummary(result.verdict, result.totalAffected, directScan),
            result.cycleDiagnostics ? `${result.cycleDiagnostics.count} cycle${result.cycleDiagnostics.count === 1 ? "" : "s"}` : null,
          ].filter(Boolean).join(", ");

          return {
            verdict: result.verdict,
            scanSummary,
            recommendation: buildRecommendation(result.verdict),
            explanation: buildExplanation(result.verdict, result.totalAffected, result.cycles.length),
            riskScore: result.impact.riskScore,
            threshold,
            reasons: result.reasons,
            changedFiles: files,
            directlyAffected: result.impact.directlyAffected,
            transitivelyAffected: result.impact.transitivelyAffected,
            impactBreakdown: {
              directCount: result.impact.directlyAffected.length,
              transitiveCount: result.impact.transitivelyAffected.length,
              directScan,
              transitiveScan,
            },
            affectedFiles: result.totalAffected,
            circularDependencies: result.cycles.length,
            cycleExamples: result.cycleExamples.length > 0 ? result.cycleExamples : undefined,
            cycleDiagnostics: result.cycleDiagnostics,
            cycles: result.cycles.length > 0 ? result.cycles : undefined,
            affectedCycles: result.affectedCycles,
          };
        }

        const workspaceResults = workspaces.map((workspace) => {
          const workspaceFiles = files
            .filter((file) => file === workspace.relativeRoot || file.startsWith(`${workspace.relativeRoot}/`))
            .map((file) => file.slice(workspace.relativeRoot.length).replace(/^\//, ""));
          if (workspaceFiles.length === 0) {
            return {
              workspace: workspace.relativeRoot,
              verdict: "PASS" as const,
              reasons: ["No changed files in this workspace."],
              changedFiles: [] as string[],
              directlyAffected: [] as string[],
              transitivelyAffected: [] as string[],
              affectedFiles: 0,
              circularDependencies: 0,
              riskScore: 0,
            };
          }

          const result = evaluateGate(buildGraph(workspace.root), workspaceFiles, threshold);
          return {
            workspace: workspace.relativeRoot,
            verdict: result.verdict,
            reasons: result.reasons,
            changedFiles: workspaceFiles,
            directlyAffected: result.impact.directlyAffected,
            transitivelyAffected: result.impact.transitivelyAffected,
            affectedFiles: result.totalAffected,
            circularDependencies: result.cycles.length,
            riskScore: result.impact.riskScore,
            cycleExamples: result.cycleExamples.length > 0 ? result.cycleExamples : undefined,
            affectedCycles: result.affectedCycles,
          };
        });

        const verdict = workspaceResults.reduce<"PASS" | "WARN" | "BLOCK">(
          (worst, current) => (verdictRank(current.verdict) > verdictRank(worst) ? current.verdict : worst),
          "PASS",
        );
        const reasons = workspaceResults
          .filter((workspace) => workspace.verdict !== "PASS")
          .flatMap((workspace) => workspace.reasons.map((reason) => `[${workspace.workspace}] ${reason}`));
        const affectedFiles = workspaceResults.reduce((sum, workspace) => sum + workspace.affectedFiles, 0);
        const circularDependencies = workspaceResults.reduce((sum, workspace) => sum + workspace.circularDependencies, 0);
        const riskScore = Math.max(...workspaceResults.map((workspace) => workspace.riskScore), 0);

        const directScan = buildImpactScanability(
          workspaceResults.flatMap((workspace) => workspace.directlyAffected.map((file) => `${workspace.workspace}/${file}`)),
        );

        return {
          verdict,
          scanSummary: buildDecisionSummary(verdict, affectedFiles, directScan),
          recommendation: buildRecommendation(verdict),
          explanation: buildExplanation(verdict, affectedFiles, circularDependencies),
          riskScore,
          threshold,
          reasons: reasons.length > 0 ? reasons : ["No changed files in any workspace exceeded the gate."],
          changedFiles: files,
          directlyAffected: workspaceResults.flatMap((workspace) => workspace.directlyAffected.map((file) => `${workspace.workspace}/${file}`)),
          transitivelyAffected: workspaceResults.flatMap((workspace) => workspace.transitivelyAffected.map((file) => `${workspace.workspace}/${file}`)),
          impactBreakdown: {
            directCount: workspaceResults.reduce((sum, workspace) => sum + workspace.directlyAffected.length, 0),
            transitiveCount: workspaceResults.reduce((sum, workspace) => sum + workspace.transitivelyAffected.length, 0),
            directScan: workspaceResults.length,
            transitiveScan: affectedFiles,
          },
          affectedFiles,
          circularDependencies,
          workspaces: workspaceResults,
        };
      }),
  );

  server.registerTool(
    "refresh_graph",
    {
      description:
        "Rebuild the dependency graph from scratch. Call this after significant file additions/deletions, " +
        "or if analyze_impact results seem stale. Returns graph statistics including file count, " +
        "edge count, build time, and any circular dependencies detected.",
      inputSchema: {
        projectRoot: z.string().describe("Absolute path to the project root directory"),
        tsconfigPath: z.string().optional().describe("Optional tsconfig path relative to projectRoot"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ projectRoot, tsconfigPath }) =>
      runTool(projectRoot, tsconfigPath, () => {
        const graph = getGraph(projectRoot, true, tsconfigPath);
        const cycles = detectCycles(graph);

        return {
          status: "Graph rebuilt successfully",
          files: graph.fileCount,
          edges: graph.edgeCount,
          buildTimeMs: graph.buildTimeMs,
          circularDependencies: cycles.length,
          cycles: cycles.length > 0 ? cycles.slice(0, 5) : undefined,
        };
      }),
  );
}
