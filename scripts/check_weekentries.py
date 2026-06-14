#!/usr/bin/env python3
"""
Diagnose week plan data after center merges.
Run on the server: python3 scripts/check_weekentries.py

Usage:
    python3 scripts/check_weekentries.py [--fix]

Without --fix: only reports the problem.
With --fix: migrates orphaned weekEntries from mz_t_ keys to their c_ counterparts.
"""
import json, os, re, sys
import psycopg2

# Map of merged pairs: mz_t_id → c_id (same as merge_tehran_confirmed.py CONFIRMED list)
MERGE_MAP = {
    'mz_t_87': 'c_165', 'mz_t_112': 'c_357', 'mz_t_11': 'c_552', 'mz_t_839': 'c_31',
    'mz_t_1096': 'c_87', 'mz_t_1185': 'c_118', 'mz_t_1718': 'c_208', 'mz_t_1780': 'c_233',
    'mz_t_1874': 'c_273', 'mz_t_2673': 'c_372', 'mz_t_2976': 'c_470', 'mz_t_3935': 'c_670',
    'mz_t_4042': 'c_647', 'mz_t_4357': 'c_788', 'mz_t_4392': 'c_811', 'mz_t_4396': 'c_813',
    'mz_t_4727': 'c_842', 'mz_t_4915': 'c_887', 'mz_t_4947': 'c_896',
    'mz_t_1691': 'c_185', 'mz_t_742': 'c_1', 'mz_t_762': 'c_3', 'mz_t_763': 'c_4',
    'mz_t_764': 'c_5', 'mz_t_765': 'c_6', 'mz_t_173': 'c_36', 'mz_t_971': 'c_41',
    'mz_t_1249': 'c_140', 'mz_t_51': 'c_547', 'mz_t_928': 'c_35', 'mz_t_944': 'c_38',
    'mz_t_962': 'c_39', 'mz_t_969': 'c_40', 'mz_t_3115': 'c_532', 'mz_t_3133': 'c_533',
    'mz_t_3155': 'c_540', 'mz_t_3208': 'c_549', 'mz_t_2979': 'c_471', 'mz_t_3826': 'c_631',
    'mz_t_4412': 'c_818', 'mz_t_26': 'c_355', 'mz_t_2586': 'c_359', 'mz_t_2611': 'c_363',
    'mz_t_89': 'c_381', 'mz_t_2701': 'c_384', 'mz_t_2543': 'c_354', 'mz_t_2530': 'c_348',
    'mz_t_1065': 'c_71', 'mz_t_3163': 'c_542', 'mz_t_3180': 'c_545', 'mz_t_223': 'c_546',
    'mz_t_3207': 'c_548', 'mz_t_217': 'c_557', 'mz_t_3240': 'c_558', 'mz_t_3243': 'c_559',
    'mz_t_3252': 'c_561', 'mz_t_34': 'c_555', 'mz_t_3235': 'c_556', 'mz_t_3095': 'c_527',
    'mz_t_2988': 'c_478', 'mz_t_3273': 'c_569', 'mz_t_3291': 'c_575', 'mz_t_2807': 'c_415',
    'mz_t_2950': 'c_454', 'mz_t_3025': 'c_499', 'mz_t_3911': 'c_659', 'mz_t_1712': 'c_205',
    'mz_t_192': 'c_648', 'mz_t_4232': 'c_761', 'mz_t_154': 'c_753', 'mz_t_1913': 'c_298',
    'mz_t_4095': 'c_719', 'mz_t_1238': 'c_136', 'mz_t_1035': 'c_56', 'mz_t_126': 'c_15',
    'mz_t_1910': 'c_296', 'mz_t_2648': 'c_369', 'mz_t_3319': 'c_588', 'mz_t_3320': 'c_589',
    'mz_t_3405': 'c_597', 'mz_t_161': 'c_633', 'mz_t_3839': 'c_634', 'mz_t_2704': 'c_385',
    'mz_t_2': 'c_779', 'mz_t_13': 'c_809', 'mz_t_56': 'c_191', 'mz_t_1695': 'c_193',
    'mz_t_3232': 'c_553', 'mz_t_3228': 'c_550', 'mz_t_3233': 'c_554', 'mz_t_157': 'c_250',
    'mz_t_4187': 'c_755', 'mz_t_4188': 'c_756', 'mz_t_1875': 'c_271', 'mz_t_4101': 'c_720',
    'mz_t_3104': 'c_528', 'mz_t_3438': 'c_611', 'mz_t_3929': 'c_669', 'mz_t_4385': 'c_807',
    'mz_t_2752': 'c_401', 'mz_t_2739': 'c_399', 'mz_t_2748': 'c_400', 'mz_t_2760': 'c_403',
    'mz_t_2762': 'c_404', 'mz_t_2763': 'c_405', 'mz_t_2768': 'c_406', 'mz_t_2784': 'c_409',
    'mz_t_4420': 'c_822', 'mz_t_2793': 'c_411', 'mz_t_2800': 'c_413', 'mz_t_2804': 'c_414',
    'mz_t_2808': 'c_416', 'mz_t_2817': 'c_417', 'mz_t_4378': 'c_803', 'mz_t_2843': 'c_421',
    'mz_t_2848': 'c_422', 'mz_t_2850': 'c_423', 'mz_t_2853': 'c_425', 'mz_t_129': 'c_903',
    'mz_t_2860': 'c_428', 'mz_t_2861': 'c_429', 'mz_t_2862': 'c_430', 'mz_t_2870': 'c_432',
    'mz_t_2878': 'c_434', 'mz_t_2879': 'c_435', 'mz_t_2883': 'c_436', 'mz_t_2884': 'c_437',
    'mz_t_2895': 'c_438', 'mz_t_2898': 'c_439', 'mz_t_2899': 'c_440', 'mz_t_2858': 'c_426',
    'mz_t_2859': 'c_427', 'mz_t_2786': 'c_410', 'mz_t_3054': 'c_511', 'mz_t_3058': 'c_512',
    'mz_t_3059': 'c_513', 'mz_t_3065': 'c_514', 'mz_t_3066': 'c_515', 'mz_t_3068': 'c_516',
    'mz_t_3075': 'c_517', 'mz_t_3077': 'c_518', 'mz_t_3079': 'c_519', 'mz_t_3082': 'c_521',
    'mz_t_3084': 'c_522', 'mz_t_3086': 'c_524', 'mz_t_3080': 'c_1002',
    'mz_t_1071': 'c_75', 'mz_t_1082': 'c_81', 'mz_t_37': 'c_22', 'mz_t_3134': 'c_534',
    'mz_t_1033': 'c_54', 'mz_t_1081': 'c_80', 'mz_t_35': 'c_244', 'mz_t_1830': 'c_260',
    'mz_t_1828': 'c_259', 'mz_t_2709': 'c_389', 'mz_t_4423': 'c_823', 'mz_t_2737': 'c_398',
    'mz_t_1047': 'c_63', 'mz_t_1223': 'c_125', 'mz_t_1905': 'c_292', 'mz_t_1680': 'c_182',
    'mz_t_4326': 'c_788', 'mz_t_2948': 'c_453', 'mz_t_2959': 'c_459', 'mz_t_3021': 'c_497',
    'mz_t_2995': 'c_479', 'mz_t_3036': 'c_505', 'mz_t_3043': 'c_507', 'mz_t_3297': 'c_578',
    'mz_t_3412': 'c_598', 'mz_t_4159': 'c_748', 'mz_t_3888': 'c_652', 'mz_t_1841': 'c_264',
    'mz_t_1843': 'c_266', 'mz_t_1854': 'c_267', 'mz_t_3268': 'c_564', 'mz_t_3271': 'c_568',
    'mz_t_1796': 'c_241', 'mz_t_1800': 'c_243', 'mz_t_2999': 'c_482', 'mz_t_252': 'c_715',
    'mz_t_4060': 'c_701', 'mz_t_4394': 'c_812', 'mz_t_1725': 'c_211', 'mz_t_1729': 'c_214',
    'mz_t_169': 'c_222', 'mz_t_1883': 'c_278', 'mz_t_4962': 'c_901', 'mz_t_4919': 'c_889',
    'mz_t_4912': 'c_885', 'mz_t_2463': 'c_331', 'mz_t_4881': 'c_858', 'mz_t_4886': 'c_864',
    'mz_t_4890': 'c_868', 'mz_t_4905': 'c_880', 'mz_t_41': 'c_876', 'mz_t_4880': 'c_857',
    'mz_t_243': 'c_281', 'mz_t_4901': 'c_875', 'mz_t_4922': 'c_892', 'mz_t_4893': 'c_860',
    'mz_t_4969': 'c_902', 'mz_t_59': 'c_904', 'mz_t_4904': 'c_879', 'mz_t_2481': 'c_341',
    'mz_t_2478': 'c_340', 'mz_t_2484': 'c_342', 'mz_t_2489': 'c_343', 'mz_t_2490': 'c_344',
    'mz_t_2534': 'c_351', 'mz_t_162': 'c_825', 'mz_t_3813': 'c_627', 'mz_t_3816': 'c_628',
    'mz_t_3427': 'c_604', 'mz_t_4883': 'c_861', 'mz_t_4324': 'c_787', 'mz_t_1104': 'c_91',
    'mz_t_1105': 'c_92',
}

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
    fix = '--fix' in sys.argv
    env = load_env()
    conn = psycopg2.connect(
        host=env.get('PG_HOST','localhost'), port=int(env.get('PG_PORT','5432')),
        dbname=env.get('PG_DATABASE','atena_crm'), user=env.get('PG_USER','postgres'),
        password=env.get('PG_PASSWORD',''),
    )
    cur = conn.cursor()

    cur.execute("SELECT value FROM app_data WHERE key='main'")
    row = cur.fetchone()
    if not row or not row[0]:
        print("❌ app_data key='main' not found or empty!")
        cur.close(); conn.close(); return

    DB = row[0]
    we = DB.get('weekEntries', {})
    wt = DB.get('weekTags', {})

    print(f"weekEntries: {len(we)} entries")
    print(f"weekTags: {len(wt)} tags")

    # Find entries referencing mz_t_ centers
    to_migrate = {}  # old_key → new_key
    for k, v in list(we.items()):
        if ':::' not in k:
            continue
        week_part, rec_part = k.split(':::', 1)
        # rec_part is like "center_mz_t_1691"
        if not rec_part.startswith('center_mz_t_'):
            continue
        mz_id = rec_part.replace('center_', '')  # "mz_t_1691"
        if mz_id in MERGE_MAP:
            new_rec = f"center_{MERGE_MAP[mz_id]}"
            new_key = f"{week_part}:::{new_rec}"
            to_migrate[k] = new_key

    print(f"\nWeek entries with mz_t_ centers: {sum(1 for k in we if ':::' in k and 'mz_t_' in k.split(':::')[1])}")
    print(f"Migratable (has known c_ target): {len(to_migrate)}")

    if to_migrate:
        print("\nSample migrations:")
        for old, new in list(to_migrate.items())[:5]:
            name = we[old].get('centerName', '?')
            print(f"  {old}")
            print(f"  → {new}  [{name}]")

    if not fix:
        print("\n⚠  Run with --fix to migrate these entries to their c_ counterparts.")
        print("   python3 scripts/check_weekentries.py --fix")
        cur.close(); conn.close(); return

    # Apply migrations
    migrated = 0
    for old_key, new_key in to_migrate.items():
        entry = we.pop(old_key)
        # Update the rid inside the entry too
        mz_id = old_key.split(':::')[1].replace('center_', '')
        c_id = MERGE_MAP[mz_id]
        entry['rid'] = c_id
        # Merge if target already exists (shouldn't normally happen)
        if new_key not in we:
            we[new_key] = entry
        migrated += 1

    DB['weekEntries'] = we

    cur.execute(
        "INSERT INTO app_data (key,value,updated_at,updated_by) VALUES ('main',%s,NOW(),'fix_weekentries') "
        "ON CONFLICT (key) DO UPDATE SET value=%s,updated_at=NOW(),updated_by='fix_weekentries'",
        (json.dumps(DB, ensure_ascii=False),) * 2)
    conn.commit()
    cur.close(); conn.close()
    print(f"\n✅ {migrated} week entries migrated to c_ keys. سرور ریستارت و hard-refresh بزنید.")

if __name__ == '__main__':
    main()
