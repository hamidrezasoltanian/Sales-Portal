#!/usr/bin/env python3
"""Diagnose PC_RAW key duplication."""

import json, os, re, sys
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
    return (s or '').strip().replace('ي','ی').replace('ك','ک').replace('‌',' ').strip()

env = load_env()
conn = psycopg2.connect(
    host=env.get('PG_HOST','localhost'),
    port=int(env.get('PG_PORT','5432')),
    dbname=env.get('PG_DATABASE','atena_crm'),
    user=env.get('PG_USER','postgres'),
    password=env.get('PG_PASSWORD',''),
)
cur = conn.cursor()
cur.execute("SELECT data FROM centers_master WHERE key='PC_RAW'")
row = cur.fetchone()
PC_RAW = row[0] if row else {}

print(f'Total keys in PC_RAW: {len(PC_RAW)}')
print()

prov_id_set = set(PROV_ID_TO_NAME.keys())  # p1..p30

# Group keys by normalized name
norm_to_keys = {}
for key in PC_RAW:
    nkey = norm(key)
    label = '[id-key]' if key in prov_id_set else '[name-key]'
    cnt = len(PC_RAW[key]) if isinstance(PC_RAW[key], list) else 0
    norm_to_keys.setdefault(nkey, []).append((key, label, cnt))

print('All province-related keys:')
total = 0
for nkey in sorted(norm_to_keys):
    entries = norm_to_keys[nkey]
    flag = ' ⚠️  DUPLICATE KEYS' if len(entries) > 1 else ''
    for k, label, cnt in entries:
        print(f'  {repr(k):44s} {label:12s} {cnt:4d} centers{flag}')
        total += cnt

print(f'\nTotal centers across all arrays: {total}')
cur.close()
conn.close()
