/* faradis-data.js — Faradis extended data views
   Team sales, inventory compare, follower mapping, center product history */
'use strict';

(function() {

function _fdEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _fdFmt(amt) {
  amt = parseFloat(amt || 0);
  if (amt >= 1e9) return (amt/1e9).toFixed(1) + 'B';
  if (amt >= 1e6) return (amt/1e6).toFixed(0) + 'M';
  return amt.toFixed(0);
}

// ── Sync all ──────────────────────────────────────────────────────────────

window._fdSyncAll = function() {
  var btn = document.getElementById('fdSyncAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sync…'; }
  fetch('/api/faradis-data/sync-all', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync همه'; }
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 4000); return; }
      var parts = Object.entries(d).map(function(kv) {
        return kv[1].ok ? kv[0]+':'+kv[1].count : kv[0]+':❌';
      });
      if (typeof showToast === 'function') showToast('✅ ' + parts.join(' | '), 6000);
    })
    .catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync همه'; }
      if (typeof showToast === 'function') showToast('❌ ' + e.message, 4000);
    });
};

// ── Follower mapping tab ──────────────────────────────────────────────────

window.renderFdFollowers = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ بارگذاری…</div>';
  Promise.all([
    fetch('/api/faradis-data/followers').then(function(r){ return r.json(); }),
    fetch('/api/faradis-data/users').then(function(r){ return r.json(); }),
  ]).then(function(res) {
    var followers = res[0];
    var users = Array.isArray(res[1]) ? res[1] : [];
    if (!Array.isArray(followers)) {
      el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fdEsc(followers.error || 'نامعلوم') + '</div>';
      return;
    }
    if (followers.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">'
        + '<div style="font-size:32px;margin-bottom:12px">👥</div>'
        + '<div style="margin-bottom:14px">ابتدا بازاریاب‌های فرادیس را دریافت کنید</div>'
        + '<button id="fdSyncFollBtn" onclick="window._fdSyncFollowers()" style="padding:7px 18px;border-radius:7px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:13px">🔄 دریافت بازاریاب‌ها</button>'
        + '</div>';
      return;
    }
    var userOpts = '<option value="">— انتخاب کارشناس —</option>'
      + users.map(function(u) {
          return '<option value="' + _fdEsc(u.username) + '">' + _fdEsc(u.name || u.username) + '</option>';
        }).join('');

    var html = '<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center">'
      + '<button id="fdSyncFollBtn" onclick="window._fdSyncFollowers()" style="padding:6px 14px;border-radius:7px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">🔄 بروزرسانی</button>'
      + '<span style="font-size:12px;color:var(--text-muted)">' + followers.length + ' بازاریاب در فرادیس | نگاشت کنید هر بازاریاب به کدام کارشناس CRM مربوط است</span>'
      + '</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
      + '<thead><tr style="background:var(--bg-raised)">'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">شماره</th>'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">کد</th>'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">نام بازاریاب</th>'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">کارشناس CRM</th>'
      + '<th style="padding:8px 12px;border-bottom:2px solid var(--border)"></th>'
      + '</tr></thead><tbody>';
    followers.forEach(function(f) {
      html += '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:8px 12px;font-family:monospace;font-size:11px;color:var(--text-muted)">' + f.follower_num + '</td>'
        + '<td style="padding:8px 12px;font-size:11px">' + _fdEsc(f.follower_code) + '</td>'
        + '<td style="padding:8px 12px;font-weight:600">' + _fdEsc(f.follower_name) + '</td>'
        + '<td style="padding:8px 12px"><select id="fdMap_' + f.follower_num + '" style="padding:5px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">'
        + userOpts + '</select></td>'
        + '<td style="padding:8px 12px"><button onclick="window._fdSaveMap(' + f.follower_num + ')" style="padding:4px 14px;border-radius:5px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:11px;font-weight:600">ذخیره</button></td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
    followers.forEach(function(f) {
      if (f.crm_username) {
        var sel = document.getElementById('fdMap_' + f.follower_num);
        if (sel) sel.value = f.crm_username;
      }
    });
  }).catch(function(e) {
    if (el) el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fdEsc(e.message) + '</div>';
  });
};

window._fdSyncFollowers = function() {
  var btn = document.getElementById('fdSyncFollBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  fetch('/api/faradis-data/sync-followers', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 بروزرسانی'; }
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 4000); return; }
      if (typeof showToast === 'function') showToast('✅ ' + d.count + ' بازاریاب دریافت شد');
      window.renderFdFollowers('fdFollowersContainer');
    })
    .catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 بروزرسانی'; }
      if (typeof showToast === 'function') showToast('❌ ' + e.message, 4000);
    });
};

