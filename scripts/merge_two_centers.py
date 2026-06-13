#!/usr/bin/env python3
"""
Merge two Tehran centers by ID: source → target.
Source's edit data (contacts, notes) is merged into target, then source is removed.

Usage:
    python3 scripts/merge_two_centers.py <source_id> <target_id> [--dry-run]

Example:
    python3 scripts/merge_two_centers.py mz_t_1 c_678
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


def merge_edit(target, source):
    if not source:
        return target
    if not target:
        return dict(source)
    # Contacts
    tc = target.get('contacts', [])
    sc = source.get('contacts', [])
    existing_names = {c.get('name', '') for c in tc}
    for ct in sc:
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
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry_run = '--dry-run' in sys.argv
    if len(args) < 2:
        print('Usage: python3 scripts/merge_two_centers.py <source_id> <target_id> [--dry-run]')
        sys.exit(1)

    source_id, target_id = args[0], args[1]
    source_edit_key = f'center_{source_id}'
    target_edit_key = f'center_{target_id}'

    if dry_run:
        print('DRY RUN\n')

    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST', 'localhost'),
        port=int(env.get('PG_PORT', '5432')),
        dbname=env.get('PG_DATABASE', 'atena_crm'),
        user=env.get('PG_USER', 'postgres'),
        password=env.get('PG_PASSWORD', ''),
    )
    cur = conn.cursor()

    # Load CENTERS
    cur.execute("SELECT data FROM centers_master WHERE key='CENTERS'")
    CENTERS = cur.fetchone()[0]
    source_center = next((c for c in CENTERS if c.get('id') == source_id), None)
    target_center = next((c for c in CENTERS if c.get('id') == target_id), None)

    if not source_center:
        print(f'Source center {source_id} not found in CENTERS')
        sys.exit(1)
    if not target_center:
        print(f'Target center {target_id} not found in CENTERS')
        sys.exit(1)

    print(f'Source: [{source_id}] {source_center.get("name")}')
    print(f'Target: [{target_id}] {target_center.get("name")}')

    # Load DB edits
    cur.execute("SELECT value FROM app_data WHERE key='main'")
    DB = cur.fetchone()[0] or {}
    edits = DB.get('edits', {})
    rTags = DB.get('rTags', {})
    notes = DB.get('notes', {})

    source_edit = edits.get(source_edit_key, {})
    target_edit = edits.get(target_edit_key, {})
    print(f'\nSource edit contacts: {len(source_edit.get("contacts", []))}')
    print(f'Target edit contacts: {len(target_edit.get("contacts", []))}')

    if not dry_run:
        # Merge edits
        merged = merge_edit(dict(target_edit), source_edit)
        edits[target_edit_key] = merged
        if source_edit_key in edits:
            del edits[source_edit_key]

        # Merge rTags
        if source_edit_key in rTags:
            existing = rTags.get(target_edit_key, [])
            for tag in rTags[source_edit_key]:
                if tag not in existing:
                    existing.append(tag)
            rTags[target_edit_key] = existing
            del rTags[source_edit_key]

        # Merge notes
        if source_edit_key in notes:
            existing_notes = notes.get(target_edit_key, [])
            existing_notes.extend(notes[source_edit_key])
            notes[target_edit_key] = existing_notes
            del notes[source_edit_key]

        # Remove source from CENTERS
        CENTERS[:] = [c for c in CENTERS if c.get('id') != source_id]

        DB['edits'] = edits
        DB['rTags'] = rTags
        DB['notes'] = notes

        cur.execute(
            "INSERT INTO centers_master (key, data, updated_at) VALUES ('CENTERS', %s, NOW()) "
            "ON CONFLICT (key) DO UPDATE SET data = %s, updated_at = NOW()",
            (json.dumps(CENTERS, ensure_ascii=False), json.dumps(CENTERS, ensure_ascii=False))
        )
        cur.execute(
            "INSERT INTO app_data (key, value, updated_at, updated_by) VALUES ('main', %s, NOW(), 'merge_centers') "
            "ON CONFLICT (key) DO UPDATE SET value = %s, updated_at = NOW(), updated_by = 'merge_centers'",
            (json.dumps(DB, ensure_ascii=False), json.dumps(DB, ensure_ascii=False))
        )
        conn.commit()
        print(f'\n✅ Merged {source_id} → {target_id} and removed {source_id}')
        print('Restart server and hard-refresh.')
    else:
        print('\nDRY RUN — no changes saved')

    cur.close()
    conn.close()


if __name__ == '__main__':
    main()
