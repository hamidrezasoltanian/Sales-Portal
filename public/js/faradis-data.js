/* faradis-data.js — Faradis extended data views
   Team sales, inventory compare, follower mapping, center enrichment */
'use strict';

(function() {

// ── Sync all button ────────────────────────────────────────────────────────

window._fdSyncAll = function() {
  var btn = document.getElementById('fdSyncAllBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ در حال sync…'; }
  fetch('/api/faradis-data/sync-all', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync همه'; }
      var parts = Object.entries(d).map(function(kv) {
        return kv[1].ok ? kv[0] + ':' + kv[1].count : kv[0] + ':خطا';
      });
      if (typeof showToast === 'function') showToast('✅ ' + parts.join(' | '), 5000);
    })
    .catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync همه'; }
      if (typeof showToast === 'function') showToast('❌ ' + e.message, 4000);
    });
};

// ── Follower / Team mapping tab ────────────────────────────────────────────

window.renderFdFollowers = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ در حال بارگذاری…</div>';
  Promise.all([
    fetch('/api/faradis-data/followers').then(function(r){ return r.json(); }),
    fetch('/api/faradis-data/users').then(function(r){ return r.json(); }),
  ]).then(function(results) {
    var followers = results[0];
    var users = Array.isArray(results[1]) ? results[1] : [];
    if (!Array.isArray(followers)) {
      el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + (followers.error || 'نامعلوم') + '</div>';
      return;
    }
    if (followers.length === 0) {
      el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">'
        + '<div style="font-size:32px;margin-bottom:10px">👥</div>'
        + '<div>ابتدا بازاریاب‌ها را sync کنید</div>'
        + '<button onclick="window._fdSyncFollowers()" style="margin-top:12px;padding:7px 18px;border-radius:7px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:12px">🔄 Sync بازاریاب‌ها</button>'
        + '</div>';
      return;
    }
    var userOpts = '<option value="">— انتخاب کارشناس —</option>'
      + users.map(function(u) { return '<option value="' + _fdEsc(u.username) + '">' + _fdEsc(u.name || u.username) + '</option>'; }).join('');

    var html = '<div style="margin-bottom:14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
      + '<button onclick="window._fdSyncFollowers()" id="fdSyncFollBtn" style="padding:6px 14px;border-radius:7px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600">🔄 Sync بازاریاب‌ها</button>'
      + '<span style="font-size:12px;color:var(--text-muted)">' + followers.length + ' بازاریاب در فرادیس</span>'
      + '</div>'
      + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px">'
      + '<thead><tr style="background:var(--bg-raised)">'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">شماره</th>'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">کد</th>'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">نام بازاریاب فرادیس</th>'
      + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">کارشناس CRM</th>'
      + '<th style="padding:8px 12px;border-bottom:2px solid var(--border)"></th>'
      + '</tr></thead><tbody>';

    followers.forEach(function(f) {
      html += '<tr style="border-bottom:1px solid var(--border)">'
        + '<td style="padding:8px 12px;font-family:monospace;font-size:11px">' + f.follower_num + '</td>'
        + '<td style="padding:8px 12px;font-size:11px">' + _fdEsc(f.follower_code) + '</td>'
        + '<td style="padding:8px 12px;font-weight:600">' + _fdEsc(f.follower_name) + '</td>'
        + '<td style="padding:8px 12px">'
        + '<select id="fdMap_' + f.follower_num + '" style="padding:5px 8px;border:1px solid var(--border-input);border-radius:5px;font-family:inherit;font-size:12px;background:var(--bg-input);color:var(--text-primary)">'
        + userOpts
        + '</select>'
        + '</td>'
        + '<td style="padding:8px 12px">'
        + '<button onclick="window._fdSaveMap(' + f.follower_num + ')" style="padding:4px 12px;border-radius:5px;border:none;background:#6366f1;color:#fff;cursor:pointer;font-family:inherit;font-size:11px">ذخیره</button>'
        + '</td>'
        + '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;

    // Set current selections
    followers.forEach(function(f) {
      if (f.crm_username) {
        var sel = document.getElementById('fdMap_' + f.follower_num);
        if (sel) sel.value = f.crm_username;
      }
    });
  }).catch(function(e) {
    el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + e.message + '</div>';
  });
};

window._fdSyncFollowers = function() {
  var btn = document.getElementById('fdSyncFollBtn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
  fetch('/api/faradis-data/sync-followers', { method: 'POST' })
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync بازاریاب‌ها'; }
      if (d.error) { if (typeof showToast === 'function') showToast('❌ ' + d.error, 4000); return; }
      if (typeof showToast === 'function') showToast('✅ ' + d.count + ' بازاریاب دریافت شد');
      window.renderFdFollowers('fdFollowersContainer');
    })
    .catch(function(e) {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Sync بازاریاب‌ها'; }
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
    .catch(function(e) {
      if (typeof showToast === 'function') showToast('❌ ' + e.message, 3000);
    });
};

// ── Team sales tab ─────────────────────────────────────────────────────────

window.renderFdTeamSales = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ در حال بارگذاری…</div>';
  fetch('/api/faradis-data/team-sales?months=6')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (!Array.isArray(data)) {
        el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + (data.error || 'نامعلوم') + '</div>';
        return;
      }
      if (data.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">'
          + '<div>ابتدا بازاریاب‌ها را نگاشت کنید و فاکتورها را sync کنید</div></div>';
        return;
      }
      // Group by month
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
        + '<th style="padding:8px 12px;text-align:right;border-bottom:2px solid var(--border)">کارشناس</th>';
      months.forEach(function(m) {
        html += '<th style="padding:8px 12px;text-align:center;border-bottom:2px solid var(--border)">' + m + '</th>';
      });
      html += '</tr></thead><tbody>';

      userArr.forEach(function(u) {
        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:8px 12px;font-weight:600">' + _fdEsc(u) + '</td>';
        months.forEach(function(m) {
          var row = byMonth[m] && byMonth[m][u];
          if (row) {
            var amt = parseFloat(row.total_amount || 0);
            var amtStr = amt >= 1e9 ? (amt/1e9).toFixed(1)+'B' : amt >= 1e6 ? (amt/1e6).toFixed(0)+'M' : amt.toFixed(0);
            html += '<td style="padding:8px 12px;text-align:center">'
              + '<div style="font-weight:700;color:var(--text-primary)">' + amtStr + '</div>'
              + '<div style="font-size:10px;color:var(--text-muted)">' + row.invoice_count + ' فاکتور | ' + row.customer_count + ' مرکز</div>'
              + '</td>';
          } else {
            html += '<td style="padding:8px 12px;text-align:center;color:var(--text-muted)">—</td>';
          }
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    })
    .catch(function(e) {
      el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + e.message + '</div>';
    });
};

// ── Inventory compare tab ──────────────────────────────────────────────────

window.renderFdInventory = function(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">⏳ در حال بارگذاری…</div>';
  fetch('/api/faradis-data/inventory-compare')
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (!Array.isArray(data)) {
        el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + (data.error || 'نامعلوم') + '</div>';
        return;
      }
      if (data.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted)">ابتدا موجودی فرادیس را sync کنید</div>';
        return;
      }
      var html = '<div style="margin-bottom:10px;font-size:12px;color:var(--text-muted)">'
        + data.length + ' محصول — سبز: تطابق | قرمز: مغایرت | خاکستری: فقط در فرادیس</div>'
        + '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:12px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:8px 10px;text-align:right;border-bottom:2px solid var(--border)">محصول</th>'
        + '<th style="padding:8px 10px;text-align:right;border-bottom:2px solid var(--border)">کد</th>'
        + '<th style="padding:8px 10px;text-align:center;border-bottom:2px solid var(--border)">موجودی فرادیس</th>'
        + '<th style="padding:8px 10px;text-align:center;border-bottom:2px solid var(--border)">موجودی WMS</th>'
        + '<th style="padding:8px 10px;text-align:center;border-bottom:2px solid var(--border)">مغایرت</th>'
        + '</tr></thead><tbody>';
      data.forEach(function(r) {
        var diff = r.diff;
        var rowColor = !r.matched ? '' : (Math.abs(diff) < 0.01 ? '#f0fdf4' : '#fef2f2');
        var diffColor = diff === null ? 'var(--text-muted)' : (Math.abs(diff) < 0.01 ? '#16a34a' : '#dc2626');
        html += '<tr style="border-bottom:1px solid var(--border);background:' + rowColor + '">'
          + '<td style="padding:7px 10px;font-weight:600">' + _fdEsc(r.stuff_name) + '</td>'
          + '<td style="padding:7px 10px;font-family:monospace;font-size:11px;color:var(--text-muted)">' + _fdEsc(r.stuff_code) + '</td>'
          + '<td style="padding:7px 10px;text-align:center">' + (r.faradis_qty % 1 === 0 ? r.faradis_qty : r.faradis_qty.toFixed(2)) + '</td>'
          + '<td style="padding:7px 10px;text-align:center">' + (r.wms_qty !== null ? (r.wms_qty % 1 === 0 ? r.wms_qty : r.wms_qty.toFixed(2)) : '<span style="color:var(--text-muted)">—</span>') + '</td>'
          + '<td style="padding:7px 10px;text-align:center;font-weight:700;color:' + diffColor + '">'
          + (diff !== null ? (diff > 0 ? '+' : '') + (diff % 1 === 0 ? diff : diff.toFixed(2)) : '—') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    })
    .catch(function(e) {
      el.innerHTML = '<div style="color:#ef4444;padding:12px">خطا: ' + e.message + '</div>';
    });
};

// ── Center product history ────────────────────────────────────────────────

window._fdShowCenterProducts = function(crmKey, btn) {
  var detail = btn.nextElementSibling;
  if (!detail) return;
  if (detail.style.display !== 'none') {
    detail.style.display = 'none';
    btn.textContent = '📦 محصولات خریداری شده';
    return;
  }
  btn.textContent = '⏳';
  detail.style.display = '';
  detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">در حال بارگذاری…</div>';
  fetch('/api/faradis-data/center-products/' + encodeURIComponent(crmKey))
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '📦 محصولات خریداری شده';
      if (!d.linked) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">این مرکز هنوز به فرادیس لینک نشده</div>';
        return;
      }
      if (!d.products || d.products.length === 0) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">محصولی یافت نشد (ابتدا ریز فاکتورها را sync کنید)</div>';
        return;
      }
      var html = '<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:6px">'
        + '<thead><tr style="background:var(--bg-raised)">'
        + '<th style="padding:4px 8px;text-align:right;border-bottom:1px solid var(--border)">محصول</th>'
        + '<th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--border)">تعداد فاکتور</th>'
        + '<th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--border)">مبلغ کل</th>'
        + '<th style="padding:4px 8px;text-align:center;border-bottom:1px solid var(--border)">آخرین خرید</th>'
        + '</tr></thead><tbody>';
      d.products.forEach(function(p) {
        var amt = parseFloat(p.total_amount || 0);
        var amtStr = amt >= 1e9 ? (amt/1e9).toFixed(1)+'B' : amt >= 1e6 ? (amt/1e6).toFixed(0)+'M' : amt.toFixed(0);
        html += '<tr style="border-bottom:1px solid var(--border)">'
          + '<td style="padding:4px 8px">' + _fdEsc(p.stuff_name || '?') + '</td>'
          + '<td style="padding:4px 8px;text-align:center">' + p.invoice_count + '</td>'
          + '<td style="padding:4px 8px;text-align:center;font-weight:600">' + amtStr + '</td>'
          + '<td style="padding:4px 8px;text-align:center;font-size:10px">' + _fdEsc(p.last_purchase || '') + '</td>'
          + '</tr>';
      });
      html += '</tbody></table>';
      detail.innerHTML = html;
    })
    .catch(function(e) {
      btn.textContent = '📦 محصولات خریداری شده';
      detail.innerHTML = '<div style="color:#ef4444;font-size:11px">خطا: ' + _fdEsc(e.message) + '</div>';
    });
};