window._fdSaveMap = function(followerNum) {
  var sel = document.getElementById('fdMap_' + followerNum);
  var username = sel ? sel.value : '';
  fetch('/api/faradis-data/follower-map', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ follower_num: followerNum, crm_username: username }),
  }).then(function(r){ return r.json(); })
    .then(function(d) {
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 3000); return; }
      if (typeof showToast === 'function') showToast(username ? '✅ نگاشت ذخیره شد' : '🗑 نگاشت حذف شد');
    })
    .catch(function(e) { if (typeof showToast === 'function') showToast('❌ ' + e.message, 3000); });
};

// ── Team sales tab ────────────────────────────────────────────────────────

window.renderFdTeamSales = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ بارگذاری…</div>';
  fetch('/api/faradis-data/team-sales')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (!Array.isArray(data)) {
        el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fdEsc(data.error || 'نامعلوم') + '</div>';
        return;
      }
      if (data.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">'
          + '<div style="font-size:32px;margin-bottom:12px">📊</div>'
          + '<div>ابتدا بازاریاب‌ها را نگاشت کنید (تب 🗺 نگاشت) و فاکتورها را sync کنید</div>'
          + '</div>';
        return;
      }
      var byMonth = {};
      var users = new Set();
      data.forEach(function(r) {
        if (!byMonth[r.jalali_month]) byMonth[r.jalali_month] = {};
        byMonth[r.jalali_month][r.crm_username] = r;
        users.add(r.crm_username);
      });
      var months = Object.keys(byMonth).sort().reverse().slice(0, 6);
      var userArr = Array.from(users).sort();

      var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px;min-width:500px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:9px 14px;text-align:right;border-bottom:2px solid var(--border)">کارشناس</th>';
      months.forEach(function(m) {
        html += '<th style="padding:9px 14px;text-align:center;border-bottom:2px solid var(--border)">' + m + '</th>';
      });
      html += '</tr></thead><tbody>';
      userArr.forEach(function(u) {
        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:8px 14px;font-weight:600">' + _fdEsc(u) + '</td>';
        months.forEach(function(m) {
          var row = byMonth[m] && byMonth[m][u];
          if (row) {
            html += '<td style="padding:8px 14px;text-align:center">'
              + '<div style="font-weight:700;color:var(--text-primary)">' + _fdFmt(row.total_amount) + '</div>'
              + '<div style="font-size:10px;color:var(--text-muted)">' + row.invoice_count + ' فاکتور | ' + row.customer_count + ' مرکز</div>'
              + '</td>';
          } else {
            html += '<td style="padding:8px 14px;text-align:center;color:var(--text-muted)">—</td>';
          }
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    })
    .catch(function(e) {
      if (el) el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fdEsc(e.message) + '</div>';
    });
};

// ── Inventory compare tab ─────────────────────────────────────────────────

window.renderFdInventory = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ بارگذاری…</div>';
  fetch('/api/faradis-data/inventory-compare')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (!Array.isArray(data)) {
        el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fdEsc(data.error || 'نامعلوم') + '</div>';
        return;
      }
      if (data.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">موجودی فرادیس sync نشده — دکمه Sync موجودی را بزنید</div>';
        return;
      }
      var mismatches = data.filter(function(r){ return r.matched && Math.abs(r.diff) >= 0.01; }).length;
      var unmatched = data.filter(function(r){ return !r.matched; }).length;
      var html = '<div style="margin-bottom:10px;display:flex;gap:16px;font-size:12px;flex-wrap:wrap">'
        + '<span>' + data.length + ' محصول فرادیس</span>'
        + '<span style="color:#16a34a">✅ ' + (data.length - mismatches - unmatched) + ' تطابق</span>'
        + '<span style="color:#dc2626">⚠ ' + mismatches + ' مغایرت</span>'
        + '<span style="color:var(--text-muted)">— ' + unmatched + ' فقط در فرادیس</span>'
        + '</div>'
        + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:8px 10px;text-align:right;border-bottom:2px solid var(--border)">محصول</th>'
        + '<th style="padding:8px 10px;text-align:right;border-bottom:2px solid var(--border)">کد</th>'
        + '<th style="padding:8px 10px;text-align:center;border-bottom:2px solid var(--border)">فرادیس</th>'
        + '<th style="padding:8px 10px;text-align:center;border-bottom:2px solid var(--border)">WMS</th>'
        + '<th style="padding:8px 10px;text-align:center;border-bottom:2px solid var(--border)">مغایرت</th>'
        + '</tr></thead><tbody>';
      data.forEach(function(r) {
        var bg = !r.matched ? '' : (Math.abs(r.diff) < 0.01 ? '#f0fdf4' : '#fef2f2');
        var diffCol = r.diff === null ? 'var(--text-muted)' : (Math.abs(r.diff) < 0.01 ? '#16a34a' : '#dc2626');
        var fmtQty = function(q) { return q % 1 === 0 ? q : q.toFixed(2); };
        html += '<tr style="border-bottom:1px solid var(--border);background:' + bg + '">'
          + '<td style="padding:7px 10px;font-weight:600">' + _fdEsc(r.stuff_name) + '</td>'
          + '<td style="padding:7px 10px;font-family:monospace;font-size:11px;color:var(--text-muted)">' + _fdEsc(r.stuff_code) + '</td>'
          + '<td style="padding:7px 10px;text-align:center">' + fmtQty(r.faradis_qty) + '</td>'
          + '<td style="padding:7px 10px;text-align:center">' + (r.wms_qty !== null ? fmtQty(r.wms_qty) : '<span style="color:var(--text-muted)">—</span>') + '</td>'
          + '<td style="padding:7px 10px;text-align:center;font-weight:700;color:' + diffCol + '">'
          + (r.diff !== null ? (r.diff > 0 ? '+' : '') + fmtQty(r.diff) : '—') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    })
    .catch(function(e) {
      if (el) el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + _fdEsc(e.message) + '</div>';
    });
};

