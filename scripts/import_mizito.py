#!/usr/bin/env python3
"""
Import Mizito CRM export (MHT file) into Flow CRM database.

Usage:
    python3 scripts/import_mizito.py <path/to/mizito_export.mht>

What it does:
  1. Parses the MHT/HTML file
  2. Maps Mizito tags → potential / lead / status / type / rTags
  3. Detects province from address
  4. Adds each center to PC_RAW (or CENTERS for Tehran) if not already present
  5. Adds contacts + all fields to DB.edits
  6. Writes back to PostgreSQL without overwriting existing data
"""

import json
import os
import re
import sys
import psycopg2

# ─── Province name → province id ─────────────────────────────────────────────
PROVINCE_MAP = {
    'فارس': 'p1',
    'اصفهان': 'p2',
    'سیستان و بلوچستان': 'p3',
    'مازندران': 'p4',
    'آذربایجان شرقی': 'p5',
    'لرستان': 'p6',
    'بوشهر': 'p7',
    'گلستان': 'p8',
    'خراسان جنوبی': 'p9',
    'چهارمحال و بختیاری': 'p10',
    'اردبیل': 'p11',
    'خراسان رضوی': 'p12',
    'یزد': 'p13',
    'قم': 'p14',
    'زنجان': 'p15',
    'مرکزی': 'p16',
    'گیلان': 'p17',
    'خراسان شمالی': 'p18',
    'ایلام': 'p19',
    'خوزستان': 'p20',
    'کرمانشاه': 'p21',
    'آذربایجان غربی': 'p22',
    'کرمان': 'p23',
    'البرز': 'p24',
    'همدان': 'p25',
    'قزوین': 'p26',
    'کردستان': 'p27',
    'هرمزگان': 'p28',
    'کهگیلویه و بویراحمد': 'p29',
    'سمنان': 'p30',
}

# ─── Tag mapping ──────────────────────────────────────────────────────────────
POTENTIAL_MAP = {
    'پرمصرف': 1,
    'متوسط': 2,
    'کم مصرف': 3,
    'بدون مصرف': 4,
}

LEAD_MAP = {
    'مشتری': 'مشتری',
    'فرصت': 'فرصت',
    'سرنخ': 'سرنخ',
}

STATUS_FROM_LEAD = {
    'مشتری': 'قرارداد بسته شد',
    'فرصت': 'پیشنهاد ارسال شد',
    'سرنخ': 'تماس اولیه',
}

# Organizational tags → type hint (may be overridden by name detection)
ORG_TYPE_MAP = {
    'دانشگاهی': 'بیمارستان',
    'تامین اجتماعی': 'بیمارستان',
    'نظامی': 'بیمارستان',
    'خصوصی': 'کلینیک',
    'تجهیزات پزشکی': 'دیگر',
}

# Product interest tags
PRODUCT_TAGS = {'بیوپسی', 'نفروستومی', 'کتتر شریانی'}


def detect_type_from_name(name):
    """Detect center type from its name."""
    n = name
    if 'بیمارستان' in n: return 'بیمارستان'
    if 'کلینیک' in n: return 'کلینیک'
    if 'داروخانه' in n: return 'داروخانه'
    if 'آزمایشگاه' in n: return 'آزمایشگاه'
    if 'درمانگاه' in n: return 'درمانگاه'
    if 'مطب' in n or ('دکتر' in n and 'بیمارستان' not in n): return 'مطب'
    if 'تجهیزات' in n or 'پزشکی' in n: return 'دیگر'
    return 'دیگر'


