#!/usr/bin/env bash
# Click CRM runtime health monitor. Sends one Telegram alert per changed failure
# state and one recovery notification when service health returns.
set -u

APP_DIR="/home/hamidreza/Click Pro"
ENV_FILE="$APP_DIR/.env"
LOG_FILE="$APP_DIR/logs/health-monitor.log"
STATE_FILE="/home/hamidreza/db_backups/.runtime_health_alert_state"
DRY_RUN=false
[ "${1:-}" = "--dry-run" ] && DRY_RUN=true

load_env() {
  [ -f "$ENV_FILE" ] || return
  set +u
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    line="${line//\'/}"
    export "$line" 2>/dev/null || true
  done < <(grep -v '^#' "$ENV_FILE" | grep -v '^[[:space:]]*$')
  set -u
}
send_telegram() {
  local message="$1"
  if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${BACKUP_ALERT_CHAT_ID:-}" ]; then
    printf '%s Telegram=not-configured\n' "$(date -Is)" >> "$LOG_FILE"
    return 1
  fi
  if $DRY_RUN; then
    printf '%s Telegram=dry-run message=%s\n' "$(date -Is)" "$message" >> "$LOG_FILE"
    return 0
  fi
  curl -fsS --max-time 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    -H 'Content-Type: application/json' \
    -d "$(python3 -c "import json,sys; print(json.dumps({'chat_id':sys.argv[1],'text':sys.argv[2],'parse_mode':'HTML'},ensure_ascii=False))" "$BACKUP_ALERT_CHAT_ID" "$message")" >/dev/null
}

load_env
now=$(date -Is)
health=$(curl -fsS --max-time 8 http://127.0.0.1:4000/api/health 2>/dev/null || true)
if printf '%s' "$health" | grep -q '"ok":true'; then app=ok; else app=fail; fi
latest=$(find /home/hamidreza/db_backups -maxdepth 1 -type f -name 'scheduled_*.sql.gz' -printf '%T@ %p\n' 2>/dev/null | sort -nr | head -1)
if [ -n "$latest" ]; then age=$(( $(date +%s) - ${latest%%.*} )); else age=-1; fi
if [ "$age" -ge 0 ] && [ "$age" -le 93600 ]; then backup=ok; else backup=stale; fi
disk=$(df -P / | awk 'NR==2 {gsub("%", "", $5); print $5}')
if [ "$disk" -lt 90 ]; then disk_status=ok; else disk_status=high; fi
if [ "${HEALTH_MONITOR_FORCE_FAIL:-0}" = "1" ]; then app=fail; fi
printf '%s app=%s backup=%s backup_age_s=%s disk_used_pct=%s disk=%s\n' "$now" "$app" "$backup" "$age" "$disk" "$disk_status" >> "$LOG_FILE"

fingerprint="app=$app backup=$backup disk=$disk_status"
previous=$(cat "$STATE_FILE" 2>/dev/null || true)
if [ "$app" = ok ] && [ "$backup" = ok ] && [ "$disk_status" = ok ]; then
  if [ -n "$previous" ]; then
    send_telegram '✅ <b>Click CRM — سلامت سرویس بازیابی شد</b>' || true
    : > "$STATE_FILE"
  fi
  exit 0
fi
if [ "$fingerprint" != "$previous" ]; then
  message="⚠️ <b>Click CRM — هشدار سلامت</b>\nسرویس: ${app}\nبکاپ زمان‌بندی‌شده: ${backup}\nدیسک: ${disk}% (${disk_status})\nزمان: ${now}"
  send_telegram "$message" || true
  printf '%s' "$fingerprint" > "$STATE_FILE"
fi
exit 1
