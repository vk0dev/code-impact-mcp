import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BLOCK_START = "# BEGIN code-impact-mcp";
const BLOCK_END = "# END code-impact-mcp";

export function renderHuskyPreCommitSnippet(packageName: string): string {
  return `${BLOCK_START}
npx -y ${packageName} run-hook
${BLOCK_END}`;
}

export type InstallHookResult =
  | { status: "created"; hookPath: string; snippet: string }
  | { status: "updated"; hookPath: string; snippet: string }
  | { status: "unchanged"; hookPath: string; snippet: string }
  | { status: "missing-infra"; hookPath: string; message: string };

function ensureTrailingNewline(text: string): string {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export function installHook(projectRoot: string, packageName: string): InstallHookResult {
  const huskyDir = join(projectRoot, ".husky");
  const hookPath = join(huskyDir, "pre-commit");
  const snippet = renderHuskyPreCommitSnippet(packageName);

  if (!existsSync(huskyDir) || !statSync(huskyDir).isDirectory()) {
    return {
      status: "missing-infra",
      hookPath,
      message: ` .husky directory not found at ${huskyDir}. Initialize Husky first, then rerun install-hook.`,
    };
  }

  if (!existsSync(hookPath)) {
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
    next = `${ensureTrailingNewline(existing)}\n${snippet}\n`;
    status = "updated";
  }

  if (next !== existing) {
    writeFileSync(hookPath, next, "utf8");
    chmodSync(hookPath, 0o755);
  }

  return { status, hookPath, snippet };
}
