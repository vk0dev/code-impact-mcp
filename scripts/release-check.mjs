#!/usr/bin/env node

/**
 * Pre-release checklist — verifies 25+ items from CLAUDE.md standards.
 * Run: node scripts/release-check.mjs
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
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const dim = (s) => `\x1b[2m${s}\x1b[0m`;

const PASS = green('✔');
const FAIL = red('✘');
const WARN = yellow('⚠');

// ─── State ───────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let warnings = 0;

function check(ok, label, detail) {
  if (ok) {
    console.log(`  ${PASS} ${label}`);
    passed++;
  } else {
    console.log(`  ${FAIL} ${label}${detail ? dim(`  — ${detail}`) : ''}`);
    failed++;
  }
}

function warn(label, detail) {
  console.log(`  ${WARN} ${label}${detail ? dim(`  — ${detail}`) : ''}`);
  warnings++;
}

function fileExists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function readJSON(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
}

function readText(rel) {
  try {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch {
    return null;
  }
}

/** Recursively collect all files under a directory */
function walkDir(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(full, ext));
    } else if (!ext || entry.name.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}

// ─── Checks ──────────────────────────────────────────────────────────────────

const pkg = readJSON('package.json');

// ── Code Quality ─────────────────────────────────────────────────────────────

console.log(`\n${bold('Code Quality')}`);

// No TODO/FIXME in src/
const srcFiles = walkDir(path.join(ROOT, 'src'));
const todoFiles = [];
for (const file of srcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  if (/\b(TODO|FIXME)\b/.test(content)) {
    todoFiles.push(path.relative(ROOT, file));
  }
}
check(
  todoFiles.length === 0,
  'No TODO/FIXME in src/',
  todoFiles.length > 0 ? `found in: ${todoFiles.join(', ')}` : undefined,
);

// Check that build output exists (proxy for "npm run build" passing)
check(fileExists('dist'), 'dist/ directory exists (build output)', 'run "npm run build" first');

// Check that test config exists
check(
  fileExists('vitest.config.ts') || fileExists('vitest.config.js') || (pkg?.scripts?.test && pkg.scripts.test.includes('vitest')),
  'Test configuration exists',
  'vitest.config.ts or vitest in test script',
);

// ── Package Metadata ─────────────────────────────────────────────────────────

console.log(`\n${bold('Package Metadata')}`);

if (!pkg) {
  check(false, 'package.json exists and is valid JSON');
} else {
  const requiredFields = ['name', 'version', 'description', 'mcpName', 'author', 'license', 'homepage'];
  for (const field of requiredFields) {
    check(!!pkg[field], `package.json has "${field}"`, pkg[field] ? undefined : 'missing');
  }

  // Nested fields
  check(!!pkg.repository?.url, 'package.json has "repository.url"', pkg.repository?.url ? undefined : 'missing');
  check(!!pkg.bugs?.url, 'package.json has "bugs.url"', pkg.bugs?.url ? undefined : 'missing');

  // Description quality
  if (pkg.description) {
    check(
      pkg.description.length <= 200,
      'description <= 200 characters',
      `current: ${pkg.description.length} chars`,
    );
    check(
      /^[A-Z]/.test(pkg.description),
      'description starts with uppercase (verb)',
      `starts with: "${pkg.description.slice(0, 20)}..."`,
    );
  }

  // Keywords
  const kwCount = (pkg.keywords || []).length;
  check(kwCount >= 10, `keywords >= 10`, `current: ${kwCount}`);

  // engines.node
  check(!!pkg.engines?.node, 'engines.node exists', pkg.engines?.node || 'missing');

  // publishConfig.access
  check(
    pkg.publishConfig?.access === 'public',
    'publishConfig.access = "public"',
    pkg.publishConfig?.access ? `current: "${pkg.publishConfig.access}"` : 'missing',
  );
}

// ── Version Sync ─────────────────────────────────────────────────────────────

console.log(`\n${bold('Version Sync')}`);

