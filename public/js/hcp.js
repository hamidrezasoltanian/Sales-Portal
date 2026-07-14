'use strict';

// ── HCP DIRECTORY & RELATIONSHIP MODULE ─────────────────────────────────────
// Handles the Healthcare Professionals (HCP) directory tab, searching, 
// editing, and managing affiliations with Centers (Healthcare Organizations - HCO).

window._hcpCache = []; // Global cache of HCPs

// ── TAB RENDERING ──────────────────────────────────────────────────────────
function renderHCPPanel() {
  var panel = document.getElementById('hcpPanel');
  if (!panel) return;

  var html = '<div class="hcp-container" style="font-family:inherit;direction:rtl;text-align:right">';
  
  // Header
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">'
    + '<h2 style="font-size:18px;font-weight:700;color:var(--text-primary);margin:0">👤 بانک اطلاعات پزشکان و کارشناسان</h2>'
    + '<button class="btn-primary" onclick="_hcpOpenCreateModal()" style="display:flex;align-items:center;gap:6px;font-weight:700;padding:8px 16px;border-radius:8px">'
    + '➕ ثبت پزشک / کارشناس جدید</button>'
    + '</div>';

  // Filters Bar
  html += '<div style="background:var(--bg-raised);border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center">'
    + '<div style="flex:1;min-width:200px">'
    + '<input type="text" id="hcpSearchInput" placeholder="جستجو بر اساس نام، تلفن..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:13px;background:var(--bg-input);color:var(--text-primary)" oninput="_hcpDebouncedSearch()">'
    + '</div>'
    + '<div style="width:180px">'
    + '<select id="hcpSpecialtyFilter" style="width:100%;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:13px;background:var(--bg-input);color:var(--text-primary)" onchange="_hcpSearch()">'
    + '<option value="">همه تخصص‌ها...</option>'
    + '<option value="رادیولوژی">رادیولوژی</option>'
    + '<option value="رادیولوژی مداخله‌ای">رادیولوژی مداخله‌ای</option>'
    + '<option value="ارولوژی">ارولوژی</option>'
    + '<option value="انکولوژی">انکولوژی</option>'
    + '<option value="جراحی">جراحی عمومی</option>'
    + '<option value="نفرولوژی">نفرولوژی</option>'
    + '<option value="خرید">تجهیزات / خرید</option>'
    + '</select>'
    + '</div>'
    + '<div style="width:160px">'
    + '<select id="hcpInfluenceFilter" style="width:100%;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:13px;background:var(--bg-input);color:var(--text-primary)" onchange="_hcpSearch()">'
    + '<option value="">همه نقش‌ها...</option>'
    + '<option value="KOL">⭐ KOL فقط</option>'
    + '<option value="Decision Maker">تصمیم‌گیرنده</option>'
    + '<option value="Influencer">تأثیرگذار</option>'
    + '</select>'
    + '</div>'
    + '<div style="display:flex;gap:6px">'
    + '<button id="hcpViewGridBtn" onclick="window._hcpView=\'grid\';_renderHCPData()" class="btn-primary" style="padding:6px 12px;border-radius:8px">🗂 کارتی</button>'
    + '<button id="hcpViewTreeBtn" onclick="window._hcpView=\'tree\';_renderHCPData()" class="btn-secondary" style="padding:6px 12px;border-radius:8px">🌳 درختی</button>'
    + '</div>'
    + '</div>';

  // Directory List Container
  html += '<div id="hcpListArea"></div>';
  html += '</div>';

  panel.innerHTML = html;
  _hcpSearch();
}

// ── DIRECTORY SEARCH & LISTING ──────────────────────────────────────────────
var _hcpSearchTimeout = null;
function _hcpDebouncedSearch() {
  if (_hcpSearchTimeout) clearTimeout(_hcpSearchTimeout);
  _hcpSearchTimeout = setTimeout(_hcpSearch, 300);
}

function _hcpSearch() {
  var q = document.getElementById('hcpSearchInput') ? document.getElementById('hcpSearchInput').value.trim() : '';
  var spec = document.getElementById('hcpSpecialtyFilter') ? document.getElementById('hcpSpecialtyFilter').value : '';
  var infl = document.getElementById('hcpInfluenceFilter') ? document.getElementById('hcpInfluenceFilter').value : '';
  var listArea = document.getElementById('hcpListArea');
  if (!listArea) return;

  listArea.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-muted)">⏳ در حال بارگذاری پزشکان...</div>';

  var url = '/api/hcps?q=' + encodeURIComponent(q) + '&specialty=' + encodeURIComponent(spec);
  fetch(url)
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(data) {
      if (infl) {
        data = data.filter(function(hcp) {
          return (hcp.affiliations || []).some(function(a) { return a.influence_level === infl; });
        });
      }
      window._hcpCache = data;
      _renderHCPData();
    });
}

