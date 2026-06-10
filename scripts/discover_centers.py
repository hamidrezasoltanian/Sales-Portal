#!/usr/bin/env python3
"""
Flow CRM — Center Discovery Script
Searches nobat.ir and doctorto.ir for medical centers likely to consume biopsy equipment.

Target specialties (by consumption order):
  1. رادیولوژی مداخله‌ای (Interventional Radiology)  — score 10
  2. رادیولوژی                                         — score 7
  3. اورولوژی                                          — score 6
  + بیوپسی keyword in comments                         — score +3 per mention (max +15)

Usage:
  pip3 install requests beautifulsoup4 psycopg2-binary
  python3 scripts/discover_centers.py [--dry-run] [--limit N] [--no-comments]
  python3 scripts/discover_centers.py --output discovered.json  (no DB needed)

If psycopg2 is unavailable, output is saved to discovered_centers.json and can be
imported via the CRM: Settings → Import discovered centers (POST /api/discovery/import-file).
"""

import os, sys, time, json, hashlib, re, random, argparse, logging
from datetime import datetime, timezone
from urllib.parse import urlencode, urljoin

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    print('[ERROR] Missing dependencies. Run:\n  pip3 install requests beautifulsoup4')
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(levelname)s %(message)s')
log = logging.getLogger(__name__)

# ── Load .env ──────────────────────────────────────────────────────────────

def load_env():
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path, encoding='utf-8') as f:
            for line in f:
                m = re.match(r'^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$', line)
                if m:
                    k, v = m.group(1), m.group(2).strip('\'"')
                    if k not in os.environ:
                        os.environ[k] = v

load_env()

# ── Config ─────────────────────────────────────────────────────────────────

BIOPSY_KEYWORDS = [
    'بیوپسی', 'نمونه‌برداری', 'نمونه برداری',
    'بیوپسی سینه', 'بیوپسی پروستات', 'بیوپسی کلیه',
    'بیوپسی ریه', 'بیوپسی رحم', 'نمونه‌گیری بافت',
    'core needle', 'ترانس رکتال', 'trus biopsy',
]

SPECIALTIES = [
    {
        'name': 'رادیولوژی مداخله‌ای',
        'label': 'اینترونشنال رادیولوژیست',
        'score': 10,
        'nobat_q': 'رادیولوژی مداخله ای',
        'nobat_slug': 'راديولوژي-مداخله-اي',
        'dt_q': 'رادیولوژی مداخله ای',
        'dt_slug': 'interventional-radiology',
    },
    {
        'name': 'رادیولوژی',
        'label': 'رادیولوژیست',
        'score': 7,
        'nobat_q': 'رادیولوژی',
        'nobat_slug': 'راديولوژي',
        'dt_q': 'رادیولوژی',
        'dt_slug': 'radiology',
    },
    {
        'name': 'اورولوژی',
        'label': 'اورولوژیست',
        'score': 6,
        'nobat_q': 'اورولوژی',
        'nobat_slug': 'اورولوژی',
        'dt_q': 'اورولوژی',
        'dt_slug': 'urology',
    },
]

HEADERS = {
    'User-Agent': (
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    ),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'fa-IR,fa;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
}

SESSION = requests.Session()
SESSION.headers.update(HEADERS)

DELAY = (1.8, 3.5)   # seconds between requests

# ── Helpers ────────────────────────────────────────────────────────────────

def sleep():
    time.sleep(random.uniform(*DELAY))

def fetch_html(url, params=None, timeout=18):
    try:
        r = SESSION.get(url, params=params, timeout=timeout, allow_redirects=True)
        r.raise_for_status()
        r.encoding = r.apparent_encoding or 'utf-8'
        return BeautifulSoup(r.text, 'html.parser'), r.url
    except Exception as e:
        log.warning(f'fetch_html failed: {url} — {e}')
        return None, url

