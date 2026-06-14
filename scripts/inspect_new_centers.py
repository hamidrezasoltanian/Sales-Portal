#!/usr/bin/env python3
"""
Check if center_new_ / pc_new_ entries referenced in weekEntries
exist in the server DB (DB.extra or centers_master).
Usage: python3 scripts/inspect_new_centers.py
"""
import json, os, re, sys
import psycopg2

def load_env():
    env = {}
    p = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(p):
        with open(p) as f:
            for line in f:
                m = re.match(r'^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$', line)
                if m:
                    env[m.group(1)] = m.group(2).strip().strip("'\"")
    return env

def main():
    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST','localhost'), port=int(env.get('PG_PORT','5432')),
        dbname=env.get('PG_DATABASE','atena_crm'), user=env.get('PG_USER','postgres'),
        password=env.get('PG_PASSWORD',''),
    )
    cur = conn.cursor()

    cur.execute("SELECT value FROM app_data WHERE key='main'")
    row = cur.fetchone()
    DB = row[0] if row else {}

    we = DB.get('weekEntries', {})
    extra = DB.get('extra', [])
    edits = DB.get('edits', {})

    # Collect all new_ IDs referenced in weekEntries
    new_refs = set()
    for k, v in we.items():
        rid = v.get('rid', '')
        rtype = v.get('rtype', '')
        if rid and ('_new_' in rid or 'new_' in rid.lower()):
            new_refs.add((rtype, rid, v.get('centerName', '?')))

    print(f"Week entries referencing 'new_' centers: {len(new_refs)}")
    print()

    # Check if they exist in DB.extra
    extra_by_id = {}
    for e in (extra if isinstance(extra, list) else []):
        eid = e.get('id','')
        extra_by_id[eid] = e

    # Check centers_master for any new_ centers
    cur.execute("SELECT data FROM centers_master WHERE key='CENTERS'")
    centers_row = cur.fetchone()
    master_ids = set()
    if centers_row:
        for c in centers_row[0]:
            master_ids.add(c.get('id',''))

    cur.execute("SELECT data FROM centers_master WHERE key='PC_RAW'")
    pc_row = cur.fetchone()
    pc_ids = set()
    if pc_row and pc_row[0]:
        raw = pc_row[0]
        items = raw.values() if isinstance(raw, dict) else (raw if isinstance(raw, list) else [])
        for item in items:
            if isinstance(item, list):
                for c in item:
                    if isinstance(c, dict):
                        pc_ids.add(c.get('id',''))
            elif isinstance(item, dict):
                pc_ids.add(item.get('id',''))

    print("Status of new_ centers:")
    for rtype, rid, name in sorted(new_refs, key=lambda x: x[1]):
        in_extra = rid in extra_by_id
        in_master = rid in master_ids
        in_pc = rid in pc_ids
        edit_key = f"{rtype}_{rid}"
        in_edits = edit_key in edits

        status = []
        if in_extra: status.append('✅ in DB.extra')
        if in_master: status.append('✅ in centers_master')
        if in_pc: status.append('✅ in PC_RAW')
        if in_edits: status.append(f'📝 has edits')
        if not status: status.append('❌ NOT FOUND IN DB')

        print(f"  [{rtype}] {rid}")
        print(f"    Name: {name}")
        print(f"    {' | '.join(status)}")
        if in_extra:
            e = extra_by_id[rid]
            print(f"    Extra data: name={e.get('name','?')}, owner={e.get('owner','?')}")
        print()

    # Also show DB.extra count for reference
    print(f"DB.extra total entries: {len(extra_by_id)}")
    if extra_by_id:
        new_in_extra = [(k,v) for k,v in extra_by_id.items() if '_new_' in k]
        print(f"DB.extra 'new_' entries: {len(new_in_extra)}")
        for k, v in new_in_extra[:10]:
            print(f"  {k}: {v.get('name','?')}")

    cur.close(); conn.close()

if __name__ == '__main__':
    main()
