#!/usr/bin/env bash
# Run on the host as root: pulls, builds, reloads. First-time setup is in deploy/README.md.
set -euo pipefail
cd /opt/pinchy-mcp
sudo -H -u pinchy-mcp git pull --ff-only
sudo -H -u pinchy-mcp pnpm install --frozen-lockfile
sudo -H -u pinchy-mcp pnpm build
pm2 startOrReload ecosystem.config.cjs --only pinchy-mcp
pm2 save
curl -fsS http://127.0.0.1:4020/healthz
