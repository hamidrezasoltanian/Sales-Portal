'use strict';
// notifications.js — In-app notification system (API-backed)
// Functions: _initNotif, _refreshNotifs, _initBrowserNotif, sendNotif,
//   updateNotifBadge, toggleNotifPanel, goToNotifCenter, ackNotif,
//   markNotifRead, markAllNotifsRead, _timeAgo

// ════════════════════════ NOTIFICATIONS (API-backed) ════════════════════
var _notifCache = [];
var _notifLoaded = false;
var _pushGranted = false;

function _initNotif() {
  if (!DB.notifications) DB.notifications = [];
  if (!_notifLoaded && currentUser) _refreshNotifs();
}

function _refreshNotifs() {
  if (!currentUser) return;
  fetch('/api/notifications?to=' + encodeURIComponent(currentUser))
    .then(function(r) { return r.ok ? r.json() : _notifCache; })
    .then(function(arr) { _notifCache = arr; _notifLoaded = true; updateNotifBadge(); })
    .catch(function() {});
}

// ── Browser Push Notifications ──────────────────────────────────────────────
function _initBrowserNotif() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') { _pushGranted = true; return; }
  if (Notification.permission === 'denied') return;
  setTimeout(function() {
    Notification.requestPermission().then(function(p) {
      _pushGranted = (p === 'granted');
      if (_pushGranted) _firePushNotif('Flow CRM', 'اعلان‌های مرورگر فعال شد ✅');
    });
  }, 3000);
}

function _firePushNotif(title, body, tag) {
  if (!_pushGranted || !('Notification' in window)) return;
  try {
    var n = new Notification(title, { body: body, tag: tag || 'flow-crm', icon: '/favicon.ico', dir: 'rtl', lang: 'fa' });
    setTimeout(function() { n.close(); }, 8000);
    return n;
  } catch(e) {}
}

function _sendOverduePushNotifs() {
  if (!_pushGranted) return;
  var items = getFollowups();
  var mine = _isExpert() ? items.filter(function(i) { return i.owner === currentUser; }) : items;
  var overdue = mine.filter(function(i) { return i.overdue; });
  if (!overdue.length) return;
  var msg = overdue.length + ' مرکز معوق پیگیری دارند';
  if (overdue.length <= 3) { msg = overdue.map(function(i) { return i.name; }).join('، ') + ' — پیگیری نشده'; }
  _firePushNotif('⚠ پیگیری‌های معوق', msg, 'overdue-reminder');
}

document.addEventListener('visibilitychange', function() {
  if (document.visibilityState === 'visible' && _pushGranted) {
    setTimeout(_sendOverduePushNotifs, 2000);
  }
});

// Polling fallback: refresh badge every 60s
setInterval(function() { if (currentUser) _refreshNotifs(); }, 60000);

var _npickData = null;
function _npickSelect(i) {
  if (!_npickData || i >= _npickData.keys.length) return;
  closeModal('_npick');
  var ck = _npickData.keys[i];
  var cp = ck.split('_'); var crt = cp[0]; var crid = cp.slice(1).join('_');
  var cn = _clGetName(ck) || ck;
  var act = _npickData.action;
  setTimeout(function() {
    if (act === 'call') quickCallLog(crt, crid, cn);
    else if (act === 'brief') openPreCallBrief(crt, crid);
    else openCenterModal(crt, crid);
  }, 80);
}
function _notifAction(nid, action) {
  var n = _notifCache.find(function(x) { return x.id === nid; });
  if (!n) return;
  markNotifRead(nid);
  var p = document.getElementById('notifPanel'); if (p) { p.remove(); _notifPanelOpen = false; }
  var multiKeys = n.centerKeys && n.centerKeys.length > 1 ? n.centerKeys : null;
  if (multiKeys && (action === 'call' || action === 'brief' || action === 'center')) {
    _npickData = { keys: multiKeys, action: action };
    var _title = action === 'call' ? '📞 کدام مرکز را تماس می‌گیرید؟'
               : action === 'brief' ? '📋 خلاصه کدام مرکز؟'
               : '🔍 کدام مرکز؟';
    var _html = '<div style="display:flex;flex-direction:column;gap:5px;max-height:360px;overflow-y:auto;padding:2px 0">';
    multiKeys.forEach(function(ck, i) {
      var cn = _clGetName(ck) || ck;
      _html += '<button onclick="_npickSelect(' + i + ')" style="text-align:right;padding:8px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer">' + esc(cn) + '</button>';
    });
    _html += '</div>';
    openModal('_npick', _title, _html, '<button class="btn-secondary" onclick="closeModal(\'_npick\')">لغو</button>');
    return;
  }
  var ck = n.centerKey || '';
  var parts = ck.indexOf('_') > 0 ? ck.split('_') : [];
  var rtype = parts[0] || 'center';
  var rid = parts.slice(1).join('_');
  var centerName = ck ? (_clGetName(ck) || ck) : '';
  if (action === 'call') {
    if (rid) setTimeout(function() { quickCallLog(rtype, rid, centerName); }, 100);
    else showToast('مرکز مشخص نیست');
  } else if (action === 'brief') {
    if (rid) setTimeout(function() { openPreCallBrief(rtype, rid); }, 100);
    else showToast('مرکز مشخص نیست');
  } else if (action === 'task') {
    var tid = n.meta && n.meta.taskId;
    if (tid) setTimeout(function() { openTaskModal(tid); }, 100);
    else { switchTab('tasks'); }
  } else if (action === 'weekplan') {
    switchTab('weekplan');
  } else if (action === 'center') {
    if (rid) setTimeout(function() { openCenterModal(rtype, rid); }, 100);
  }
}

