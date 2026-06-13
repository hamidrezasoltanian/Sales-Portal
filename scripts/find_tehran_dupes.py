#!/usr/bin/env python3
"""
Find and auto-merge duplicate Tehran centers where mz_t_ names match c_ names.

Matching strategy (in order of confidence):
  1. Exact normalized name match
  2. c_ name is substring of mz_t_ name (hospital name embedded in org description)
  3. mz_t_ name (or its parenthetical part) is substring of c_ name

Usage:
    python3 scripts/find_tehran_dupes.py [--dry-run] [--auto-merge] [--min-confidence=HIGH|MEDIUM]
"""

import json, os, re, sys
import psycopg2


def load_env():
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                m = re.match(r'^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$', line)
                if m:
                    env[m.group(1)] = m.group(2).strip().strip("'\"")
    return env


def norm(s):
    s = (s or '').strip()
    s = s.replace('ي', 'ی').replace('ك', 'ک')
    s = re.sub(r'[‌‍‎‏]', ' ', s)  # zero-width chars
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def extract_paren(s):
    """Extract content from inside parentheses."""
    m = re.search(r'\(([^)]+)\)', s)
    return norm(m.group(1)) if m else ''


def base_name(s):
    """Remove parenthetical part and common prefixes."""
    s = re.sub(r'\([^)]*\)', '', s).strip()
    for prefix in ['بیمارستان', 'مرکز', 'کلینیک', 'داروخانه', 'آزمایشگاه', 'دکتر', 'مطب']:
        s = re.sub(r'^' + prefix + r'\s*', '', s)
    return s.strip()


def merge_edit(target, source):
    if not source:
        return target
    if not target:
        return dict(source)
    tc = target.get('contacts', [])
    existing_names = {c.get('name', '') for c in tc}
    for ct in source.get('contacts', []):
        cname = ct.get('name', '')
        if cname not in existing_names:
            tc.append(ct)
            existing_names.add(cname)
        else:
            existing_ct = next((x for x in tc if x.get('name', '') == cname), None)
            if existing_ct:
                ep = set(existing_ct.get('phones', []))
                for ph in ct.get('phones', []):
                    if ph and ph not in ep:
                        existing_ct.setdefault('phones', []).append(ph)
                        ep.add(ph)
    target['contacts'] = tc
    for field in ['address', 'status', 'lead', 'potential', 'type']:
        if not target.get(field) and source.get(field):
            target[field] = source[field]
    return target