def fetch_json(url, params=None, timeout=18):
    try:
        r = SESSION.get(url, params=params, timeout=timeout,
                        headers={**HEADERS, 'Accept': 'application/json'})
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log.warning(f'fetch_json failed: {url} — {e}')
        return None

def center_id(name, city):
    raw = f'{name.strip()}::{city.strip()}'.encode('utf-8')
    return hashlib.md5(raw).hexdigest()[:14]

def count_biopsy(text):
    if not text:
        return 0
    t = text.lower()
    return sum(t.count(kw.lower()) for kw in BIOPSY_KEYWORDS)

def clean(s):
    return (s or '').strip()

# ── nobat.ir ───────────────────────────────────────────────────────────────
#
# nobat.ir (نوبت) — major Iranian medical appointment platform.
# Endpoint patterns tried in order:
#   1. /api/v2/search?q=…&type=doctor
#   2. /api/doctors?speciality=…
#   3. HTML search: /search?s=… (selector-based fallback)

def scrape_nobat(spec, limit=40):
    log.info(f'[nobat.ir] {spec["name"]}')
    results = []

    # — attempt 1: JSON search API —
    data = fetch_json('https://nobat.ir/api/v2/search',
                      {'q': spec['nobat_q'], 'type': 'doctor', 'per_page': limit})
    if data:
        doctors = (data.get('doctors') or data.get('data') or
                   (data if isinstance(data, list) else []))
        log.info(f'  API /api/v2/search → {len(doctors)} results')
        for d in doctors[:limit]:
            r = _nobat_doctor_to_raw(d, spec)
            if r:
                results.append(r)
        if results:
            return results

    # — attempt 2: specialty endpoint —
    sleep()
    data = fetch_json(f'https://nobat.ir/api/doctors',
                      {'speciality': spec['nobat_slug'], 'per_page': limit})
    if data:
        doctors = data.get('doctors') or data.get('data') or (data if isinstance(data, list) else [])
        log.info(f'  API /api/doctors → {len(doctors)} results')
        for d in doctors[:limit]:
            r = _nobat_doctor_to_raw(d, spec)
            if r:
                results.append(r)
        if results:
            return results

    # — attempt 3: HTML fallback —
    sleep()
    soup, final_url = fetch_html('https://nobat.ir/search',
                                  {'s': spec['nobat_q'], 'type': 'doctor'})
    if soup:
        cards = (soup.select('.doctor-card') or
                 soup.select('.doctor-item') or
                 soup.select('[class*="DoctorCard"]') or
                 soup.select('.result-card'))
        log.info(f'  HTML {final_url} → {len(cards)} cards')
        for card in cards[:limit]:
            r = _nobat_card_to_raw(card, spec)
            if r:
                results.append(r)
                sleep()

    return results


def _nobat_doctor_to_raw(d, spec):
    name = clean(d.get('full_name') or d.get('name') or d.get('display_name') or '')
    if not name:
        return None
    clinics = d.get('clinics') or d.get('offices') or d.get('medical_centers') or []
    slug = d.get('slug') or d.get('id') or ''
    profile_url = f'https://nobat.ir/doctor/{slug}' if slug else ''

    if clinics:
        cl = clinics[0]
        return {
            'center_name': clean(cl.get('name') or cl.get('center_name') or f'مطب دکتر {name}'),
            'city':        clean(cl.get('city') or cl.get('province') or d.get('city') or ''),
            'address':     clean(cl.get('address') or ''),
            'doctor_name': name,
            'spec':        spec,
            'source':      'nobat.ir',
            'source_url':  profile_url,
        }
    return {
        'center_name': clean(d.get('office_name') or f'مطب دکتر {name}'),
        'city':        clean(d.get('city') or d.get('province') or ''),
        'address':     clean(d.get('address') or ''),
        'doctor_name': name,
        'spec':        spec,
        'source':      'nobat.ir',
        'source_url':  profile_url,
    }