function _renderHCPData() {
  var data = window._hcpCache || [];
  var listArea = document.getElementById('hcpListArea');
  if (!listArea) return;
  
  window._hcpView = window._hcpView || 'grid';
  
  var gridBtn = document.getElementById('hcpViewGridBtn');
  var treeBtn = document.getElementById('hcpViewTreeBtn');
  if (gridBtn && treeBtn) {
    gridBtn.className = window._hcpView === 'grid' ? 'btn-primary' : 'btn-secondary';
    treeBtn.className = window._hcpView === 'tree' ? 'btn-primary' : 'btn-secondary';
  }

  if (!data.length) {
    listArea.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);background:var(--bg-card);border:1px dashed var(--border);border-radius:10px">'
      + '<div style="font-size:24px;margin-bottom:8px">👥</div>'
      + 'هیچ پزشک یا کارشناسی یافت نشد'
      + '</div>';
    listArea.style.display = 'block';
    return;
  }

  if (window._hcpView === 'grid') {
    listArea.style.display = 'grid';
    listArea.style.gridTemplateColumns = 'repeat(auto-fill, minmax(280px, 1fr))';
    listArea.style.gap = '12px';
    listArea.innerHTML = data.map(function(hcp) {
      var phonesHtml = (hcp.phones || []).map(function(ph) {
        return '<div style="display:inline-flex;align-items:center;gap:6px;background:var(--bg-raised);border:1px solid var(--border);padding:2px 8px;border-radius:12px;font-size:11px;direction:ltr">'
          + '📞 ' + esc(ph)
          + ' <a href="tel:'+ph+'" style="text-decoration:none">📞</a>'
          + ' <a href="https://wa.me/'+_waNum(ph)+'" target="_blank" style="text-decoration:none;font-size:12px">💬</a>'
          + '</div>';
      }).join(' ') || '<span style="color:var(--text-muted)">بدون شماره تلفن</span>';

      var tagHtml = hcp.specialty 
        ? '<span style="font-size:10px;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;padding:2px 8px;border-radius:10px;font-weight:600">'+esc(hcp.specialty)+'</span>'
        : '';
      var rankHtml = hcp.rank ? '<span style="font-size:11px;color:var(--text-secondary);font-weight:600">'+esc(hcp.rank)+'</span> ' : '';

      return '<div class="card" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,.05);display:flex;flex-direction:column;justify-content:space-between">'
        + '<div>'
        + '<div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">'
        + '<div>'
        + '<div style="font-weight:700;font-size:14px;color:var(--text-primary)">' + rankHtml + esc(hcp.name) + '</div>'
        + (hcp.medical_council_no ? '<div style="font-size:10px;color:var(--text-muted);margin-top:2px">نظام پزشکی: ' + esc(hcp.medical_council_no) + '</div>' : '')
        + '</div>'
        + tagHtml
        + '</div>'
        + '<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:4px">' + phonesHtml + '</div>'
        + (hcp.notes ? '<div style="font-size:11px;color:var(--text-secondary);background:var(--bg-raised);padding:6px 8px;border-radius:6px;margin-top:8px;line-height:1.4">' + esc(hcp.notes) + '</div>' : '')
        + '</div>'
        + '<div style="margin-top:14px;padding-top:10px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">'
        + '<button class="btn-secondary" onclick="_hcpShowAffiliations(\''+hcp.id+'\',\''+esc(hcp.name)+'\')" style="font-size:10px;padding:4px 8px;border-radius:6px">🏥 مراکز تحت پوشش</button>'
        + '<div style="display:flex;gap:4px">'
        + '<button onclick="_hcpToggleActive(\''+hcp.id+'\', '+(hcp.is_active === false ? 'true' : 'false')+')" style="background:'+(hcp.is_active === false ? '#dcfce7' : '#fef9c3')+';color:'+(hcp.is_active === false ? '#166534' : '#854d0e')+';border:1px solid '+(hcp.is_active === false ? '#bbf7d0' : '#fef08a')+';border-radius:6px;cursor:pointer;font-size:10px;padding:4px 8px;font-family:inherit">'+(hcp.is_active === false ? '✅ فعال' : '🚫 غیرفعال')+'</button>'
        + '<button class="btn-secondary" onclick="_hcpOpenEditModal(\''+hcp.id+'\')" style="font-size:10px;padding:4px 8px;border-radius:6px">✏️ ویرایش</button>'
        + '<button onclick="_hcpDelete(\''+hcp.id+'\')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;cursor:pointer;font-size:10px;padding:4px 8px;font-family:inherit">🗑 حذف</button>'
        + '</div>'
        + '</div>'
        + '</div>';
    }).join('');
  } else {
    // Tree View
    _renderHCPTreeView(data, listArea);
  }
}

