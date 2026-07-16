# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
It is the single source of truth for an AI to understand the entire app and its future plan — keep it updated after every significant change.

## Project Name

**Click CRM** — Persian-language (RTL, Jalali calendar) CRM for a medical equipment sales team (~5 users).
Vanilla JS frontend + Express/PostgreSQL backend. Vite + TypeScript + Vue 3 scaffold added in `src/` for incremental migration (no build step yet — new components will be compiled to `public/dist/` and loaded alongside existing vanilla JS).

## Running the App

```bash
# Development server (Node.js + PostgreSQL backend)
cd /home/user/Sales-Portal && node server/index.js
# then open http://localhost:3000

# Syntax check after any JS edit (mandatory):
node --check public/js/core.js
node --check public/js/weekplan.js

# Pre-deploy checklist (production):
node scripts/predeploy-check.js
```

## File Structure

```
Sales-Portal/
  public/
    index.html              ← HTML shell: markup, tab buttons, panel divs
    css/app.css             ← all styles (~1,640 lines), indigo design system
    js/
      core.js               ← loadDB, saveDB, savePatchDB, slim PUT payload
      safe-dom.js           ← XSS-safe DOM helpers
      provinces.js, weekplan.js, tasks.js, ...  ← tab modules (~30 files, all loaded by index.html)
      _legacy/
        app.bundle.js       ← archived monolith (NOT served — reference only, has NBSP)
        app.js              ← older single-file snapshot (NOT served)
      proforma.js           ← proforma invoice module (~650 lines)
      modules/              ← organized copies of some modules (reference)
      core/                 ← pure utility modules (no side effects)
        jalali.js           ← Jalali date conversion (g2j, j2g, todayStr, ...)
        helpers.js          ← esc, fNorm, showToast, flashRow
        modal.js            ← openModal, closeModal, showContactPopup
        date-picker.js      ← openJDP, buildJDP
      [other module files]  ← activity.js, calendar.js, center-modal.js, checklist.js,
                              dashboard.js, kpi.js, manager.js, manager-tasks.js,
                              mtr.js, onboarding.js, pricing.js, provinces.js,
                              settings.js, tasks.js, ui-core.js, weekplan.js
    wms.html                ← WMS warehouse app (served at /wms); uses REST endpoints
    sw.js                   ← service worker (CDN caching)
    fonts/                  ← Vazirmatn font files
  src/                      ← Vue 3 + TypeScript (Vite builds → public/dist/)
    main.ts                 ← placeholder entry point
  server/
    index.js                ← Express entry point (port 3000); helmet + compression
    db.js                   ← PostgreSQL pool (pg) + initSchema() for all tables
    auth.js                 ← cookie-session auth
    bot/
      telegram.js           ← Telegram long-polling bot (proforma approve/reject, inventory, QR scan)
    routes/
      auth.js               ← /api/auth  (login/logout)
      data.js               ← /api/data/db  (main DB blob PUT/GET)
      contacts.js           ← /api/contacts/:key
      pricing.js            ← /api/pricing
      audit.js              ← /api/audit  (field change log)
      events.js             ← /api/events (SSE broadcast)
      users.js              ← /api/users
      distribution.js       ← /api/distribution
      ai.js                 ← /api/ai proxy
      discovery.js          ← /api/discovery (biopsy center discovery: list, ai-scan, import-file)
      wms.js                ← /api/wms  (full REST CRUD: products, warehouses, lots, transactions, POs)
      proforma.js           ← /api/proforma  (CRUD + workflow actions, SQL-backed, zod validated)
      tasks.js              ← /api/tasks  (SQL-backed task CRUD)
      week-entries.js       ← /api/week-entries  (SQL-backed week schedule)
      notifications.js      ← /api/notifications  (SQL-backed)
      changelog.js          ← /api/changelog  (SQL-backed)
      migrate.js            ← /api/migrate/blob-to-sql  (one-shot blob→SQL migration)
  scripts/
    discover_centers.py ← CLI scraper (nobat.ir, doctorto.ir, --ai, --enrich modes)
  vite.config.ts        ← Vite 6 config: Vue plugin, src/ → public/dist/, dev proxy → :3000
  tsconfig.json         ← strict ES2022 TypeScript config
  atena_crm_v3_mtr_3.html  ← legacy snapshot of the OLD single-file app (frozen; kept for history)
  CLAUDE.md
```

> History note: the frontend used to be one giant HTML file. It was split into
> `index.html` + `css/app.css` + `js/app.js` (commit `cfc5741`). All new work goes
> into the split files. `atena_crm_v3_mtr_3.html` is a frozen legacy copy.

## ⚠️ Critical Edit Constraint

**Active frontend** is split across `public/js/*.js` modules loaded by `index.html`. Edit the relevant module file directly (`weekplan.js`, `provinces.js`, `core.js`, etc.).

`public/js/_legacy/app.bundle.js` is **archived** (not served) but still contains **non-breaking spaces (`\xa0`)** — if you must edit it, use Python scripts only, never the Edit tool.

**Quote-escaping rule for generated HTML:** most UI is built as JS strings with
`onclick="fn(\''+var+'\')"` patterns. When writing such strings from Python, the
JS source must contain `\\'` (backslash-quote) inside the double-quoted HTML
attribute. Always run `node --check` on edited files after changes.

## Architecture

### Data Layer

