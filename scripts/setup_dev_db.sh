#!/bin/bash
# One-shot: create isolated dev DB from production snapshot
set -euo pipefail

PG_USER="${PGUSER:-postgres}"
PROD_DB="${PG_DATABASE_PROD:-atena_crm}"
DEV_DB="${PG_DATABASE_DEV:-atena_crm_dev}"

echo "=== Click CRM — setup dev database ==="
echo "source: $PROD_DB → target: $DEV_DB"

if psql -U "$PG_USER" -lqt | cut -d \| -f 1 | grep -qw "$DEV_DB"; then
  echo "[skip] database $DEV_DB already exists"
  read -r -p "Drop and recreate? [y/N] " ans
  if [[ "${ans:-}" =~ ^[Yy]$ ]]; then
    dropdb -U "$PG_USER" "$DEV_DB"
  else
    echo "done (no changes)"
    exit 0
  fi
fi

createdb -U "$PG_USER" "$DEV_DB"
echo "[dump] copying from $PROD_DB..."
pg_dump -U "$PG_USER" "$PROD_DB" | psql -U "$PG_USER" -q "$DEV_DB"

echo ""
echo "✅ Dev DB ready: $DEV_DB"
echo "Copy .env.dev.example → .env and set PG_DATABASE=$DEV_DB"
