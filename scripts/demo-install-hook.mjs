#!/usr/bin/env node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

import { executeCliMode } from '../dist/cli.js';

const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const out = async (line = '', ms = 420) => {
  process.stdout.write(`${line}\n`);
  await sleep(ms);
};

async function runInstall(cwd) {
  let buffer = '';
  const exitCode = await executeCliMode('install-hook', {
    cwd,
    write: (text) => {
      buffer += text;
    },
  });
  return { exitCode, output: buffer.trimEnd() };
}

async function main() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'code-impact-hook-demo-'));
  const huskyDir = path.join(root, '.husky');
  const hookPath = path.join(huskyDir, 'pre-commit');
  mkdirSync(huskyDir, { recursive: true });
  writeFileSync(hookPath, '#!/usr/bin/env sh\necho existing\n', 'utf8');

  await out(`${DIM}# Husky exists, unrelated pre-commit content already in place.${RESET}`, 1100);
  await out(`${BOLD}$ npx -y @vk0/code-impact-mcp install-hook${RESET}`, 700);
  const first = await runInstall(root);
  await out(`${GREEN}${first.output}${RESET}`, 900);
  await out(`${CYAN}${BOLD}>>> .husky/pre-commit after first run${RESET}`, 650);
  await out(readFileSync(hookPath, 'utf8').trimEnd(), 1500);
  await out();

  await out(`${BOLD}$ npx -y @vk0/code-impact-mcp install-hook${RESET}`, 700);
  const second = await runInstall(root);
  await out(`${YELLOW}${second.output}${RESET}`, 900);
  await out(`${CYAN}${BOLD}>>> .husky/pre-commit after rerun${RESET}`, 650);
  await out(readFileSync(hookPath, 'utf8').trimEnd(), 1500);
  await out();
  await out(`${YELLOW}${BOLD}Refusal is intentional.${RESET} Existing hook lines stay untouched unless the helper already owns a managed code-impact-mcp block.`, 1700);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
