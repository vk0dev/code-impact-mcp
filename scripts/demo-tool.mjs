#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeImpact, buildGraph, detectCycles } from '../dist/graph.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function typeLine(line = '') {
  process.stdout.write(`${line}\n`);
}

async function paced(line = '', ms = 450) {
  typeLine(line);
  await sleep(ms);
}

function write(rel, body, root) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

function createDemoProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-impact-demo-'));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true }, include: ['src/**/*.ts'] }, null, 2), root);
  write('src/index.ts', "export { handler } from './api/handler.js';\n", root);
  write('src/api/handler.ts', "import { formatUser } from '../services/formatter.js';\nimport { recordMetric } from '../shared/metrics.js';\n\nexport function handler(name: string) {\n  recordMetric('handler');\n  return formatUser(name);\n}\n", root);
  write('src/services/formatter.ts', "import { titleCase } from '../shared/strings.js';\nimport { logger } from '../shared/logger.js';\n\nexport function formatUser(name: string) {\n  logger.info('formatUser');\n  return titleCase(name);\n}\n", root);
  write('src/shared/strings.ts', "export function titleCase(value: string) {\n  return value.charAt(0).toUpperCase() + value.slice(1);\n}\n", root);
  write('src/shared/logger.ts', "import { config } from './config.js';\n\nexport const logger = {\n  info(message: string) {\n    return `[${config.env}] ${message}`;\n  },\n};\n", root);
  write('src/shared/config.ts', "import { logger } from './logger.js';\n\nexport const config = { env: 'demo' };\nexport function logConfig() {\n  return logger.info('config loaded');\n}\n", root);
  write('src/shared/metrics.ts', "export function recordMetric(_name: string) {\n  return true;\n}\n", root);
  return root;
}

function summarizeDependencies(graph, file) {
  const node = graph.nodes.get(file);
  if (!node) throw new Error(`missing ${file}`);
  const fanIn = node.importedBy.length;
  const fanOut = node.imports.length;
  const couplingRole = fanIn > 10 ? 'hub' : fanIn > fanOut ? 'consumer-facing dependency' : fanOut > fanIn ? 'orchestrator' : 'balanced module';
  return { node, fanIn, fanOut, couplingRole };
}

function summarizeGate(graph, files, threshold) {
  const impact = analyzeImpact(graph, files);
  const cycles = detectCycles(graph);
  const reasons = [];
  let verdict = 'PASS';
  const totalAffected = impact.directlyAffected.length + impact.transitivelyAffected.length;
  if (impact.riskScore >= threshold) {
    verdict = 'BLOCK';
    reasons.push(`Risk score ${impact.riskScore} exceeds threshold ${threshold}. ${totalAffected} files would be affected.`);
  } else if (impact.riskScore >= threshold * 0.6) {
    verdict = 'WARN';
    reasons.push(`Risk score ${impact.riskScore} is approaching threshold. Review affected files.`);
  }
  const affectedCycles = cycles.filter((cycle) => files.some((f) => cycle.includes(f)));
  if (affectedCycles.length > 0) {
    verdict = verdict === 'PASS' ? 'WARN' : verdict;
    reasons.push(`Changed files are part of ${affectedCycles.length} circular dependency cycle(s).`);
  }
  if (reasons.length === 0) reasons.push(`Changes affect ${impact.directlyAffected.length} direct dependents. Risk is low.`);
  return { verdict, reasons, impact, affectedCycles };
}

async function main() {
  const tool = process.argv[2] ?? 'analyze_impact';
  const root = createDemoProject();
  const graph = buildGraph(root);
  await paced('$ code-impact-mcp demo', 250);
  await paced(`Tool: ${tool}`);
  await paced(`Project: ${root}`);
  if (tool === 'refresh_graph') {
    const cycles = detectCycles(graph);
    await paced('Refreshing dependency graph...');
    typeLine(JSON.stringify({ status: 'Graph rebuilt successfully', files: graph.fileCount, edges: graph.edgeCount, buildTimeMs: graph.buildTimeMs, circularDependencies: cycles.length, cycles: cycles.length ? cycles.slice(0, 5) : undefined }, null, 2));
    return;
  }
  if (tool === 'analyze_impact') {
    const files = ['src/shared/logger.ts'];
    const result = analyzeImpact(graph, files);
    await paced(`Changed files: ${files.join(', ')}`);
    typeLine(JSON.stringify({ summary: `Medium graph impact: review the ${result.directlyAffected.length + result.transitivelyAffected.length} affected files before changing this area.`, changedFiles: files, directlyAffected: result.directlyAffected, transitivelyAffected: result.transitivelyAffected, riskScore: result.riskScore, totalAffected: result.directlyAffected.length + result.transitivelyAffected.length }, null, 2));
    return;
  }
  if (tool === 'get_dependencies') {
    const file = 'src/api/handler.ts';
    const { node, fanIn, fanOut, couplingRole } = summarizeDependencies(graph, file);
    await paced(`Inspecting: ${file}`);
    typeLine(JSON.stringify({ file: node.file, imports: node.imports, importedBy: node.importedBy, exports: node.exports, fanIn, fanOut, couplingRole }, null, 2));
    return;
  }
  if (tool === 'gate_check') {
    const files = ['src/shared/logger.ts'];
    const threshold = 0.35;
    const result = summarizeGate(graph, files, threshold);
    await paced(`Gate threshold: ${threshold}`);
    await paced(`Changed files: ${files.join(', ')}`);
    typeLine(JSON.stringify({ verdict: result.verdict, reasons: result.reasons, riskScore: result.impact.riskScore, directlyAffected: result.impact.directlyAffected, transitivelyAffected: result.impact.transitivelyAffected, affectedCycles: result.affectedCycles }, null, 2));
    return;
  }
  throw new Error(`Unknown tool demo: ${tool}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