function _renderHCPTreeView(data, listArea) {
  listArea.style.display = 'block';
  var tree = {};
  
  // Group by Province -> Center
  data.forEach(function(hcp) {
    var affs = hcp.affiliations || [];
    if (!affs.length) affs = [{ center_key: 'no_center' }];
    
    affs.forEach(function(aff) {
      var centerName = 'بدون مرکز';
      var provName = 'نامشخص';
      var cKey = aff.center_key;
      
      if (cKey !== 'no_center') {
        if (typeof _getCenterName === 'function') {
          var parts = cKey.split('_');
          var rt = parts[0] || 'center';
          var cid = parts.slice(1).join('_');
          centerName = _getCenterName(rt, cid) || cKey;
        } else if (typeof getRecLabel === 'function') {
          centerName = getRecLabel(cKey) || cKey;
        }
        var provId = (cKey.indexOf('||') >= 0) ? cKey.split('||')[0] : (cKey.split('_')[0] === 'pc' ? cKey.split('_')[1] : 'tehran');
        if (typeof getAllProvinces === 'function') {
          var pObj = getAllProvinces().find(function(x) { return x.id === provId || x.name === provId; });
          if (pObj) provName = pObj.name;
        }
      }
      
      if (!tree[provName]) tree[provName] = {};
      if (!tree[provName][centerName]) tree[provName][centerName] = [];
      tree[provName][centerName].push(hcp);
    });
  });

  var html = '<div style="display:flex;flex-direction:column;gap:12px">';
  var provKeys = Object.keys(tree).sort();
  
  provKeys.forEach(function(prov) {
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden">';
    html += '<div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'block\' : \'none\'" style="padding:12px 16px;background:var(--bg-raised);cursor:pointer;font-weight:700;display:flex;justify-content:space-between;align-items:center">';
    html += '<span>📍 استان ' + esc(prov) + '</span><span style="font-size:12px;color:var(--text-muted)">▼</span></div>';
    html += '<div style="display:block;padding:12px">';
    
    var centerKeys = Object.keys(tree[prov]).sort();
    centerKeys.forEach(function(center) {
      html += '<div style="margin-bottom:12px;border:1px solid var(--border-input);border-radius:8px;overflow:hidden">';
      html += '<div onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'block\' : \'none\'" style="padding:10px 12px;background:rgba(0,0,0,0.02);cursor:pointer;font-weight:600;font-size:13px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-input)">';
      html += '<span>🏥 ' + esc(center) + ' <span style="font-size:11px;font-weight:normal;color:var(--text-secondary)">(' + tree[prov][center].length + ' مخاطب)</span></span><span style="font-size:10px;color:var(--text-muted)">▼</span></div>';
      html += '<div style="display:none;padding:8px">';
      
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px">';
      tree[prov][center].forEach(function(hcp) {
        var inactiveStyle = hcp.is_active === false ? 'opacity:0.6;text-decoration:line-through' : '';
        html += '<tr style="border-bottom:1px solid var(--border-input)">';
        html += '<td style="padding:8px;'+inactiveStyle+'">👤 ' + esc(hcp.name) + '</td>';
        html += '<td style="padding:8px;color:var(--text-secondary)">' + esc(hcp.specialty || '-') + '</td>';
        html += '<td style="padding:8px;direction:ltr;text-align:right">' + (hcp.phones||[]).join(', ') + '</td>';
        html += '<td style="padding:8px;text-align:left"><button onclick="_hcpOpenEditModal(\''+hcp.id+'\')" class="btn-secondary" style="font-size:10px;padding:2px 6px">ویرایش</button></td>';
        html += '</tr>';
      });
      html += '</table>';
      
      html += '</div></div>';
    });
    
    html += '</div></div>';
  });
  
  html += '</div>';
  listArea.innerHTML = html;
}

// ── SHOW HCP INFLUENCE SPHERE (AFFILIATIONS) ────────────────────────────────
function _hcpShowAffiliations(hcpId, hcpName) {
  openModal('hcpAffListModal', '⏳ در حال بارگذاری...', '<div style="text-align:center;padding:20px">در حال خواندن اطلاعات مراکز...</div>', '<button class="btn-secondary" onclick="closeModal(\'hcpAffListModal\')">بستن</button>', { lg: true });
  
  fetch('/api/hcps/' + hcpId + '/affiliations')
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(affs) {
      var title = '🏥 مراکز مرتبط با ' + hcpName;
      if (!affs.length) {
        var body = '<div style="text-align:center;padding:30px;color:var(--text-muted)">این پزشک/مخاطب هنوز به هیچ مرکز درمانی متصل نشده است.</div>';
        openModal('hcpAffListModal', title, body, '<button class="btn-secondary" onclick="closeModal(\'hcpAffListModal\')">بستن</button>', { lg: true });
        return;
      }

      var body = '<div style="font-size:12px;direction:rtl;text-align:right">';
      body += '<table style="width:100%;border-collapse:collapse">';
      body += '<tr style="border-bottom:2px solid var(--border);font-weight:700"><th style="padding:6px;text-align:right">مرکز درمانی</th><th style="padding:6px;text-align:right">سمت / نقش</th><th style="padding:6px;text-align:center">سطح نفوذ</th><th style="padding:6px;text-align:right">جزئیات / حضور</th></tr>';
      
      affs.forEach(function(a) {
        var centerName = _getCenterNameFromKey(a.center_key);
        var infColor = a.influence_level === 'KOL' ? '#7c3aed' : (a.influence_level === 'Decision Maker' ? '#22c55e' : '#64748b');
        body += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:6px;font-weight:600"><a href="#" onclick="closeModal(\'hcpAffListModal\');openCenterModal(\''+a.center_key.split('_')[0]+'\',\''+a.center_key.split('_').slice(1).join('_')+'\');return false;" style="color:#0ea5e9;text-decoration:none">' + esc(centerName) + '</a></td>'
          + '<td style="padding:6px">' + esc(a.role || '—') + '</td>'
          + '<td style="padding:6px;text-align:center"><span style="font-size:10px;background:'+infColor+'15;color:'+infColor+';border:1px solid '+infColor+'40;border-radius:4px;padding:1px 6px;font-weight:700">' + esc(a.influence_level || 'Decision Maker') + '</span></td>'
          + '<td style="padding:6px;color:var(--text-secondary)">'
          + (a.working_hours ? '🕒 ' + esc(a.working_hours) : '')
          + (a.notes ? ' <span title="'+esc(a.notes)+'" style="cursor:help">📝</span>' : '')
          + '</td>'
          + '</tr>';
      });

      body += '</table></div>';
      openModal('hcpAffListModal', title, body, '<button class="btn-secondary" onclick="closeModal(\'hcpAffListModal\')">بستن</button>', { lg: true });
    });
}

