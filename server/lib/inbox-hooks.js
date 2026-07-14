'use strict';

const inboxIndex = require('./inbox-index');

function safeHook(fn) {
  return function () {
    return fn.apply(inboxIndex, arguments).catch(function (e) {
      console.error('[inbox-hook]', e.message);
    });
  };
}

module.exports = {
  onTaskChange: safeHook(inboxIndex.syncTask),
  onTaskDelete: function (id) { return safeHook(inboxIndex.deactivateBySource)('task', id); },
  onWeekChange: safeHook(inboxIndex.syncWeekEntry),
  onWeekDelete: function (id) { return safeHook(inboxIndex.deactivateBySource)('week', id); },
  onNotificationChange: safeHook(inboxIndex.syncNotification),
  onProformaChange: safeHook(inboxIndex.syncProforma),
  onLeaveChange: function (id) {
    return safeHook(inboxIndex.syncLeave)(id);
  },
  onPayrollVariableChange: function (id) {
    return safeHook(inboxIndex.syncPayrollVariable)(id);
  },
  rebuildAll: safeHook(inboxIndex.rebuildAll),
};