def _nobat_card_to_raw(card, spec):
    name_el = (card.select_one('[class*="name"]') or
               card.select_one('h2') or card.select_one('h3'))
    name = clean(name_el.get_text()) if name_el else ''
    if not name:
        return None

    clinic_el = (card.select_one('[class*="clinic"]') or
                 card.select_one('[class*="center"]') or
                 card.select_one('[class*="office"]'))
    clinic = clean(clinic_el.get_text()) if clinic_el else ''

    city_el = (card.select_one('[class*="city"]') or
               card.select_one('[class*="location"]'))
    city = clean(city_el.get_text()) if city_el else ''

    link = card.select_one('a[href]')
    href = link['href'] if link else ''
    if href and not href.startswith('http'):
        href = 'https://nobat.ir' + href

    return {
        'center_name': clinic or f'مطب دکتر {name}',
        'city':        city,
        'address':     '',
        'doctor_name': name,
        'spec':        spec,
        'source':      'nobat.ir',
        'source_url':  href,
    }


# ── doctorto.ir ────────────────────────────────────────────────────────────
#
# doctorto.ir (دکترتو) — another major appointment platform.

def scrape_doctorto(spec, limit=40):
    log.info(f'[doctorto.ir] {spec["name"]}')
    results = []

    # — attempt 1: JSON API —
    data = fetch_json('https://www.doctorto.ir/api/v1/doctors',
                      {'specialty': spec['dt_slug'], 'per_page': min(limit, 24), 'page': 1})
    if not data:
        data = fetch_json('https://www.doctorto.ir/api/search',
                          {'q': spec['dt_q'], 'per_page': min(limit, 24)})
    if data:
        doctors = (data.get('data') or data.get('doctors') or
                   (data if isinstance(data, list) else []))
        log.info(f'  API → {len(doctors)} results')
        for d in doctors[:limit]:
            r = _dt_doctor_to_raw(d, spec)
            if r:
                results.append(r)
        if results:
            return results

    # — attempt 2: HTML fallback —
    sleep()
    soup, final_url = fetch_html(
        'https://www.doctorto.ir/find-doctor',
        {'specialty': spec['dt_slug'], 'q': spec['dt_q']}
    )
    if soup:
        cards = (soup.select('.doctor-card') or
                 soup.select('.dr-card') or
                 soup.select('[class*="doctor-item"]') or
                 soup.select('.search-result'))
        log.info(f'  HTML → {len(cards)} cards')
        for card in cards[:limit]:
            r = _dt_card_to_raw(card, spec)
            if r:
                results.append(r)
                sleep()

    return results


def _dt_doctor_to_raw(d, spec):
    name = clean(d.get('full_name') or d.get('name') or '')
    if not name:
        return None
    clinics = d.get('clinics') or d.get('offices') or []
    city = clean(d.get('city') or d.get('province') or '')
    slug = d.get('slug') or d.get('id') or ''
    url = f'https://www.doctorto.ir/doctor/{slug}' if slug else ''

    if clinics:
        cl = clinics[0]
        return {
            'center_name': clean(cl.get('name') or f'مطب دکتر {name}'),
            'city':        clean(cl.get('city') or city),
            'address':     clean(cl.get('address') or ''),
            'doctor_name': name,
            'spec':        spec,
            'source':      'doctorto.ir',
            'source_url':  url,
        }
    return {
        'center_name': f'مطب دکتر {name}',
        'city':        city,
        'address':     clean(d.get('address') or ''),
        'doctor_name': name,
        'spec':        spec,
        'source':      'doctorto.ir',
        'source_url':  url,
    }