// Helper to get center name from its database key
function _getCenterNameFromKey(key) {
  var parts = key.split('_');
  var rtype = parts[0];
  var rid = parts.slice(1).join('_');
  return _getCenterName(rtype, rid);
}

// ── CREATE / EDIT HCP MODAL ─────────────────────────────────────────────────
function _hcpOpenCreateModal() {
  _hcpRenderFormModal(null);
}

function _hcpOpenEditModal(id, onSaved) {
  var hcp = (window._hcpCache || []).find(function(x) { return x.id === id; });
  if (hcp) {
    _hcpRenderFormModal(hcp, onSaved);
  } else {
    showToast('⏳ در حال دریافت اطلاعات پزشک...');
    fetch('/api/hcps/' + encodeURIComponent(id))
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(data) {
        if (data) {
          _hcpRenderFormModal(data, onSaved);
        } else {
          showToast('⚠️ پزشک یافت نشد');
        }
      })
      .catch(function() {
        showToast('⚠️ خطایی رخ داد');
      });
  }
}

function _hcpRenderFormModal(hcp, onSaved) {
  window._hcpOnSavedCallback = onSaved || null;
  var title = hcp ? '✏️ ویرایش پزشک / کارشناس' : '👤 ثبت پزشک / کارشناس جدید';
  var id = hcp ? hcp.id : '';
  var name = hcp ? hcp.name : '';
  var rank = hcp ? hcp.rank : '';
  var specialty = hcp ? hcp.specialty : '';
  var mcNo = hcp ? hcp.medical_council_no : '';
  var email = hcp ? hcp.email : '';
  var notes = hcp ? hcp.notes : '';
  var phones = hcp ? (hcp.phones || []) : [];

  var inp = 'width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px';

  var body = '<div style="direction:rtl;text-align:right;font-size:12px">'
    + '<label style="font-weight:700;display:block;margin-bottom:3px">نام و نام خانوادگی <span style="color:#dc2626">*</span></label>'
    + '<input type="text" id="hcpFormName" value="'+esc(name)+'" style="'+inp+'" placeholder="مثال: دکتر علیرضا عباسی...">'
    
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><label style="font-weight:700;display:block;margin-bottom:3px">مرتبه علمی / سمت</label>'
    + '<input type="text" id="hcpFormRank" value="'+esc(rank)+'" style="'+inp+'" placeholder="مثلاً: دانشیار، مدیر خرید..."></div>'
    + '<div><label style="font-weight:700;display:block;margin-bottom:3px">تخصص</label>'
    + '<input type="text" id="hcpFormSpecialty" value="'+esc(specialty)+'" style="'+inp+'" placeholder="مثلاً: رادیولوژیست..."></div>'
    + '</div>'

    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    + '<div><label style="font-weight:700;display:block;margin-bottom:3px">شماره نظام پزشکی</label>'
    + '<input type="text" id="hcpFormMC" value="'+esc(mcNo)+'" style="'+inp+'" placeholder="شماره نظام..."></div>'
    + '<div><label style="font-weight:700;display:block;margin-bottom:3px">ایمیل</label>'
    + '<input type="text" id="hcpFormEmail" value="'+esc(email)+'" style="'+inp+'" placeholder="email@example.com"></div>'
    + '</div>'

    + '<label style="font-weight:700;display:block;margin-bottom:3px">شماره‌های تلفن همراه/شخصی</label>'
    + '<div id="hcpFormPhonesArea" style="margin-bottom:10px">'
    + phones.map(function(ph, pi) {
      return '<div style="display:flex;gap:5px;align-items:center;margin-bottom:4px">'
        + '<input type="text" value="'+esc(ph)+'" class="hcp-form-phone" style="flex:1;direction:ltr;padding:6px 10px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)" placeholder="۰۹۱۲xxxxxxx">'
        + '<button onclick="this.parentNode.remove()" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;cursor:pointer;padding:6px 12px">✕</button>'
        + '</div>';
    }).join('')
    + '</div>'
    + '<button class="btn-secondary" onclick="_hcpAddPhoneRow()" style="font-size:11px;padding:4px 10px;border-radius:6px;margin-bottom:12px">+ افزودن تلفن</button>'

    + '<label style="font-weight:700;display:block;margin-bottom:3px">یادداشت و بیوگرافی</label>'
    + '<textarea id="hcpFormNotes" rows="2" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);resize:vertical" placeholder="سایر توضیحات...">'+esc(notes)+'</textarea>'
    + '</div>';

  var foot = '<button class="btn-secondary" onclick="closeModal(\'hcpFormModal\')">لغو</button>'
    + '<button class="btn-primary" onclick="_hcpSubmitForm(\''+id+'\')" style="font-weight:700">ذخیره 💾</button>';

  openModal('hcpFormModal', title, body, foot, {lg: false});
}

function _hcpAddPhoneRow() {
  var area = document.getElementById('hcpFormPhonesArea');
  if (!area) return;
  var div = document.createElement('div');
  div.style.display = 'flex';
  div.style.gap = '5px';
  div.style.alignItems = 'center';
  div.style.marginBottom = '4px';
  div.innerHTML = '<input type="text" class="hcp-form-phone" style="flex:1;direction:ltr;padding:6px 10px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)" placeholder="۰۹۱۲xxxxxxx">'
    + '<button onclick="this.parentNode.remove()" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:8px;cursor:pointer;padding:6px 12px">✕</button>';
  area.appendChild(div);
  var inp = div.querySelector('input');
  if (inp) inp.focus();
}

