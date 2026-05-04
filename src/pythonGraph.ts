import fs from "node:fs";
import path from "node:path";
import Parser from "tree-sitter";
import Python from "tree-sitter-python";
import type { DependencyGraph, GraphEdge, GraphNode } from "./graph.js";

const parser = new Parser();
parser.setLanguage(Python as unknown as Parser.Language);

function normalize(relPath: string): string {
  return relPath.split(path.sep).join("/");
}

function stripPySuffix(relPath: string): string {
  if (relPath.endsWith('/__init__.py')) return relPath.slice(0, -'/__init__.py'.length);
  if (relPath.endsWith('.py')) return relPath.slice(0, -3);
  return relPath;
}

function moduleNameFor(relPath: string): string {
  return stripPySuffix(normalize(relPath)).replace(/\//g, '.');
}

function candidateModuleToRel(moduleName: string): string[] {
  const base = moduleName.replace(/\./g, '/');
  return [`${base}.py`, `${base}/__init__.py`];
}

function resolveAbsoluteImport(moduleName: string, knownFiles: Set<string>): string | null {
  for (const candidate of candidateModuleToRel(moduleName)) {
    if (knownFiles.has(candidate)) return candidate;
  }
  return null;
}

function resolveRelativeImport(currentRel: string, level: number, moduleName: string | null, knownFiles: Set<string>): string | null {
  const currentModule = moduleNameFor(currentRel);
  const packageParts = currentRel.endsWith('/__init__.py')
    ? currentModule.split('.')
    : currentModule.split('.').slice(0, -1);
  const anchor = packageParts.slice(0, Math.max(0, packageParts.length - Math.max(0, level - 1)));
  const target = [...anchor, ...(moduleName ? moduleName.split('.') : [])].filter(Boolean).join('.');
  if (!target) return null;
  return resolveAbsoluteImport(target, knownFiles);
}

function collectPyFiles(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.py')) out.push(normalize(path.relative(root, full)));
    }
  }
  walk(root);
  return out.sort();
}

function textFor(node: Parser.SyntaxNode, source: string): string {
  return source.slice(node.startIndex, node.endIndex);
}

function extractImports(relPath: string, source: string, knownFiles: Set<string>): string[] {
  const tree = parser.parse(source);
  const deps = new Set<string>();

  function visit(node: Parser.SyntaxNode) {
    if (node.type === 'import_statement') {
      for (const child of node.namedChildren) {
        if (child.type === 'dotted_name' || child.type === 'aliased_import') {
          const raw = textFor(child, source).split(' as ')[0].trim();
          const resolved = resolveAbsoluteImport(raw, knownFiles);
          if (resolved) deps.add(resolved);
        }
      }
    }

    if (node.type === 'import_from_statement') {
      const statement = textFor(node, source).trim();
      const match = statement.match(/^from\s+(\.*)([A-Za-z0-9_\.]+)?\s+import\s+(.+)$/s);
      if (match) {
        const [, dots, modulePart, importedPart] = match;
        const importedNames = importedPart
          .replace(/[()]/g, "")
          .split(",")
          .map((name) => name.trim().split(/\s+as\s+/)[0])
          .filter(Boolean);

        if (dots) {
          if (modulePart) {
            const resolved = resolveRelativeImport(relPath, dots.length, modulePart, knownFiles);
            if (resolved) deps.add(resolved);
          } else {
            for (const importedName of importedNames) {
              const resolved = resolveRelativeImport(relPath, dots.length, importedName, knownFiles);
              if (resolved) deps.add(resolved);
            }
          }
        } else if (modulePart) {
          const resolved = resolveAbsoluteImport(modulePart, knownFiles);
          if (resolved) deps.add(resolved);
        }
      }
    }

    for (const child of node.namedChildren) visit(child);
  }

  visit(tree.rootNode);
  return Array.from(deps).sort();
}

export function buildPythonGraph(projectRoot: string): DependencyGraph {
  const startedAt = Date.now();
  const files = collectPyFiles(projectRoot);
  const knownFiles = new Set(files);
  const nodes = new Map<string, GraphNode>();
  const reverseDeps = new Map<string, Set<string>>();
  const edges: GraphEdge[] = [];

  for (const relPath of files) {
    const abs = path.join(projectRoot, relPath);
    const source = fs.readFileSync(abs, 'utf8');
    const imports = extractImports(relPath, source, knownFiles);
    nodes.set(relPath, { path: abs, file: relPath, imports, importedBy: [], exports: [] });
    for (const dep of imports) {
      if (!reverseDeps.has(dep)) reverseDeps.set(dep, new Set());
      reverseDeps.get(dep)!.add(relPath);
      edges.push({ from: relPath, to: dep, kind: "esm-import", specifier: dep });
    }
  }

  for (const [file, importers] of reverseDeps) {
    const node = nodes.get(file);
    if (node) node.importedBy = Array.from(importers).sort();
  }

  return {
    nodes,
    reverseDeps,
    edges,
    fileCount: files.length,
    edgeCount: edges.length,
    buildTimeMs: Date.now() - startedAt,
  };
}
