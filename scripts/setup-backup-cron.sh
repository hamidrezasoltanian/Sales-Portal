#!/bin/bash
# Install cron entries for 3× daily DB backups (Tehran server local time)
# Run once on production: ./scripts/setup-backup-cron.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_db.sh"
LOG_DIR="${HOME}/db_backups"
mkdir -p "$LOG_DIR"

MARKER="# click-crm-auto-backup"
CRON_LINES=(
  "0 11 * * * $BACKUP_SCRIPT scheduled >> $LOG_DIR/backup.log 2>&1"
  "0 13 * * * $BACKUP_SCRIPT scheduled >> $LOG_DIR/backup.log 2>&1"
  "0 18 * * * $BACKUP_SCRIPT scheduled >> $LOG_DIR/backup.log 2>&1"
)

EXISTING=$(crontab -l 2>/dev/null | grep -v "$MARKER" | grep -v "backup_db.sh scheduled" || true)
{
  echo "$EXISTING"
  echo "$MARKER"
  for line in "${CRON_LINES[@]}"; do echo "$line"; done
} | crontab -

echo "✅ Cron installed — backups at 11:00, 13:00, 18:00 (server local time)"
echo "   Log: $LOG_DIR/backup.log"
echo "   Script: $BACKUP_SCRIPT scheduled"
echo ""
echo "Note: Node server also runs auto-backup via server/lib/auto-backup.js (Asia/Tehran)."
echo "Use AUTO_BACKUP_ENABLED=false in .env if you prefer cron-only."
