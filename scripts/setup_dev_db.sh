#!/usr/bin/env bash
# Create isolated dev database from production snapshot (run once on dev machine).
set -euo pipefail

PROD_DB="${PG_DATABASE_PROD:-atena_crm}"
DEV_DB="${PG_DATABASE_DEV:-atena_crm_dev}"
PG_USER="${PG_USER:-postgres}"

echo "Creating dev database: $DEV_DB (copy of $PROD_DB)"

if psql -U "$PG_USER" -lqt | cut -d \| -f 1 | grep -qw "$DEV_DB"; then
  echo "Database $DEV_DB already exists — skipping createdb"
else
  createdb -U "$PG_USER" "$DEV_DB"
fi

echo "Dumping $PROD_DB → $DEV_DB ..."
pg_dump -U "$PG_USER" "$PROD_DB" | psql -U "$PG_USER" "$DEV_DB" > /dev/null

echo ""
echo "Done. Add to your dev .env:"
echo "  PG_DATABASE=$DEV_DB"
echo ""
echo "Never run backend experiments against $PROD_DB in dev."
