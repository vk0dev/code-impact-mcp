/**
 * Dependency graph foundation for CodeImpact MCP.
 * Extracts TS/JS module relationships with ts-morph and exposes a minimal
 * in-memory graph model for later MCP tools.
 */

import { Project, SyntaxKind, type SourceFile } from "ts-morph";
import { dirname, extname, isAbsolute, join, normalize, relative, resolve } from "node:path";
import { existsSync, statSync } from "node:fs";

export class GraphBuildError extends Error {
  constructor(message: string, readonly code: "INVALID_PROJECT_ROOT" | "INVALID_TSCONFIG") {
    super(message);
    this.name = "GraphBuildError";
  }
}

export interface GraphNode {
  path: string;
  file: string;
  imports: string[];
  importedBy: string[];
  exports: string[];
}

export type GraphEdgeKind = "esm-import" | "esm-reexport" | "cjs-require";

export interface GraphEdge {
  from: string;
  to: string;
  kind: GraphEdgeKind;
  specifier: string;
}

export interface DependencyGraph {
  nodes: Map<string, GraphNode>;
  reverseDeps: Map<string, Set<string>>;
  edges: GraphEdge[];
  fileCount: number;
  edgeCount: number;
  buildTimeMs: number;
}

export interface ImpactAnalysis {
  changedFile?: string;
  changedFiles: string[];
  directDependents: string[];
  allDependents: string[];
  directDependencies: string[];
  blastRadius: number;
  directlyAffected: string[];
  transitivelyAffected: string[];
  cascadeChain: string[][];
  riskScore: number;
}

const SOURCE_DIRS = ["src", "app", "components", "lib", "hooks", "stores", "utils", "pages", "tests", "scripts"];
const SOURCE_GLOBS = [
  ...SOURCE_DIRS.flatMap((dir) => [`${dir}/**/*.ts`, `${dir}/**/*.tsx`, `${dir}/**/*.js`, `${dir}/**/*.jsx`]),
  "*.ts",
  "*.tsx",
  "*.js",
  "*.jsx",
];

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"];
const INDEX_CANDIDATES = RESOLVE_EXTENSIONS.map((ext) => `/index${ext}`);
const SOURCE_EXTENSION_ALIASES: Record<string, string[]> = {
  ".js": [".ts", ".tsx", ".mts", ".cts"],
  ".jsx": [".tsx", ".ts", ".mts", ".cts"],
  ".mjs": [".mts", ".ts"],
  ".cjs": [".cts", ".ts"],
};

export function buildGraph(projectRoot: string, tsconfigPath?: string): DependencyGraph {
  const startedAt = Date.now();
  const root = resolve(projectRoot);

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new GraphBuildError(`Project root does not exist or is not a directory: ${projectRoot}`, "INVALID_PROJECT_ROOT");
  }

  const resolvedTsconfig = tsconfigPath ? resolve(projectRoot, tsconfigPath) : undefined;
  if (resolvedTsconfig && !existsSync(resolvedTsconfig)) {
    throw new GraphBuildError(`tsconfig file does not exist: ${tsconfigPath}`, "INVALID_TSCONFIG");
  }

  let project: Project;
  try {
    project = new Project({
      tsConfigFilePath: resolvedTsconfig,
      skipAddingFilesFromTsConfig: !tsconfigPath,
      skipFileDependencyResolution: false,
    });
  } catch (error) {
    if (resolvedTsconfig) {
      const message = error instanceof Error ? error.message : String(error);
      throw new GraphBuildError(`Failed to load tsconfig ${tsconfigPath}: ${message}`, "INVALID_TSCONFIG");
    }
    throw error;
  }

  if (!tsconfigPath) {
    for (const pattern of SOURCE_GLOBS) {
      project.addSourceFilesAtPaths(join(root, pattern));
    }
  }

  const nodes = new Map<string, GraphNode>();
  const reverseDeps = new Map<string, Set<string>>();
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const sourceFile of project.getSourceFiles()) {
    if (sourceFile.isDeclarationFile()) {
      continue;
    }

    const filePath = normalizePath(relative(root, sourceFile.getFilePath()));
    const imports = new Set<string>();
    const exports = extractExports(sourceFile);
    nodes.set(filePath, { path: filePath, file: filePath, imports: [], importedBy: [], exports });

    for (const entry of collectModuleReferences(sourceFile)) {
      const resolved = resolveImport(root, sourceFile.getFilePath(), entry.specifier);
      if (!resolved) {
        continue;
      }

      imports.add(resolved);
      if (!reverseDeps.has(resolved)) {
        reverseDeps.set(resolved, new Set());
      }
      reverseDeps.get(resolved)!.add(filePath);

      const edgeKey = `${filePath}|${resolved}|${entry.kind}|${entry.specifier}`;
      if (!seenEdges.has(edgeKey)) {
        seenEdges.add(edgeKey);
        edges.push({ from: filePath, to: resolved, kind: entry.kind, specifier: entry.specifier });
      }
    }

    nodes.set(filePath, { path: filePath, file: filePath, imports: [...imports].sort(), importedBy: [], exports });
  }

  for (const [file, node] of nodes) {
    node.importedBy = [...(reverseDeps.get(file) || new Set())].sort();
    nodes.set(file, node);
  }

  return {
    nodes,
    reverseDeps,
    edges,
    fileCount: nodes.size,
    edgeCount: edges.length,
    buildTimeMs: Date.now() - startedAt,
  };
}

