#!/usr/bin/env node

/**
 * Post-release verification: proves a release actually landed everywhere,
 * instead of trusting continue-on-error publish steps.
 *
 * Usage: node scripts/post-release-verify.mjs [version]
 *   version — expected version (default: package.json version)
 *
 * Checks (hard failures exit 1):
 *   1. npm dist-tags.latest == expected version (polls up to ~3 min for propagation)
 *   2. Official MCP Registry: expected version present, active and isLatest
 *   3. GitHub Pages landing responds 200
 * Warnings (never fail — creation is OAuth-gated / best-effort):
 *   4. Smithery listing responds 200
 *
 * Uses only Node.js built-ins (global fetch, node >= 18).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const npmName = pkg.name; // @vk0/<repo>
const repoName = npmName.split('/').pop();
const serverJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'server.json'), 'utf8'));
const registryName = serverJson.name; // io.github.vk0dev/<repo>

const expected = (process.argv[2] || pkg.version).replace(/^v/, '');

let failures = 0;
let warnings = 0;
const pass = (msg, detail = '') => console.log(`  ${green('✔')} ${msg}${detail ? ` — ${detail}` : ''}`);
const fail = (msg, detail = '') => { failures++; console.log(`  ${red('✘')} ${msg}${detail ? ` — ${detail}` : ''}`); };
const warn = (msg, detail = '') => { warnings++; console.log(`  ${yellow('⚠')} ${msg}${detail ? ` — ${detail}` : ''}`); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function checkNpm() {
  // npm propagation can lag right after publish — poll up to ~3 min
  const url = `https://registry.npmjs.org/${encodeURIComponent(npmName)}`;
  const deadline = Date.now() + 3 * 60 * 1000;
  let last = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/vnd.npm.install-v1+json' } });
      if (res.ok) {
        const data = await res.json();
        last = data['dist-tags']?.latest;
        if (last === expected) {
          pass(`npm dist-tags.latest == ${expected}`);
          return;
        }
      } else {
        last = `HTTP ${res.status}`;
      }
    } catch (err) {
      last = err.message;
    }
    await sleep(15_000);
  }
  fail(`npm dist-tags.latest == ${expected}`, `got ${last}`);
}

async function checkOfficialRegistry() {
  try {
    const res = await fetch(
      `https://registry.modelcontextprotocol.io/v0/servers?search=${encodeURIComponent(registryName)}&version=latest`,
    );
    if (!res.ok) return fail('Official MCP Registry reachable', `HTTP ${res.status}`);
    const data = await res.json();
    const entry = (data.servers || []).find((s) => s.server?.name === registryName);
    if (!entry) return fail('Official MCP Registry listing exists', `no entry for ${registryName}`);
    const meta = entry._meta?.['io.modelcontextprotocol.registry/official'] || {};
    if (entry.server.version === expected && meta.status === 'active') {
      pass(`Official MCP Registry latest == ${expected} (active)`);
    } else {
      fail(
        `Official MCP Registry latest == ${expected}`,
        `got ${entry.server.version} (status ${meta.status ?? '?'})`,
      );
    }
  } catch (err) {
    fail('Official MCP Registry check', err.message);
  }
}

async function checkPages() {
  const url = `https://vk0dev.github.io/${repoName}/`;
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (res.status === 200) pass(`GitHub Pages landing 200 (${url})`);
    else fail(`GitHub Pages landing 200 (${url})`, `HTTP ${res.status}`);
  } catch (err) {
    fail(`GitHub Pages landing (${url})`, err.message);
  }
}

async function checkSmithery() {
  // smithery.ai web pages return 200 + a client-side shell for ANY slug
  // (verified against a nonexistent control slug), so HTTP status of the
  // public page proves nothing. The registry API is authoritative.
  const qualified = `unfucker/${repoName}`;
  const apiKey = process.env.SMITHERY_API_KEY;
  if (!apiKey) {
    warn(`Smithery listing (${qualified})`, 'SMITHERY_API_KEY not set — cannot verify via registry API');
    return;
  }
  try {
    const res = await fetch(`https://registry.smithery.ai/servers/${qualified}`, {
      headers: { authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.qualifiedName === qualified) {
      pass(`Smithery registry lists ${qualified}`);
    } else {
      warn(`Smithery registry (${qualified})`, `${data.error || `HTTP ${res.status}`} — one-time submit via smithery.ai/new`);
    }
  } catch (err) {
    warn(`Smithery registry (${qualified})`, err.message);
  }
}

console.log(`\n${bold('Post-release verify:')} ${npmName}@${expected}\n`);
await checkNpm();
await checkOfficialRegistry();
await checkPages();
await checkSmithery();

console.log(
  `\n${bold('Summary:')} ${failures === 0 ? green('all hard checks passed') : red(`${failures} failed`)}${warnings ? yellow(`, ${warnings} warnings`) : ''}\n`,
);
if (failures > 0) process.exit(1);
