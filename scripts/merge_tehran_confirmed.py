#!/usr/bin/env python3
"""
Merge confirmed Tehran duplicate pairs (mz_t_ → c_).
Only merges pairs that are clearly the same entity after manual review.

Usage:
    python3 scripts/merge_tehran_confirmed.py [--dry-run]
"""
import json, os, re, sys
import psycopg2

# ── Confirmed duplicate pairs (mz_t_id → c_id) ────────────────────────────
# Each pair was manually verified to be the same entity.
# Skipped pairs that are: different branches, different doctors, different cities,
# or where a hospital name merely appears inside a pharmacy company name.
CONFIRMED = [
    # mz_t_id,  c_id,   reason
    ('mz_t_87',   'c_165',  'فوق تخصصی مرکزی نفت'),
    ('mz_t_112',  'c_357',  'بیمارستان حضرت سیدالشهداء (ع)'),
    ('mz_t_11',   'c_552',  'بیمارستان شهید فیاض بخش'),
    ('mz_t_839',  'c_31',   'شرکت اکترو خاورمیانه'),
    ('mz_t_1096', 'c_87',   'پلیکلینیک آزادی نفت'),
    ('mz_t_1185', 'c_118',  'فروشگاه آندیا کالا'),
    ('mz_t_1718', 'c_208',  'پارس بهداشت تجهیز'),
    ('mz_t_1780', 'c_233',  'موسسه پزشکی شهید شوریده'),
    ('mz_t_1874', 'c_273',  'سازمان تدارکات پزشکی جمعیت هلال احمر'),
    ('mz_t_2673', 'c_372',  'بیمارستان خانواده ارتش'),
    ('mz_t_2976', 'c_470',  'پژوهشگاه رویان جهاد'),
    ('mz_t_3935', 'c_670',  'بیمارستان محب کوثر'),
    ('mz_t_4042', 'c_647',  'مرکز طبی / بیمارستان کودکان تهران'),
    ('mz_t_4357', 'c_788',  'بین المللی پیشتازان سلامت صادق'),
    ('mz_t_4392', 'c_811',  'تامین تجهیزات پزشکی جم'),
    ('mz_t_4396', 'c_813',  'داروخانه بیمارستان صدیقه زهرا'),
    ('mz_t_4727', 'c_842',  'سونوگرافی مهر ایرانیان'),
    ('mz_t_4915', 'c_887',  'مرکز تصویربرداری تابش'),
    ('mz_t_4947', 'c_896',  'صنایع پزشکی دکتر احمدی'),
]

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

def norm(s):
    s = (s or '').strip().replace('ي','ی').replace('ك','ک')
    s = re.sub(r'[‌‍‌-‏]','',s)
    return re.sub(r'\s+',' ',s).strip()

def merge_edit(target, source):
    if not source: return target or {}
    if not target: return dict(source)
    tc = target.get('contacts',[])
    seen = {c.get('name','') for c in tc}
    for ct in source.get('contacts',[]):
        cn = ct.get('name','')
        if cn not in seen:
            tc.append(ct); seen.add(cn)
        else:
            exc = next((x for x in tc if x.get('name','')==cn), None)
            if exc:
                ep = set(exc.get('phones',[]))
                for ph in ct.get('phones',[]):
                    if ph and ph not in ep:
                        exc.setdefault('phones',[]).append(ph); ep.add(ph)
    target['contacts'] = tc
    for f in ['address','status','lead','potential','type']:
        if not target.get(f) and source.get(f):
            target[f] = source[f]
    return target

def do_merge(edits, rTags, notes_db, src_key, tgt_key):
    if src_key == tgt_key: return
    if src_key in edits:
        edits[tgt_key] = merge_edit(edits.get(tgt_key,{}), edits.pop(src_key))
    if src_key in rTags:
        ex = rTags.get(tgt_key,[])
        for t in rTags.pop(src_key):
            if t not in ex: ex.append(t)
        rTags[tgt_key] = ex
    if src_key in notes_db:
        notes_db.setdefault(tgt_key,[]).extend(notes_db.pop(src_key))

def main():
    dry_run = '--dry-run' in sys.argv
    if dry_run: print('DRY RUN\n')

    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST','localhost'), port=int(env.get('PG_PORT','5432')),
        dbname=env.get('PG_DATABASE','atena_crm'), user=env.get('PG_USER','postgres'),
        password=env.get('PG_PASSWORD',''),
    )
    cur = conn.cursor()

    cur.execute("SELECT data FROM centers_master WHERE key='CENTERS'")
    CENTERS = cur.fetchone()[0]
    by_id = {c.get('id'): c for c in CENTERS}

    print(f'=== {len(CONFIRMED)} جفت تایید شده ===\n')
    valid_pairs = []
    for mz_id, c_id, reason in CONFIRMED:
        mz = by_id.get(mz_id)
        c  = by_id.get(c_id)
        if not mz:
            print(f'  ⚠ {mz_id} یافت نشد (قبلاً merge شده؟)')
            continue
        if not c:
            print(f'  ⚠ {c_id} یافت نشد')
            continue
        print(f'  ✂ {mz_id}: "{norm(mz.get("name",""))[:50]}"')
        print(f'     → {c_id}: "{norm(c.get("name",""))[:50]}"')
        print(f'     ({reason})')
        valid_pairs.append((mz_id, c_id))

    print(f'\n{len(valid_pairs)} جفت معتبر')

    if dry_run:
        print('\nDRY RUN — ذخیره نشد')
        cur.close(); conn.close(); return

    cur.execute("SELECT value FROM app_data WHERE key='main'")
    DB = (cur.fetchone()[0] or {})
    edits    = DB.setdefault('edits',{})
    rTags    = DB.setdefault('rTags',{})
    notes_db = DB.setdefault('notes',{})

    remove_ids = set()
    for mz_id, c_id in valid_pairs:
        do_merge(edits, rTags, notes_db, f'center_{mz_id}', f'center_{c_id}')
        remove_ids.add(mz_id)

    CENTERS[:] = [c for c in CENTERS if c.get('id') not in remove_ids]
    DB['edits'] = edits; DB['rTags'] = rTags; DB['notes'] = notes_db

    cur.execute(
        "INSERT INTO centers_master (key,data,updated_at) VALUES ('CENTERS',%s,NOW()) "
        "ON CONFLICT (key) DO UPDATE SET data=%s,updated_at=NOW()",
        (json.dumps(CENTERS,ensure_ascii=False),)*2)
    cur.execute(
        "INSERT INTO app_data (key,value,updated_at,updated_by) VALUES ('main',%s,NOW(),'merge_confirmed') "
        "ON CONFLICT (key) DO UPDATE SET value=%s,updated_at=NOW(),updated_by='merge_confirmed'",
        (json.dumps(DB,ensure_ascii=False),)*2)
    conn.commit()
    cur.close(); conn.close()
    print(f'\n✅ {len(valid_pairs)} مرکز تکراری merge شد. سرور ریستارت و hard-refresh بزنید.')

if __name__ == '__main__':
    main()
