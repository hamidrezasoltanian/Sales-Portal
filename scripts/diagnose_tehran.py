#!/usr/bin/env python3
"""
Diagnose remaining Tehran duplicates: mz_t_ vs c_ centers.
Uses multiple strategies: exact, substring, token overlap, character n-gram.
Run on production server.
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

def norm(s):
    s = (s or '').strip().replace('ي','ی').replace('ك','ک')
    s = re.sub(r'[‌‍‌-‏]','',s)
    return re.sub(r'\s+',' ',s).strip()

def strip_prefixes(s):
    """Remove common medical prefix words."""
    for p in ['بیمارستان','بیمارستانی','مجتمع','مرکز','کلینیک','درمانگاه',
              'داروخانه','آزمایشگاه','دکتر','پزشکی','درمانی','آموزشی',
              'تخصصی','فوق','بهداشتی']:
        s = re.sub(r'^'+p+r'\s*','',s)
    return s.strip()

def ngram_sim(a, b, n=3):
    """Character n-gram Jaccard similarity."""
    def ngrams(s):
        s = re.sub(r'\s+','',s)
        return set(s[i:i+n] for i in range(len(s)-n+1))
    ga, gb = ngrams(a), ngrams(b)
    if not ga or not gb: return 0.0
    return len(ga&gb)/len(ga|gb)

def score(mz_name, c_name):
    """Combined similarity score (0-1)."""
    mn, cn = norm(mz_name), norm(c_name)
    # Exact
    if mn == cn: return 1.0
    # Substring
    if len(cn) >= 5 and cn in mn: return 0.92
    if len(mn) >= 5 and mn in cn: return 0.88
    # Strip prefixes then compare
    ms, cs = strip_prefixes(mn), strip_prefixes(cn)
    if ms and cs and ms == cs: return 0.85
    if ms and cs and len(cs)>=4 and cs in ms: return 0.80
    if ms and cs and len(ms)>=4 and ms in cs: return 0.75
    # Character trigram similarity
    ts = ngram_sim(mn, cn, 3)
    return ts

env = load_env()
conn = psycopg2.connect(
    host=env.get('PG_HOST','localhost'), port=int(env.get('PG_PORT','5432')),
    dbname=env.get('PG_DATABASE','atena_crm'), user=env.get('PG_USER','postgres'),
    password=env.get('PG_PASSWORD',''),
)
cur = conn.cursor()
cur.execute("SELECT data FROM centers_master WHERE key='CENTERS'")
CENTERS = cur.fetchone()[0]

c_list  = [c for c in CENTERS if not c.get('id','').startswith('mz_t_')]
mz_list = [c for c in CENTERS if c.get('id','').startswith('mz_t_')]

print(f'c_ centers: {len(c_list)}')
print(f'mz_t_ centers: {len(mz_list)}')
print()

threshold = float(sys.argv[1]) if len(sys.argv)>1 else 0.72

pairs = []
for mz in mz_list:
    mzn = norm(mz.get('name',''))
    best_score = 0.0
    best_c = None
    for c in c_list:
        cn = norm(c.get('name',''))
        s = score(mzn, cn)
        if s > best_score:
            best_score = s
            best_c = c
    if best_c and best_score >= threshold:
        pairs.append((best_score, mz, best_c))

pairs.sort(key=lambda x: -x[0])

print(f'=== جفت‌های احتمالی تکراری (threshold={threshold}) ===')
print(f'تعداد: {len(pairs)}\n')

for s, mz, c in pairs[:60]:
    print(f'[{s:.2f}] {mz["id"]:12s} "{norm(mz.get("name",""))[:45]}"')
    print(f'       {c["id"]:12s} "{norm(c.get("name",""))[:45]}"')

if len(pairs) > 60:
    print(f'... و {len(pairs)-60} مورد دیگر')

print(f'\n---')
print(f'برای merge دستی از این دستور استفاده کنید:')
print(f'  python3 scripts/merge_two_centers.py <mz_t_ID> <c_ID>')
print(f'\nبرای threshold پایین‌تر (موارد بیشتر):')
print(f'  python3 scripts/diagnose_tehran.py 0.65')

cur.close(); conn.close()
