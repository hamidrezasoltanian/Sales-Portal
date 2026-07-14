/* ═══ Lazy tab script loader (Phase 2) ═══ */
(function () {
  var V = '20260713ad';
  var _loaded = {};

  var TAB_SCRIPTS = {
    calendar: ['calendar.js'],
    checklist: ['checklist.js'],
    activity: ['activity-log.js'],
    changelog: [],
    tasks: ['tasks.js'],
    kpi: ['tasks.js', 'manager-tasks.js'],
    mtr: ['mtr.js'],
    proforma: ['proforma.js', 'proforma-analytics.js', 'proforma-phase2.js'],
    hcp: ['hcp.js'],
    support: ['support.js'],
    hr: ['hr.js'],
    'trade-kpi': ['trade-kpi.js'],
    reports: ['reports.js'],
    'week-planner': ['week-planner.js'],
    'faradis-match': ['faradis-match.js', 'faradis-data.js'],
    home: ['home-cartable.js'],
    pricing: [],
    weekplan: [],
    manager: ['tasks.js'],
    provinces: [],
    letters: []
  };

  function _loadOne(file) {
    var src = '/js/' + file;
    if (_loaded[src]) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src + '?v=' + V;
      s.async = false;
      s.onload = function () { _loaded[src] = true; resolve(); };
      s.onerror = function () { reject(new Error('Failed to load ' + src)); };
      document.body.appendChild(s);
    });
  }

  window.ensureTabScripts = function (tab) {
    var files = TAB_SCRIPTS[tab];
    if (!files || !files.length) return Promise.resolve();
    return files.reduce(function (chain, f) {
      return chain.then(function () { return _loadOne(f); });
    }, Promise.resolve());
  };

  window.preloadTabScripts = function (tab) {
    ensureTabScripts(tab).catch(function (e) { console.warn('[tab-loader]', e.message); });
  };

  /** Open proforma tab from center profile (works before proforma.js is loaded). */
  window.openProformaForCenter = function (centerKey, centerName, mode) {
    var ck = centerKey || '';
    var nm = centerName || '';
    var wantNew = mode !== 'list';
    if (wantNew) {
      window.__pfPendingNewCenter = { centerKey: ck, centerName: nm };
    }
    function _open() {
      if (wantNew && typeof pfOpenNewForCenter === 'function') {
        return pfOpenNewForCenter(ck, nm);
      }
      if (!wantNew && typeof pfOpenForCenter === 'function') {
        return pfOpenForCenter(ck, nm);
      }
      if (wantNew) window.__pfPendingNewCenter = { centerKey: ck, centerName: nm };
      if (typeof switchTab === 'function') switchTab('proforma');
    }
    if (typeof ensureTabScripts === 'function') {
      return ensureTabScripts('proforma').then(_open).catch(function (e) {
        console.warn('[openProformaForCenter]', e.message);
        _open();
      });
    }
    _open();
  };
})();