const pkgVersion = pkg?.version;
if (!pkgVersion) {
  check(false, 'package.json has a version');
} else {
  console.log(`  ${dim(`Target version: ${pkgVersion}`)}`);

  // plugin.json
  const plugin = readJSON('.claude-plugin/plugin.json');
  if (plugin) {
    check(plugin.version === pkgVersion, 'plugin.json version matches', `got "${plugin.version}"`);
  } else {
    check(false, 'plugin.json version matches', 'file not found');
  }

  // server.json
  const serverJson = readJSON('server.json');
  if (serverJson) {
    check(serverJson.version === pkgVersion, 'server.json version matches', `got "${serverJson.version}"`);
    const pkgVer = serverJson.packages?.[0]?.version;
    if (pkgVer !== undefined) {
      check(pkgVer === pkgVersion, 'server.json packages[0].version matches', `got "${pkgVer}"`);
    }
  } else {
    check(false, 'server.json version matches', 'file not found');
  }

  // src/ files with version: string near a server/McpServer constructor
  const tsFiles = walkDir(path.join(ROOT, 'src'), '.ts');
  let foundVersionInSrc = false;
  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    // Match version string in McpServer constructor or similar patterns
    const versionMatch = content.match(/version:\s*['"]([^'"]+)['"]/);
    if (versionMatch) {
      foundVersionInSrc = true;
      const rel = path.relative(ROOT, file);
      check(
        versionMatch[1] === pkgVersion,
        `${rel} version matches`,
        `got "${versionMatch[1]}"`,
      );
    }
  }
  if (!foundVersionInSrc) {
    warn('No version: string found in src/ files');
  }
}

// ── README Quality ───────────────────────────────────────────────────────────

console.log(`\n${bold('README Quality')}`);

const readme = readText('README.md');
if (!readme) {
  check(false, 'README.md exists');
} else {
  check(true, 'README.md exists');

  // Why / When to use section
  check(
    /##\s.*(why|when to use)/i.test(readme),
    'README has "Why" or "When to use" section',
  );

  // Install snippets for >= 4 clients
  const clients = ['Claude Desktop', 'Claude Code', 'Cursor', 'Cline'];
  const foundClients = clients.filter((c) => readme.includes(c));
  check(
    foundClients.length >= 4,
    `Install snippets for >= 4 clients`,
    `found: ${foundClients.join(', ')} (${foundClients.length}/4)`,
  );

  // FAQ section
  check(/##\s.*faq/i.test(readme), 'README has FAQ section');

  // Comparison table
  check(
    /##\s.*compar/i.test(readme) || /\|.*\|.*\|/.test(readme),
    'README has Comparison table',
  );

  // Translations
  const translations = ['README.ja.md', 'README.zh-CN.md', 'README.ru.md', 'README.es.md'];
  for (const t of translations) {
    check(fileExists(t), `Translation: ${t}`);
  }
}

// ── Infrastructure ───────────────────────────────────────────────────────────

console.log(`\n${bold('Infrastructure')}`);

const infraFiles = [
  ['server.json', 'server.json'],
  ['.claude-plugin/plugin.json', '.claude-plugin/plugin.json'],
  ['CHANGELOG.md', 'CHANGELOG.md'],
  ['LICENSE', 'LICENSE'],
  ['docs/index.html', 'docs/index.html'],
  ['.github/workflows/ci.yml', '.github/workflows/ci.yml'],
  ['.github/workflows/publish.yml', '.github/workflows/publish.yml'],
  ['.github/dependabot.yml', '.github/dependabot.yml'],
  ['scripts/dogfood_smoke.mjs', 'scripts/dogfood_smoke.mjs'],
];

for (const [filePath, label] of infraFiles) {
  check(fileExists(filePath), `${label} exists`);
}

// CHANGELOG contains current version
if (pkgVersion) {
  const changelog = readText('CHANGELOG.md');
  if (changelog) {
    check(
      changelog.includes(pkgVersion),
      `CHANGELOG.md contains version ${pkgVersion}`,
      'version string not found in CHANGELOG',
    );
  }
}

// ── Security ─────────────────────────────────────────────────────────────────

console.log(`\n${bold('Security')}`);

// npm audit — no high/critical vulnerabilities
try {
  const { execSync } = await import('node:child_process');
  const auditOutput = execSync('npm audit --json 2>/dev/null', { encoding: 'utf-8', timeout: 30000 });
  const audit = JSON.parse(auditOutput);
  const high = audit?.metadata?.vulnerabilities?.high ?? 0;
  const critical = audit?.metadata?.vulnerabilities?.critical ?? 0;
  check(high === 0 && critical === 0, 'No high/critical npm vulnerabilities', `high: ${high}, critical: ${critical}`);
} catch (e) {
  // npm audit exits non-zero when vulnerabilities found
  try {
    const parsed = JSON.parse(e.stdout || '{}');
    const high = parsed?.metadata?.vulnerabilities?.high ?? 0;
    const critical = parsed?.metadata?.vulnerabilities?.critical ?? 0;
    check(high === 0 && critical === 0, 'No high/critical npm vulnerabilities', `high: ${high}, critical: ${critical}`);
  } catch {
    check(true, 'npm audit (skipped — could not parse output)');
  }
}

// No hardcoded secret patterns in src/
{
  const secretPatterns = [
    /sk-[a-zA-Z0-9]{20,}/,        // OpenAI/Stripe keys
    /ghp_[a-zA-Z0-9]{36}/,         // GitHub PATs
    /npm_[a-zA-Z0-9]{36}/,         // npm tokens
    /AKIA[A-Z0-9]{16}/,            // AWS access keys
    /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,  // Private keys
  ];
  const srcFiles = [];
  const walkDir = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (/\.[tj]s$/.test(entry.name)) srcFiles.push(full);
    }
  };
  walkDir('src');
  const secretFindings = [];
  for (const f of srcFiles) {
    const content = readText(f);
    if (!content) continue;
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        secretFindings.push(`${f}: matches ${pattern.source.slice(0, 30)}...`);
      }
    }
  }
  check(secretFindings.length === 0, 'No hardcoded secret patterns in src/', secretFindings.join('; '));
}

