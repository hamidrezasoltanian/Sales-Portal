import re

t = open('node_modules/@stll/folio-vue/dist/index.js', encoding='utf-8').read()
start = t.find('DocxEditor.vue')
chunk = t[start:start + 200000]
for s in ['selection', 'Selection', 'caret', 'Caret', 'highlight', 'overlay']:
    print(s, chunk.count(s))
for m in re.finditer(r'__name:\s*"([^"]+)"', chunk):
    name = m.group(1)
    if any(x in name for x in ['elect', 'verlay', 'aged', 'Caret', 'Selection']):
        print('component', name)

# main.js - find selection overlay painter
m = open('public/dist/assets/main.js', encoding='utf-8').read()
for pat in [
    'data-folio-selection-rect',
    'data-folio-caret-rect',
    'FOLIO_SELECTION_RECT',
    'FOLIO_CARET_RECT',
    'getSelectionRectsFromDom',
    'SelectionOverlay',
    'selectionHighlight',
    'selectionFill',
    'doc-primary',
    'aecbfa',
    'cfe2f3',
    'highlightColor',
]:
    print(pat, m.find(pat))

# search for background with doc-primary in selection context
idx = 0
count = 0
while count < 10:
    i = m.find('background', idx)
    if i < 0:
        break
    snippet = m[i:i+120]
    if 'selection' in snippet.lower() or 'caret' in snippet.lower() or 'folio' in snippet.lower():
        print('bg:', snippet)
        count += 1
    idx = i + 1
