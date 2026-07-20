#!/bin/bash
# Install unified cron entries for Click CRM backups (OS-level, independent of Node/PM2)
#
# Schedule:
#   appdata   — every 10 minutes (lightweight app_data table)
#   scheduled — 11:00, 13:00, 18:00 (full pg_dump, ~140MB)
#   full      — 03:00 daily (full pg_dump archive, ~1.4GB)
#   health    — hourly at :15 (age + size checks → Telegram)
#   verify    — Sunday 04:30 (restore test into temp DB → Telegram)
#
# Run once on production:
#   cd /home/hamidreza/Click\ Pro && ./scripts/setup-backup-cron.sh
#
# After install, set in .env:
#   AUTO_BACKUP_SCHEDULER=false   (Node must NOT duplicate scheduled runs)
#   TELEGRAM_BOT_TOKEN=...
#   BACKUP_ALERT_CHAT_ID=...

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="$SCRIPT_DIR/backup_db.sh"
HEALTH_SCRIPT="$SCRIPT_DIR/check_backup_health.sh"
VERIFY_SCRIPT="$SCRIPT_DIR/verify_backup_restore.sh"
LOG_DIR="${HOME}/db_backups"
mkdir -p "$LOG_DIR"
chmod +x "$BACKUP_SCRIPT" "$HEALTH_SCRIPT" "$VERIFY_SCRIPT" 2>/dev/null || true

MARKER="# click-crm-backup-v2"
CRON_LINES=(
  "*/10 * * * * $BACKUP_SCRIPT appdata >> $LOG_DIR/backup.log 2>&1"
  "0 11 * * * $BACKUP_SCRIPT scheduled >> $LOG_DIR/backup.log 2>&1"
  "0 13 * * * $BACKUP_SCRIPT scheduled >> $LOG_DIR/backup.log 2>&1"
  "0 18 * * * $BACKUP_SCRIPT scheduled >> $LOG_DIR/backup.log 2>&1"
  "0 3 * * * $BACKUP_SCRIPT full >> $LOG_DIR/backup.log 2>&1"
  "15 * * * * $HEALTH_SCRIPT >> $LOG_DIR/health.log 2>&1"
  "30 4 * * 0 $VERIFY_SCRIPT >> $LOG_DIR/verify.log 2>&1"
)

# Remove old click-crm markers and legacy Sales-Portal backup lines
EXISTING=$(crontab -l 2>/dev/null \
  | grep -v "$MARKER" \
  | grep -v "# click-crm-auto-backup" \
  | grep -v "backup_db.sh scheduled" \
  | grep -v "backup_db.sh appdata" \
  | grep -v "backup_db.sh full" \
  | grep -v "check_backup_health.sh" \
  | grep -v "verify_backup_restore.sh" \
  | grep -v "Sales-Portal/scripts/backup_db.sh" \
  || true)

{
  echo "$EXISTING"
  echo "$MARKER"
  for line in "${CRON_LINES[@]}"; do echo "$line"; done
} | crontab -

echo "✅ Unified backup cron installed (Click Pro paths)"
echo ""
echo "   appdata:    every 10 min"
echo "   scheduled:  11:00, 13:00, 18:00"
echo "   full:       03:00 daily"
echo "   health:     hourly :15 → $LOG_DIR/health.log"
echo "   verify:     Sun 04:30 → $LOG_DIR/verify.log"
echo ""
echo "   Scripts: $BACKUP_SCRIPT"
echo ""
echo "⚠️  Set in .env:"
echo "   AUTO_BACKUP_SCHEDULER=false"
echo "   TELEGRAM_BOT_TOKEN=..."
echo "   BACKUP_ALERT_CHAT_ID=...   (your Telegram chat id)"
echo ""
echo "Node on-demand backup (Settings → بکاپ کامل الان) still works via /api/backups/run"