def _dt_card_to_raw(card, spec):
    name_el = (card.select_one('[class*="name"]') or
               card.select_one('h2') or card.select_one('h3'))
    name = clean(name_el.get_text()) if name_el else ''
    if not name:
        return None

    clinic_el = (card.select_one('[class*="clinic"]') or
                 card.select_one('[class*="center"]'))
    clinic = clean(clinic_el.get_text()) if clinic_el else ''

    city_el = (card.select_one('[class*="city"]') or
               card.select_one('[class*="location"]'))
    city = clean(city_el.get_text()) if city_el else ''

    link = card.select_one('a[href]')
    href = link['href'] if link else ''
    if href and not href.startswith('http'):
        href = 'https://www.doctorto.ir' + href

    return {
        'center_name': clinic or f'مطب دکتر {name}',
        'city':        city,
        'address':     '',
        'doctor_name': name,
        'spec':        spec,
        'source':      'doctorto.ir',
        'source_url':  href,
    }


# ── Comment mining ─────────────────────────────────────────────────────────

def mine_comments(source_url, no_comments=False):
    """Visit doctor profile page, count biopsy keywords in reviews/comments."""
    if no_comments or not source_url:
        return 0
    sleep()
    soup, _ = fetch_html(source_url)
    if not soup:
        return 0
    # Try common comment/review selectors
    sections = (soup.select('.comment') or soup.select('.review') or
                soup.select('[class*="comment"]') or soup.select('[class*="review"]') or
                soup.select('[class*="feedback"]') or soup.select('.user-comment'))
    text = ' '.join(el.get_text(separator=' ') for el in sections)
    n = count_biopsy(text)
    if n:
        log.info(f'    💬 {n} بیوپسی mentions at {source_url}')
    return n


# ── Aggregation ────────────────────────────────────────────────────────────

def aggregate(raw_results):
    """Group by (center_name, city), compute final scores."""
    centers = {}

    for r in raw_results:
        name = clean(r['center_name'])
        city = clean(r['city'])
        if not name:
            continue
        key = center_id(name, city)

        if key not in centers:
            centers[key] = {
                'id':              key,
                'name':            name,
                'city':            city,
                'address':         r.get('address', ''),
                'doctors':         [],
                'biopsy_mentions': 0,
                'score':           0,
                'reasons':         [],
                'source_urls':     [],
                'status':          'new',
            }

        c = centers[key]
        spec = r['spec']
        doc_name = clean(r.get('doctor_name', ''))

        # Add doctor once
        if doc_name and not any(d['name'] == doc_name for d in c['doctors']):
            c['doctors'].append({
                'name':      doc_name,
                'specialty': spec['name'],
                'label':     spec['label'],
                'source':    r.get('source', ''),
            })
            c['score'] += spec['score']
            c['reasons'].append(f'{spec["label"]}: {doc_name}')

        bm = r.get('biopsy_mentions', 0)
        c['biopsy_mentions'] += bm

        url = r.get('source_url', '')
        if url and url not in c['source_urls']:
            c['source_urls'].append(url)

    # Biopsy mention bonus (capped at +15)
    for c in centers.values():
        if c['biopsy_mentions'] > 0:
            bonus = min(c['biopsy_mentions'] * 3, 15)
            c['score'] += bonus
            c['reasons'].append(f'{c["biopsy_mentions"]} نظر با کلیدواژه بیوپسی')

    return sorted(centers.values(), key=lambda x: -x['score'])


# ── Output ────────────────────────────────────────────────────────────────

def save_json(centers, path):
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(centers, f, ensure_ascii=False, indent=2)
    log.info(f'Saved {len(centers)} centers → {path}')