def detect_province_id(address):
    """Detect province id from address string. Returns (provId, isTehran)."""
    if not address:
        return None, False
    # Tehran patterns (city of Tehran → separate CENTERS list)
    if re.search(r'تهران\s+تهران|استان تهران|ایران تهران|ایران IR تهران|^تهران[،\s\-]', address):
        return 'tehran', True
    # Province name lookup (including common misspellings in Mizito data)
    ALIASES = {
        'کهکیلویه و بویر احمد': 'p29',
        'کهگیلویه و بویراحمد': 'p29',
        'کهکیلویه': 'p29',
        'بویراحمد': 'p29',
        'یاسوج': 'p29',
    }
    for alias, pid in ALIASES.items():
        if alias in address:
            return pid, False
    for prov_name, prov_id in PROVINCE_MAP.items():
        if prov_name in address:
            return prov_id, False
    # City-name fallback (when address has no province name)
    CITY_TO_PROV = {
        'ارومیه': 'p22', 'اورمیه': 'p22',
        'ساری': 'p4', 'بابل': 'p4', 'آمل': 'p4', 'نوشهر': 'p4',
        'رشت': 'p17', 'لاهیجان': 'p17', 'انزلی': 'p17',
        'اهواز': 'p20', 'دزفول': 'p20', 'آبادان': 'p20',
        'تبریز': 'p5',
        'شیراز': 'p1',
        'مشهد': 'p12',
        'اصفهان': 'p2',
        'کرمانشاه': 'p21',
        'اراک': 'p16',
        'قم': 'p14',
        'کرج': 'p24',
        'زنجان': 'p15',
        'سنندج': 'p27',
        'همدان': 'p25',
        'قزوین': 'p26',
        'یزد': 'p13',
        'بندرعباس': 'p28',
        'کرمان': 'p23',
        'بوشهر': 'p7',
        'گرگان': 'p8', 'گنبد': 'p8',
        'بیرجند': 'p9',
        'شهرکرد': 'p10',
        'اردبیل': 'p11',
        'خرم آباد': 'p6', 'خرم‌آباد': 'p6',
        'ایلام': 'p19',
        'زاهدان': 'p3',
        'سمنان': 'p30',
    }
    for city, pid in CITY_TO_PROV.items():
        if city in address:
            return pid, False
    # If starts with تهران → Tehran
    if address.startswith('تهران'):
        return 'tehran', True
    return None, False


def strip_html(s):
    """Strip HTML tags and decode common entities."""
    s = re.sub(r'<[^>]+>', '', s)
    s = s.replace('&nbsp;', ' ').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>').replace('&#160;', ' ')
    return s.strip()


def normalize_phone(p):
    """Normalize phone number."""
    p = strip_html(str(p)).strip()
    # Remove spaces, dashes, +98, spaces
    p = re.sub(r'[\s\-\+]', '', p)
    p = re.sub(r'^98', '0', p)
    # Keep as-is if it looks reasonable
    return p if p else ''