| Store | Key / Table | Contents |
|---|---|---|
| PostgreSQL `app_data` | `'main'` | Entire `DB` object as JSON |
| PostgreSQL `app_data` | `'mtr'` | Receivables module data |
| PostgreSQL `center_contacts` | center_key | Legacy single-contact per center |
| PostgreSQL `centers_master` | `'CENTERS'` / `'PC_RAW'` | Master center lists |
| PostgreSQL `proformas` | — | Proforma invoices (proper table, zod validated) |
| PostgreSQL `wms_products` | — | WMS product catalog |
| PostgreSQL `wms_warehouses` | — | WMS warehouses |
| PostgreSQL `wms_counterparties` | — | WMS suppliers / customers |
| PostgreSQL `wms_lots` | — | WMS lot/batch records |
| PostgreSQL `wms_transactions` | — | WMS entry/exit transactions |
| PostgreSQL `wms_purchase_orders` | — | WMS purchase orders (JSONB items) |
| PostgreSQL `wms_recalls` | — | WMS product recalls |
| PostgreSQL `wms_audit_log` | — | WMS immutable audit trail |
| PostgreSQL `wms_settings` | key | WMS key-value config |
| PostgreSQL `wms_fiscal_years` | — | Jalali fiscal years (active/closed) |
| PostgreSQL `wms_opening_balances` | — | Opening qty snapshot per FY/product/warehouse |
| `localStorage` `atena_crm_v2` | — | Client-side cache of `DB` |
| IndexedDB `atenaCRM_master` | — | Master center list cache |

**The primary store is PostgreSQL.** `localStorage` is a fallback/cache.
Routine saves use a **slim PUT** (`saveDB` → `_buildSavePayload`) that omits migrated collections (`edits`, `notes`, `weekEntries`, `tasks`, …). Center fields go through `PATCH /api/centers/:key`; notes through `POST /api/centers/:key/notes`; week plan through `/api/week-entries`; tasks through `/api/tasks`; user settings keys through `PATCH /api/settings/:key`. Residual blob is mainly logs, events, checklist, KPI, and `_mtr`.

The main `DB` object contains:
```
edits, notes, tags, rTags, weekTags, weekEntries, events, checklist,
extra, settings, kpiTargets, callLog, visitLog, salesLog, missionLog,
provHistory, mtrFollower, mtrFollowerMap, changeLog, mtrTrend,
notifications, tasks, kpiHistory
```

Key sub-structures:

| Field | Shape | Notes |
|---|---|---|
| `DB.edits` | `{"{type}_{id}": {status, owner, potential, followupDate, lead, type, address, nameOverride, contacts[], competitor, biopsyScore, biopsyReasons, _ts, ...}}` | per-center overrides; the heart of the CRM |
| `DB.weekEntries` | `{"{weekId}:::{recKey}": {rtype, rid, scheduledDate, actionType:'call'|'visit', done, doneDate, addedBy, centerName, weekTagId}}` | week-plan assignments |
| `DB.tasks` | `[{id, title, owner, dueDate, priority(1-3), status, centerKey, note, subtasks[], done, doneAt, createdBy, createdAt}]` | kanban tasks; `subtasks` is recursive `{id,title,done,subtasks[]}` up to 3 levels |
| `DB.changeLog` | `[{at(ISO), by, rkey, field, val}]` | full field-change history; powers audit, drill-down, activity detection |
| `DB.notifications` | `[{id, to, msg, centerKey, at, read}]` | in-app bell notifications |
| `DB.notes` | `{"{rkey}": [note,...]}` | per-center notes |
| `DB.settings.members` | `[{id, name, role, active, color}]` | user list (managed in Settings) |
| `DB.settings.taskColumns` | `{"{userId}": [{id,label,color}]}` | per-user custom kanban columns (falls back to `_TK_STATUSES`) |

**Reading/writing center fields** goes through `getE(type, id)` / `setE(type, id, field, val)`.
- `type` is `'center'` for Tehran centers, `'pc'` for all other provinces.
- `pc` ids look like `"{provId}||{n}"`; province id = `rid.split('||')[0]`.
- `setE` appends to `DB.changeLog` and triggers `saveDB()` (debounced 300 ms → PUT `/api/data/db`).

