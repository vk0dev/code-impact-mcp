import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function renderHuskyPreCommitSnippet(packageName: string): string {
  return `#!/usr/bin/env sh
set -eu

npx -y ${packageName} run-hook
`;
}

export type InstallHookResult =
  | { status: "created"; hookPath: string; snippet: string }
  | { status: "conflict"; hookPath: string; message: string };

export function installHook(projectRoot: string, packageName: string): InstallHookResult {
  const huskyDir = join(projectRoot, ".husky");
  const hookPath = join(huskyDir, "pre-commit");

  if (existsSync(hookPath)) {
    return {
      status: "conflict",
      hookPath,
      message: `Refusing to overwrite existing hook: ${hookPath}`,
    };
  }

  const snippet = renderHuskyPreCommitSnippet(packageName);
  mkdirSync(huskyDir, { recursive: true });
  writeFileSync(hookPath, snippet, "utf8");
  chmodSync(hookPath, 0o755);

  return {
    status: "created",
    hookPath,
    snippet,
  };
}
