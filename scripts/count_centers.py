#!/usr/bin/env python3
"""
Count and analyze all centers in the database.
Shows breakdown by province, key type, and _mizito flag.
Run on production server to diagnose duplicates.
"""
import json, os, re, sys
import psycopg2

PROVINCE_MAP = {
    'فارس':'p1','اصفهان':'p2','سیستان و بلوچستان':'p3','مازندران':'p4',
    'آذربایجان شرقی':'p5','لرستان':'p6','بوشهر':'p7','گلستان':'p8',
    'خراسان جنوبی':'p9','چهارمحال و بختیاری':'p10','اردبیل':'p11',
    'خراسان رضوی':'p12','یزد':'p13','قم':'p14','زنجان':'p15','مرکزی':'p16',
    'گیلان':'p17','خراسان شمالی':'p18','ایلام':'p19','خوزستان':'p20',
    'کرمانشاه':'p21','آذربایجان غربی':'p22','کرمان':'p23','البرز':'p24',
    'همدان':'p25','قزوین':'p26','کردستان':'p27','هرمزگان':'p28',
    'کهگیلویه و بویراحمد':'p29','سمنان':'p30',
}
PROV_ID_TO_NAME = {v: k for k, v in PROVINCE_MAP.items()}

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
    return re.sub(r'\s+', ' ', s).strip()

def center_name(r):
    if isinstance(r, dict): return norm(r.get('name',''))
    if isinstance(r, list) and len(r) > 1: return norm(r[1])
    return ''

env = load_env()
conn = psycopg2.connect(
    host=env.get('PG_HOST','localhost'), port=int(env.get('PG_PORT','5432')),
    dbname=env.get('PG_DATABASE','atena_crm'), user=env.get('PG_USER','postgres'),
    password=env.get('PG_PASSWORD',''),
)
cur = conn.cursor()

cur.execute("SELECT key, data FROM centers_master WHERE key IN ('CENTERS','PC_RAW')")
cm = {r[0]: r[1] for r in cur.fetchall()}
CENTERS = cm.get('CENTERS', [])
PC_RAW  = cm.get('PC_RAW', {})

# ── Tehran ────────────────────────────────────────────────────────────────────
mz_t = [c for c in CENTERS if c.get('id','').startswith('mz_t_')]
c_   = [c for c in CENTERS if not c.get('id','').startswith('mz_t_')]
print(f'=== تهران ===')
print(f'  مراکز اصلی (c_):   {len(c_)}')
print(f'  مراکز میزیتو (mz_t_): {len(mz_t)}')
print(f'  جمع تهران:          {len(CENTERS)}')

# ── PC_RAW keys analysis ──────────────────────────────────────────────────────
print(f'\n=== PC_RAW ===')
print(f'  تعداد کلیدها: {len(PC_RAW)}')

id_keys   = [k for k in PC_RAW if k in PROV_ID_TO_NAME]
name_keys = [k for k in PC_RAW if k in PROVINCE_MAP]
other_keys= [k for k in PC_RAW if k not in PROV_ID_TO_NAME and k not in PROVINCE_MAP]

print(f'  کلیدهای ID (p1..p30): {len(id_keys)} — {id_keys[:5]}{"..." if len(id_keys)>5 else ""}')
print(f'  کلیدهای نام استان:    {len(name_keys)}')
if other_keys:
    print(f'  کلیدهای ناشناخته:     {other_keys[:5]}')

# ── Per-province breakdown ────────────────────────────────────────────────────
print(f'\n=== جزئیات استان‌ها ===')
total_name = 0
total_id   = 0
total_miz  = 0
total_dup  = 0

for pname, prov_id in sorted(PROVINCE_MAP.items(), key=lambda x: int(x[1][1:])):
    name_arr = PC_RAW.get(pname, [])
    id_arr   = PC_RAW.get(prov_id, [])
    mizito_in_name = sum(1 for r in name_arr if isinstance(r,dict) and r.get('_mizito'))

    # Check duplicates between id_arr and name_arr
    name_set = {center_name(r) for r in name_arr if center_name(r)}
    id_dupes = sum(1 for r in id_arr if center_name(r) in name_set)

    total_name += len(name_arr)
    total_id   += len(id_arr)
    total_miz  += mizito_in_name
    total_dup  += id_dupes

    if id_arr or mizito_in_name:
        print(f'  [{prov_id}] {pname[:20]:20s}: name={len(name_arr):4d}  id={len(id_arr):4d}  _mizito={mizito_in_name:4d}  id_dupes={id_dupes}')

print(f'\n  جمع name-key مراکز: {total_name}')
print(f'  جمع id-key  مراکز: {total_id}')
print(f'  جمع _mizito در name-key: {total_miz}')
print(f'  تکراری بین id/name arrays: {total_dup}')
print(f'\n  جمع کل (تهران + استان‌ها): {len(CENTERS) + total_name + total_id}')

# ── Name-level duplicates inside each province ─────────────────────────────
print(f'\n=== تکراری‌های اسمی داخل هر استان ===')
total_name_dupes = 0
for pname, prov_id in sorted(PROVINCE_MAP.items(), key=lambda x: int(x[1][1:])):
    arr = PC_RAW.get(pname, [])
    seen = {}
    dupes = []
    for r in arr:
        n = center_name(r)
        if not n: continue
        if n in seen:
            dupes.append(n)
        else:
            seen[n] = True
    if dupes:
        print(f'  [{pname}]: {len(dupes)} تکراری اسمی')
        for d in dupes[:3]:
            print(f'    - "{d[:50]}"')
        total_name_dupes += len(dupes)

if total_name_dupes == 0:
    print('  هیچ تکراری اسمی دقیق یافت نشد.')
else:
    print(f'  جمع: {total_name_dupes} تکراری اسمی')

cur.close(); conn.close()
