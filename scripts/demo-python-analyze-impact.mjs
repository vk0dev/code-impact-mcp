#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { registerTools } from '../dist/tools/index.js';

const DIM = '\x1b[2m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

class FakeServer {
  constructor() { this.handlers = new Map(); }
  registerTool(name, _config, handler) { this.handlers.set(name, handler); }
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-impact-python-'));
  write('app.py', "from services.billing import charge_customer\n\n\ndef checkout(user_id: str):\n    return charge_customer(user_id)\n", root);
  write('services/billing.py', "from shared.pricing import normalize_price\nfrom shared.audit import record_charge_attempt\n\n\ndef charge_customer(user_id: str):\n    record_charge_attempt(user_id)\n    return normalize_price(1999)\n", root);
  write('shared/pricing.py', "def normalize_price(cents: int) -> float:\n    return round(cents / 100, 2)\n", root);
  write('shared/audit.py', "def record_charge_attempt(user_id: str) -> None:\n    print(f'audit:{user_id}')\n", root);
  return root;
}

const out = async (line = '', ms = 420) => {
  process.stdout.write(`${line}\n`);
  await sleep(ms);
};

async function main() {
  const root = createDemoProject();
  const server = new FakeServer();
  registerTools(server);

  await out(`${DIM}# Changed Python file: shared/pricing.py${RESET}`, 1100);
  await out(`${BOLD}$ analyze_impact files=shared/pricing.py${RESET}`, 700);
  await out(`${DIM}  project: ${root}${RESET}`, 900);
  await out();

  const payload = parseToolResult(await server.handlers.get('analyze_impact')({
    projectRoot: root,
    files: ['shared/pricing.py'],
  }));

  await out(`${CYAN}${BOLD}>>> summary${RESET} ${payload.summary}`, 1100);
  await out(`${CYAN}${BOLD}>>> scanSummary${RESET} ${payload.scanSummary}`, 1100);
  await out(`  changed: ${BOLD}${payload.changedFiles.join(', ')}${RESET}`, 800);
  await out(`  direct:  ${payload.directlyAffected.join(', ')}`, 900);
  await out(`  transitive: ${payload.transitivelyAffected.join(', ')}`, 1200);
  await out(`  risk score: ${GREEN}${BOLD}${payload.riskScore}${RESET}`, 1000);
  await out();
  await out(`${GREEN}${BOLD}Decision first:${RESET} a Python utility change fans out into billing, then app checkout.`, 1700);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