**Owner resolution chain** (used everywhere a center's responsible expert is needed — keep all copies consistent):
1. `getE(rtype,id).owner` → 2. static center `owner` (CENTERS / `_PC_CACHE`) → 3. `DB.extra[].owner` → 4. `we.addedBy` (week entries only).
Canonical implementation: `_wpGetOwner(we)` (~line 5996). Inline copies exist in `renderWeekPlan` and `renderWpFullCenterList`.

### Global State Variables

| Variable | Meaning |
|---|---|
| `currentUser` | Active user ID e.g. `'Sarah.hosseini'` |
| `currentTab` | `'provinces'` \| `'weekplan'` \| `'calendar'` \| `'checklist'` \| `'activity'` \| `'kpi'` \| `'tasks'` \| `'changelog'` \| `'manager'` \| `'mtr'` \| `'pricing'` |
| `_currentProvId` | `null` = province list; province ID = centers view |
| `_viewMode` | Centers view: `'list'` \| `'kanban'` \| `'card'` |
| `_provView` | Province list: `'grid'` \| `'list'` \| `'kanban'` |
| `_taskView` / `_taskFilter` | Tasks tab: `'kanban'|'list'` / `'all'|'mine'|'overdue'` |
| `_notifViewAll` | Manager toggle: own vs. everyone's notifications |
| `_wpFclFilters` | `{q, owner, prov}` — week-plan full-center-list filters; `owner` is synced from `#wpOwnerFilter` |

### Main Tabs / Panels

1. **استان‌ها** — Province grid → centers with list/kanban/card views; recommendations widget (P1/P2 only)
2. **برنامه هفته** — 7-day Jalali weekly grid; drag-drop; expert filter (`#wpOwnerFilter`) applies to BOTH the day grid and the full center list below; progress bar; bulk move
3. **تقویم** — Month/week/list Jalali event calendar (also shows followup dates)
4. **چک‌لیست روزانه** — Daily scored checklist
5. **فعالیت‌ها** — Read-only log of calls, visits, sales
6. **KPI** — Manager dashboard (manager-only)
7. **📌 وظایف** — Monday-style kanban tasks (all users): drag-drop columns, per-user custom columns (⚙️ ستون‌ها), 3-level subtasks with inline add/edit, priority, owner, due date, center link
8. **🗃 لاگ تغییرات** — Change log (manager-only)
9. **بررسی مدیر** — Manager panel: summary cards, per-expert table (rows clickable → drill-down), pipeline matrix (potential × status), today summary; overdue numbers clickable → overdue list
10. **مطالبات** — Receivables module (semi-independent, key `'mtr'`)
11. **قیمت‌گذاری** — Pricing module (margin settings gated behind password)

### Initialization

`init()` (~line 8128) called on `DOMContentLoaded`:
1. `loadDB()` — fetch from `/api/data/db`, fall back to localStorage
2. `loadMasterCenters()` — fetch from `/api/data/centers/master` → IndexedDB cache
3. `initSettings()`, `buildUSERS()` (loads members from server → `USERS` map of id→display-name)
4. `switchTab(currentTab)`, `_initNotif()`, `_initOnboarding()`
5. Startup auto-reminders: centers with no followup date or overdue dates notify their experts

### Jalali Calendar

All dates are Persian/Solar Hijri, format `'YYYY/MM/DD'` (string comparison works for ordering):
- `g2j(gy, gm, gd)` → `[jy, jm, jd]` · `j2g(jy, jm, jd)` → `[gy, gm, gd]`
- `todayStr()` → `'YYYY/MM/DD'` · `jMs(jy, jm, jd)` → Unix ms · `p2(n)` → zero-pad
- `DB.changeLog[].at` is ISO Gregorian; convert with `g2j` when comparing to Jalali dates

### Users & Permissions

- Default members: `Sarah.hosseini` (مدیر), `Reyhane.kashisaz`, `Mohammad.seyedsalehi`, `Rambod.ghasemi` (کارشناس فروش), `guest`. Actual list lives in `DB.settings.members`, editable in Settings.
- `_isManager()` — checks `'مدیر'` role · `_isExpert()` — checks `'کارشناس فروش'` role
- Non-managers only see week-plan cards / center lists for centers they own.
- **Access password for pricing margins** — verified server-side via `POST /api/pricing/mgmt/verify`; costs from `GET /api/pricing/costs` (env: `PRICING_ACCESS_PASSWORD` or hash)

### Function Map (app.js, approximate line numbers)

| Line | Function | Purpose |
|---|---|---|
| 122 | `loadDB()` | fetch DB blob, localStorage fallback |
| 138 | `saveDB()` / `saveDBSync()` | debounced / immediate PUT `/api/data/db` |
| 323 | `umGetActive()` | active members list |
| 693 | `buildUSERS()` | build `USERS` id→name map |
| 858/879 | `getE` / `setE` | center field read/write (+changeLog) |
| 999 | `switchTab(tab)` | tab routing — single if/else chain; don't break it |
| ~1646 | `openPreCallBrief(rtype,rid)` | pre-call summary modal (status, last notes, changes, competitor, address) |
| ~1680 | `quickCallLog(rtype,rid,name)` | quick post-call log modal (result dropdown + note + next followup date) |
| ~1690 | `_submitQCL(rtype,rid,modalId)` | submit quickCallLog form → saves note + followupDate |
| ~1720 | `_renderExpertDash(el)` | expert dashboard; first section = ☀️ امروز من (today's week entries) |
| 1753 | `renderDashboard()` | provinces-tab dashboard widgets |
| 1796 | `renderBanner()` | top reminder banner (overdue/today followups) |
| 1907 | `renderTable()` | centers list view inside a province; each row has 🎯 pre-call button |
| 3159 | `openCenterAudit(key,name)` | center timeline modal (changeLog+notes+weekEntries+tasks) |
| 3231 | `openCenterModal(rtype,id)` | center edit modal: status, owner, followup date, competitor field, map button, commission div, 🎯 خلاصه footer button |
| 3839 | `renderWeekPlan()` | 7-day grid; syncs `#wpOwnerFilter` → `_wpFclFilters.owner` |
| 3961 | `renderWpFullCenterList()` | unscheduled queue + all-centers list below the grid |
| 4888 | `sendNotif(to,msg,centerKey)` | push in-app notification |
| 4913 | `toggleNotifPanel()` | bell panel; manager «من/همه» toggle (`_notifViewAll`) |
| 5043 | `openDailyMonitor()` | manager daily activity report modal |
| 5376 | `_TK_STATUSES` | default kanban columns (todo/doing/waiting/done) |
| 5383 | `_getTkStatuses()` | per-user columns from `DB.settings.taskColumns[currentUser]`, else defaults — use this, never `_TK_STATUSES` directly, in rendering |
| 5390 | `openTkColumnsModal()` | column manager UI (uses `window._tkColsPending` because modal onclicks can't close over locals) |
| 5470 | `renderTasksPanel()` | kanban/list board |
| 5572 | `openTaskModal(tid, prefill)` | task detail/create; `prefill={title,owner,dueDate,priority,centerKey}` |
| 5679 | `tkAddSub(tid,parentSid)` | inline subtask add row (Enter/Escape), `tkSubmitNewSub` |
| 5982 | `convertFollowupToTask(rtype,rid)` | followup → prefilled task |
| 5996 | `_wpGetOwner(we)` | canonical owner resolution |
| 6051 | `renderCalendar()` | Jalali calendar |
| 7405 | `openSettings()` | settings modal (members, tags, onboarding reset…) |
| 7622 | `renderManagerPanel()` | manager overview (cards, expert table, pipeline matrix, today summary) |
| 7848 | `openManagerDrilldown(memberId)` | expert detail: all assigned centers, expandable rows w/ last note + changeLog |
| 7931 | `openOverdueList(memberId?)` | overdue followups list (all or one expert) |
| 8128 | `init()` | startup |
| 8304 | `_initOnboarding()` | 7-day tutorial widget |
| 8976 | `calcCenterRecommendations()` | P1/P2-only suggestion engine, sorted P1 first |

### Key Helper Functions

| Function | Purpose |
|---|---|
| `esc(s)` | HTML-escape for safe innerHTML insertion |
| `fNorm(s)` | Normalize Persian text for search |
| `showToast(msg, dur)` | Global toast notification |
| `openModal(id, title, body, footer, opts)` | Generic modal — `opts.lg` for large |
| `openJDP(input, cb)` | Jalali date-picker popup |
| `_getCenterName(type, id)` | Display name for a center |
| `getAllProvinces()` / `getProvType(pid)` / `getProvCenters(pid)` | province/center iteration |
| `_buildPCCache()` | populate `_PC_CACHE[provId]` — call before touching pc centers |
| `umGetColor(uid)` | user's badge color |

### External Dependencies (CDN only)

- **Vazirmatn font** — `cdn.jsdelivr.net/npm/vazirmatn@33.003.0`
- **SheetJS/xlsx** — `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js`

### AI Feature

The receivables AI tab calls `https://api.anthropic.com/v1/messages` directly from the browser using model `claude-sonnet-4-20250514`. API key provided by user at runtime.

## Feature Inventory (what exists today)

| Feature | Where | Status |
|---|---|---|
| Province → center pipeline w/ status, lead, potential, owner | provinces tab | ✅ |
| Week plan: drag-drop scheduling, expert filter (unified across grid + center list), bulk move, progress bar | weekplan tab | ✅ |
| **Expert targets (Quota)**: جدا از week_entries؛ شمارش فقط done؛ min پرریسک؛ ماه→هفته؛ progress board | `/api/expert-targets` + تب تخصیص → اهداف | ✅ |
| assignment_source on week_entries (manager_fixed / expert_self) + free_slots/WIP enforce | week-entries POST | ✅ |
| Done modal: structured logging (نتیجه / یادداشت / اقدام بعدی) on completion | weekplan | ✅ |
| Followup → next-date auto suggestion, overdue marking | center modal, banner | ✅ |
| Convert followup to task («📌 وظیفه» button) | center modal | ✅ |
| Kanban tasks: drag-drop, list view, filters, priority/owner/due | tasks tab | ✅ |
| Per-user custom kanban columns | tasks ⚙️ ستون‌ها | ✅ |
| 3-level subtasks, inline add/edit (no prompt()) | task modal | ✅ |
| In-app notifications + manager all-view toggle | bell icon | ✅ |
| **Notification engine**: severity, atomic dedup, per-user prefs, no cartable mirror | `notification-engine.js` + `/api/notifications` | ✅ |
| **Server digests**: morning 08:00 / afternoon 15:00 / weekly Sat 09:00 Tehran | `notification-scheduler.js` | ✅ |
| Bell = events only; cartable = scheduled work (no dual spam) | inbox-index + weekplan UI | ✅ |
| Auto-reminders at startup (no-date / overdue centers) | init | ⛔ replaced by server digests + cartable |
| Manager overview: summary cards, expert table, pipeline matrix, today summary | manager tab | ✅ |
| Manager drill-down: expert → centers → notes/changeLog | click expert row | ✅ |
| Overdue list modal (per-expert or global) | click معوق numbers | ✅ |
| Recommendations: P1/P2 centers only, P1 first | provinces dashboard | ✅ |
| Center timeline / audit | center modal | ✅ |
| Onboarding: all 7 steps shown daily for 7 days, dismissible | startup widget | ✅ |
| Multi-contact per center (name, role, phones) | center modal | ✅ |
| Pricing module + per-item price edit + margin gated by password 62604193 | pricing tab | ✅ |
| Receivables (مطالبات) incl. AI analysis tab | mtr tab | ✅ semi-independent |
| Excel import/export of centers | provinces | ✅ |
| Global search (Ctrl+K style) | header | ✅ |
| Biopsy center discovery: Python scraper (nobat.ir, doctorto.ir) + AI web_search scan | KPI tab → کشف مراکز | ✅ |
| biopsyScore badge on center rows (🔬 score) from online enrichment | center list rows | ✅ |
| Claude API key config (env var or DB.settings.anthropicKey) | ⚙ Settings modal | ✅ |
| ☀️ امروز من: today's scheduled week entries at top of expert dashboard | provinces dashboard | ✅ |
| 📞 Quick post-call log: minimal modal (result+note+next-date) from list row or today section | center list, dashboard | ✅ |
| 🎯 Pre-call brief: last notes, changes, competitor, address before calling | center list row (🎯), modal footer | ✅ |
| 🗺 Navigation: map button next to address textarea → Google Maps | center modal | ✅ |
| 🤖 Competitor tracking: text field in center modal + orange badge in list row | center modal, list | ✅ |
| Commission in center modal + SQL `commission_rules` editor in pricing mgmt tab | center modal, pricing | ✅ |
| 9 UX confusion fixes (banner role tag, kanban empty states, etc.) | various | ✅ |
| UI Polish v2: custom scrollbar, tab underline animation, card hover lift, pill buttons, input focus ring, modal entrance, notification pulse | css/app.css | ✅ |
| Comprehensive bug-fix pass: 15+ bugs fixed across backend routes + frontend modules | all files | ✅ |
| Tehran duplicate center merge: 219 mz_t_ pairs merged into c_ entries | scripts/merge_tehran_confirmed.py | ✅ |
| Automated DB backup: 3× daily (11/13/18 Tehran) + 30-day retention | scripts/backup_db.sh + server/lib/auto-backup.js + Settings Data Hub | ✅ |
| weekEntries guard: server merges instead of overwriting when incoming has fewer entries | server/routes/data.js | ✅ |
| DB history retention: extended from 30 snapshots to 30 days | server/routes/data.js | ✅ |
| WMS warehouse module: served at /wms, backed by PostgreSQL (9 tables), REST API at /api/wms | public/wms.html + server/routes/wms.js | ✅ |
| WMS REST endpoints: /api/wms/inventory (aggregate), /api/wms/lots/scan/:code (QR), /api/wms/transactions (paginated) | server/routes/wms.js | ✅ |
| WMS auto-migration: blob data migrated to SQL tables on first startup | server/db.js _migrateWMSFromBlob() | ✅ |
| WMS fiscal year: Jalali FY CRUD, activate, close + opening balance snapshot | server/routes/wms-ext.js + public/js/wms-ext.js | ✅ |
| WMS server reports: daily in/out movement + ledger (کاردکس) by fiscal year | server/lib/wms-reports.js + wms-ext.js | ✅ |
| WMS recalls/audit/delivery: SQL persistence via wms-ext API | server/routes/wms-ext.js | ✅ |
| WMS atomic warehouse transfer: POST /api/wms/transfers (paired exit+entry) | server/routes/wms-ext.js + wms-ext.js modal | ✅ |
| WMS txn backfill: fiscal_year_id + txn_date_jalali on startup | server/db.js _backfillWmsTxnFiscal() | ✅ |
| WMS IMED persist: PATCH transaction imed + bulk by refNo | server/routes/wms-ext.js + wms-ext.js | ✅ |
| WMS stock count SQL: complete → lot qty + adjustment txn | server/routes/wms-ext.js + wms-ext.js | ✅ |
| WMS TTAC + purchase price: PUT lots via wms-ext.js | wms-ext.js | ✅ |
| WMS markDelivered → PATCH delivery SQL | wms-ext.js | ✅ |
| WMS reconcile Faradis: GET /api/wms/reconcile/data + prefill UI | wms-ext.js | ✅ |
| WMS valuation FIFO/LIFO/weighted: server simulation + report tab | server/lib/wms-valuation.js + wms-ext.js | ✅ |
| WMS client reports Jalali date filters (mov/fct/compare) | wms-ext.js jalali upgrade on date fields | ✅ |
| Center modal: deals + files + workflow + HCP lazy load | pricing.js + crm-complete.js | ✅ |
| Week plan extended action types (price_send/sample/…) | ACTION_TYPE_LABELS + weekplan.js + crm-complete.js | ✅ |
| Done-modal metadata → SQL + activity-log POST | weekplan `_wpFinishDone` PUT fields | ✅ |
| Manager done-logs + full drilldown done entries | crm-complete.js + manager.js | ✅ |
| Overdue lead filter (فرصت/سرنخ/…) | manager.js openOverdueList | ✅ |
| Activity tab merges SQL `/api/activity-log` | activity-log.js GET + render merge | ✅ |
| MTR sync stub → Faradis receivables summary | server/routes/mtr-sync.js | ✅ |
| sync.js: no hardcoded API secret (env SYNC_API_KEY) | server/routes/sync.js | ✅ |
| **Workflows module**: user-definable processes (stages/transitions), kanban board, SQL-backed | tab گردش‌کار + /api/workflows | ✅ |
| Proforma invoice module: draft→sent→approved/rejected→reopen workflow, auto-number PF-YYYY-NNNN | proforma tab + /api/proforma | ✅ |
| Proforma SQL: zod validation, rowToObj mapper, manager-only approve/reject | server/routes/proforma.js | ✅ |
| Proforma auto-migration: blob migrated to SQL on first startup | server/db.js _migrateProformasFromBlob() | ✅ |
| Telegram bot: long-polling, CRM auth, proforma approve/reject inline keyboard, inventory check, QR scan | server/bot/telegram.js | ✅ |
| Security middleware: Helmet CSP + compression (graceful fallback) | server/index.js | ✅ |
| Vite + TypeScript + Vue 3 scaffold for incremental frontend migration | src/ + vite.config.ts + tsconfig.json | ✅ (placeholder) |
| Slim PUT save: routine saves omit destructive collections; `_fullSync` for import | public/js/core.js + server/routes/data.js | ✅ |
| Weekplan SQL-only saves: individual + bulk mutations use `/api/week-entries`; blob paths ignore weekEntries | public/js/weekplan.js + server/routes/data.js | ✅ |
| Production env guard + pre-deploy checklist | server/lib/prod-guard.js + scripts/predeploy-check.js | ✅ |
| Legacy bundle archived to `public/js/_legacy/` | not served | ✅ |
| Lazy tab script loading | `public/js/tab-loader.js` | ✅ |
| PATCH expanded: events, checklist, KPI, settings | `core.js` + `data.js` | ✅ |
| Per-collection GET APIs | `/api/data/collections/events`, `checklist` | ✅ |
| MTR Faradis sync: server cache refresh + normalized rows + optional auto scheduler | `/api/mtr/sync` + `faradis-auto-sync.js` | ✅ |
| Secret rotation checklist | `scripts/rotate-secrets-checklist.js` | ✅ |
| Reports upgrade: SQL-backed activity/competitor/coverage tabs + Excel export | reports.js + /api/reports | ✅ |
| KPI SQL load: GET /api/kpi-data (targets/history/province) in loadDB | core.js + kpi-data.js | ✅ |
| Manager reports API: expert SQL report, win/loss, daily, weekly snapshot | manager.js + manager-reports.js | ✅ |
| Center timeline API + گزارش مرکز modal + audit SQL merge | pricing.js + center-reports.js | ✅ |
| Proforma stats bar + invoiced status on invoice issue | proforma.js + invoices.js | ✅ |
| Workflows module: user-definable processes + kanban | workflows.js + /api/workflows | ✅ |
| CRM gaps: deals, files, KOL badges | center-deals.js + center-files.js | ✅ |
| SQL route RBAC: center ownership for deals/files/reports/week entries/tasks; MTR module permission | center-access.js + route middleware | ✅ |
| Session hardening: password change increments token_version and requires re-login | auth.js + routes/auth.js | ✅ |
| Portable JSON backup: critical CRM/Workflow/Proforma/WMS collections restored; binary files via pg_dump | data.js `/backup` + `/restore` | ✅ |
| Workflow center linkage: centerKey persisted and active instances shown in center modal | workflows.js + pricing.js | ✅ |
| IMED external adapter: configurable API sync (`IMED_API_URL`, `IMED_API_TOKEN`) + manual fallback | integrations/imed.js + wms-ext | ✅ |
| WMS UOM conversion metadata: base/secondary unit + conversion factor | wms_products + wms UI | ✅ |

## Canonical development branch

**`cursor/curser-edition-bd8e`** — unified integration branch (all features merged).  
**`main`** — stable production baseline; do not merge experimental work directly.


## Planned Integration: Accounting Software → Receivables (مطالبات)

The product owner (hamidreza.soltanian@gmail.com) wants to connect the accounting system's database directly to the CRM so receivables (مطالبات) update in real-time without manual Excel uploads.

**Planned approach:**
- A server-side route (`/api/mtr/sync`) that pulls from the accounting DB (e.g., via ODBC/REST/PostgreSQL foreign data wrapper depending on the accounting software).
- The MTR panel would poll this endpoint periodically (e.g., SSE push or 5-min refresh) instead of requiring file upload.
- Matching algorithm (`matchCentersToData`) stays unchanged — it will still link accounting records to CRM centers.
- META (notes, followup dates, forecasts) lives in Click CRM's DB and is merged on top of live accounting data.
- Accounting software candidates: **میزیتو**, **رافع**, **هوفار**, **سپیدار**, **دینا** — integration method depends on which is in use.
- Until the integration is live, the existing Excel/TSV upload path remains the fallback.

**What needs to be done when the accounting software is identified:**
1. Add a `server/routes/mtr-sync.js` route that connects to accounting DB and returns normalized invoice rows.
2. Add `DB.settings.mtrSyncEnabled` toggle in Settings modal.
3. Add auto-refresh timer in `mtr.js` when sync is enabled.

---

## Roadmap / Future Plan

**Active execution plan (data-loss fix + safety net):** see [`docs/IMPROVEMENT_PLAN.md`](docs/IMPROVEMENT_PLAN.md) — phases 1→2α (week plan save path) → 2β (PATCH centers) → observability. Checklist + PR log maintained there.

Priorities expressed by the product owner (hamidreza.soltanian@gmail.com), roughly ordered:

0. **Salesperson workflow polish** — `competitor` field tracked; commission wired to `commission_rules` SQL (center modal level picker + pricing mgmt tab editor). Pre-call brief and quick-log are live; consider adding "call timer" or "call history" count to the brief.
1. **Manager drill-down depth** — keep extending کلی→جزئی: from expert detail down to full written reports per center (currently shows last note + 5 changeLog entries; owner wants full report reading). Consider a dedicated per-expert report page aggregating done-modal structured logs (نتیجه/یادداشت/اقدام بعدی) by date range.
2. **Dashboard & overdue follow-up tracking** — keep making overdue work more actionable; possible next steps: overdue aging buckets, one-click reschedule from overdue list, weekly digest notification to manager.
3. **Task system maturity** — column reordering (drag), per-column WIP hints, task comments/activity, recurring tasks.
4. **Week plan** — owner repeatedly emphasized: ALL filtering must be consistent by expert everywhere; any new week-plan widget must respect `#wpOwnerFilter` + `_wpFclFilters` and the canonical owner-resolution chain.
5. **Data layer evolution (tech debt)** — IN PROGRESS per `docs/IMPROVEMENT_PLAN.md`: week_entries/tasks/notifications already SQL-backed; remaining work = remove dual-write (saveDB + API), PATCH centers, omit entities from bulk PUT. SSE → per-entity events (`week-entry-changed`, etc.).
6. **app.js modularization (tech debt)** — 12k+ lines in one file; if a build step is ever accepted, split by tab/module. Until then keep the function map above accurate.
7. **UX polish** — owner cares about "روان بودن" (flow); the app was renamed Flow for this reason. Prefer inline editing over prompt()/alert(), keep the indigo design system (`--brand:#6366f1`) consistent.

### Process Management (PM2)

پروداکشن با PM2 مدیریت می‌شود و بعد از ری‌استارت سرور خودکار بالا می‌آید.

```bash
# آپدیت و ری‌استارت (بعد از هر git pull)
cd /home/hamidreza/Sales-Portal && git pull origin claude/hopeful-bardeen-iz7jf9 && pm2 restart sales-portal

# وضعیت
pm2 status

# لاگ لایو
pm2 logs sales-portal

# ری‌استارت دستی
pm2 restart sales-portal

# اگر PM2 به هر دلیلی نبود، راه‌اندازی مجدد:
pkill -f "node server/index.js"; sleep 1
pm2 start server/index.js --name "sales-portal" && pm2 save
```

### Dev vs Prod environment

- **Prod**: `/home/hamidreza/Sales-Portal` — port 3000, managed by PM2 (autostart on reboot)
- **Dev**: `/home/hamidreza/Sales-Portal-dev` — port 4000, manual start
- **CRITICAL**: Both use the same PostgreSQL DB (`atena_crm`). Running dev with backend changes that write to DB can corrupt prod data.
- **Safe for dev**: frontend-only changes (HTML/CSS/JS) — the dev server just serves files, DB writes go to same place but are protected by weekEntries guard.
- **Unsafe for dev**: testing backend route changes (data.js, auth.js, etc.) — use a separate DB for that (see below).

#### Setting up a truly isolated dev DB:
```bash
# Create dev DB as a copy of prod (run once)
createdb -U postgres atena_crm_dev
pg_dump -U postgres atena_crm | psql -U postgres atena_crm_dev

# Set PG_DATABASE=atena_crm_dev in ~/Sales-Portal-dev/.env
# Then dev server writes to atena_crm_dev, prod stays clean
```

### Backup system

- **Scheduled full backup 3× daily** (11:00, 13:00, 18:00 Asia/Tehran): `server/lib/auto-backup.js` (Node scheduler) or cron via `scripts/setup-backup-cron.sh` → `~/db_backups/scheduled_*.sql.gz`
- **Manual backup from Settings → مدیریت داده‌ها** (Data Hub): full or lightweight appdata via `/api/backups/run`
- **Retention**: 30 days (`BACKUP_RETENTION_DAYS` env)
- **Restore full**: `gunzip -c ~/db_backups/scheduled_TIMESTAMP.sql.gz | psql -U postgres atena_crm`
- **In-app snapshots**: `app_data_history` table (30 days) — browse/restore in Settings Data Hub
- **Unified import/export**: Settings → مرکز مدیریت داده (JSON, Excel centers, server backup)
- In-DB history: `app_data_history` table keeps 30 days of snapshots (previously was only 30 records)
- Use `scripts/restore_weekentries.py` to find and restore from DB snapshots

### weekEntries guard (data.js — PUT /api/data/db)

If an incoming save has FEWER weekEntries than what's currently in the DB, the server merges them (server entries + incoming entries) instead of overwriting. This prevents a stale browser session from wiping the team's week plan.
Logged as: `[data/db PUT] weekEntries guard: merged server(N) + incoming(M) → K`

### Tehran duplicate center merge

- 219 confirmed duplicate pairs (mz_t_ → c_) merged via `scripts/merge_tehran_confirmed.py`
- Analysis script: `scripts/analyze_export_dupes.py` (works on exported TXT, no DB needed)
- After merge, `scripts/check_weekentries.py` migrates orphaned weekEntries from mz_t_ keys to c_ keys
- Diagnostic tools: `scripts/inspect_weekentries.py`, `scripts/inspect_new_centers.py`

### Bug-fix history (session June 2026)

**Backend (server/routes/):**
- `data.js`: History ops inside transaction used `.catch()` that silently put PG into aborted-transaction state → fixed with `SAVEPOINT history_ops`
- `data.js`: `pool.connect()` not in try block → crash if pool throws → fixed with `let client` before try, `if(client)` in finally
- `ai.js`: Unbounded `max_tokens`/`model` from client body → API abuse → fixed with model allowlist + `Math.min(8192, ...)`
- `pricing.js`: XSS in `/quotes/:id/print` — DB values interpolated raw into HTML → added `he()` HTML-escape helper
- `pricing.js`: `parseInt(limit)` NaN → 500 error → fixed with `Math.min(Math.max(parseInt||50, 1), 200)`
- `contacts.js`: Phone search used `$1 = ANY(phones)` with `%q%` LIKE pattern (exact match = always empty) → fixed with `EXISTS (SELECT 1 FROM unnest(phones) p WHERE p ILIKE $1)`
- `distribution.js`: `parseInt(id)` without NaN guard in approve/reject → 500 instead of 400 → added guard

**Frontend (public/js/ modules):**
- `manager.js`: `i` from `forEach(function(c,i){...})` used in onclick string as `+i+` literal text → ReferenceError at click time → fixed by breaking string to embed literal value at build time
- `manager.js`: Note date/author fields used `n.at`/`n.by` (new format only) → fixed to `n.date||fmtDate(n.at)` and `n.by||n.user`
- `dashboard.js`: Same note field issue in pre-call brief → same fix
- `provinces.js`: `Object.keys(DB.edits).forEach()` without null guard → crash on fresh DB → fixed with `DB.edits||{}`
- `calendar.js`: `Math.max.apply(null, ids)` with NaN ids → `_nextEvId = NaN` → duplicate events → fixed with isNaN filter
- `calendar.js`: `evId?find():null` → event id=0 treated as falsy → edit becomes create → fixed with `evId!==null&&evId!==undefined`
- `weekplan.js`: `renderList` is a local `var`, used in `oninput="renderList()"` (global scope) → ReferenceError → fixed with `window._wpPickRenderList = renderList`
- `weekplan.js`: `recKey.split('_')[1]` truncates IDs with underscores (e.g. `pc_north_khorasan||1`) → fixed with `split('_').slice(1).join('_')`
- `backup.js`: `doDBImport` promise chain had no `.catch()` → button stuck disabled on error → added `.catch()`
- `center-modal.js`: `popup.style.top=...` with no null check after `getElementById` → added early return

### Product principles (learned from owner feedback)

- Center value must NOT be reduced to a single number — potential (P1–P4) plus status is the model; recommendations only from P1/P2.
- Experts should be auto-reminded (startup notifications) — don't rely on them checking.
- Managers want both: a fast at-a-glance overview AND the ability to drill down to raw written reports.
- Everything filterable by expert; experts only see their own centers (managers see all).
- All UI text in Persian; all dates Jalali; layout RTL.

---

## Sales Playbook Gap Analysis (فایل: crm_gap_analysis.md)

Based on the Atena Sales Playbook v1.0. These are features the playbook requires that the CRM must implement.

### Implementation Status

| # | Feature | Priority | Status |
|---|---|---|---|
| 1 | Customer Status خودکار (New/Active/Dormant/Lost) بر اساس آخرین خرید | 🔴 حیاتی | ✅ DONE |
| 2 | Dormant detection: مشتری بدون خرید > 90 روز شناسایی خودکار شود | 🔴 حیاتی | ✅ DONE |
| 3 | Closed Lost Reason: popup اجباری هنگام غیرفعال/بستن Opportunity | 🔴 حیاتی | ✅ DONE |
| 4 | Opportunity fields: احتمال موفقیت (کم/متوسط/زیاد) + درجه A/B/C | 🔴 حیاتی | ✅ DONE |
| 5 | Opportunity value: ارزش فرصت به عنوان فیلد مرکز (نه فقط done entry) | 🔴 حیاتی | ✅ DONE |
| 6 | Activity type dropdown کامل: ارسال قیمت / نمونه / کمیته / جلسه / ... | 🟠 مهم | ✅ DONE |
| 7 | No-Next-Step flag: نشانگر نارنجی روی مراکز فعال بدون followupDate | 🟠 مهم | ✅ DONE |
| 8 | فیلدهای رقیب تکمیلی: مزیت / دلیل خرید از رقیب | 🟠 مهم | ✅ DONE |
| 9 | گزارش هفتگی: New Opportunity / مشتری جدید / مشتری خوابیده این هفته | 🟠 مهم | ✅ DONE |
| 10 | فاصله پیگیری per-Stage: Lead 7d / Opportunity داغ 2-3d / Dormant ماهانه | 🟡 مطلوب | ✅ DONE |
| 11 | Pipeline value: ارزش کل Pipeline به تفکیک Stage در dashboard مدیر | 🟡 مطلوب | ✅ DONE |
| 12 | KOL/پزشک Entity جداگانه با رابطه many-to-many به مراکز | 🟡 مطلوب | ✅ DONE (`hcp.js` + `/api/hcps`) |
| 13 | Stage validation: فیلدهای اجباری قبل از تغییر Stage | 🟡 مطلوب | ✅ DONE |
| 14 | فیلدهای Prospect تکمیلی: میزان مصرف / نحوه خرید / شرایط پرداخت | 🟡 مطلوب | ✅ DONE |
| 15 | گزارش per-رقیب: چه مراکزی به کدام رقیب داده‌ایم و چرا | 🟡 مطلوب | ✅ DONE |

### Data Model Extensions Needed

```
DB.edits[key] extensions:
  customerStatus: 'new' | 'active' | 'active_new' | 'dormant' | 'lost'  ← auto-computed
  lastPurchaseDate: 'YYYY/MM/DD'    ← Jalali, updated on sale log
  firstPurchaseDate: 'YYYY/MM/DD'   ← Jalali, set on first sale
  closeReason: string               ← mandatory on غیرفعال/بسته
  oppProbability: 'low'|'medium'|'high'   ← shown when lead=فرصت
  oppGrade: 'A'|'B'|'C'            ← hot/warm/cold, shown when lead=فرصت
  oppValue: number                  ← M ریال, shown when lead=فرصت
  competitorAdvantage: string
  competitorWeakness: string
  buyReasonFromCompetitor: string
  consumptionVolume: string         ← Prospect field
  purchaseMethod: string            ← Prospect field
  paymentTerms: string              ← Prospect field
```

### Action Type Extensions
Current: `'call' | 'visit'`
Target:  `'call' | 'visit' | 'price_send' | 'sample_send' | 'committee' | 'meeting' | 'followup'`

Persian labels:
```javascript
var ACTION_TYPE_LABELS = {
  call: '📞 تماس', visit: '🤝 ملاقات', price_send: '📄 ارسال قیمت',
  sample_send: '🧪 ارسال نمونه', committee: '🏛 پیگیری کمیته',
  meeting: '👥 جلسه', followup: '🔄 پیگیری'
};
```

## Workflow Checklist for every change

1. Edit the relevant `public/js/<module>.js`, `public/css/app.css`, or `public/index.html`.
2. `node --check public/js/<edited-file>.js` — must pass.
3. `node scripts/predeploy-check.js` before production deploy.
4. Commit with a descriptive message; push to the designated branch.
5. Update this file's Feature Inventory / Function Map / Roadmap if they changed.