function sendNotif(toUser, message, centerKey, centerKeys, type, meta) {
  var id = Date.now() + '_' + Math.random().toString(36).slice(2);
  var payload = { id: id, to: toUser, msg: message, centerKey: centerKey || null,
                  type: type || 'general', meta: meta || null };
  if (centerKeys && centerKeys.length) payload.centerKeys = centerKeys;
  fetch('/api/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r) {
    return r.ok ? r.json() : null;
  }).then(function(notif) {
    if (!notif) return;
    _notifCache.unshift({
      id: notif.id, to: notif.to, msg: notif.msg,
      centerKey: notif.centerKey || centerKey || '',
      centerKeys: centerKeys || null,
      at: notif.at || new Date().toISOString(),
      read: false, from: currentUser
    });
  }).catch(function() {
    console.warn('[sendNotif] API failed — notification not persisted');
  });
  showToast('📩 اعلان برای ' + (USERS[toUser] || toUser) + ' ارسال شد', 2000);
}

function updateNotifBadge() {
  var unread = _notifCache.filter(function(n) { return n.to === currentUser && !n.read; }).length;
  var badge = document.getElementById('notifBadge');
  if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'flex' : 'none'; }
}

var _notifPanelOpen = false;
var _notifViewAll = false;
function setNotifView(all) {
  _notifViewAll = !!all;
  var p = document.getElementById('notifPanel');
  if (p) { p.remove(); _notifPanelOpen = false; }
  toggleNotifPanel();
}

