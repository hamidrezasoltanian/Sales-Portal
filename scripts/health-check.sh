#!/usr/bin/env bash
# health-check.sh — quick ops dashboard for Click CRM
set -euo pipefail

PG_USER="${PGUSER:-postgres}"
PG_DB="${PG_DATABASE:-atena_crm}"
BACKUP_DIR="${HOME}/db_backups"
API_URL="${HEALTH_URL:-http://localhost:3000/api/health}"

echo "=== Click CRM Health Check ==="
echo "time: $(date -Iseconds)"
echo

# PostgreSQL
if command -v psql >/dev/null 2>&1; then
  if psql -U "$PG_USER" -d "$PG_DB" -c 'SELECT 1' >/dev/null 2>&1; then
    echo "[OK] PostgreSQL ($PG_DB)"
    psql -U "$PG_USER" -d "$PG_DB" -t -c \
      "SELECT '  week_entries: ' || COUNT(*) FROM week_entries UNION ALL
       SELECT '  center_edits: ' || COUNT(*) FROM center_edits UNION ALL
       SELECT '  tasks: ' || COUNT(*) FROM tasks;" 2>/dev/null || true
  else
    echo "[FAIL] PostgreSQL — cannot connect to $PG_DB"
  fi
else
  echo "[SKIP] psql not found"
fi
echo

# Latest backup age (3× daily schedule — warn if > 10 hours)
BACKUP_DIR="${BACKUP_DIR:-${HOME}/db_backups}"
if [ -d "$BACKUP_DIR" ]; then
  latest=$(ls -t "$BACKUP_DIR"/scheduled_*.sql.gz "$BACKUP_DIR"/full_*.sql.gz 2>/dev/null | head -1 || true)
  if [ -n "$latest" ]; then
    age_sec=$(( $(date +%s) - $(stat -c %Y "$latest" 2>/dev/null || stat -f %m "$latest") ))
    age_hr=$(( age_sec / 3600 ))
    echo "[OK] Latest DB backup: $(basename "$latest") (${age_hr}h ago)"
    if [ "$age_hr" -gt 10 ]; then
      echo "[WARN] Backup older than 10 hours (expected 3× daily at 11/13/18)"
    fi
  else
    echo "[WARN] No scheduled/full backups in $BACKUP_DIR"
  fi
else
  echo "[WARN] Backup dir not found: $BACKUP_DIR"
fi
echo

# Disk usage
df -h / 2>/dev/null | tail -1 | awk '{print "[INFO] Disk root: " $3 " used / " $2 " total (" $5 ")"}'
echo

# API health
if command -v curl >/dev/null 2>&1; then
  if curl -sf "$API_URL" >/dev/null 2>&1; then
    echo "[OK] API $API_URL"
    curl -s "$API_URL" 2>/dev/null | head -c 500
    echo
  else
    echo "[FAIL] API not reachable: $API_URL"
  fi
else
  echo "[SKIP] curl not found"
fi

echo
echo "=== done ==="