// ── Center product history ────────────────────────────────────────────────

window._fdShowCenterProducts = function(crmKey, btn) {
  var detail = btn.nextElementSibling;
  if (!detail) return;
  if (detail.style.display !== 'none') {
    detail.style.display = 'none';
    btn.textContent = '📦 محصولات';
    return;
  }
  btn.textContent = '⏳';
  detail.style.display = '';
  detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">بارگذاری…</div>';
  fetch('/api/faradis-data/center-products/' + encodeURIComponent(crmKey))
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '📦 محصولات';
      if (!d.linked) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">لینک به فرادیس وجود ندارد</div>';
        return;
      }
      if (!d.products || d.products.length === 0) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">محصولی ثبت نشده (ابتدا ریز فاکتورها را sync کنید)</div>';
        return;
      }
      var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border)">محصول</th>'
        + '<th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--border)">فاکتور</th>'
        + '<th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--border)">مبلغ</th>'
        + '<th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--border)">آخرین خرید</th>'
        + '</tr></thead><tbody>';
      d.products.forEach(function(p) {
        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:4px 8px">' + _fdEsc(p.stuff_name || '—') + '</td>'
          + '<td style="padding:4px 8px;text-align:center">' + p.invoice_count + '</td>'
          + '<td style="padding:4px 8px;text-align:center;font-weight:600">' + _fdFmt(p.total_amount) + '</td>'
          + '<td style="padding:4px 8px;text-align:center;font-size:10px;color:var(--text-muted)">' + _fdEsc(p.last_purchase || '') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      detail.innerHTML = html;
    })
    .catch(function(e) {
      btn.textContent = '📦 محصولات';
      detail.innerHTML = '<div style="color:#ef4444;font-size:11px;padding:4px">خطا: ' + _fdEsc(e.message) + '</div>';
    });
};