function _renderNotifPanel(arr) {
  var viewAll = _notifViewAll && _isManager();
  var myNotifs = (viewAll ? arr.slice() : arr.filter(function(n) { return n.to === currentUser; }))
    .sort(function(a, b) { return new Date(b.at) - new Date(a.at); })
    .slice(0, 100);
  var panel = document.createElement('div');
  panel.id = 'notifPanel'; panel.className = 'notif-panel';
  var unreadIds = viewAll ? [] : myNotifs.filter(function(n) { return !n.read; }).map(function(n) { return n.id; });
  var _tglBtn = '';
  if (_isManager()) {
    _tglBtn = '<span style="display:inline-flex;gap:2px;background:var(--bg-raised);border-radius:6px;padding:2px;border:1px solid var(--border)">'
      + '<button onclick="setNotifView(false)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:' + (viewAll ? 'transparent' : 'var(--brand,#6366f1)') + ';color:' + (viewAll ? 'var(--text-secondary)' : '#fff') + '">من</button>'
      + '<button onclick="setNotifView(true)" style="font-size:10px;border:none;border-radius:4px;padding:2px 8px;cursor:pointer;background:' + (viewAll ? 'var(--brand,#6366f1)' : 'transparent') + ';color:' + (viewAll ? '#fff' : 'var(--text-secondary)') + '">همه</button>'
      + '</span>';
  }
  var head = '<div class="notif-panel-head"><span>🔔 ' + (viewAll ? 'همه اعلان‌ها' : 'اعلان‌های من') + '</span>'
    + '<span style="display:inline-flex;gap:6px;align-items:center">'
    + _tglBtn
    + (unreadIds.length ? '<button onclick="markAllNotifsRead()" style="font-size:10px;background:var(--bg-raised);border:1px solid var(--border);border-radius:4px;padding:2px 8px;cursor:pointer">همه خوانده شد</button>' : '')
    + '</span>'
    + '</div>';
  var body = '';
  if (!myNotifs.length) {
    body = '<div class="notif-empty">اعلانی وجود ندارد</div>';
  } else {
    body = myNotifs.map(function(n) {
      var timeAgo = _timeAgo(n.at);
      var nid = n.id;
      var nmsg = n.msg || n.message || '';
      var nfrom = n.from || '';
      var hasCk = n.centerKey && n.centerKey.indexOf('_') > 0;
      var hasMultiCk = n.centerKeys && n.centerKeys.length > 1;
      var cName = hasCk ? _clGetName(n.centerKey) : '';
      return '<div class="notif-item' + (n.read ? '' : ' unread') + (n.ack ? ' notif-acked' : '') + '" data-nid="' + nid + '">'
        + '<div class="notif-item-msg">' + esc(nmsg) + '</div>'
        + ((hasCk || hasMultiCk) ? '<div class="notif-item-center">📍 <span class="notif-center-link" onclick="goToNotifCenter(\'' + nid + '\')">' + (hasMultiCk ? (n.centerKeys.length + ' مرکز') : esc(cName)) + '</span></div>' : '')
        + '<div class="notif-item-actions">'
        + ((hasCk || hasMultiCk) ? '<button class="notif-act-btn" onclick="goToNotifCenter(\'' + nid + '\')">🔍 ' + (hasMultiCk ? 'مشاهده مراکز' : 'مشاهده مرکز') + '</button>' : '')
        + (viewAll
          ? (n.ack ? '<span class="notif-ack-badge">✓ تأیید شده</span>' : '')
          : (n.ack ? '<span class="notif-ack-badge">✓ تأیید شده</span>' : (function(){
              var ntype = n.type || 'general';
              if (ntype === 'followup' || ntype === 'manager_request') {
                return (n.centerKey && n.centerKey.indexOf('_') > 0
                  ? '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'call\')">📞 ثبت تماس</button>'
                    + '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'brief\')">📋 خلاصه</button>'
                  : '<button class="notif-act-btn notif-ack-btn" onclick="ackNotif(\'' + nid + '\')">✓ انجام دادم</button>');
              } else if (ntype === 'task') {
                return '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'task\')">📋 باز کردن تکلیف</button>';
              } else if (ntype === 'morning_brief') {
                return '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'weekplan\')">📅 برنامه هفته</button>';
              } else if (ntype === 'owner_change') {
                return '<button class="notif-act-btn" onclick="_notifAction(\'' + nid + '\',\'center\')">🔍 مشاهده مرکز</button>';
              } else if (ntype === 'ack') {
                return '';
              } else {
                return '<button class="notif-act-btn notif-ack-btn" onclick="ackNotif(\'' + nid + '\')">✓ انجام دادم</button>';
              }
            })()))
        + '</div>'
        + '<div class="notif-item-time">' + (viewAll ? 'به: <b>' + esc(USERS[n.to] || n.to) + '</b> · ' : '') + 'از: ' + (USERS[nfrom] || nfrom) + ' · ' + timeAgo + (viewAll && !n.read ? ' · <span style="color:#f59e0b">خوانده نشده</span>' : '') + '</div>'
        + '</div>';
    }).join('');
  }
  panel.innerHTML = head + '<div class="notif-body-scroll">' + body + '</div>';
  document.body.appendChild(panel);
  // Auto mark-as-read after 2s
  setTimeout(function() {
    if (viewAll || !unreadIds.length) return;
    unreadIds.forEach(function(id) {
      var nx = _notifCache.find(function(x) { return x.id === id; });
      if (nx) nx.read = true;
    });
    updateNotifBadge();
    fetch('/api/notifications/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: currentUser })
    }).catch(function() {});
    var p = document.getElementById('notifPanel');
    if (p) p.querySelectorAll('.notif-item.unread').forEach(function(el) { el.classList.remove('unread'); });
  }, 2000);
  setTimeout(function() {
    document.addEventListener('click', function _nClose(ev) {
      var p = document.getElementById('notifPanel');
      var bell = document.getElementById('notifBell');
      if (p && !p.contains(ev.target) && ev.target !== bell && !bell.contains(ev.target)) { p.remove(); _notifPanelOpen = false; }
      document.removeEventListener('click', _nClose);
    });
  }, 100);
}

