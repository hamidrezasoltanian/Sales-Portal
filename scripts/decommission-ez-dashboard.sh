#!/usr/bin/env bash
# Phase 7: stop standalone EZ Dashboard after CRM trade tab is verified.
# Does NOT delete EZ repos or databases.

set -euo pipefail

echo "=== EZ Dashboard decommission (Click CRM trade tab is canonical) ==="

stopped=0

if command -v pm2 >/dev/null 2>&1; then
  for name in ez-dashboard ez_dashboard ez-dashboard-backend ez-dashboard-frontend; do
    if pm2 describe "$name" >/dev/null 2>&1; then
      echo "Stopping PM2 process: $name"
      pm2 stop "$name" || true
      pm2 delete "$name" || true
      stopped=1
    fi
  done
  if [[ "$stopped" -eq 1 ]]; then
    pm2 save || true
  fi
fi

for unit in ez-dashboard ez-dashboard.service; do
  if systemctl list-unit-files "$unit" >/dev/null 2>&1; then
    if systemctl is-active --quiet "$unit" 2>/dev/null; then
      echo "Stopping systemd unit: $unit"
      sudo systemctl stop "$unit" || true
      sudo systemctl disable "$unit" || true
      stopped=1
    fi
  fi
done

# Kill stray node on common EZ port 1001 (non-destructive)
if command -v lsof >/dev/null 2>&1; then
  pids=$(lsof -ti :1001 2>/dev/null || true)
  if [[ -n "${pids:-}" ]]; then
    echo "Found process on port 1001 — review before kill: $pids"
    echo "Run manually if needed: kill $pids"
  fi
fi

if [[ "$stopped" -eq 0 ]]; then
  echo "No EZ Dashboard PM2/systemd service found. Nothing to stop."
else
  echo "EZ services stopped. CRM trade tab: http://localhost:3000 (tab بازرگانی)"
fi

echo ""
echo "EZ SQLite backup (optional):"
echo "  cp ~/App/frontend-ez-dashboard/database/ez_dashboard.db ~/db_backups/ez_dashboard_\$(date +%Y%m%d).db"
echo "Done."