def main():
    dry_run = '--dry-run' in sys.argv
    auto_merge = '--auto-merge' in sys.argv
    min_conf = 'HIGH'
    for a in sys.argv:
        if a.startswith('--min-confidence='):
            min_conf = a.split('=')[1].upper()

    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST', 'localhost'),
        port=int(env.get('PG_PORT', '5432')),
        dbname=env.get('PG_DATABASE', 'atena_crm'),
        user=env.get('PG_USER', 'postgres'),
        password=env.get('PG_PASSWORD', ''),
    )
    cur = conn.cursor()

    cur.execute("SELECT data FROM centers_master WHERE key='CENTERS'")
    CENTERS = cur.fetchone()[0]

    original = [c for c in CENTERS if not c.get('id', '').startswith('mz_t_')]
    mizito   = [c for c in CENTERS if c.get('id', '').startswith('mz_t_')]

    print(f'Original (c_) centers: {len(original)}')
    print(f'Mizito  (mz_t_) centers: {len(mizito)}')

    # Build lookup for originals
    orig_by_norm = {}   # normalized name → center
    for c in original:
        n = norm(c.get('name', ''))
        orig_by_norm[n] = c

    matches = []  # (confidence, mz_center, orig_center, reason)

    for mz in mizito:
        mz_name = norm(mz.get('name', ''))
        mz_paren = extract_paren(mz_name)
        mz_base = base_name(mz_name)

        best = None
        best_conf = None
        best_reason = ''

        # 1. Exact match
        if mz_name in orig_by_norm:
            best = orig_by_norm[mz_name]
            best_conf = 'HIGH'
            best_reason = 'exact'
        else:
            for orig_n, orig_c in orig_by_norm.items():
                # 2. Original name is contained in mz name (length >= 5)
                if len(orig_n) >= 5 and orig_n in mz_name:
                    conf = 'HIGH' if len(orig_n) >= 8 else 'MEDIUM'
                    if best_conf != 'HIGH' or conf == 'HIGH':
                        best = orig_c
                        best_conf = conf
                        best_reason = f'c_name "{orig_n[:30]}" in mz_name'
                # 3. Parenthetical part matches orig name
                if mz_paren and len(mz_paren) >= 5 and mz_paren in orig_n:
                    if best_conf != 'HIGH':
                        best = orig_c
                        best_conf = 'MEDIUM'
                        best_reason = f'paren "{mz_paren[:30]}" in c_name'
                # 4. Base name (without prefix) matches
                if mz_base and len(mz_base) >= 6 and mz_base == base_name(orig_n):
                    if best_conf != 'HIGH':
                        best = orig_c
                        best_conf = 'MEDIUM'
                        best_reason = f'base match "{mz_base[:30]}"'

        if best:
            matches.append((best_conf, mz, best, best_reason))

    high = [(c, mz, o, r) for c, mz, o, r in matches if c == 'HIGH']
    medium = [(c, mz, o, r) for c, mz, o, r in matches if c == 'MEDIUM']

    print(f'\nMatches found:')
    print(f'  HIGH confidence:   {len(high)}')
    print(f'  MEDIUM confidence: {len(medium)}')

    to_show = high if min_conf == 'HIGH' else high + medium
    if not auto_merge:
        print(f'\nFirst 30 matches (--min-confidence={min_conf}):')
        for conf, mz, orig, reason in to_show[:30]:
            print(f'  [{conf}] mz:{mz["id"]:12s} "{mz.get("name","")[:40]}"')
            print(f'         c_:{orig["id"]:12s} "{orig.get("name","")[:40]}"')
            print(f'         reason: {reason}')
        if len(to_show) > 30:
            print(f'  ... and {len(to_show)-30} more')
        print(f'\nTo auto-merge HIGH confidence matches:')
        print(f'  python3 scripts/find_tehran_dupes.py --auto-merge [--dry-run]')
        print(f'To also merge MEDIUM:')
        print(f'  python3 scripts/find_tehran_dupes.py --auto-merge --min-confidence=MEDIUM [--dry-run]')
        cur.close()
        conn.close()
        return

    # Auto-merge
    cur.execute("SELECT value FROM app_data WHERE key='main'")
    DB = cur.fetchone()[0] or {}
    edits = DB.get('edits', {})
    rTags = DB.get('rTags', {})
    notes_db = DB.get('notes', {})

    ids_to_remove = set()
    merged_count = 0

    for conf, mz, orig, reason in to_show:
        mz_id = mz['id']
        orig_id = orig['id']
        mz_key = f'center_{mz_id}'
        orig_key = f'center_{orig_id}'

        if not dry_run:
            src_edit = edits.get(mz_key, {})
            tgt_edit = edits.get(orig_key, {})
            if src_edit:
                edits[orig_key] = merge_edit(tgt_edit, src_edit)
                del edits[mz_key]
            if mz_key in rTags:
                existing = rTags.get(orig_key, [])
                for tag in rTags[mz_key]:
                    if tag not in existing:
                        existing.append(tag)
                rTags[orig_key] = existing
                del rTags[mz_key]
            if mz_key in notes_db:
                existing_notes = notes_db.get(orig_key, [])
                existing_notes.extend(notes_db[mz_key])
                notes_db[orig_key] = existing_notes
                del notes_db[mz_key]

        ids_to_remove.add(mz_id)
        merged_count += 1
        print(f'  Merged {mz_id} → {orig_id}  [{conf}] {reason[:40]}')

    if not dry_run and ids_to_remove:
        CENTERS[:] = [c for c in CENTERS if c.get('id') not in ids_to_remove]
        DB['edits'] = edits
        DB['rTags'] = rTags
        DB['notes'] = notes_db

        cur.execute(
            "INSERT INTO centers_master (key,data,updated_at) VALUES ('CENTERS',%s,NOW()) "
            "ON CONFLICT (key) DO UPDATE SET data=%s, updated_at=NOW()",
            (json.dumps(CENTERS, ensure_ascii=False),)*2
        )
        cur.execute(
            "INSERT INTO app_data (key,value,updated_at,updated_by) VALUES ('main',%s,NOW(),'find_dupes') "
            "ON CONFLICT (key) DO UPDATE SET value=%s, updated_at=NOW(), updated_by='find_dupes'",
            (json.dumps(DB, ensure_ascii=False),)*2
        )
        conn.commit()
        print(f'\n✅ Merged {merged_count} centers. Restart server and hard-refresh.')
    elif dry_run:
        print(f'\nDRY RUN — {merged_count} would be merged')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
