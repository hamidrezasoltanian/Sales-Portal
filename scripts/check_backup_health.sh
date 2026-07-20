#!/usr/bin/env bash
# Click CRM — backup health monitor (cron-independent, hourly recommended)
#
# Checks newest scheduled_ / full_ / appdata_ files:
#   • age vs threshold
#   • size vs minimum (detect silent corrupt/tiny dumps)
#
# Alerts via Telegram when BACKUP_ALERT_CHAT_ID + TELEGRAM_BOT_TOKEN are set.
# State file avoids repeat alerts until issue clears (sends recovery OK once).
#
# Usage:
#   ./scripts/check_backup_health.sh           # check + alert if needed
#   ./scripts/check_backup_health.sh --dry-run # print only, no Telegram
#
# Cron (installed by setup-backup-cron.sh):
#   15 * * * * .../check_backup_health.sh >> ~/db_backups/health.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
BACKUP_DIR="${BACKUP_DIR:-${HOME}/db_backups}"
STATE_FILE="${BACKUP_DIR}/.health_alert_state"
LOG_PREFIX="[backup-health $(date '+%Y-%m-%d %H:%M:%S')]"

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Thresholds (override via env)
THRESHOLD_SCHEDULED_H="${BACKUP_MAX_AGE_SCHEDULED_H:-8}"
THRESHOLD_FULL_H="${BACKUP_MAX_AGE_FULL_H:-26}"
THRESHOLD_APPDATA_M="${BACKUP_MAX_AGE_APPDATA_M:-30}"

MIN_SIZE_SCHEDULED="${BACKUP_MIN_SIZE_SCHEDULED:-10485760}"   # 10 MB
MIN_SIZE_FULL="${BACKUP_MIN_SIZE_FULL:-104857600}"             # 100 MB
MIN_SIZE_APPDATA="${BACKUP_MIN_SIZE_APPDATA:-512}"             # 512 B

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
mkdir -p "$BACKUP_DIR"

newest_file() {
  local prefix="$1"
  ls -t "$BACKUP_DIR"/${prefix}_*.sql.gz 2>/dev/null | head -1 || true
}

file_age_seconds() {
  local f="$1"
  local now mt
  now=$(date +%s)
  if stat -c %Y "$f" >/dev/null 2>&1; then
    mt=$(stat -c %Y "$f")
  else
    mt=$(stat -f %m "$f")
  fi
  echo $(( now - mt ))
}

human_age() {
  local sec="$1"
  if (( sec < 3600 )); then
    echo "$(( sec / 60 ))m"
  elif (( sec < 86400 )); then
    echo "$(( sec / 3600 ))h"
  else
    echo "$(( sec / 86400 ))d"
  fi
}

human_size() {
  local n="$1"
  if (( n >= 1073741824 )); then
    awk "BEGIN { printf \"%.1f GB\", $n/1073741824 }"
  elif (( n >= 1048576 )); then
    awk "BEGIN { printf \"%.1f MB\", $n/1048576 }"
  elif (( n >= 1024 )); then
    awk "BEGIN { printf \"%.1f KB\", $n/1024 }"
  else
    echo "${n} B"
  fi
}