// ── Center contact enrichment ─────────────────────────────────────────────

window._fdShowEnrichment = function(crmKey, btn) {
  var detail = btn.nextElementSibling;
  if (!detail) return;
  if (detail.style.display !== 'none') {
    detail.style.display = 'none';
    btn.textContent = '📋 اطلاعات';
    return;
  }
  btn.textContent = '⏳';
  detail.style.display = '';
  detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">بارگذاری…</div>';

  fetch('/api/faradis-data/center-persons/' + encodeURIComponent(crmKey))
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '📋 اطلاعات';
      if (!d.linked) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px">لینک ندارد</div>';
        return;
      }
      var persons = d.persons || [];
      if (!persons.length) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px">اطلاعاتی یافت نشد</div>';
        return;
      }
      var html = '<div style="font-size:11px;color:var(--text-secondary);padding:4px 0">';
      html += '<div style="font-weight:700;color:var(--text-primary);margin-bottom:6px">' + _fdEsc(d.company_name) + '</div>';
      persons.forEach(function(p, pi) {
        var phones = [];
        if (p.phone) phones.push(p.phone);
        if (p.mobile) phones.push(p.mobile);
        var locParts = [p.city_name, p.state_name].filter(Boolean);
        html += '<div style="border:1px solid var(--border);border-radius:6px;padding:6px 8px;margin-bottom:6px;background:var(--bg-raised)">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">';
        html += '<div>';
        if (p.company_code) html += '<span style="font-size:10px;color:var(--text-muted)">کد: ' + _fdEsc(p.company_code) + '</span> ';
        if (locParts.length) html += '<span style="font-size:10px;color:var(--text-muted)">' + _fdEsc(locParts.join(' / ')) + '</span>';
        html += '</div>';
        if (phones.length) {
          html += '<button onclick="window._fdImportContact(\'' + _fdEsc(crmKey) + '\',' + pi + ',' + JSON.stringify(phones) + ')" '
            + 'style="padding:2px 8px;border-radius:4px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:10px">📥 وارد کردن</button>';
        }
        html += '</div>';
        if (phones.length) {
          html += '<div style="margin-top:4px">' + phones.map(function(ph){ return '<span style="background:#f0f9ff;border-radius:3px;padding:1px 6px;margin-left:4px;font-family:monospace;font-size:11px;direction:ltr;display:inline-block">' + _fdEsc(ph) + '</span>'; }).join('') + '</div>';
        }
        if (p.address) html += '<div style="margin-top:3px;font-size:10px;color:var(--text-muted)">' + _fdEsc(p.address.slice(0,80)) + '</div>';
        html += '</div>';
      });
      html += '</div>';
      detail.innerHTML = html;
    })
    .catch(function(e) {
      btn.textContent = '📋 اطلاعات';
      detail.innerHTML = '<div style="color:#ef4444;font-size:11px;padding:4px">خطا</div>';
    });
};

// ── مطالبات tab renderer ──────────────────────────────────────────────────

