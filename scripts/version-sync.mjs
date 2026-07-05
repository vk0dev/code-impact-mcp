#!/usr/bin/env node

/**
 * Syncs a semver version across all 4 required locations.
 * Usage:
 *   node scripts/version-sync.mjs 1.2.3    — write version everywhere
 *   node scripts/version-sync.mjs --check  — verify all 4 locations agree (CI gate, exit 1 on drift)
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
  console.error(`Usage: node scripts/version-sync.mjs <version> | --check`);
  console.error(`Example: node scripts/version-sync.mjs 1.2.3`);
  process.exit(1);
}

// ─── Check Mode (CI gate) ───────────────────────────────────────────────────
// Reads the version from all 4 sync locations and exits 1 if they disagree.

if (version === '--check') {
  const found = [];
  const readJSONVersion = (relPath, extract) => {
    const p = path.join(ROOT, relPath);
    if (!fs.existsSync(p)) return found.push([relPath, null]);
    try {
      found.push([relPath, extract(JSON.parse(fs.readFileSync(p, 'utf8')))]);
    } catch (err) {
      found.push([relPath, `unreadable: ${err.message}`]);
    }
  };
  readJSONVersion('package.json', (d) => d.version);
  readJSONVersion('.claude-plugin/plugin.json', (d) => d.version);
  readJSONVersion('server.json', (d) => d.version);
  {
    const p = path.join(ROOT, 'server.json');
    if (fs.existsSync(p)) {
      try {
        const d = JSON.parse(fs.readFileSync(p, 'utf8'));
        found.push(['server.json packages[0]', d.packages?.[0]?.version ?? null]);
      } catch {
        // already reported as unreadable by the server.json entry above
      }
    }
  }
  const srcPath = path.join(ROOT, 'src/createServer.ts');
  if (fs.existsSync(srcPath)) {
    const m = fs.readFileSync(srcPath, 'utf8').match(/version:\s*['"]([^'"]+)['"]/);
    found.push(['src/createServer.ts', m ? m[1] : null]);
  } else {
    found.push(['src/createServer.ts', null]);
  }

  const reference = found[0][1];
  let drift = false;
  console.log(`\n${bold('Version sync check')} ${dim(`(reference: package.json = ${reference})`)}\n`);
  for (const [loc, v] of found) {
    const ok = v === reference && v != null;
    if (!ok) drift = true;
    console.log(`  ${ok ? green('✔') : red('✘')} ${loc}: ${v ?? red('missing')}`);
  }
  if (drift) {
    console.error(`\n${red('Version drift detected.')} Run: node scripts/version-sync.mjs ${reference}\n`);
    process.exit(1);
  }
  console.log(`\n${green('All locations in sync.')}\n`);
  process.exit(0);
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

function updateJSON(relPath, updater) {
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
});

// ─── 2. .claude-plugin/plugin.json ──────────────────────────────────────────

updateJSON('.claude-plugin/plugin.json', (data) => {
  data.version = version;
});

// ─── 3. server.json ─────────────────────────────────────────────────────────

updateJSON('server.json', (data) => {
  data.version = version;
  if (data.packages && Array.isArray(data.packages) && data.packages.length > 0) {
    data.packages[0].version = version;
  }
});

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
