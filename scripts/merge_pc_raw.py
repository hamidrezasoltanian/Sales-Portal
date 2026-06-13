#!/usr/bin/env python3
"""
Merge PC_RAW id-key arrays (e.g. PC_RAW['p1']) into name-key arrays
(e.g. PC_RAW['فارس']), consolidating DB.edits data along the way.

After this script:
  - Each province has ONE array (under name key, e.g. PC_RAW['فارس'])
  - No more id-key arrays (PC_RAW['p1'] removed)
  - DB.edits merged: Mizito contacts/data merged into canonical keys
  - No more duplicate centers

Usage:
    python3 scripts/merge_pc_raw.py [--dry-run]
"""

import json
import os
import re
import sys

import psycopg2

PROVINCE_MAP = {
    'فارس': 'p1', 'اصفهان': 'p2', 'سیستان و بلوچستان': 'p3',
    'مازندران': 'p4', 'آذربایجان شرقی': 'p5', 'لرستان': 'p6',
    'بوشهر': 'p7', 'گلستان': 'p8', 'خراسان جنوبی': 'p9',
    'چهارمحال و بختیاری': 'p10', 'اردبیل': 'p11', 'خراسان رضوی': 'p12',
    'یزد': 'p13', 'قم': 'p14', 'زنجان': 'p15', 'مرکزی': 'p16',
    'گیلان': 'p17', 'خراسان شمالی': 'p18', 'ایلام': 'p19',
    'خوزستان': 'p20', 'کرمانشاه': 'p21', 'آذربایجان غربی': 'p22',
    'کرمان': 'p23', 'البرز': 'p24', 'همدان': 'p25', 'قزوین': 'p26',
    'کردستان': 'p27', 'هرمزگان': 'p28', 'کهگیلویه و بویراحمد': 'p29',
    'سمنان': 'p30',
}
PROV_ID_TO_NAME = {v: k for k, v in PROVINCE_MAP.items()}


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
    """Normalize Persian string for comparison."""
    return (s or '').strip().replace('ي', 'ی').replace('ك', 'ک').replace('‌', ' ').replace('  ', ' ')


def get_center_name(r):
    if isinstance(r, dict):
        return norm(r.get('name', ''))
    elif isinstance(r, list) and len(r) > 1:
        return norm(r[1])
    return ''


def get_row(r):
    if isinstance(r, dict):
        return r.get('row', r.get('n', 0))
    elif isinstance(r, list):
        return r[0]
    return 0


def merge_edits(target, source):
    """Merge source edit dict into target edit dict (in-place, non-destructive)."""
    if not source:
        return
    # Merge contacts
    target_contacts = target.get('contacts', [])
    source_contacts = source.get('contacts', [])
    existing_names = {c.get('name', '') for c in target_contacts}
    for ct in source_contacts:
        cname = ct.get('name', '')
        if cname not in existing_names:
            target_contacts.append(ct)
            existing_names.add(cname)
        else:
            # Merge phones into existing contact
            existing_ct = next((x for x in target_contacts if x.get('name', '') == cname), None)
            if existing_ct:
                ep = set(existing_ct.get('phones', []))
                for ph in ct.get('phones', []):
                    if ph and ph not in ep:
                        existing_ct.setdefault('phones', []).append(ph)
                        ep.add(ph)
    target['contacts'] = target_contacts

    # Merge other fields: only fill empty/missing slots
    for field in ['address', 'status', 'lead', 'potential', 'type']:
        if not target.get(field) and source.get(field):
            target[field] = source[field]

    # Merge rTags
    return target