window.renderFdReceivables = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">در حال بارگذاری…</div>';
  fetch('/api/faradis-data/receivables')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (!d.ok) { el.innerHTML = '<div style="padding:20px;color:#ef4444">خطا: ' + _fdEsc(d.error||'') + '</div>'; return; }
      var rows = d.rows || [];
      var totalBalance = rows.reduce(function(s,r){ return s + Number(r.balance); }, 0);
      var html = '<div style="margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
        + '<div style="font-size:13px;color:var(--text-muted)">مجموع: <b>' + rows.length + '</b> مشتری</div>'
        + '<div style="font-size:13px;color:' + (totalBalance>0?'#ef4444':'#059669') + '">جمع مانده: <b>' + _fdFmt(Math.abs(totalBalance)) + '</b> ریال</div>'
        + '</div>'
        + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:right">مشتری فرادیس</th>'
        + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:right">مرکز CRM</th>'
        + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:left">فروش کل</th>'
        + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:left">برگشتی</th>'
        + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:left">دریافتی</th>'
        + '<th style="padding:8px 10px;border-bottom:2px solid var(--border);text-align:left">مانده بدهکار</th>'
        + '</tr></thead><tbody>';
      rows.forEach(function(r) {
        var bal = Number(r.balance);
        var balColor = bal > 0 ? '#ef4444' : '#059669';
        var crmCell = r.crm_center_name
          ? '<span style="background:#6366f120;color:#6366f1;padding:2px 6px;border-radius:4px;font-size:10px">' + _fdEsc(r.crm_center_name) + '</span>'
          : '<span style="color:var(--text-muted);font-size:10px">لینک نشده</span>';
        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:8px 10px"><div style="font-weight:600">' + _fdEsc(r.company_name||'') + '</div>'
          + '<div style="font-size:10px;color:var(--text-muted)">' + _fdEsc(r.company_code||'') + '</div></td>'
          + '<td style="padding:8px 10px">' + crmCell + '</td>'
          + '<td style="padding:8px 10px;text-align:left;direction:ltr">' + _fdFmt(r.total_sales) + '</td>'
          + '<td style="padding:8px 10px;text-align:left;direction:ltr;color:#f59e0b">' + _fdFmt(r.total_returns) + '</td>'
          + '<td style="padding:8px 10px;text-align:left;direction:ltr;color:#059669">' + _fdFmt(r.total_received) + '</td>'
          + '<td style="padding:8px 10px;text-align:left;direction:ltr"><b style="color:' + balColor + '">' + _fdFmt(Math.abs(bal)) + '</b></td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    })
    .catch(function(e){ el.innerHTML = '<div style="padding:20px;color:#ef4444">' + _fdEsc(e.message) + '</div>'; });
};

window._fdSyncReceivables = function() {
  fetch('/api/faradis-data/sync-receivables', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (typeof showToast === 'function') showToast(d.ok ? '✅ ' + d.count + ' مطالبه' : '❌ ' + (d.error||'خطا'), 4000);
      if (d.ok && typeof window.renderFdReceivables === 'function') {
        var el = document.getElementById('fdReceivablesContainer');
        if (el) window.renderFdReceivables('fdReceivablesContainer');
      }
    }).catch(function(e){ if (typeof showToast === 'function') showToast('❌ ' + e.message, 4000); });
};

window._fdShowReceivable = function(crmKey, btn) {
  var detail = btn.nextElementSibling;
  if (!detail) return;
  if (detail.style.display !== 'none') { detail.style.display = 'none'; btn.textContent = '💰 مطالبه'; return; }
  btn.textContent = '⏳';
  detail.style.display = '';
  detail.innerHTML = '<div style="font-size:11px;padding:6px">بارگذاری…</div>';
  fetch('/api/faradis-data/receivables/' + encodeURIComponent(crmKey))
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '💰 مطالبه';
      if (!d.ok || !d.data) {
        detail.innerHTML = '<div style="font-size:11px;padding:6px;color:var(--text-muted)">اطلاعات مطالبه یافت نشد</div>';
        return;
      }
      var r = d.data;
      var bal = Number(r.balance);
      detail.innerHTML = '<div style="font-size:11px;padding:8px;background:var(--bg-raised);border-radius:6px;margin-top:4px">'
        + '<div>فروش: <b>' + _fdFmt(r.total_sales) + '</b></div>'
        + '<div>برگشتی: <b style="color:#f59e0b">' + _fdFmt(r.total_returns) + '</b></div>'
        + '<div>دریافتی: <b style="color:#059669">' + _fdFmt(r.total_received) + '</b></div>'
        + '<hr style="border:none;border-top:1px solid var(--border);margin:4px 0">'
        + '<div>مانده: <b style="color:' + (bal>0?'#ef4444':'#059669') + ';font-size:13px">' + _fdFmt(Math.abs(bal)) + ' ریال</b></div>'
        + '</div>';
    })
    .catch(function(e){ btn.textContent = '💰 مطالبه'; detail.innerHTML = '<div style="font-size:11px;color:#ef4444;padding:4px">' + _fdEsc(e.message) + '</div>'; });
};

