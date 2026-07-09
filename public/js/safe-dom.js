'use strict';
/**
 * Safe DOM helpers — prefer textContent for plain text; esc() before HTML insertion.
 */
function safeText(el, text) {
  if (!el) return;
  el.textContent = text == null ? '' : String(text);
}

/** Set innerHTML only when html is trusted static markup; user strings must use esc() first. */
function safeHTML(el, html) {
  if (!el) return;
  el.innerHTML = html == null ? '' : String(html);
}

/** Escape then set as HTML (for simple formatted user text). */
function safeUserHTML(el, text) {
  if (!el) return;
  el.innerHTML = typeof esc === 'function' ? esc(text) : String(text || '');
}

/** Remove script tags only (keeps onclick handlers used by modal footers). */
function stripScripts(html) {
  return String(html || '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
}

window.safeText = safeText;
window.safeHTML = safeHTML;
window.safeUserHTML = safeUserHTML;
window.stripScripts = stripScripts;
