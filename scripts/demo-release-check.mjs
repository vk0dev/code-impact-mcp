#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const DIM = '\x1b[2m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const out = async (line = '', ms = 420) => {
  process.stdout.write(`${line}\n`);
  await sleep(ms);
};

async function main() {
  await out(`${DIM}# Release QA proof for the shipped 1.6.4 lane.${RESET}`, 1100);
  await out(`${BOLD}$ node scripts/release-check.mjs${RESET}`, 700);
  await out();

  const raw = execSync('node scripts/release-check.mjs', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const interesting = lines.filter((line) =>
    line.includes('Target version:') ||
    line.includes('server.json version matches') ||
    line.includes('server.json packages[0].version matches') ||
    line.includes('README has') ||
    line.includes('Translation:') ||
    line.includes('CHANGELOG.md contains version') ||
    line.includes('Summary:') ||
    line.includes('All checks passed!')
  );

  for (const line of interesting) {
    await out(line, line.includes('Summary:') || line.includes('All checks passed!') ? 900 : 220);
  }

  await out();
  await out(`${GREEN}${BOLD}What this proves:${RESET} the repo-local release contract stays green after the 1.6.4 hardening work.`, 1700);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