// ── Commission tab ────────────────────────────────────────────────────────

window.renderFdCommissions = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;

  // Build month selector + user filter + table
  var todayJ = typeof todayStr === 'function' ? todayStr().slice(0,7) : '';
  el.innerHTML = '<div id="fdCommFilters" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">'
    + '<label style="font-size:12px;color:var(--text-secondary)">ماه:</label>'
    + '<input id="fdCommMonth" type="text" placeholder="مثلاً 1403/06" value="' + _fdEsc(todayJ) + '" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px;width:100px">'
    + '<select id="fdCommUser" style="padding:5px 10px;border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px"><option value="">همه بازاریاب‌ها</option></select>'
    + '<button onclick="window._fdLoadCommissions()" style="padding:5px 14px;border-radius:6px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">🔍 نمایش</button>'
    + '<button onclick="window._fdShowCommSettings()" style="padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:none;cursor:pointer;font-family:inherit;font-size:12px">⚙️ نرخ پورسانت</button>'
    + '</div>'
    + '<div id="fdCommSummaryBox" style="margin-bottom:12px"></div>'
    + '<div id="fdCommTable">در حال بارگذاری…</div>';

  // Load users for dropdown
  fetch('/api/faradis-data/user-commission-pct')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      var sel = document.getElementById('fdCommUser');
      if (!sel || !d.ok) return;
      (d.users || []).forEach(function(u) {
        var opt = document.createElement('option');
        opt.value = u.username;
        opt.textContent = (u.name || u.username) + ' (' + u.commission_pct + '٪)';
        sel.appendChild(opt);
      });
    }).catch(function(){});

  window._fdLoadCommissions();
};