def parse_mht(filepath):
    """Parse MHT file and extract customer list."""
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    html_start = content.find('<tbody')
    html_end = content.find('</tbody>') + len('</tbody>')
    if html_start < 0:
        raise ValueError('Could not find <tbody> in file')
    html = content[html_start:html_end]

    # Pattern to extract the 9 rowspan fields for each customer
    pattern = (
        r'<td rowspan="(\d+)">(\d+)</td>\s*\n'
        r'\s*<td rowspan="\1">(.*?)</td>\s*\n'   # name
        r'\s*<td rowspan="\1">(.*?)</td>\s*\n'   # brand
        r'\s*<td rowspan="\1">(.*?)</td>\s*\n'   # phone_fix
        r'\s*<td rowspan="\1">(.*?)</td>\s*\n'   # phone_mob
        r'\s*<td rowspan="\1">(.*?)</td>\s*\n'   # email
        r'\s*<td rowspan="\1">(.*?)</td>\s*\n'   # address
        r'\s*\n'
        r'\s*<td rowspan="\1">(.*?)</td>'        # tags
    )

    # Find all customer positions in HTML to extract contact rows
    cust_matches = list(re.finditer(pattern, html, re.DOTALL))

    # Also find all contact rows: plain <td>name</td><td>phone</td> pairs
    # These appear AFTER the main rowspan block
    # Use \s+ to handle both single and double newlines between tags
    contact_pattern = re.compile(
        r'<tr>\s+<td>([^<]*)</td>\s+<td>([^<]*)</td>\s+</tr>'
    )

    customers = []
    for i, m in enumerate(cust_matches):
        rowspan_s, rownum_s, name, brand, phone_fix, phone_mob, email, address, tags_raw = m.groups()

        # Validate row number (accept any positive integer — file has up to 5285 rows)
        try:
            rownum = int(rownum_s)
            if rownum < 1:
                continue
        except Exception:
            continue

        rowspan = int(rowspan_s)
        name = strip_html(name).strip()
        if not name:
            continue

        # Parse tags
        tags = [t.strip() for t in tags_raw.split(',') if t.strip()]

        # Map fields
        potential = 2  # default
        for tag, val in POTENTIAL_MAP.items():
            if tag in tags:
                potential = val
                break

        lead = 'ندارد'
        for tag, val in LEAD_MAP.items():
            if tag in tags:
                lead = val
                break

        status = STATUS_FROM_LEAD.get(lead, 'تماس اولیه')

        # Type: first from name, then from org tags
        ctype = detect_type_from_name(name)
        for tag, tval in ORG_TYPE_MAP.items():
            if tag in tags and ctype == 'دیگر':
                ctype = tval
                break

        # Product tags
        product_tags = [t for t in tags if t in PRODUCT_TAGS]

        # Province
        prov_id, is_tehran = detect_province_id(address)

        # Contacts: find in the block between this customer and the next
        block_start = m.start()
        block_end = cust_matches[i + 1].start() if i + 1 < len(cust_matches) else len(html)
        block = html[block_start:block_end]

        contacts = []
        # First contact row is embedded in the main td block (first representative)
        # subsequent contacts appear as plain <tr><td>name</td><td>phone</td></tr>
        # Allow any content (including HTML) inside the rowspan tags cell
        main_contact_m = re.search(
            r'<td rowspan="\d+">.*?</td>\s*\n\s*<td>([^<]*)</td>\s*\n\s*<td>([^<]*)</td>',
            block, re.DOTALL
        )
        if main_contact_m:
            cname = strip_html(main_contact_m.group(1)).strip()
            cphone = normalize_phone(main_contact_m.group(2))
            if cname or cphone:
                contacts.append({'name': cname, 'title': '', 'phones': [p for p in [cphone] if p]})

        for cm in contact_pattern.finditer(block):
            cname = strip_html(cm.group(1)).strip()
            cphone = normalize_phone(cm.group(2))
            # Skip if duplicate first contact
            if contacts and contacts[0]['name'] == cname:
                continue
            if cname or cphone:
                contacts.append({'name': cname, 'title': '', 'phones': [p for p in [cphone] if p]})

        # Build phone list from header fields (center-level landline + mobile)
        header_phones = []
        for ph in [phone_fix, phone_mob]:
            pn = normalize_phone(ph)
            if pn and len(pn) >= 6:
                header_phones.append(pn)

        # Add header phones to first contact (merge, avoid duplicates)
        if header_phones:
            if not contacts:
                contacts.append({'name': '', 'title': '', 'phones': header_phones})
            else:
                existing_phones = set(contacts[0]['phones'])
                for hp in header_phones:
                    if hp not in existing_phones:
                        contacts[0]['phones'].append(hp)
                        existing_phones.add(hp)

        customers.append({
            'rownum': rownum,
            'name': name,
            'brand': strip_html(brand).strip(),
            'address': strip_html(address).strip(),
            'potential': potential,
            'lead': lead,
            'status': status,
            'type': ctype,
            'tags': tags,
            'product_tags': product_tags,
            'contacts': contacts,
            'prov_id': prov_id,
            'is_tehran': is_tehran,
        })

    return customers


def load_env():
    """Load .env from project root."""
    env = {}
    env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                m = re.match(r'^\s*([^#\s][^=]*?)\s*=\s*(.*)\s*$', line)
                if m:
                    env[m.group(1)] = m.group(2).strip().strip("'\"")
    return env


