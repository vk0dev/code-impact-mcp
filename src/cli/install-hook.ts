import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BLOCK_START = "# BEGIN code-impact-mcp";
const BLOCK_END = "# END code-impact-mcp";

export function renderHuskyPreCommitSnippet(packageName: string): string {
  return `${BLOCK_START}
npx -y ${packageName} run-hook
${BLOCK_END}`;
}

export type InstallHookResult =
  | { status: "created"; hookPath: string; snippet: string; dryRun?: boolean }
  | { status: "updated"; hookPath: string; snippet: string; dryRun?: boolean }
  | { status: "unchanged"; hookPath: string; snippet: string; dryRun?: boolean }
  | { status: "print-only"; hookPath: string; message: string; snippet: string; dryRun?: boolean }
  | { status: "refused"; hookPath: string; message: string; snippet: string; dryRun?: boolean };

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

function renderHuskyInstallSnippet(packageName: string): string {
  return [
    "mkdir -p .husky",
    "cat > .husky/pre-commit <<'EOF'",
    "#!/usr/bin/env sh",
    "set -eu",
    "",
    renderHuskyPreCommitSnippet(packageName),
    "EOF",
    "chmod +x .husky/pre-commit",
  ].join("\n");
}

export function installHook(projectRoot: string, packageName: string, options: { dryRun?: boolean } = {}): InstallHookResult {
  const huskyDir = join(projectRoot, ".husky");
  const hookPath = join(huskyDir, "pre-commit");
  const snippet = renderHuskyPreCommitSnippet(packageName);

  if (!existsSync(huskyDir) || !statSync(huskyDir).isDirectory()) {
    return {
      status: "print-only",
      hookPath,
      message: `.husky directory not found at ${huskyDir}. Printing a safe snippet instead of scaffolding Husky automatically.`,
      snippet: renderHuskyInstallSnippet(packageName),
      dryRun: options.dryRun,
    };
  }

  if (!existsSync(hookPath)) {
    if (options.dryRun) {
      return { status: "created", hookPath, snippet, dryRun: true };
    }
    writeFileSync(hookPath, `#!/usr/bin/env sh\nset -eu\n\n${snippet}\n`, "utf8");
    chmodSync(hookPath, 0o755);
    return { status: "created", hookPath, snippet };
  }

  const existing = readFileSync(hookPath, "utf8");
  const blockPattern = new RegExp(`${BLOCK_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^]*?${BLOCK_END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);

  let next = existing;
  let status: InstallHookResult["status"] = "updated";

  if (blockPattern.test(existing)) {
    next = existing.replace(blockPattern, snippet);
    status = next === existing ? "unchanged" : "updated";
  } else {
    return {
      status: "refused",
      hookPath,
      message: `Refusing to overwrite existing pre-commit hook at ${hookPath}. The file already contains unrelated content and no managed code-impact-mcp block.`,
      snippet: renderHuskyInstallSnippet(packageName),
      dryRun: options.dryRun,
    };
  }

  if (next !== existing) {
    if (!options.dryRun) {
      writeFileSync(hookPath, next, "utf8");
      chmodSync(hookPath, 0o755);
    }
  }

  return { status, hookPath, snippet, dryRun: options.dryRun };
}
