/* ═══ Lazy tab script loader (Phase 2) ═══ */
(function () {
  var V = '20260710d';
  var _loaded = {};

  var TAB_SCRIPTS = {
    calendar: ['calendar.js'],
    checklist: ['checklist.js'],
    activity: ['activity-log.js'],
    changelog: [],
    tasks: ['tasks.js'],
    kpi: ['kpi.js', 'manager-tasks.js'],
    mtr: ['mtr.js'],
    proforma: ['proforma.js'],
    hcp: ['hcp.js'],
    support: ['support.js'],
    hr: ['hr.js'],
    'trade-kpi': ['trade-kpi.js'],
    reports: ['reports.js'],
    'week-planner': ['week-planner.js'],
    'faradis-match': ['faradis-match.js', 'faradis-data.js'],
    home: ['expert-dashboard.js'],
    pricing: [],
    weekplan: [],
    manager: [],
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
})();