check_one() {
  local kind="$1"
  local max_age_sec="$2"
  local min_bytes="$3"
  local prefix="$kind"

  local f age size issues=()
  f=$(newest_file "$prefix")

  if [[ -z "$f" ]]; then
    issues+=("missing")
    echo "${kind}|FAIL|missing|0|0|none"
    return
  fi

  age=$(file_age_seconds "$f")
  size=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f")
  local base
  base=$(basename "$f")

  if (( age > max_age_sec )); then
    issues+=("stale")
  fi
  if (( size < min_bytes )); then
    issues+=("small")
  fi

  if ((${#issues[@]})); then
    echo "${kind}|FAIL|${issues[*]}|${age}|${size}|${base}"
  else
    echo "${kind}|OK||${age}|${size}|${base}"
  fi
}

send_telegram() {
  local text="$1"
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${BACKUP_ALERT_CHAT_ID:-}" ]]; then
    echo "$LOG_PREFIX Telegram skip (set TELEGRAM_BOT_TOKEN + BACKUP_ALERT_CHAT_ID in .env)"
    return 1
  fi
  if $DRY_RUN; then
    echo "$LOG_PREFIX [dry-run] Telegram: $text"
    return 0
  fi
  local resp
  resp=$(curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c "
import json, sys
print(json.dumps({
  'chat_id': sys.argv[1],
  'text': sys.argv[2],
  'parse_mode': 'HTML',
  'disable_web_page_preview': True,
}, ensure_ascii=False))" "$BACKUP_ALERT_CHAT_ID" "$text")" 2>&1) || {
    echo "$LOG_PREFIX Telegram send failed: $resp"
    return 1
  }
  echo "$LOG_PREFIX Telegram sent"
}

read_state() {
  if [[ -f "$STATE_FILE" ]]; then
    cat "$STATE_FILE"
  fi
}

write_state() {
  echo "$1" > "$STATE_FILE"
}

# ── Run checks ─────────────────────────────────────────────────────────────
sched_sec=$(( THRESHOLD_SCHEDULED_H * 3600 ))
full_sec=$(( THRESHOLD_FULL_H * 3600 ))
app_sec=$(( THRESHOLD_APPDATA_M * 60 ))

R_SCHED=$(check_one scheduled "$sched_sec" "$MIN_SIZE_SCHEDULED")
R_FULL=$(check_one full "$full_sec" "$MIN_SIZE_FULL")
R_APP=$(check_one appdata "$app_sec" "$MIN_SIZE_APPDATA")

failures=()
recovery=false
prev_state=""
prev_state=$(read_state || true)

report_lines=()
for row in "$R_SCHED" "$R_FULL" "$R_APP"; do
  IFS='|' read -r kind status issues age size fname <<< "$row"
  if [[ "$status" == "FAIL" ]]; then
    failures+=("$kind:$issues:$fname")
    if [[ "$issues" == *"stale"* ]]; then
      report_lines+=("❌ <b>${kind}</b>: قدیمی (${issues}) — $(human_age "$age") — ${fname}")
    elif [[ "$issues" == *"small"* ]]; then
      report_lines+=("❌ <b>${kind}</b>: حجم مشکوک (${issues}) — $(human_size "$size") — ${fname}")
    elif [[ "$issues" == *"missing"* ]]; then
      report_lines+=("❌ <b>${kind}</b>: فایلی یافت نشد")
    else
      report_lines+=("❌ <b>${kind}</b>: ${issues} — ${fname}")
    fi
  else
    report_lines+=("✅ <b>${kind}</b>: OK — $(human_age "$age") — $(human_size "$size") — ${fname}")
  fi
  echo "$LOG_PREFIX $kind status=$status age=${age}s size=$size file=${fname:-none} issues=${issues:-ok}"
done

# Build state fingerprint
new_fingerprint=""
if ((${#failures[@]})); then
  new_fingerprint=$(printf '%s;' "${failures[@]}")
fi

if ((${#failures[@]})); then
  if [[ "$new_fingerprint" != "$prev_state" ]]; then
    msg="⚠️ <b>Click CRM — هشدار بک‌آپ</b>
$(printf '%s\n' "${report_lines[@]}")
📁 ${BACKUP_DIR}
🕐 $(date '+%Y-%m-%d %H:%M %Z')"
    send_telegram "$msg" || true
    write_state "$new_fingerprint"
  else
    echo "$LOG_PREFIX failures unchanged — alert suppressed"
  fi
else
  if [[ -n "$prev_state" ]]; then
    msg="✅ <b>Click CRM — بک‌آپ دوباره سالم است</b>
$(printf '%s\n' "${report_lines[@]}")
📁 ${BACKUP_DIR}"
    send_telegram "$msg" || true
    write_state ""
  fi
  echo "$LOG_PREFIX all checks OK"
fi

exit 0