def main():
    dry_run = '--dry-run' in sys.argv
    if dry_run:
        print('DRY RUN — no changes will be saved\n')

    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST', 'localhost'),
        port=int(env.get('PG_PORT', '5432')),
        dbname=env.get('PG_DATABASE', 'atena_crm'),
        user=env.get('PG_USER', 'postgres'),
        password=env.get('PG_PASSWORD', ''),
    )
    cur = conn.cursor()

    # Load PC_RAW
    cur.execute("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')")
    cm_rows = cur.fetchall()
    cm_data = {r[0]: r[1] for r in cm_rows}
    PC_RAW = cm_data.get('PC_RAW', {})

    # Load DB (edits)
    cur.execute("SELECT value FROM app_data WHERE key = 'main'")
    row = cur.fetchone()
    DB = row[0] if row else {}
    if not DB:
        DB = {}
    edits = DB.get('edits', {})
    rTags = DB.get('rTags', {})

    total_merged = 0
    total_new = 0
    total_edits_rekey = 0

    for prov_id, pname in PROV_ID_TO_NAME.items():
        name_list = PC_RAW.get(pname)
        id_list = PC_RAW.get(prov_id)

        if not id_list:
            continue  # nothing under id-key, nothing to merge

        if name_list is None:
            name_list = []
            PC_RAW[pname] = name_list

        # Build lookup of name-key centers by normalized name → index
        name_lookup = {}
        for i, r in enumerate(name_list):
            n = get_center_name(r)
            if n:
                name_lookup[n] = i

        merged_count = 0
        new_count = 0

        for id_center in id_list:
            cname = get_center_name(id_center)
            id_row = get_row(id_center)
            id_edit_key = f"pc_{prov_id}||{id_row}"
            id_edit = edits.get(id_edit_key, {})

            match_idx = name_lookup.get(cname)

            if match_idx is not None:
                # Center exists in name-key array — merge edits
                name_center = name_list[match_idx]
                canonical_row = get_row(name_center)
                canonical_edit_key = f"pc_{prov_id}||{canonical_row}"

                if id_edit_key != canonical_edit_key:
                    # Merge id_edit into canonical edit
                    canonical_edit = edits.get(canonical_edit_key, {})
                    if id_edit:
                        merge_edits(canonical_edit, id_edit)
                        if not dry_run:
                            edits[canonical_edit_key] = canonical_edit
                            if id_edit_key in edits:
                                del edits[id_edit_key]
                            # Move rTags if any
                            if id_edit_key in rTags:
                                existing_rtags = rTags.get(canonical_edit_key, [])
                                for tag in rTags[id_edit_key]:
                                    if tag not in existing_rtags:
                                        existing_rtags.append(tag)
                                rTags[canonical_edit_key] = existing_rtags
                                del rTags[id_edit_key]
                        total_edits_rekey += 1

                merged_count += 1
                total_merged += 1

            else:
                # Center not in name-key array — add it
                new_row = len(name_list)
                new_center = id_center.copy() if isinstance(id_center, dict) else {
                    'row': new_row, 'name': cname, 'type': id_center[3] if len(id_center) > 3 else '',
                    'lead': id_center[4] if len(id_center) > 4 else 'سرنخ',
                }
                new_center['row'] = new_row
                new_canonical_key = f"pc_{prov_id}||{new_row}"

                if not dry_run:
                    name_list.append(new_center)
                    name_lookup[cname] = new_row

                    # Re-key edits if the id_row differs from new_row
                    if id_edit_key != new_canonical_key and id_edit:
                        edits[new_canonical_key] = id_edit
                        del edits[id_edit_key]
                        if id_edit_key in rTags:
                            rTags[new_canonical_key] = rTags.pop(id_edit_key)

                new_count += 1
                total_new += 1

        if merged_count or new_count:
            print(f'  [{prov_id} / {pname}]: merged {merged_count} duplicates, added {new_count} new centers')

        # Remove id-key array entirely
        if not dry_run and prov_id in PC_RAW:
            del PC_RAW[prov_id]

    print(f'\nSummary:')
    print(f'  Duplicates merged into canonical entries: {total_merged}')
    print(f'  New unique centers added to name-key arrays: {total_new}')
    print(f'  DB.edits re-keyed/merged: {total_edits_rekey}')

    if dry_run:
        print('\nDRY RUN — no changes saved')
        cur.close()
        conn.close()
        return

    if total_merged == 0 and total_new == 0:
        print('Nothing to merge.')
        cur.close()
        conn.close()
        return

    DB['edits'] = edits
    DB['rTags'] = rTags

    print('\nSaving to database...')
    cur.execute(
        """INSERT INTO centers_master (key, data, updated_at)
           VALUES ('PC_RAW', %s, NOW())
           ON CONFLICT (key) DO UPDATE SET data = %s, updated_at = NOW()""",
        (json.dumps(PC_RAW, ensure_ascii=False), json.dumps(PC_RAW, ensure_ascii=False))
    )
    cur.execute(
        """INSERT INTO app_data (key, value, updated_at, updated_by)
           VALUES ('main', %s, NOW(), 'merge_script')
           ON CONFLICT (key) DO UPDATE SET value = %s, updated_at = NOW(), updated_by = 'merge_script'""",
        (json.dumps(DB, ensure_ascii=False), json.dumps(DB, ensure_ascii=False))
    )
    conn.commit()
    cur.close()
    conn.close()
    print('✅ Merge complete! Restart the server and hard-refresh.')


if __name__ == '__main__':
    main()
