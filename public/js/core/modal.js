'use strict';
// ── Modal system ──────────────────────────────────────────────────────────────
// Extracted from app.js.
// Depends on: closeJDP() (date-picker.js), closeTagMenu() (app.js),
//             getE(), _getContacts(), _phoneHref(), _phoneTitle(), esc() (app.js/helpers.js)

// ════════════════════════ MODAL (DOM-based) ════════════
function openModal(id,titleHTML,bodyHTML,footHTML,opts){
  closeModal(id);
  var overlay=document.createElement('div');
  overlay.className='m-overlay';overlay.id='mo_'+id;
  overlay.addEventListener('click',function(e){if(e.target===overlay)closeModal(id);});
  var box=document.createElement('div');
  box.className='m-box'+(opts&&opts.lg?' lg':'')+(opts&&opts.xl?' xl':'');
  box.addEventListener('click',function(e){if(typeof closeTagMenu==='function')closeTagMenu();e.stopPropagation();});
  var head=document.createElement('div');head.className='m-head';
  head.innerHTML='<span>'+titleHTML+'</span><button class="m-close" onclick="closeModal(\''+id+'\')">✕</button>';
  var body=document.createElement('div');body.className='m-body';body.innerHTML=bodyHTML;
  var foot=document.createElement('div');foot.className='m-foot';foot.innerHTML=footHTML;
  box.appendChild(head);box.appendChild(body);box.appendChild(foot);
  overlay.appendChild(box);document.body.appendChild(overlay);
  return{overlay,box,body,foot};
}
function closeModal(id){
  var m=document.getElementById('mo_'+id);
  if(m)m.remove();
  // also close JDP if open
  closeJDP();
}
function closeAllModals(){
  document.querySelectorAll('.m-overlay').forEach(function(m){m.remove();});
  closeJDP();closeTagMenu();
}

// ════════════════════════ CENTER MODAL ══════════════

function showContactPopup(ev, rtype, id) {
  var e = getE(rtype, id);
  var popup = document.getElementById('centerContactPopup');
  var nameEl = document.getElementById('ccp-name');
  var bodyEl = document.getElementById('ccp-body');
  var contacts = _getContacts(rtype, id);
  if(nameEl)nameEl.textContent = (contacts.length===1&&contacts[0].name)?contacts[0].name:(contacts.length>0?contacts.length+' مخاطب':'اطلاعات تماس');
  var html = '';
  contacts.forEach(function(c, ci) {
    if(c.name||c.title||(c.phones&&c.phones.length)){
      if(contacts.length>1) html += '<div style="font-size:10px;font-weight:700;color:var(--text-secondary);margin-top:'+(ci>0?'8':'0')+'px;margin-bottom:3px">'+(c.name||'مخاطب '+(ci+1))+(c.title?' — '+c.title:'')+'</div>';
      else if(c.name||c.title) html += '<div class="contact-popup-row" style="font-weight:600;font-size:12px">'+(c.name||'')+(c.title?' ('+c.title+')':'')+'</div>';
      (c.phones||[]).forEach(function(p){
        if(p) html += '<div class="contact-popup-row"><a href="'+_phoneHref(p)+'" title="'+_phoneTitle()+'" onclick="event.stopPropagation()" style="color:#0369a1;text-decoration:none;direction:ltr;display:block">📞 '+esc(p)+'</a></div>';
      });
    }
  });
  if (e.address) html += '<div class="contact-popup-row" style="margin-top:5px;color:var(--text-secondary)">📍 '+esc(e.address)+'</div>';
  if(bodyEl)bodyEl.innerHTML = html || '<span style="color:var(--text-muted);font-size:11px">اطلاعاتی ثبت نشده</span>';
  var rect = ev.target.getBoundingClientRect();
  popup.style.top = (rect.bottom + 6) + 'px';
  popup.style.right = (window.innerWidth - rect.right - 10) + 'px';
  popup.style.left = 'auto';
  popup.classList.add('show');
  ev.stopPropagation();
}
function hideContactPopup() {
  var popup = document.getElementById('centerContactPopup');
  if (popup) popup.classList.remove('show');
}