function _hcpSubmitForm(id) {
  var name = document.getElementById('hcpFormName') ? document.getElementById('hcpFormName').value.trim() : '';
  if (!name) {
    showToast('⚠️ نام و نام خانوادگی پزشک الزامی است');
    return;
  }

  var phones = [];
  document.querySelectorAll('.hcp-form-phone').forEach(function(el) {
    var val = el.value.trim();
    if (val) phones.push(val);
  });

  var payload = {
    name: name,
    rank: document.getElementById('hcpFormRank') ? document.getElementById('hcpFormRank').value.trim() : '',
    specialty: document.getElementById('hcpFormSpecialty') ? document.getElementById('hcpFormSpecialty').value.trim() : '',
    medicalCouncilNo: document.getElementById('hcpFormMC') ? document.getElementById('hcpFormMC').value.trim() : '',
    email: document.getElementById('hcpFormEmail') ? document.getElementById('hcpFormEmail').value.trim() : '',
    notes: document.getElementById('hcpFormNotes') ? document.getElementById('hcpFormNotes').value.trim() : '',
    phones: phones
  };

  var method = id ? 'PUT' : 'POST';
  var url = id ? '/api/hcps/' + id : '/api/hcps';

  fetch(url, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (d) {
        showToast('✅ اطلاعات پزشک/کارشناس با موفقیت ذخیره شد');
        closeModal('hcpFormModal');
        _hcpSearch();
        
        if (typeof window._hcpOnSavedCallback === 'function') {
          window._hcpOnSavedCallback(d);
          window._hcpOnSavedCallback = null;
        }
        
        // If we opened this form inside center modal link, we can refresh it
        if (window._hcpPendingLinkCenterKey) {
          _hcpLinkAndClose(d.id);
        }
      } else {
        showToast('❌ خطا در ذخیره اطلاعات');
      }
    });
}

function _hcpDelete(id) {
  if (!confirm('آیا از حذف این پزشک/کارشناس مطمئن هستید؟ (به سطل زباله منتقل می‌شود و مدیر می‌تواند بازیابی کند)')) return;
  fetch('/api/hcps/' + id, { method: 'DELETE' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (d && (d.ok || d.success)) {
        showToast('🗑 به سطل زباله منتقل شد');
        _hcpSearch();
      } else {
        showToast('❌ خطا در حذف پزشک');
      }
    });
}

function _hcpToggleActive(id, activate) {
  fetch('/api/hcps/' + id + '/active', { 
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_active: activate })
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (d && (d.ok || d.success)) {
        showToast(activate ? '✅ پزشک فعال شد' : '🚫 پزشک غیرفعال شد');
        _hcpSearch();
      } else {
        showToast('❌ خطا در تغییر وضعیت');
      }
    });
}


// ── CENTER MODAL INTEGRATION ───────────────────────────────────────────────

function _hcpLoadCenterAffiliations(rtype, rid, domId) {
  var centerKey = rtype + '_' + rid;
  var area = document.getElementById('contactsArea_' + domId);
  if (!area) return;

  area.innerHTML = '<div style="text-align:center;padding:10px;color:var(--text-muted)">⏳ در حال بارگذاری پزشکان متصل...</div>';

  fetch('/api/hcps/centers/' + encodeURIComponent(centerKey) + '/affiliations')
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(affs) {
      area.dataset.hcpCount = String(affs.length);
      if (!affs.length) {
        area.innerHTML = '<div style="color:var(--text-muted);font-size:11px;padding:12px 0;text-align:center;background:var(--bg-raised);border:1px dashed var(--border);border-radius:6px">'
          + 'هیچ پزشک یا کارشناسی به این مرکز متصل نشده است'
          + '</div>';
        return;
      }

      area.innerHTML = affs.map(function(a) {
        var infColor = a.influence_level === 'KOL' ? '#7c3aed' : (a.influence_level === 'Decision Maker' ? '#22c55e' : '#64748b');
        var roleLabel = a.role ? esc(a.role) : 'مخاطب';
        var specialtyLabel = a.hcp_specialty ? '<span style="font-size:10px;background:#eff6ff;color:#1d4ed8;padding:1px 5px;border-radius:4px;margin-right:4px">' + esc(a.hcp_specialty) + '</span>' : '';
        var rankLabel = a.hcp_rank ? esc(a.hcp_rank) + ' ' : '';

        var phonesHtml = (a.hcp_phones || []).map(function(ph) {
          return '<div style="display:flex;gap:5px;align-items:center;margin-top:3px">'
            + '<a href="tel:'+ph+'" style="font-size:12px;text-decoration:none" title="تماس">📞</a>'
            + '<span style="font-size:11px;direction:ltr;flex:1">' + esc(ph) + '</span>'
            + '<a href="https://wa.me/'+_waNum(ph)+'" target="_blank" title="واتساپ" style="font-size:12px;text-decoration:none">💬</a>'
            + '<button onclick="_copyPhone(\''+esc(ph)+'\')" title="کپی" style="background:none;border:1px solid var(--border);border-radius:3px;cursor:pointer;font-size:10px;padding:1px 4px">📋</button>'
            + '</div>';
        }).join('');

        return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;position:relative">'
          + '<div style="display:flex;justify-content:space-between;align-items:start">'
          + '<div>'
          + '<div style="font-weight:700;font-size:13px;color:var(--text-primary)">'
          + '<a href="#" onclick="_hcpShowAffiliations(\''+a.hcp_id+'\',\''+esc(a.hcp_name)+'\');return false;" style="color:var(--brand,#6366f1);text-decoration:none">' + rankLabel + esc(a.hcp_name) + '</a>'
          + '</div>'
          + '<div style="font-size:11px;color:var(--text-secondary);margin-top:2px;display:flex;align-items:center;gap:4px">'
          + '<span>سمت: ' + roleLabel + '</span>'
          + specialtyLabel
          + '</div>'
          + '</div>'
          + '<div style="display:flex;flex-direction:column;align-items:end;gap:4px">'
          + '<span style="font-size:9px;background:'+infColor+'12;color:'+infColor+';border:1px solid '+infColor+'40;border-radius:4px;padding:1px 6px;font-weight:700">' + esc(a.influence_level || 'Decision Maker') + '</span>'
          + '</div>'
          + '</div>'
          
          + '<div style="margin-top:6px;border-top:1px dashed var(--border);padding-top:4px">'
          + phonesHtml
          + '</div>'

          + (a.working_hours || a.notes ? '<div style="font-size:10px;color:var(--text-secondary);background:var(--bg-raised);padding:4px 6px;border-radius:4px;margin-top:6px">'
            + (a.working_hours ? '🕒 حضور: ' + esc(a.working_hours) : '')
            + (a.notes ? ' | یادداشت: ' + esc(a.notes) : '')
            + '</div>' : '')

          + '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:8px;padding-top:6px;border-top:1px solid var(--border)">'
          + '<button class="btn-secondary" onclick="_hcpOpenEditModal(\''+a.hcp_id+'\', function(){ _hcpLoadCenterAffiliations(\''+rtype+'\', \''+rid+'\', \''+domId+'\'); })" style="font-size:10px;padding:2px 8px;border-radius:4px">👤 ویرایش مشخصات</button>'
          + '<button class="btn-secondary" onclick="_hcpOpenEditAffiliationModal('+a.id+', \''+rtype+'\', \''+rid+'\', \''+domId+'\')" style="font-size:10px;padding:2px 8px;border-radius:4px">✏️ ویرایش ارتباط</button>'
          + '<button onclick="_hcpUnlinkAffiliation('+a.id+', \''+rtype+'\', \''+rid+'\', \''+domId+'\')" style="background:#fee2e2;color:#dc2626;border:1px solid #fca5a5;border-radius:4px;cursor:pointer;font-size:10px;padding:2px 8px;font-family:inherit">🔗 قطع ارتباط</button>'
          + '</div>'
          + '</div>';
      }).join('');
    });
}

