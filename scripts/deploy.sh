#!/bin/bash
# Safe deploy: backup → pull → install → test → pm2 reload
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$ROOT"

echo "[deploy] pre-backup (appdata)..."
if [ -x "$SCRIPT_DIR/backup_db.sh" ]; then
  "$SCRIPT_DIR/backup_db.sh" appdata || echo "[deploy] warning: appdata backup failed"
fi

echo "[deploy] git pull..."
git pull origin "$(git branch --show-current)"

echo "[deploy] npm ci..."
npm ci

echo "[deploy] syntax check..."
node --check public/js/core.js
node --check public/js/weekplan.js
node --check server/index.js
node --check server/routes/week-entries.js

echo "[deploy] tests..."
npm test

echo "[deploy] pm2 reload..."
if command -v pm2 >/dev/null 2>&1; then
  pm2 reload sales-portal || pm2 restart sales-portal
else
  echo "[deploy] pm2 not found — start manually: node server/index.js"
fi

echo "[deploy] done ✓"
