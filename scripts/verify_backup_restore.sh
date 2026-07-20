#!/usr/bin/env bash
# Click CRM — weekly restoreability test (optional cron, Sunday 04:30)
#
# Restores latest scheduled_*.sql.gz into a temp DB and compares row counts
# with production for critical tables. Alerts via Telegram on failure.
#
# Usage:
#   ./scripts/verify_backup_restore.sh
#   ./scripts/verify_backup_restore.sh --dry-run
#
# Requires: psql, createdb, dropdb, enough disk/RAM for ~140MB compressed dump

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
BACKUP_DIR="${BACKUP_DIR:-${HOME}/db_backups}"
TEST_DB="${BACKUP_RESTORE_TEST_DB:-atena_crm_restore_test}"
LOG_PREFIX="[backup-verify $(date '+%Y-%m-%d %H:%M:%S')]"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    set +u
    while IFS= read -r line; do
      [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
      line="${line//\'/}"
      export "$line" 2>/dev/null || true
    done < <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
    set -u
  fi
}

load_env

DB_HOST="${PG_HOST:-localhost}"
DB_PORT="${PG_PORT:-5432}"
DB_NAME="${PG_DATABASE:-atena_crm}"
DB_USER="${PG_USER:-postgres}"
export PGPASSWORD="${PG_PASSWORD:-}"

send_telegram() {
  local text="$1"
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${BACKUP_ALERT_CHAT_ID:-}" ]]; then
    echo "$LOG_PREFIX Telegram skip"
    return 1
  fi
  if $DRY_RUN; then
    echo "$LOG_PREFIX [dry-run] $text"
    return 0
  fi
  curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c "
import json, sys
print(json.dumps({'chat_id': sys.argv[1], 'text': sys.argv[2], 'parse_mode': 'HTML'}, ensure_ascii=False))" \
      "$BACKUP_ALERT_CHAT_ID" "$text")" >/dev/null || return 1
  echo "$LOG_PREFIX Telegram sent"
}

count_table() {
  local db="$1"
  local tbl="$2"
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$db" -t -A -c "SELECT COUNT(*) FROM ${tbl}" 2>/dev/null || echo "ERR"
}

latest=$(ls -t "$BACKUP_DIR"/scheduled_*.sql.gz 2>/dev/null | head -1 || true)
if [[ -z "$latest" ]]; then
  echo "$LOG_PREFIX no scheduled backup found"
  send_telegram "🔴 <b>Click CRM — تست restore</b>: فایل scheduled یافت نشد" || true
  exit 1
fi

echo "$LOG_PREFIX using $(basename "$latest")"

if $DRY_RUN; then
  echo "$LOG_PREFIX dry-run — would restore to $TEST_DB"
  exit 0
fi

dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$TEST_DB" 2>/dev/null || true
createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$TEST_DB"

if ! gunzip -c "$latest" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$TEST_DB" -v ON_ERROR_STOP=1 -q; then
  dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$TEST_DB" 2>/dev/null || true
  send_telegram "🔴 <b>Click CRM — تست restore شکست خورد</b>
فایل: $(basename "$latest")
خطا در pg_restore/psql" || true
  exit 1
fi

TABLES=(center_edits week_entries tasks app_data)
mismatches=()
report=""

for tbl in "${TABLES[@]}"; do
  prod=$(count_table "$DB_NAME" "$tbl")
  test=$(count_table "$TEST_DB" "$tbl")
  if [[ "$prod" == "ERR" || "$test" == "ERR" ]]; then
    mismatches+=("$tbl: query error")
    report+="⚠️ ${tbl}: query error\n"
  elif [[ "$prod" != "$test" ]]; then
    mismatches+=("$tbl: prod=$prod test=$test")
    report+="❌ ${tbl}: prod=${prod} restore=${test}\n"
  else
    report+="✅ ${tbl}: ${prod}\n"
  fi
  echo "$LOG_PREFIX $tbl prod=$prod test=$test"
done

dropdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" --if-exists "$TEST_DB" 2>/dev/null || true

if ((${#mismatches[@]})); then
  send_telegram "🔴 <b>Click CRM — تست restore: ناهماهنگی</b>
$(echo -e "$report")
📁 $(basename "$latest")" || true
  exit 1
fi

send_telegram "✅ <b>Click CRM — تست restore موفق</b>
$(echo -e "$report")
📁 $(basename "$latest")" || true
echo "$LOG_PREFIX OK"
exit 0
