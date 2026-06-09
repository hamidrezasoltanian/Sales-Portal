# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

This is a zero-build, single-file web app. Open the HTML file directly in a browser:

```bash
# Recommended: serve over HTTP so IndexedDB works correctly
python3 -m http.server 8080
# then open http://localhost:8080/atena_crm_v3_mtr_3.html
```

Opening `file://` directly also works for most features, but IndexedDB may be restricted in some browsers.

There are no package managers, build tools, test suites, or linters.

## Architecture

The entire application is a single HTML file (`atena_crm_v3_mtr_3.html`, ~7800 lines) combining all CSS, HTML markup, and JavaScript. It is a Persian-language (RTL, Jalali calendar) CRM for a medical equipment sales team.

### Data Layer

All state lives in the browser:

- **`localStorage` key `atena_crm_v2`** — the main `DB` object (serialized JSON) containing: `edits`, `notes`, `tags`, `rTags`, `weekTags`, `weekEntries`, `events`, `checklist`, `settings`, `kpiTargets`, `callLog`, `visitLog`, `salesLog`, `missionLog`, `provHistory`, `mtrFollower`, `mtrFollowerMap`.
- **IndexedDB `atenaCRM_master`** — master list of medical centers (`CENTERS` array and `PC_RAW` province↔center mapping), loaded at startup via `loadMasterCenters()`.
- **`localStorage` keys `atena_mtr_*`** — receivables module (مطالبات) stores its invoice data separately.

`PROVINCES` (30 Iranian provinces) is a static JS array hardcoded in the HTML at line 841.

**Reading/writing center fields** goes through `getE(type, id)` / `setE(type, id, field, val)` — these operate on `DB.edits` which holds per-center overrides keyed as `"{type}_{id}"`. `type` is `'center'` for Tehran, `'pc'` for all other provinces.

### Global State Variables (line 875–888)

| Variable | Meaning |
|---|---|
| `currentUser` | Active user ID (e.g. `'Sarah.hosseini'`) |
| `currentTab` | Active tab: `'provinces'`, `'weekplan'`, `'calendar'`, `'checklist'`, `'activity'`, `'kpi'` |
| `_currentProvId` | `null` = province list view; a province ID = open province's centers view |
| `_viewMode` | Centers view: `'list'` \| `'kanban'` \| `'card'` |
| `_provView` | Province list view: `'grid'` \| `'list'` \| `'kanban'` |

### Main Tabs / Panels

1. **استان‌ها (Provinces)** — Province grid → drill into a province → centers table with list/kanban/card views, status, lead classification, follow-up dates, tags.
2. **برنامه هفته (Week Plan)** — 7-day Jalali weekly grid with scheduled center visits; unscheduled queue at the bottom.
3. **تقویم (Calendar)** — Month/week/list event calendar using custom Jalali logic.
4. **چک‌لیست روزانه (Daily Checklist)** — Daily scored checklist, one entry per Jalali day.
5. **فعالیت‌ها (Activity)** — Read-only log of calls, visits, and sales.
6. **KPI** — Manager dashboard (hidden tab, accessible only to مدیر role) with targets vs. actuals.
7. **مطالبات (Receivables)** — Semi-independent embedded module in `#mtrPanel` (line 6398+), with its own init, state, storage helpers, and tabs: priority, aging, by-rep, forecast, AI.

### Initialization

`init()` at line 4977 is called on `DOMContentLoaded`. It calls `loadDB()`, `loadMasterCenters()`, `initSettings()`, `buildUSERS()`, sets up keyboard shortcuts, and renders the first tab.

The receivables module has its own `DOMContentLoaded` listener at line 7755.

### Jalali Calendar (line 891–901)

All dates are Persian/Solar Hijri. Core conversion functions:
- `g2j(gy, gm, gd)` → `[jy, jm, jd]`
- `j2g(jy, jm, jd)` → `[gy, gm, gd]`
- `todayStr()` → current date as `'YYYY/MM/DD'` string in Jalali
- `jMs(jy, jm, jd)` → Unix ms timestamp (used for date comparisons)

Date inputs throughout the UI use format `YYYY/MM/DD` in Jalali.

### Users & Permissions

Default members are defined in `_DEFAULT_MEMBERS` (line 914): `Sarah.hosseini` (مدیر), `Reyhane.kashisaz`, `Mohammad.seyedsalehi`, `Rambod.ghasemi` (all کارشناس فروش), and `guest`. After first save, members come from `DB.settings.members`.

`_isManager()` checks if `currentUser` has the `'مدیر'` role — manager-only features (KPI tab, user management modal, bulk reassign) are gated behind this check.

### AI Feature (Receivables Module)

The AI tab in مطالبات calls `https://api.anthropic.com/v1/messages` directly from the browser (line 7743), using model `claude-sonnet-4-20250514`. The API key must be provided by the user at runtime — it is not stored in the file.

### External Dependencies (CDN only)

- **Vazirmatn font** — `cdn.jsdelivr.net/npm/vazirmatn@33.003.0`
- **SheetJS/xlsx** — `cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js` (Excel export; gracefully degrades to TSV if unavailable)

### Key Helper Functions

| Function | Purpose |
|---|---|
| `esc(s)` | HTML-escape for safe innerHTML insertion |
| `fNorm(s)` | Normalize Persian text for search (unifies Arabic/Persian letter variants, converts Eastern Arabic numerals) |
| `showToast(msg, dur)` | Global toast notification |
| `openModal(id, title, body, footer, opts)` | Generic modal system |
| `saveDB()` | Persist entire `DB` to localStorage |
