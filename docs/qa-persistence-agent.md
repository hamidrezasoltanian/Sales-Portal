# QA Persistence Agent

Automated user-flow tests that verify CRM data **persists after a full reload** and is **not wiped** by partial bulk saves.

## Run

```bash
# Single pass
node tests/qa-persistence-agent.js

# Retry up to 3 rounds (CI default)
npm run test:qa
```

Requires PostgreSQL (same env as `npm test`: `PG_*`, `JWT_SECRET`).

## Flows covered

| Flow | What it simulates |
|------|-------------------|
| Center PATCH | Expert edits center status → another tab saves settings blob → status still there |
| Note add/delete | Add note via API → delete by index → refresh confirms empty |
| Activity log | POST call log → PUT /db without `callLog` → entry still in GET /db |
| Concurrent logs | Two users append call logs at once → both survive refresh |
| Calendar event | POST event → refresh → DELETE cleanup |
| Checklist | POST checklist row → partial PUT → row survives |
| Week entry | POST week entry → PUT without `weekEntries` → entry still listed |
| Mission log | POST mission → partial PUT → survives refresh |
| Tags | PUT global tags → PATCH center tags → survives partial PUT |
| KPI target | POST user/month target → refresh confirms values |

## Residual blob (still via PUT /db)

`settings` (per-key via `patchCrmSetting`), `_mtr` (MTR — untouched)

## Seed for UI/QA

```bash
PG_DATABASE=atena_crm_test npm run seed:qa
```

Creates `center_qa_seed_1` with status/owner/note for browser walkthrough.

## Relationship to behavioral tests

- `tests/behavioral.test.js` — infrastructure (409 conflict, SSE, weekEntries guard, …)
- `tests/qa-persistence-agent.js` — end-user persistence scenarios; runs in CI after behavioral tests

## MTR (مطالبات)

This agent **does not** test MTR sync or Faradis integration — those remain out of scope per product decision.

## For a future manual agent

Use the `computerUse` subagent to walk the UI after deploy:

1. Login as expert → edit center → refresh → verify
2. Week plan drag → mark done → refresh
3. Add note → delete → refresh
4. KPI log call → refresh activity tab

Report failures back into this test file as new automated flows.
