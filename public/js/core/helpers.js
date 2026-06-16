'use strict';
// ── UI helpers ────────────────────────────────────────────────────────────────
// Extracted from app.js. Depends on: STATUS_LIST, STATUS_CLS, H_CLS, LEAD_CLS (constants).

// ════════════════════════ HELPERS ══════════════════════
function esc(s){return(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function _safeColor(c){return(typeof c==='string'&&(/^#[0-9a-fA-F]{3,8}$/.test(c)||/^rgb/.test(c)||/^hsl/.test(c)))?c:'#888888';}
function fNorm(s){return(s||'').toString().toLowerCase().replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').replace(/[أإآا]/g,'ا').replace(/[\u200c\u200d]/g,' ').replace(/[۰-۹]/g,function(d){return'0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(d)];}).replace(/\s+/g,' ').trim();}
function fMatch(q,t){return!q||fNorm(t).indexOf(fNorm(q))>=0;}
function nowTs(){return Date.now();}
function stCls(st){var i=STATUS_LIST.indexOf(st);return STATUS_CLS[i]||'st-0';}
function stHCls(st){var i=STATUS_LIST.indexOf(st);return H_CLS[i]||'h-st-0';}
function lCls(lead){var l=(lead||'').replace(/[ي]/g,'ی').replace(/[ك]/g,'ک').trim();return LEAD_CLS[l]||'lead-none';}


// ════════════════════════ UI FLASH / TOAST ════════════
function flashRow(id){
  var r=document.querySelector('[data-rowid="'+id+'"]');
  if(r){r.classList.remove('row-flash-ok');void r.offsetWidth;r.classList.add('row-flash-ok');}
}
var _toastTimer=null;
function showToast(msg,dur){
  var t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;t.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){t.classList.remove('show');},dur||2500);
}

