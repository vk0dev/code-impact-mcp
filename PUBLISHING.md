# Publishing Playbook

How to release updates and manage marketplace presence for `@vk0/code-impact-mcp`.
This document is for **any agent** (Claude Code, OpenClaw, Cursor, Cline, or manual) — not tied to a specific tool.

---

## Releasing an update (v1.1, v2.0, etc.)

### What you do

```bash
# 1. Version bump — sync in 4 places:
#    package.json, .claude-plugin/plugin.json, server.json, src/createServer.ts
#    Or use: node scripts/version-sync.mjs X.Y.Z

# 2. Update CHANGELOG.md with new entry

# 3. Verify
npm run build && npm test && npm run lint && npm run smoke

# 4. Commit + tag + push
git add -A
git commit -m "chore: release vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin main --follow-tags
```

### What happens automatically

| Platform | Mechanism | Delay |
|----------|-----------|-------|
| **npm** | CI `publish.yml` triggered by tag `v*` | ~1 min |
| **GitHub Release** | CI `softprops/action-gh-release` | ~1 min |
| **GitHub Pages** | CI `pages.yml` on push to main | ~2 min |
| **Official MCP Registry** | CI `publish.yml` step (after npm publish) | ~1 min |
| **Smithery** | CI `publish.yml` step (after npm publish) | ~1 min |
| **Glama.ai** | Auto-scraping npm by keyword `mcp-server` | 24-48h |
| **MseeP / MCPServers.org** | Auto-scraping npm | 24-48h |
| **PulseMCP** | Auto-ingests from Official MCP Registry | 1-7 days |

All platforms update automatically on `git push --follow-tags`. No manual steps needed.

---

## Version sync locations

When bumping version, update ALL of these:

1. `package.json` → `"version": "X.Y.Z"`
2. `.claude-plugin/plugin.json` → `"version": "X.Y.Z"`
3. `server.json` → `"version": "X.Y.Z"` (two places: root + packages[0])
4. `src/createServer.ts` → `version: 'X.Y.Z'`

Or use the automated script: `node scripts/version-sync.mjs X.Y.Z`

---

## Credentials

| Credential | Location | Used for |
|------------|----------|----------|
| npm token | `~/.npmrc` + GitHub secret `NPM_TOKEN` | npm publish via CI |
| Smithery API Key | GitHub secret `SMITHERY_API_KEY` | Smithery publish via CI |
| GitHub OAuth | `gh auth` (keyring) | `mcp-publisher`, `gh` CLI |
