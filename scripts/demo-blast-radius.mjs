#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { registerTools } from '../dist/tools/index.js';

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

class FakeServer {
  constructor() {
    this.handlers = new Map();
  }
  registerTool(name, _config, handler) {
    this.handlers.set(name, handler);
  }
}

function parseToolResult(result) {
  return JSON.parse(result.content[0].text);
}

function write(rel, body, root) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body, 'utf8');
}

function createDemoProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-impact-blast-radius-'));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true }, include: ['src/**/*.ts'] }, null, 2), root);
  write('src/index.ts', "export { checkoutRoute } from './routes/checkout.ts';\nexport { invoiceJob } from './jobs/invoice.ts';\n", root);
  write('src/routes/checkout.ts', "import { calculateInvoice } from '../services/billing.ts';\nexport function checkoutRoute(orderId: string) { return calculateInvoice(orderId); }\n", root);
  write('src/jobs/invoice.ts', "import { calculateInvoice } from '../services/billing.ts';\nexport function invoiceJob(orderId: string) { return calculateInvoice(orderId); }\n", root);
  write('src/services/billing.ts', "import { getPlanMultiplier } from '../pricing/plans.ts';\nexport function calculateInvoice(orderId: string) { return `${orderId}:${getPlanMultiplier('pro')}`; }\n", root);
  write('src/pricing/plans.ts', "export function getPlanMultiplier(plan: string) { return plan === 'pro' ? 2 : 1; }\n", root);
  return root;
}

async function out(line = '', ms = 450) {
  process.stdout.write(`${line}\n`);
  await sleep(ms);
}

async function main() {
  const root = createDemoProject();
  const server = new FakeServer();
  registerTools(server);

  await out(`${DIM}# Blast-radius check: if billing changes, what else should I inspect?${RESET}`, 1100);
  await out(`${BOLD}$ analyze_impact files=src/services/billing.ts${RESET}`, 700);
  await out(`${DIM}  project: ${root}${RESET}`, 900);
  await out();

  const result = parseToolResult(await server.handlers.get('analyze_impact')({
    projectRoot: root,
    files: ['src/services/billing.ts'],
  }));

  await out(`${CYAN}${BOLD}>>> fanout summary${RESET}`, 700);
  await out(`  changed: ${BOLD}${result.changedFiles.join(', ')}${RESET}`, 1000);
  await out(`  affected: ${YELLOW}${result.totalAffected}${RESET} files`, 900);
  await out(`  risk: ${BOLD}${result.riskScore.toFixed(2)}${RESET}`, 900);
  await out();
  await out(`${CYAN}${BOLD}>>> direct dependents${RESET}`, 700);
  for (const item of result.directlyAffected) {
    await out(`  ${GREEN}•${RESET} ${item}`, 700);
  }
  await out();
  await out(`${CYAN}${BOLD}>>> transitive dependents${RESET}`, 700);
  for (const item of result.transitivelyAffected) {
    await out(`  ${GREEN}•${RESET} ${item}`, 700);
  }
  await out();
  await out(`${GREEN}${BOLD}Decision first.${RESET} One changed file in, bounded blast radius out.`, 1600);

  fs.rmSync(root, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
