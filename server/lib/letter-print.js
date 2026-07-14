'use strict';

const mammoth = require('mammoth');

function he(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Light markdown → HTML (bold + line breaks). Input is escaped first. */
function markdownToHtml(md) {
  if (!md) return '';
  let html = he(md);
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

async function docxToHtml(buf) {
  if (!buf || !buf.length) return '';
  try {
    const result = await mammoth.convertToHtml(
      { buffer: buf },
      {
        styleMap: [
          'b => strong',
          'strong => strong',
          "p[style-name='Heading 1'] => h2:fresh",
          "p[style-name='Heading 2'] => h3:fresh",
        ],
      }
    );
    return result.value || '';
  } catch (e) {
    console.warn('[letter-print] docx convert failed:', e.message);
    return '';
  }
}

async function resolveBodyHtml(letter) {
  if (letter.body_docx && letter.body_docx.length) {
    const fromDocx = await docxToHtml(letter.body_docx);
    if (fromDocx.trim()) return fromDocx;
  }
  const body = letter.body || '';
  if (/\*\*|__|\n/.test(body)) return markdownToHtml(body);
  return he(body).replace(/\n/g, '<br>');
}

function buildLetterheadHtml() {
  return '';
}

function buildSignersBlock(signers, signatureMap) {
  const signed = (signers || []).filter((s) => s.status === 'signed');
  if (!signed.length) return '';

  return signed.map((s) => {
    const imgBuf = signatureMap[s.username];
    const showImg = imgBuf && imgBuf.length;
    const mime = s.signature_mime || 'image/png';
    const imgTag = showImg
      ? `<img class="sig-image" src="data:${mime};base64,${imgBuf.toString('base64')}" alt="امضا"/>`
      : '<span></span>';
    return `<div class="sig-row">
  <div class="sig-info">
    <span class="sig-role">با تشکر</span>
    <span class="sig-name">${he(s.display_name || s.username)}</span>
  </div>
  ${imgTag}
</div>`;
  }).join('\n');
}

const DEFAULT_PRINT_TEMPLATE = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>چاپ نامه — {{subject}}</title>
<link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet">
<style>
body {
  font-family: 'Vazirmatn', Tahoma, sans-serif;
  font-size: 14px;
  color: #1e293b;
  background-color: #e2e8f0;
  margin: 0;
  padding: 40px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  -webkit-font-smoothing: antialiased;
}
.a4-paper {
  background: #ffffff;
  width: 100%;
  max-width: 210mm;
  min-height: 297mm;
  height: 297mm;
  padding: 50mm 20mm 40mm 20mm;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  border-radius: 4px;
  box-sizing: border-box;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 5px 10px;
  font-size: 10px;
  margin-bottom: 18px;
  background: #f8fafc;
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  border-right: 3px solid #6366f1;
  flex-shrink: 0;
}
.meta b { color: #475569; margin-left: 4px; }
.subject-line {
  font-size: 16px;
  font-weight: bold;
  color: #1e3a8a;
  margin: 0 0 16px 0;
  padding-bottom: 10px;
  border-bottom: 1px dashed #cbd5e1;
  flex-shrink: 0;
}
.body-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.body {
  line-height: 1.65;
  text-align: justify;
  text-justify: inter-word;
  font-size: 15.5px;
  color: #0f172a;
}
.body strong, .body b { font-weight: 700; }
.body p { margin: 0 0 0.35em; }
.signers {
  margin-top: auto;
  padding-top: 12px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}
.sig-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 8px 0;
  border-bottom: 1px dashed #e2e8f0;
  color: #334155;
}
.sig-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: right;
}
.sig-name { font-weight: bold; color: #1e293b; }
.sig-role { font-size: 12px; color: #64748b; }
.sig-image {
  max-height: 70px;
  max-width: 160px;
  object-fit: contain;
}
.print-btn {
  margin-top: 30px;
  padding: 12px 30px;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: inherit;
  font-size: 15px;
  font-weight: bold;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}
@media print {
  @page {
    size: A4;
    margin: 50mm 20mm 40mm 20mm;
  }
  body { background: none; padding: 0; }
  .a4-paper {
    box-shadow: none;
    border-radius: 0;
    width: 100%;
    max-width: none;
    height: auto;
    min-height: auto;
    padding: 0;
    page-break-after: avoid;
    page-break-inside: avoid;
  }
  .no-print { display: none !important; }
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
}
</style>
</head>
<body>
<div class="a4-paper">
<div class="meta">
  <div><b>شماره اندیکاتور:</b> {{indicator_number}}</div>
  <div><b>تاریخ:</b> {{date}}</div>
  <div><b>نوع نامه:</b> {{type}}</div>
  <div><b>ثبت\u200cکننده:</b> {{creator}}</div>
  {{sender_block}}
  {{receiver_block}}
</div>
<div class="subject-line">موضوع: {{subject}}</div>
<div class="body-wrap"><div class="body" id="letter-body">{{body}}</div></div>
<div class="signers">{{signers_block}}</div>
</div>
<button class="no-print print-btn" onclick="window.print()">\uD83D\uDDA8 \u0686\u0627\u067E \u0646\u0627\u0645\u0647</button>
<script>
(function fitBodyOnePage() {
  function run() {
    var body = document.getElementById('letter-body');
    var area = body && body.parentElement;
    if (!body || !area) return;
    var fs = 15.5;
    body.style.fontSize = fs + 'px';
    body.style.lineHeight = '1.65';
    for (var i = 0; i < 50 && body.scrollHeight > area.clientHeight && fs > 10; i++) {
      fs -= 0.25;
      body.style.fontSize = fs + 'px';
      body.style.lineHeight = (fs * 0.09 + 1.05).toFixed(2);
    }
  }
  if (document.readyState === 'complete') run();
  else window.addEventListener('load', run);
})();
</script>
</body>
</html>`;

function applyPrintTemplate(template, vars) {
  let html = template;
  Object.keys(vars).forEach((k) => {
    html = html.split(`{{${k}}}`).join(vars[k] == null ? '' : String(vars[k]));
  });
  return html;
}

async function buildPrintHtml(letter, signers, signatureMap, templateHtml) {
  const typeFa = letter.type === 'outgoing' ? 'صادره' : (letter.type === 'incoming' ? 'وارده' : 'داخلی');
  const ind = letter.indicator_number || '—';
  const bodyHtml = await resolveBodyHtml(letter);
  const signersBlock = buildSignersBlock(signers, signatureMap);

  return applyPrintTemplate(templateHtml || DEFAULT_PRINT_TEMPLATE, {
    letterhead: '',
    indicator_number: he(ind),
    type: typeFa,
    date: he(new Date(letter.created_at).toLocaleDateString('fa-IR')),
    creator: he(letter.creator_name || letter.created_by),
    sender_block: letter.sender_external ? `<div><b>فرستنده:</b> ${he(letter.sender_external)}</div>` : '',
    receiver_block: letter.receiver_external ? `<div><b>گیرنده:</b> ${he(letter.receiver_external)}</div>` : '',
    subject: he(letter.subject),
    body: bodyHtml,
    signers_block: signersBlock,
  });
}

module.exports = {
  DEFAULT_PRINT_TEMPLATE,
  he,
  markdownToHtml,
  docxToHtml,
  resolveBodyHtml,
  buildSignersBlock,
  buildLetterheadHtml,
  applyPrintTemplate,
  buildPrintHtml,
};