def save_db(centers):
    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        log.warning('psycopg2 not installed — saving to discovered_centers.json instead')
        out = os.path.join(os.path.dirname(__file__), '..', 'discovered_centers.json')
        save_json(centers, out)
        log.info('To import into CRM:\n'
                 '  curl -s -X POST http://localhost:3000/api/discovery/import-file \\\n'
                 '    -H "Content-Type: application/json" \\\n'
                 '    -d @discovered_centers.json  (wrap centers in {"centers":[...]})')
        return

    conn = psycopg2.connect(
        host=os.environ.get('PG_HOST', 'localhost'),
        port=int(os.environ.get('PG_PORT', '5432')),
        database=os.environ.get('PG_DATABASE', 'atena_crm'),
        user=os.environ.get('PG_USER', 'postgres'),
        password=os.environ.get('PG_PASSWORD', ''),
    )
    cur = conn.cursor()

    cur.execute("""
        CREATE TABLE IF NOT EXISTS discovered_centers (
            id TEXT PRIMARY KEY,
            name VARCHAR(300) NOT NULL,
            city VARCHAR(100) DEFAULT '',
            address TEXT DEFAULT '',
            doctors JSONB DEFAULT '[]',
            biopsy_mentions INTEGER DEFAULT 0,
            score INTEGER DEFAULT 0,
            reasons TEXT[] DEFAULT '{}',
            source_urls TEXT[] DEFAULT '{}',
            status VARCHAR(20) DEFAULT 'new',
            last_scraped TIMESTAMPTZ DEFAULT NOW(),
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)

    saved = 0
    for c in centers:
        cur.execute("""
            INSERT INTO discovered_centers
              (id, name, city, address, doctors, biopsy_mentions,
               score, reasons, source_urls, status, last_scraped, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,
              COALESCE((SELECT status FROM discovered_centers WHERE id=%s),'new'),
              NOW(),
              COALESCE((SELECT created_at FROM discovered_centers WHERE id=%s), NOW()))
            ON CONFLICT (id) DO UPDATE SET
              name=EXCLUDED.name, city=EXCLUDED.city, address=EXCLUDED.address,
              doctors=EXCLUDED.doctors, biopsy_mentions=EXCLUDED.biopsy_mentions,
              score=EXCLUDED.score, reasons=EXCLUDED.reasons,
              source_urls=EXCLUDED.source_urls, last_scraped=NOW()
        """, (
            c['id'], c['name'], c['city'], c['address'],
            json.dumps(c['doctors'], ensure_ascii=False),
            c['biopsy_mentions'], c['score'],
            c['reasons'], c['source_urls'],
            c['id'], c['id'],
        ))
        saved += 1

    conn.commit()
    cur.close()
    conn.close()
    log.info(f'Saved {saved} centers to PostgreSQL discovered_centers table')


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Flow CRM biopsy center discovery')
    parser.add_argument('--dry-run',     action='store_true', help='Skip DB write, show top results')
    parser.add_argument('--limit',       type=int, default=40, help='Max doctors per specialty/site')
    parser.add_argument('--no-comments', action='store_true', help='Skip comment mining (faster)')
    parser.add_argument('--output',      default='',         help='Write JSON to this file path')
    args = parser.parse_args()

    all_raw = []

    for spec in SPECIALTIES:
        # nobat.ir
        sleep()
        nobat = scrape_nobat(spec, limit=args.limit)
        for r in nobat:
            r['biopsy_mentions'] = mine_comments(r.get('source_url'), args.no_comments)
        all_raw.extend(nobat)
        log.info(f'  nobat.ir total for {spec["name"]}: {len(nobat)}')

        # doctorto.ir
        sleep()
        dt = scrape_doctorto(spec, limit=args.limit)
        for r in dt:
            r['biopsy_mentions'] = mine_comments(r.get('source_url'), args.no_comments)
        all_raw.extend(dt)
        log.info(f'  doctorto.ir total for {spec["name"]}: {len(dt)}')

    log.info(f'\nRaw results: {len(all_raw)}')
    centers = aggregate(all_raw)
    log.info(f'Unique centers: {len(centers)}')

    # Print top 15
    print('\n── Top 15 discovered centers ──────────────────────────────────────')
    for i, c in enumerate(centers[:15], 1):
        print(f'{i:2d}. [{c["score"]:3d}] {c["name"]}  ({c["city"]})')
        for reason in c['reasons'][:3]:
            print(f'        • {reason}')

    if args.dry_run:
        log.info('[dry-run] Not writing to DB.')
        return

    if args.output:
        save_json(centers, args.output)
    else:
        save_db(centers)


if __name__ == '__main__':
    main()