def main():
    if len(sys.argv) < 2:
        print('Usage: python3 scripts/import_mizito.py <file.mht>')
        sys.exit(1)

    mht_path = sys.argv[1]
    if not os.path.exists(mht_path):
        print(f'File not found: {mht_path}')
        sys.exit(1)

    print(f'Parsing {mht_path}...')
    customers = parse_mht(mht_path)
    print(f'Parsed {len(customers)} customers')

    # Stats
    prov_counts = {}
    for c in customers:
        key = 'تهران' if c['is_tehran'] else (c['prov_id'] or 'نامشخص')
        prov_counts[key] = prov_counts.get(key, 0) + 1
    print('Province distribution:')
    for prov, cnt in sorted(prov_counts.items(), key=lambda x: -x[1])[:10]:
        print(f'  {prov}: {cnt}')

    # Load DB credentials
    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST', 'localhost'),
        port=int(env.get('PG_PORT', '5432')),
        dbname=env.get('PG_DATABASE', 'atena_crm'),
        user=env.get('PG_USER', 'postgres'),
        password=env.get('PG_PASSWORD', ''),
    )
    cur = conn.cursor()

    # ── Load current centers_master ───────────────────────────────────────────
    cur.execute("SELECT key, data FROM centers_master WHERE key IN ('CENTERS', 'PC_RAW')")
    rows = cur.fetchall()
    centers_data = {r[0]: r[1] for r in rows}
    CENTERS = centers_data.get('CENTERS', [])
    PC_RAW = centers_data.get('PC_RAW', {})

    # Migrate any legacy centers that used 'n' key instead of 'row'
    for prov_id, pcs in PC_RAW.items():
        if isinstance(pcs, list):
            for pc in pcs:
                if isinstance(pc, dict) and 'n' in pc and 'row' not in pc:
                    pc['row'] = pc.pop('n')

    # Build name lookup for existing centers
    existing_names = set()
    for c in CENTERS:
        existing_names.add(c.get('name', '').strip())
    for prov_id, pcs in PC_RAW.items():
        for pc in (pcs if isinstance(pcs, list) else []):
            if isinstance(pc, dict):
                existing_names.add(pc.get('name', '').strip())

    # ── Load current DB (main) ────────────────────────────────────────────────
    cur.execute("SELECT value FROM app_data WHERE key = 'main'")
    row = cur.fetchone()
    DB = row[0] if row else {}
    if not DB:
        DB = {}
    if 'edits' not in DB:
        DB['edits'] = {}
    if 'rTags' not in DB:
        DB['rTags'] = {}

    # ── Process each customer ─────────────────────────────────────────────────
    added_pc = 0
    added_tehran = 0
    updated_edits = 0
    skipped_existing = 0

    for c in customers:
        name = c['name']

        # Determine center key
        if c['is_tehran']:
            # Add to CENTERS (Tehran list)
            # Check if already exists by name
            existing = next((x for x in CENTERS if x.get('name', '').strip() == name), None)
            if existing:
                center_id = existing.get('id', f"mz_t_{c['rownum']}")
                edit_key = f"center_{center_id}"
                skipped_existing += 1
            else:
                center_id = f"mz_t_{c['rownum']}"
                CENTERS.append({
                    'id': center_id,
                    'name': name,
                    'type': c['type'],
                    'owner': '',
                    'potential': c['potential'],
                    '_mizito': True,
                })
                edit_key = f"center_{center_id}"
                added_tehran += 1
        elif c['prov_id']:
            prov_id = c['prov_id']
            if prov_id not in PC_RAW:
                PC_RAW[prov_id] = []
            # Check if already exists by name
            existing = next((x for x in PC_RAW[prov_id] if isinstance(x, dict) and x.get('name', '').strip() == name), None)
            if existing:
                n_idx = existing.get('row', existing.get('n', 0))
                edit_key = f"pc_{prov_id}||{n_idx}"
                skipped_existing += 1
            else:
                n_idx = len(PC_RAW[prov_id])
                PC_RAW[prov_id].append({
                    'row': n_idx,
                    'name': name,
                    'type': c['type'],
                    'lead': 'سرنخ',
                    'owner': '',
                    '_mizito': True,
                })
                edit_key = f"pc_{prov_id}||{n_idx}"
                added_pc += 1
        else:
            # No province detected — store with special prefix, skip province assignment
            edit_key = f"mz_unknown_{c['rownum']}"

        # Build edit entry — don't overwrite existing data if key already present
        existing_edit = DB['edits'].get(edit_key, {})
        if existing_edit:
            # Merge contacts: add new contacts and merge missing phones into existing ones
            existing_contacts = existing_edit.get('contacts', [])
            existing_contact_names = {ct.get('name', '') for ct in existing_contacts}
            for ct in c['contacts']:
                cname = ct.get('name', '')
                if cname not in existing_contact_names:
                    existing_contacts.append(ct)
                else:
                    # Contact exists — merge any new phones
                    existing_ct = next((x for x in existing_contacts if x.get('name', '') == cname), None)
                    if existing_ct:
                        ep = set(existing_ct.get('phones', []))
                        for ph in ct.get('phones', []):
                            if ph not in ep:
                                existing_ct.setdefault('phones', []).append(ph)
                                ep.add(ph)
            # If no contacts at all yet, use fresh list
            if not existing_contacts and c['contacts']:
                existing_contacts = c['contacts']
            existing_edit['contacts'] = existing_contacts
            # Only update fields that are currently empty/default
            if not existing_edit.get('address') and c['address']:
                existing_edit['address'] = c['address']
            DB['edits'][edit_key] = existing_edit
        else:
            DB['edits'][edit_key] = {
                'status': c['status'],
                'lead': c['lead'],
                'potential': c['potential'],
                'type': c['type'],
                'address': c['address'],
                'contacts': c['contacts'],
                '_ts': 0,
                '_mizitoRow': c['rownum'],
            }
            updated_edits += 1

        # Store product tags in rTags
        if c['product_tags']:
            DB['rTags'][edit_key] = c['product_tags']

    print(f'\nResults:')
    print(f'  Added to PC_RAW (provinces): {added_pc}')
    print(f'  Added to CENTERS (Tehran):   {added_tehran}')
    print(f'  Updated DB.edits:            {updated_edits}')
    print(f'  Matched existing centers:    {skipped_existing}')

    # ── Save back to DB ───────────────────────────────────────────────────────
    print('\nSaving to database...')

    cur.execute(
        """INSERT INTO centers_master (key, data, updated_at)
           VALUES ('CENTERS', %s, NOW())
           ON CONFLICT (key) DO UPDATE SET data = %s, updated_at = NOW()""",
        (json.dumps(CENTERS, ensure_ascii=False), json.dumps(CENTERS, ensure_ascii=False))
    )
    cur.execute(
        """INSERT INTO centers_master (key, data, updated_at)
           VALUES ('PC_RAW', %s, NOW())
           ON CONFLICT (key) DO UPDATE SET data = %s, updated_at = NOW()""",
        (json.dumps(PC_RAW, ensure_ascii=False), json.dumps(PC_RAW, ensure_ascii=False))
    )
    cur.execute(
        """INSERT INTO app_data (key, value, updated_at, updated_by)
           VALUES ('main', %s, NOW(), 'mizito_import')
           ON CONFLICT (key) DO UPDATE SET value = %s, updated_at = NOW(), updated_by = 'mizito_import'""",
        (json.dumps(DB, ensure_ascii=False), json.dumps(DB, ensure_ascii=False))
    )

    conn.commit()
    cur.close()
    conn.close()

    print('✅ Import complete!')
    print()
    print('Next steps:')
    print('  1. Restart the server: node server/index.js')
    print('  2. Reload the app in your browser')
    print('  3. The imported centers will appear in each province tab')


if __name__ == '__main__':
    main()
