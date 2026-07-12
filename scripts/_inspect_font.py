from pathlib import Path

js = Path(r'C:\click-crm-app\public\dist\assets\main.js').read_text(encoding='utf-8')
idx = js.find('__name:`Toolbar`')
out = js[idx:idx+25000]
Path(r'C:\click-crm-app\scripts\_font_snippet.txt').write_text(out, encoding='utf-8')
# find key function names
for pat in ['setFontFamily', 'applyFont', 'se(', 'ae=V', 'fontFamilies', 'documentFonts', 'currentFont']:
    i = out.find(pat)
    print(pat, i)