function toggleNotifPanel() {
  var existing = document.getElementById('notifPanel');
  if (existing) { existing.remove(); _notifPanelOpen = false; return; }
  _notifPanelOpen = true;
  var url = '/api/notifications' + (_notifViewAll && _isManager() ? '' : '?to=' + encodeURIComponent(currentUser));
  fetch(url)
    .then(function(r) { return r.ok ? r.json() : _notifCache; })
    .then(function(arr) { _notifCache = arr; updateNotifBadge(); _renderNotifPanel(arr); })
    .catch(function() { _renderNotifPanel(_notifCache); });
}

function goToNotifCenter(nid) {
  var n = _notifCache.find(function(x) { return x.id === nid; });
  if (!n || (!(n.centerKey && n.centerKey.indexOf('_') > 0) && !(n.centerKeys && n.centerKeys.length))) return;
  markNotifRead(nid);
  var p = document.getElementById('notifPanel'); if (p) p.remove(); _notifPanelOpen = false;
  var keys = n.centerKeys && n.centerKeys.length ? n.centerKeys : [n.centerKey];
  if (keys.length === 1) {
    var parts = keys[0].split('_'); var rtype = parts[0]; var rid = parts.slice(1).join('_');
    setTimeout(function() { openCenterModal(rtype, rid); }, 100);
    return;
  }
  var listHtml = '<div style="display:flex;flex-direction:column;gap:6px;padding:4px 0">';
  keys.forEach(function(ck) {
    var cname = _clGetName(ck);
    var cparts = ck.split('_'); var crt = cparts[0]; var crid = cparts.slice(1).join('_');
    listHtml += '<button onclick="closeModal(\'notifCkList\');if(currentTab!==\'provinces\'&&currentTab!==\'weekplan\')switchTab(\'provinces\');setTimeout(function(){openCenterModal(\'' + crt + '\',\'' + crid + '\');},150)" style="text-align:right;padding:8px 12px;background:var(--bg-raised);border:1px solid var(--border);border-radius:6px;font-family:inherit;font-size:12px;cursor:pointer">' + esc(cname) + '</button>';
  });
  listHtml += '</div>';
  openModal('notifCkList', '📍 مراکز مرتبط با این اعلان', listHtml, '<button class="btn-secondary" onclick="closeModal(\'notifCkList\')">بستن</button>');
}

function ackNotif(nid) {
  var n = _notifCache.find(function(x) { return x.id === nid; });
  if (!n || n.ack) return;
  n.read = true; n.ack = true; n.ackAt = new Date().toISOString();
  fetch('/api/notifications/' + encodeURIComponent(nid) + '/read', { method: 'PUT' }).catch(function() {});
  if (n.from && n.from !== currentUser) {
    var cName = n.centerKey ? _clGetName(n.centerKey) : '';
    var replyMsg = (USERS[currentUser] || currentUser) + ' تأیید کرد: ' + (cName ? '"' + cName + '" ' : '') + 'انجام شد ✓';
    sendNotif(n.from, replyMsg, n.centerKey || '');
  }
  updateNotifBadge();
  var p = document.getElementById('notifPanel');
  if (p) {
    var el = p.querySelector('[data-nid="' + nid + '"]');
    if (el) {
      el.classList.remove('unread'); el.classList.add('notif-acked');
      var btn = el.querySelector('.notif-ack-btn');
      if (btn) btn.outerHTML = '<span class="notif-ack-badge">✓ تأیید شده</span>';
    }
  }
  showToast('✅ تأیید ثبت و به مدیر اطلاع داده شد', 2000);
}

function markNotifRead(nid) {
  var nx = _notifCache.find(function(x) { return x.id === nid; });
  if (nx && !nx.read) {
    nx.read = true;
    updateNotifBadge();
    fetch('/api/notifications/' + encodeURIComponent(nid) + '/read', { method: 'PUT' }).catch(function() {});
  }
}

function markAllNotifsRead() {
  _notifCache.forEach(function(n) { if (n.to === currentUser) n.read = true; });
  updateNotifBadge();
  fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: currentUser })
  }).catch(function() {});
  var p = document.getElementById('notifPanel');
  if (p) {
    var btn = p.querySelector('.notif-panel-head button');
    if (btn) btn.remove();
    p.querySelectorAll('.notif-item.unread').forEach(function(el) { el.classList.remove('unread'); });
  }
}

function _timeAgo(isoStr) {
  var diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'لحظاتی پیش';
  if (diff < 3600) return Math.floor(diff / 60) + ' دقیقه پیش';
  if (diff < 86400) return Math.floor(diff / 3600) + ' ساعت پیش';
  return Math.floor(diff / 86400) + ' روز پیش';
}