function _hcpOpenLinkModal(rtype, rid, domId) {
  var centerKey = rtype + '_' + rid;
  window._hcpPendingLinkCenterKey = centerKey;
  window._hcpPendingLinkDomId = domId;
  window._hcpPendingLinkRtype = rtype;
  window._hcpPendingLinkRid = rid;

  var title = '🔗 اتصال پزشک / مخاطب به مرکز';
  var body = '<div style="direction:rtl;text-align:right;font-size:12px">'
    + '<label style="font-weight:700;display:block;margin-bottom:3px">نام پزشک را جستجو کنید:</label>'
    + '<div style="position:relative;margin-bottom:12px">'
    + '<input type="text" id="hcpLinkSearch" placeholder="تایپ کنید تا جستجو شود..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)" oninput="_hcpLinkAutocomplete(this.value)">'
    + '<div id="hcpAutocompleteResults" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;max-height:200px;overflow-y:auto;z-index:999;box-shadow:0 4px 6px rgba(0,0,0,.1)"></div>'
    + '</div>'
    
    + '<div style="border-top:1px solid var(--border);margin-top:16px;padding-top:12px;text-align:center">'
    + '<p style="color:var(--text-secondary);font-size:11px;margin-bottom:8px">پزشک مورد نظر را در سیستم ندارید؟</p>'
    + '<button class="btn-secondary" onclick="closeModal(\'hcpLinkModal\');_hcpOpenCreateModal();" style="font-weight:700;padding:6px 16px">+ ثبت و اتصال پزشک جدید</button>'
    + '</div>'
    + '</div>';

  openModal('hcpLinkModal', title, body, '<button class="btn-secondary" onclick="closeModal(\'hcpLinkModal\');window._hcpPendingLinkCenterKey=null;">انصراف</button>');
}

function getProvNameFromKey(recKey) {
  if (!recKey) return '';
  var pts = recKey.split('_');
  var tp = pts[0];
  var id = pts.slice(1).join('_');
  if (tp === 'center') return 'تهران';
  if (tp === 'pc') {
    var provId = id.split('||')[0];
    var p = (typeof PROVINCES !== 'undefined' ? PROVINCES : []).find(function(x){return x.id === provId;});
    return p ? p.name : '';
  }
  return '';
}