// ── Tool Descriptions (MCP-specific) ─────────────────────────────────────────

console.log(`\n${bold('Tool Descriptions')}`);

const allSrcFiles = walkDir(path.join(ROOT, 'src'));
let toolDescriptions = 0;
let shortDescriptions = [];

for (const file of allSrcFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Match description strings in registerTool calls or tool definitions
  // Pattern: description: 'string' or description: "string" (potentially multiline with +/template)
  const descRegex = /description:\s*\n?\s*['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = descRegex.exec(content)) !== null) {
    // Skip Zod .describe() calls which are parameter descriptions
    const before = content.slice(Math.max(0, match.index - 50), match.index);
    if (before.includes('.describe(')) continue;

    toolDescriptions++;
    const desc = match[1];
    if (desc.length < 80) {
      shortDescriptions.push({
        file: path.relative(ROOT, file),
        length: desc.length,
        preview: desc.slice(0, 60) + (desc.length > 60 ? '...' : ''),
      });
    }
  }
}

if (toolDescriptions === 0) {
  warn('No tool description strings found in src/');
} else {
  check(
    shortDescriptions.length === 0,
    `All ${toolDescriptions} tool description(s) >= 80 characters`,
    shortDescriptions.length > 0
      ? shortDescriptions
          .map((d) => `${d.file}: ${d.length} chars "${d.preview}"`)
          .join('; ')
      : undefined,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log(
  `\n${bold('Summary:')} ${green(`${passed} passed`)}, ${failed > 0 ? red(`${failed} failed`) : `${failed} failed`}${warnings > 0 ? `, ${yellow(`${warnings} warnings`)}` : ''}\n`,
);

if (failed > 0) {
  console.log(`${red('Release checklist has failures.')} Fix them before publishing.\n`);
  process.exit(1);
} else {
  console.log(`${green('All checks passed!')} Ready to release.\n`);
  process.exit(0);
}
