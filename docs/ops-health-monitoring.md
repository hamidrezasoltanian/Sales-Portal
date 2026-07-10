# Health monitoring — Click CRM

## Endpoint

`GET /api/health` — no auth required

Returns `checks.postgres.ok`, Faradis status, cache counts.

## Recommended setup

1. **UptimeRobot / similar** — ping every 5 minutes
2. **Alert** when HTTP status ≠ 200 OR `checks.postgres.ok === false`
3. **On server** — run `./scripts/health-check.sh` daily via cron

## Example curl

```bash
curl -sf http://localhost:3000/api/health | jq '.ok, .checks.postgres'
```

## Deploy log

`scripts/deploy.sh` appends to `~/db_backups/deploy.log`