function _hcpLinkAutocomplete(val) {
  var container = document.getElementById('hcpAutocompleteResults');
  if (!container) return;
  val = val.trim();
  if (!val) {
    container.style.display = 'none';
    return;
  }

  fetch('/api/hcps?q=' + encodeURIComponent(val))
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(data) {
      if (!data.length) {
        container.innerHTML = '<div style="padding:10px;text-align:center;color:var(--text-muted)">هیچ موردی یافت نشد</div>';
        container.style.display = 'block';
        return;
      }

      container.innerHTML = data.map(function(hcp) {
        var rankLabel = hcp.rank ? esc(hcp.rank) + ' ' : '';
        var specLabel = hcp.specialty ? '<span style="background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:4px;padding:1px 6px;font-size:10px;margin-right:4px">' + esc(hcp.specialty) + '</span>' : '';
        var mcLabel = hcp.medical_council_no ? '<span style="font-size:10px;color:var(--text-muted)"> | نظام پزشکی: ' + esc(hcp.medical_council_no) + '</span>' : '';
        
        var affs = (hcp.affiliations || []).filter(function(a){ return a && a.center_key; });
        var affsLabel = '';
        if (affs.length > 0) {
          // Use stored center_name/province_name from DB, fall back to client-side resolve
          var parts = affs.map(function(a) {
            var cname = a.center_name;
            var pname = a.province_name;
            // Fallback to client-side resolve if not stored yet
            if (!cname && typeof getRecLabel === 'function') {
              var resolved = getRecLabel(a.center_key);
              if (resolved && resolved !== a.center_key) cname = resolved;
            }
            if (!pname && typeof getProvNameFromKey === 'function') {
              pname = getProvNameFromKey(a.center_key);
            }
            if (cname && pname) return esc(cname) + ' <span style="opacity:.7">(' + esc(pname) + ')</span>';
            if (cname) return esc(cname);
            if (pname) return '<span style="opacity:.7">(' + esc(pname) + ')</span>';
            return '';
          }).filter(Boolean);
          
          if (parts.length > 0) {
            affsLabel = '<div style="font-size:10px;color:var(--text-muted);margin-top:3px">🏥 ' + parts.join(' · ') + '</div>';
          }
        } else {
          affsLabel = '<div style="font-size:10px;color:var(--text-muted);margin-top:3px">🏥 بدون اتصال قبلی</div>';
        }
        
        return '<div class="autocomplete-item" onclick="_hcpLinkAndClose(\''+hcp.id+'\')" style="padding:10px 12px;cursor:pointer;border-bottom:1px solid var(--border);color:var(--text-primary)" onmouseover="this.style.background=\'var(--bg-raised)\'" onmouseout="this.style.background=\'none\'">'
          + '<div style="font-weight:600;font-size:13px">👤 ' + rankLabel + esc(hcp.name) + '&nbsp;&nbsp;' + specLabel + mcLabel + '</div>'
          + affsLabel
          + '</div>';
      }).join('');
      container.style.display = 'block';
    });
}

function _hcpLinkAndClose(hcpId) {
  var centerKey = window._hcpPendingLinkCenterKey;
  var domId = window._hcpPendingLinkDomId;
  var rtype = window._hcpPendingLinkRtype;
  var rid = window._hcpPendingLinkRid;

  if (!centerKey) return;

  // Open affiliation details modal first so they can specify Role and Influence
  closeModal('hcpLinkModal');
  
  var title = '🔗 تنظیم جزئیات ارتباط پزشک با مرکز';
  var body = '<div style="direction:rtl;text-align:right;font-size:12px">'
    + '<label style="font-weight:700;display:block;margin-bottom:3px">سمت / نقش در این مرکز:</label>'
    + '<input type="text" id="affFormRole" placeholder="مثال: رئیس بخش، جراح ارشد..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px">'
    
    + '<label style="font-weight:700;display:block;margin-bottom:3px">میزان تأثیرگذاری در خرید تجهیزات:</label>'
    + '<select id="affFormInfluence" style="width:100%;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px">'
    + '<option value="Decision Maker">Decision Maker (تصمیم‌گیرنده)</option>'
    + '<option value="KOL">Key Opinion Leader (پیشرو علمی)</option>'
    + '<option value="End User">End User (کاربر نهایی)</option>'
    + '<option value="Influencer">Influencer (تأثیرگذار)</option>'
    + '</select>'

    + '<label style="font-weight:700;display:block;margin-bottom:3px">روزها / ساعت‌های حضور:</label>'
    + '<input type="text" id="affFormHours" placeholder="مثال: شنبه‌ها و دوشنبه‌ها صبح..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px">'

    + '<label style="font-weight:700;display:block;margin-bottom:3px">توضیحات اختصاصی این مرکز:</label>'
    + '<textarea id="affFormNotes" rows="2" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);resize:vertical" placeholder="توضیحات..."></textarea>'
    + '</div>';

  var foot = '<button class="btn-secondary" onclick="closeModal(\'affDetailsModal\')">انصراف</button>'
    + '<button class="btn-primary" onclick="_hcpSaveAffiliation(\''+centerKey+'\', \''+hcpId+'\', \''+rtype+'\', \''+rid+'\', \''+domId+'\')">تایید و اتصال 🔗</button>';

  openModal('affDetailsModal', title, body, foot);
}

function _hcpSaveAffiliation(centerKey, hcpId, rtype, rid, domId) {
  // Resolve center name and province name from client-side data for storage
  var cname = '';
  var pname = '';
  try {
    if (typeof getRecLabel === 'function') cname = getRecLabel(centerKey) || '';
    if (typeof getProvNameFromKey === 'function') pname = getProvNameFromKey(centerKey) || '';
    // If getRecLabel returns raw key (not resolved), try direct lookup
    if (cname === centerKey || !cname) {
      var pts = centerKey.split('_'); var tp = pts[0]; var id2 = pts.slice(1).join('_');
      if (tp === 'center' && typeof CENTERS !== 'undefined') {
        var cc = CENTERS.find(function(x){ return x.id === id2; });
        if (cc) cname = cc.name || '';
      }
      if (!cname && typeof DB !== 'undefined' && DB.extra) {
        var ex = DB.extra.find(function(x){ return x.id === id2; });
        if (ex) cname = ex.name || '';
      }
    }
  } catch(e) {}

  var payload = {
    centerKey: centerKey,
    hcpId: hcpId,
    role: document.getElementById('affFormRole') ? document.getElementById('affFormRole').value.trim() : '',
    influenceLevel: document.getElementById('affFormInfluence') ? document.getElementById('affFormInfluence').value : 'Decision Maker',
    workingHours: document.getElementById('affFormHours') ? document.getElementById('affFormHours').value.trim() : '',
    notes: document.getElementById('affFormNotes') ? document.getElementById('affFormNotes').value.trim() : '',
    centerName: cname,
    provinceName: pname
  };

  fetch('/api/hcps/affiliations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (d) {
        showToast('🔗 پزشک به مرکز متصل شد');
        closeModal('affDetailsModal');
        window._hcpPendingLinkCenterKey = null;
        _hcpLoadCenterAffiliations(rtype, rid, domId);
      } else {
        showToast('❌ خطا در اتصال پزشک');
      }
    });
}