export function analyzeImpact(graph: DependencyGraph, changed: string | string[]): ImpactAnalysis {
  const changedFiles = Array.isArray(changed) ? changed.map(normalizePath) : [normalizePath(changed)];
  const changedFilesSet = new Set(changedFiles);
  const directDependentsSet = new Set<string>();
  const directDependenciesSet = new Set<string>();
  const allDependents = new Set<string>();
  const cascadeChain: string[][] = [];

  for (const changedFile of changedFiles) {
    for (const dep of graph.nodes.get(changedFile)?.imports || []) {
      directDependenciesSet.add(dep);
    }

    const queue = [...(graph.reverseDeps.get(changedFile) || new Set())].sort().map((file) => ({ file, chain: [changedFile, file] }));
    for (const entry of queue) {
      directDependentsSet.add(entry.file);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (changedFilesSet.has(current.file) || allDependents.has(current.file)) {
        continue;
      }
      allDependents.add(current.file);
      cascadeChain.push(current.chain);
      for (const next of graph.reverseDeps.get(current.file) || []) {
        if (!changedFilesSet.has(next) && !allDependents.has(next)) {
          queue.push({ file: next, chain: [...current.chain, next] });
        }
      }
    }
  }

  const directDependents = [...directDependentsSet].sort();
  const allDependentsSorted = [...allDependents].sort();
  const directlyAffected = directDependents;
  const transitivelyAffected = allDependentsSorted.filter((file) => !directDependentsSet.has(file));
  const totalAffected = allDependentsSorted.length;
  const riskScore = graph.fileCount === 0 ? 0 : Number(Math.min(1, totalAffected / graph.fileCount).toFixed(2));

  return {
    changedFile: changedFiles.length === 1 ? changedFiles[0] : undefined,
    changedFiles,
    directDependents,
    allDependents: allDependentsSorted,
    directDependencies: [...directDependenciesSet].sort(),
    blastRadius: totalAffected,
    directlyAffected,
    transitivelyAffected,
    cascadeChain,
    riskScore,
  };
}

export function detectCycles(graph: DependencyGraph): string[][] {
  const cycles: string[][] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const seenCycleKeys = new Set<string>();

  const visit = (node: string) => {
    if (visiting.has(node)) {
      const start = stack.indexOf(node);
      if (start >= 0) {
        const cycle = [...stack.slice(start), node];
        const key = canonicalCycleKey(cycle);
        if (!seenCycleKeys.has(key)) {
          seenCycleKeys.add(key);
          cycles.push(cycle);
        }
      }
      return;
    }

    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const dep of graph.nodes.get(node)?.imports || []) {
      if (graph.nodes.has(dep)) {
        visit(dep);
      }
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };

  for (const node of graph.nodes.keys()) {
    visit(node);
  }

  return cycles;
}

function collectModuleReferences(sourceFile: SourceFile): Array<{ specifier: string; kind: GraphEdgeKind }> {
  const refs: Array<{ specifier: string; kind: GraphEdgeKind }> = [];

  for (const decl of sourceFile.getImportDeclarations()) {
    refs.push({ specifier: decl.getModuleSpecifierValue(), kind: "esm-import" });
  }

  for (const decl of sourceFile.getExportDeclarations()) {
    const specifier = decl.getModuleSpecifierValue();
    if (specifier) {
      refs.push({ specifier, kind: "esm-reexport" });
    }
  }

  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expression = call.getExpression().getText();
    if (expression !== "require") {
      continue;
    }

    const [firstArg] = call.getArguments();
    if (!firstArg || !firstArg.asKind(SyntaxKind.StringLiteral)) {
      continue;
    }

    refs.push({ specifier: firstArg.getText().slice(1, -1), kind: "cjs-require" });
  }

  return refs;
}

function extractExports(sourceFile: SourceFile): string[] {
  const exports = new Set<string>();

  if (sourceFile.getDefaultExportSymbol()) {
    exports.add("default");
  }

  for (const symbol of sourceFile.getExportSymbols()) {
    exports.add(symbol.getName());
  }

  return [...exports].sort();
}

function resolveImport(projectRoot: string, fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return null;
  }

  const base = isAbsolute(specifier) ? resolve(projectRoot, `.${specifier}`) : resolve(dirname(fromFile), specifier);
  const direct = tryResolvePath(projectRoot, base);
  if (direct) {
    return direct;
  }

  const explicitExtension = extname(base);
  if (explicitExtension) {
    for (const alias of SOURCE_EXTENSION_ALIASES[explicitExtension] || []) {
      const resolved = tryResolvePath(projectRoot, base.slice(0, -explicitExtension.length) + alias);
      if (resolved) {
        return resolved;
      }
    }
    return null;
  }

  for (const ext of RESOLVE_EXTENSIONS) {
    const resolved = tryResolvePath(projectRoot, `${base}${ext}`);
    if (resolved) {
      return resolved;
    }
  }

  for (const suffix of INDEX_CANDIDATES) {
    const resolved = tryResolvePath(projectRoot, `${base}${suffix}`);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function tryResolvePath(projectRoot: string, absolutePath: string): string | null {
  if (!existsSync(absolutePath)) {
    return null;
  }
  if (!statSync(absolutePath).isFile()) {
    return null;
  }

  const rel = normalizePath(relative(projectRoot, absolutePath));
  if (rel.startsWith("..") || rel === "") {
    return null;
  }

  return rel;
}

function normalizePath(pathValue: string): string {
  return normalize(pathValue).replace(/\\/g, "/");
}

function canonicalCycleKey(cycle: string[]): string {
  const closed = cycle[cycle.length - 1] === cycle[0] ? cycle.slice(0, -1) : cycle.slice();
  if (closed.length === 0) {
    return "";
  }

  const rotations = closed.map((_, index) => {
    const rotated = closed.slice(index).concat(closed.slice(0, index));
    return rotated.join("->");
  });

  return rotations.sort()[0];
}
