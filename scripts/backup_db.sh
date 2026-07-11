#!/bin/bash
# Click CRM — Database backup
#
# Modes:
#   scheduled  — full pg_dump (3× daily: 11:00, 13:00, 18:00 Tehran) — PRIMARY
#   full       — full pg_dump (manual / legacy daily)
#   appdata    — app_data table only (lightweight manual backup)
#
# Retention: 30 days (BACKUP_RETENTION_DAYS env, default 30)
#
# Cron (alternative to Node auto-scheduler in server/lib/auto-backup.js):
#   0 11 * * * /path/to/scripts/backup_db.sh scheduled >> ~/db_backups/backup.log 2>&1
#   0 13 * * * /path/to/scripts/backup_db.sh scheduled >> ~/db_backups/backup.log 2>&1
#   0 18 * * * /path/to/scripts/backup_db.sh scheduled >> ~/db_backups/backup.log 2>&1
#
# Or run: ./scripts/setup-backup-cron.sh

set -euo pipefail

MODE="${1:-scheduled}"  # scheduled | full | appdata

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
BACKUP_DIR="${BACKUP_DIR:-${HOME}/db_backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# Load .env
if [ -f "$ENV_FILE" ]; then
  set +u
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    line="${line//\'/}"
    export "$line" 2>/dev/null || true
  done < <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
  set -u
fi

DB_HOST="${PG_HOST:-localhost}"
DB_PORT="${PG_PORT:-5432}"
DB_NAME="${PG_DATABASE:-atena_crm}"
DB_USER="${PG_USER:-postgres}"
export PGPASSWORD="${PG_PASSWORD:-}"

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

cleanup_old() {
  local pattern="$1"
  find "$BACKUP_DIR" -name "$pattern" -mtime +"$RETENTION_DAYS" -delete 2>/dev/null || true
}

if [ "$MODE" = "appdata" ]; then
  FILE="$BACKUP_DIR/appdata_${TIMESTAMP}.sql"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" \
    --table=app_data \
    --data-only --column-inserts \
    > "$FILE"
  gzip "$FILE"
  FILE="${FILE}.gz"
  cleanup_old "appdata_*.sql.gz"

elif [ "$MODE" = "full" ] || [ "$MODE" = "scheduled" ]; then
  PREFIX="scheduled"
  [ "$MODE" = "full" ] && PREFIX="full"
  FILE="$BACKUP_DIR/${PREFIX}_${TIMESTAMP}.sql.gz"
  pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
  cleanup_old "${PREFIX}_*.sql.gz"
  # Also prune the other full-type backups
  cleanup_old "scheduled_*.sql.gz"
  cleanup_old "full_*.sql.gz"

else
  echo "Unknown mode: $MODE (use scheduled | full | appdata)" >&2
  exit 1
fi

SIZE=$(du -sh "$FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ ${MODE} backup: $FILE ($SIZE)"

COUNT_SCHED=$(find "$BACKUP_DIR" -name "scheduled_*.sql.gz" 2>/dev/null | wc -l)
COUNT_FULL=$(find "$BACKUP_DIR" -name "full_*.sql.gz" 2>/dev/null | wc -l)
COUNT_APP=$(find "$BACKUP_DIR" -name "appdata_*.sql.gz" 2>/dev/null | wc -l)
TOTAL=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📦 scheduled: ${COUNT_SCHED} | full: ${COUNT_FULL} | appdata: ${COUNT_APP} | total: ${TOTAL} | retention: ${RETENTION_DAYS}d"