// ── Center enrichment (phone/address from Faradis) ────────────────────────

window._fdShowEnrichment = function(crmKey, btn) {
  var detail = btn.nextElementSibling;
  if (!detail) return;
  if (detail.style.display !== 'none') {
    detail.style.display = 'none';
    btn.textContent = '📋 اطلاعات فرادیس';
    return;
  }
  btn.textContent = '⏳';
  detail.style.display = '';
  fetch('/api/faradis-data/center-enrichment/' + encodeURIComponent(crmKey))
    .then(function(r){ return r.json(); })
    .then(function(d) {
      btn.textContent = '📋 اطلاعات فرادیس';
      if (!d.linked) {
        detail.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:6px">لینک نشده</div>';
        return;
      }
      var rows = [
        d.phone ? 'تلفن: <b>' + _fdEsc(d.phone) + '</b>' : '',
        d.mobile ? 'موبایل: <b>' + _fdEsc(d.mobile) + '</b>' : '',
        d.city ? 'شهر: <b>' + _fdEsc(d.city + (d.state ? ' / ' + d.state : '')) + '</b>' : '',
        d.address ? 'آدرس: ' + _fdEsc(d.address) : '',
      ].filter(Boolean);
      detail.innerHTML = '<div style="font-size:11px;color:var(--text-secondary);padding:6px;line-height:2">'
        + rows.join('<br>') + '</div>';
    })
    .catch(function(e) {
      btn.textContent = '📋 اطلاعات فرادیس';
      detail.innerHTML = '<div style="color:#ef4444;font-size:11px">خطا</div>';
    });
};

function _fdEsc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

})();
