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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'code-impact-cycles-'));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true }, include: ['src/**/*.ts'] }, null, 2), root);
  write('src/router.ts', "import { routes } from './routes.js';\nexport const router = { routes };\n", root);
  write('src/routes.ts', "import { router } from './router.js';\nexport const routes = [router];\n", root);
  write('src/api.ts', "import { router } from './router.js';\nexport const api = router;\n", root);
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

  await out(`${DIM}# Quick cycle hotspot check before a refactor.${RESET}`, 1100);
  await out(`${BOLD}$ detect_cycles${RESET}`, 700);
  await out(`${DIM}  project: ${root}${RESET}`, 900);
  await out();

  const payload = parseToolResult(await server.handlers.get('detect_cycles')({ projectRoot: root }));

  await out(`${CYAN}${BOLD}>>> cycleCount${RESET} ${payload.cycleCount}`, 700);
  await out(`${CYAN}${BOLD}>>> hotspots${RESET} ${payload.hotspots.join(', ')}`, 1000);
  await out(`${CYAN}${BOLD}>>> cycles${RESET} ${JSON.stringify(payload.cycles, null, 2)}`, 1500);
  await out();
  await out(`${GREEN}${BOLD}Decision first:${RESET} untangle router ↔ routes before widening the change.`, 1700);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
