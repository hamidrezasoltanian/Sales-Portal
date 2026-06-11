#!/usr/bin/env python3
"""
Concatenate all 20 JS modules into public/js/app.bundle.js
Run from repo root: python3 scripts/build-bundle.py
"""
import os, sys, subprocess

FILES = [
    'public/js/core.js',
    'public/js/settings.js',
    'public/js/data.js',
    'public/js/ui-core.js',
    'public/js/dashboard.js',
    'public/js/provinces.js',
    'public/js/center-modal.js',
    'public/js/pricing.js',
    'public/js/weekplan.js',
    'public/js/activity.js',
    'public/js/tasks.js',
    'public/js/calendar.js',
    'public/js/checklist.js',
    'public/js/activity-log.js',
    'public/js/backup.js',
    'public/js/manager.js',
    'public/js/onboarding.js',
    'public/js/kpi.js',
    'public/js/manager-tasks.js',
    'public/js/mtr.js',
]

OUT = 'public/js/app.bundle.js'

chunks = []
for fp in FILES:
    with open(fp, 'r', encoding='utf-8') as f:
        src = f.read()
    chunks.append('/* ═══ ' + fp + ' ═══ */')
    chunks.append(src)

result = '\n'.join(chunks)
with open(OUT, 'w', encoding='utf-8') as f:
    f.write(result)

size = os.path.getsize(OUT)
print(f'✅ {OUT} — {size:,} bytes ({len(FILES)} files)')

# Syntax check
r = subprocess.run(['node', '--check', OUT], capture_output=True, text=True)
if r.returncode != 0:
    print('❌ Syntax error:', r.stderr)
    sys.exit(1)
print('✅ Syntax OK')