function _hcpOpenEditAffiliationModal(affId, rtype, rid, domId) {
  openModal('affEditModal', '⏳ در حال بارگذاری...', '<div style="text-align:center;padding:20px">در حال خواندن اطلاعات ارتباط...</div>');
  
  // We can fetch from center's affiliations endpoint to find this specific one
  var centerKey = rtype + '_' + rid;
  fetch('/api/hcps/centers/' + encodeURIComponent(centerKey) + '/affiliations')
    .then(function(r) { return r.ok ? r.json() : []; })
    .then(function(affs) {
      var a = affs.find(function(x) { return x.id === affId; });
      if (!a) {
        showToast('❌ ارتباط یافت نشد');
        closeModal('affEditModal');
        return;
      }

      var title = '✏️ ویرایش مشخصات ارتباط ' + esc(a.hcp_name);
      var body = '<div style="direction:rtl;text-align:right;font-size:12px">'
        + '<label style="font-weight:700;display:block;margin-bottom:3px">سمت / نقش در این مرکز:</label>'
        + '<input type="text" id="affEditFormRole" value="'+esc(a.role || '')+'" placeholder="مثال: رئیس بخش..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px">'
        
        + '<label style="font-weight:700;display:block;margin-bottom:3px">میزان تأثیرگذاری در خرید تجهیزات:</label>'
        + '<select id="affEditFormInfluence" style="width:100%;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px">'
        + '<option value="Decision Maker"'+(a.influence_level === 'Decision Maker' ? ' selected' : '')+'>Decision Maker (تصمیم‌گیرنده)</option>'
        + '<option value="KOL"'+(a.influence_level === 'KOL' ? ' selected' : '')+'>Key Opinion Leader (پیشرو علمی)</option>'
        + '<option value="End User"'+(a.influence_level === 'End User' ? ' selected' : '')+'>End User (کاربر نهایی)</option>'
        + '<option value="Influencer"'+(a.influence_level === 'Influencer' ? ' selected' : '')+'>Influencer (تأثیرگذار)</option>'
        + '</select>'

        + '<label style="font-weight:700;display:block;margin-bottom:3px">روزها / ساعت‌های حضور:</label>'
        + '<input type="text" id="affEditFormHours" value="'+esc(a.working_hours || '')+'" placeholder="حضور..." style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);margin-bottom:10px">'

        + '<label style="font-weight:700;display:block;margin-bottom:3px">توضیحات اختصاصی این مرکز:</label>'
        + '<textarea id="affEditFormNotes" rows="2" style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-input);border-radius:8px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary);resize:vertical" placeholder="توضیحات...">'+esc(a.notes || '')+'</textarea>'
        + '</div>';

      var foot = '<button class="btn-secondary" onclick="closeModal(\'affEditModal\')">انصراف</button>'
        + '<button class="btn-primary" onclick="_hcpUpdateAffiliation('+affId+', \''+rtype+'\', \''+rid+'\', \''+domId+'\')">ذخیره تغییرات 💾</button>';

      openModal('affEditModal', title, body, foot);
    });
}

function _hcpUpdateAffiliation(affId, rtype, rid, domId) {
  var payload = {
    role: document.getElementById('affEditFormRole') ? document.getElementById('affEditFormRole').value.trim() : '',
    influenceLevel: document.getElementById('affEditFormInfluence') ? document.getElementById('affEditFormInfluence').value : 'Decision Maker',
    workingHours: document.getElementById('affEditFormHours') ? document.getElementById('affEditFormHours').value.trim() : '',
    notes: document.getElementById('affEditFormNotes') ? document.getElementById('affEditFormNotes').value.trim() : ''
  };

  fetch('/api/hcps/affiliations/' + affId, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (d) {
        showToast('💾 تغییرات ارتباط ذخیره شد');
        closeModal('affEditModal');
        _hcpLoadCenterAffiliations(rtype, rid, domId);
      } else {
        showToast('❌ خطا در ذخیره تغییرات');
      }
    });
}

function _hcpUnlinkAffiliation(affId, rtype, rid, domId) {
  if (!confirm('آیا از قطع ارتباط این پزشک با این مرکز درمانی مطمئن هستید؟')) return;

  fetch('/api/hcps/affiliations/' + affId, { method: 'DELETE' })
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(d) {
      if (d && d.ok) {
        showToast('🔗 ارتباط قطع شد');
        _hcpLoadCenterAffiliations(rtype, rid, domId);
      } else {
        showToast('❌ خطا در قطع ارتباط');
      }
    });
}