window._fdLoadCommissions = function() {
  var monthEl = document.getElementById('fdCommMonth');
  var userEl  = document.getElementById('fdCommUser');
  var tableEl = document.getElementById('fdCommTable');
  var summEl  = document.getElementById('fdCommSummaryBox');
  if (!tableEl) return;

  var month = monthEl ? monthEl.value.trim() : '';
  var username = userEl ? userEl.value : '';

  var url = '/api/faradis-data/commissions?';
  if (month)    url += 'month=' + encodeURIComponent(month) + '&';
  if (username) url += 'username=' + encodeURIComponent(username) + '&';

  tableEl.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted)">در حال بارگذاری…</div>';

  // Also load monthly summary
  var sumUrl = '/api/faradis-data/commission-summary?' + (month ? 'month=' + encodeURIComponent(month) : '');

  Promise.all([fetch(url).then(function(r){return r.json();}), fetch(sumUrl).then(function(r){return r.json();})])
    .then(function(results) {
      var d = results[0], s = results[1];

      // Summary cards
      if (summEl && s.ok) {
        var sumRows = (s.rows || []).filter(function(r){ return r.crm_username; });
        var totalComm = sumRows.reduce(function(a,r){ return a + Number(r.commission_amount||0); }, 0);
        var totalSales = sumRows.reduce(function(a,r){ return a + Number(r.total_sales||0); }, 0);
        var sumHtml = '<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">';
        sumHtml += '<div style="padding:10px 16px;background:var(--bg-raised);border-radius:8px;border:1px solid var(--border)">'
          + '<div style="font-size:11px;color:var(--text-muted)">جمع فروش</div>'
          + '<div style="font-size:16px;font-weight:700;color:#6366f1">' + _fdFmt(totalSales) + ' ﷼</div></div>';
        sumHtml += '<div style="padding:10px 16px;background:var(--bg-raised);border-radius:8px;border:1px solid var(--border)">'
          + '<div style="font-size:11px;color:var(--text-muted)">جمع پورسانت</div>'
          + '<div style="font-size:16px;font-weight:700;color:#059669">' + _fdFmt(totalComm) + ' ﷼</div></div>';
        sumRows.forEach(function(r) {
          if (!r.crm_username) return;
          sumHtml += '<div style="padding:10px 16px;background:var(--bg-raised);border-radius:8px;border:1px solid var(--border)">'
            + '<div style="font-size:11px;color:var(--text-muted)">' + _fdEsc(r.crm_name || r.crm_username) + ' — ' + r.effective_pct + '٪</div>'
            + '<div style="font-size:14px;font-weight:700;color:#059669">' + _fdFmt(r.commission_amount) + ' ﷼</div>'
            + '<div style="font-size:10px;color:var(--text-muted)">' + r.invoice_count + ' فاکتور · ' + _fdFmt(r.total_sales) + '</div>'
            + '</div>';
        });
        sumHtml += '</div>';
        summEl.innerHTML = sumHtml;
      }

      // Per-invoice table
      if (!d.ok) { tableEl.innerHTML = '<div style="padding:16px;color:#ef4444">خطا: ' + _fdEsc(d.error||'') + '</div>'; return; }
      var rows = d.rows || [];
      if (!rows.length) { tableEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted)">فاکتوری یافت نشد</div>'; return; }

      var html = '<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px">' + rows.length + ' فاکتور</div>'
        + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:right">تاریخ</th>'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:right">مشتری</th>'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:right">مرکز CRM</th>'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:right">بازاریاب</th>'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:left">مبلغ فاکتور</th>'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:center">نرخ</th>'
        + '<th style="padding:7px 8px;border-bottom:2px solid var(--border);text-align:left">پورسانت</th>'
        + '</tr></thead><tbody>';

      rows.forEach(function(r) {
        var hasMarketer = r.crm_username;
        var marketerCell = hasMarketer
          ? '<span style="font-weight:600">' + _fdEsc(r.crm_name || r.crm_username) + '</span>'
            + '<div style="font-size:10px;color:var(--text-muted)">' + r.commission_pct + '٪</div>'
          : '<span style="color:var(--text-muted);font-size:10px">نگاشت نشده</span>';
        var crmCell = r.crm_center_name
          ? '<span style="background:#6366f120;color:#6366f1;padding:1px 5px;border-radius:3px;font-size:10px">' + _fdEsc(r.crm_center_name) + '</span>'
          : '<span style="color:var(--text-muted);font-size:10px">—</span>';
        var commCell = hasMarketer
          ? '<b style="color:#059669">' + _fdFmt(r.commission_amount) + '</b>'
          : '<span style="color:var(--text-muted)">—</span>';

        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:7px 8px">' + _fdEsc(r.jalali_date || '') + '</td>'
          + '<td style="padding:7px 8px"><div>' + _fdEsc(r.company_name || '') + '</div></td>'
          + '<td style="padding:7px 8px">' + crmCell + '</td>'
          + '<td style="padding:7px 8px">' + marketerCell + '</td>'
          + '<td style="padding:7px 8px;text-align:left;direction:ltr">' + _fdFmt(r.total_amount) + '</td>'
          + '<td style="padding:7px 8px;text-align:center">' + (hasMarketer ? r.commission_pct + '٪' : '—') + '</td>'
          + '<td style="padding:7px 8px;text-align:left;direction:ltr">' + commCell + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      tableEl.innerHTML = html;
    })
    .catch(function(e){ if(tableEl) tableEl.innerHTML = '<div style="padding:16px;color:#ef4444">' + _fdEsc(e.message) + '</div>'; });
};

// Settings modal for commission rates
window._fdShowCommSettings = function() {
  fetch('/api/faradis-data/user-commission-pct')
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (!d.ok) return;
      var rows = d.users || [];
      var body = '<div style="font-size:13px;margin-bottom:12px;color:var(--text-secondary)">نرخ پورسانت هر بازاریاب را تنظیم کنید:</div>'
        + '<table style="width:100%;border-collapse:collapse;font-size:13px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:8px;border-bottom:2px solid var(--border);text-align:right">نام</th>'
        + '<th style="padding:8px;border-bottom:2px solid var(--border);text-align:right">نقش</th>'
        + '<th style="padding:8px;border-bottom:2px solid var(--border);text-align:center">پورسانت ٪</th>'
        + '<th style="padding:8px;border-bottom:2px solid var(--border)"></th>'
        + '</tr></thead><tbody>';
      rows.forEach(function(u) {
        body += '<tr style="border-bottom:1px solid var(--border)" id="fdcrow_' + _fdEsc(u.username) + '">'
          + '<td style="padding:8px">' + _fdEsc(u.name || u.username) + '</td>'
          + '<td style="padding:8px;color:var(--text-muted)">' + _fdEsc(u.role || '') + '</td>'
          + '<td style="padding:8px;text-align:center"><input type="number" step="0.1" min="0" max="20" value="' + u.commission_pct + '" id="fdcpct_' + _fdEsc(u.username) + '" style="width:70px;text-align:center;padding:4px;border:1px solid var(--border);border-radius:5px;font-family:inherit"></td>'
          + '<td style="padding:8px"><button onclick="window._fdSaveCommPct(\'' + _fdEsc(u.username) + '\')" style="padding:3px 10px;border-radius:5px;border:none;background:#059669;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">ذخیره</button></td>'
          + '</tr>';
      });
      body += '</tbody></table>';
      if (typeof openModal === 'function') {
        openModal('fdCommSettingsModal', '⚙️ نرخ پورسانت بازاریاب‌ها', body, '', { lg: true });
      } else {
        alert(body);
      }
    }).catch(function(e){ if(typeof showToast==='function') showToast('❌ ' + e.message, 3000); });
};

