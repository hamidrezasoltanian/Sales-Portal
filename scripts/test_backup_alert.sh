#!/usr/bin/env bash
# Send a one-time test message to verify BACKUP_ALERT_CHAT_ID + TELEGRAM_BOT_TOKEN
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set +u
  while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    export "$line" 2>/dev/null || true
  done < <(grep -v '^#' "$ENV_FILE" | grep -v '^\s*$')
  set -u
fi
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${BACKUP_ALERT_CHAT_ID:-}" ]]; then
  echo "Set TELEGRAM_BOT_TOKEN and BACKUP_ALERT_CHAT_ID in .env"
  exit 1
fi
TEXT="🧪 <b>Click CRM — تست هشدار بک‌آپ</b>
اگر این پیام را می‌بینید، health-check آماده است."
curl -sf -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H 'Content-Type: application/json' \
  -d "$(python3 -c "import json,sys; print(json.dumps({'chat_id':sys.argv[1],'text':sys.argv[2],'parse_mode':'HTML'},ensure_ascii=False))" "$BACKUP_ALERT_CHAT_ID" "$TEXT")"
echo "✅ Test message sent to chat $BACKUP_ALERT_CHAT_ID"
