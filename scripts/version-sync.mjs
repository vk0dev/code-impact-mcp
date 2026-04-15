#!/usr/bin/env node

/**
 * Syncs a semver version across all 4 required locations.
 * Usage: node scripts/version-sync.mjs 1.2.3
 * Uses only Node.js built-in modules.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ─── Colors ──────────────────────────────────────────────────────────────────

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

// ─── Validate Args ──────────────────────────────────────────────────────────

const version = process.argv[2];

if (!version) {
  console.error(`${red('Error:')} version argument required.\n`);
  console.error(`Usage: node scripts/version-sync.mjs <version>`);
  console.error(`Example: node scripts/version-sync.mjs 1.2.3`);
  process.exit(1);
}

// Semver validation (basic: major.minor.patch with optional pre-release and build metadata)
const SEMVER_RE = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?(\+[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*)?$/;

if (!SEMVER_RE.test(version)) {
  console.error(`${red('Error:')} "${version}" is not a valid semver version.`);
  console.error(`Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.3, 2.0.0-beta.1)`);
  process.exit(1);
}

console.log(`\n${bold('Version sync:')} ${green(version)}\n`);

// ─── Helpers ─────────────────────────────────────────────────────────────────

let updated = 0;
let errors = 0;

function updateJSON(relPath, updater, label) {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ${red('✘')} ${relPath} — ${red('file not found')}`);
    errors++;
    return;
  }

  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    const data = JSON.parse(raw);
    const oldVersion = data.version || '(none)';
    updater(data);
    // Preserve original indentation
    const indent = raw.match(/^(\s+)"/m)?.[1] || '  ';
    fs.writeFileSync(fullPath, JSON.stringify(data, null, indent) + '\n', 'utf8');
    console.log(`  ${green('✔')} ${relPath} ${dim(`${oldVersion} → ${version}`)}`);
    updated++;
  } catch (err) {
    console.error(`  ${red('✘')} ${relPath} — ${err.message}`);
    errors++;
  }
}

// ─── 1. package.json ─────────────────────────────────────────────────────────

updateJSON('package.json', (data) => {
  data.version = version;
}, 'package.json');

// ─── 2. .claude-plugin/plugin.json ──────────────────────────────────────────

updateJSON('.claude-plugin/plugin.json', (data) => {
  data.version = version;
}, 'plugin.json');

// ─── 3. server.json ─────────────────────────────────────────────────────────

updateJSON('server.json', (data) => {
  data.version = version;
  if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
    data.packages[0].version = version;
  }
}, 'server.json');

// ─── 4. src/createServer.ts ─────────────────────────────────────────────────

const createServerPath = path.join(ROOT, 'src/createServer.ts');
if (!fs.existsSync(createServerPath)) {
  console.error(`  ${red('✘')} src/createServer.ts — ${red('file not found')}`);
  errors++;
} else {
  try {
    let content = fs.readFileSync(createServerPath, 'utf8');
    const versionPattern = /(version:\s*['"])([^'"]+)(['"])/;
    const match = content.match(versionPattern);

    if (!match) {
      console.error(`  ${red('✘')} src/createServer.ts — ${red('no version: string found in McpServer constructor')}`);
      errors++;
    } else {
      const oldVersion = match[2];
      content = content.replace(versionPattern, `$1${version}$3`);
      fs.writeFileSync(createServerPath, content, 'utf8');
      console.log(`  ${green('✔')} src/createServer.ts ${dim(`${oldVersion} → ${version}`)}`);
      updated++;
    }
  } catch (err) {
    console.error(`  ${red('✘')} src/createServer.ts — ${err.message}`);
    errors++;
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${bold('Done:')} ${green(`${updated} files updated`)}${errors > 0 ? `, ${red(`${errors} errors`)}` : ''}\n`);

if (errors > 0) {
  process.exit(1);
}