window._fdSaveCommPct = function(username) {
  var inp = document.getElementById('fdcpct_' + username);
  if (!inp) return;
  var pct = parseFloat(inp.value);
  if (isNaN(pct) || pct < 0 || pct > 100) { if(typeof showToast==='function') showToast('نرخ معتبر نیست', 3000); return; }
  fetch('/api/faradis-data/user-commission-pct', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: username, pct: pct })
  }).then(function(r){ return r.json(); })
    .then(function(d) {
      if (typeof showToast === 'function') showToast(d.ok ? '✅ ذخیره شد' : '❌ ' + (d.error||'خطا'), 3000);
    }).catch(function(e){ if(typeof showToast==='function') showToast('❌ ' + e.message, 3000); });
};


// Import a Faradis contact (phone/mobile) into CRM center contacts
window._fdImportContact = function(crmKey, personIndex, phones) {
  // Parse CRM key to rtype/rid
  var rtype, rid;
  if (crmKey.startsWith('c_')) { rtype = 'center'; rid = crmKey.slice(2); }
  else if (crmKey.startsWith('pc_')) { rtype = 'pc'; rid = crmKey.slice(3); }
  else { if(typeof showToast==='function') showToast('کلید مرکز نامعتبر', 3000); return; }

  if (typeof _getContacts === 'undefined' || typeof _saveContacts === 'undefined') {
    if (typeof showToast === 'function') showToast('لطفاً ابتدا مودال مرکز را باز کنید', 3000);
    return;
  }
  var contacts = _getContacts(rtype, rid);
  var validPhones = (phones || []).filter(function(p){ return p && p.trim(); });
  contacts.push({ name: '', title: 'مخاطب فرادیس ' + (personIndex + 1), phones: validPhones });
  _saveContacts(rtype, rid, contacts);
  if (typeof showToast === 'function') showToast('✅ مخاطب اضافه شد — در مودال مرکز قابل ویرایش است', 3000);
};

})();
