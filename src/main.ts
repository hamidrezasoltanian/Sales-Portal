import { createApp } from 'vue';
import NotificationsPanel from './components/NotificationsPanel.vue';
import TasksPanel from './components/TasksPanel.vue';
import LettersPanel from './components/LettersPanel.vue';
import SyncStatusBadge from './components/SyncStatusBadge.vue';

type VueUser = { username: string; role?: string };

function mountVuePanels(user: VueUser) {
  const w = window as any;
  if (w._vuePanelsMounted) return;
  w._vuePanelsMounted = true;

  const userRole = user.role || '';
  const username = user.username || '';
  const isManager = userRole === 'مدیر' || userRole === 'سوپر ادمین';

  const notifEl = document.getElementById('vue-notifications');
  if (notifEl && !notifEl.__vue_app__) {
    const ni = createApp(NotificationsPanel, {
      username,
      onOpenCenter: (key: string) => {
        if (!key || typeof key !== 'string') return;
        const us = key.indexOf('_');
        if (us < 0) return;
        const rtype = key.slice(0, us);
        const rid = key.slice(us + 1);
        try { w._buildPCCache?.(); } catch (_) {}
        if (typeof w.openCenterModal === 'function') {
          w.openCenterModal(rtype, rid);
        }
      },
    });
    const nm = ni.mount(notifEl);
    w._notifVueLoad = () => (nm as any).load?.();
  }

  const tasksEl = document.getElementById('vue-tasks');
  if (tasksEl && !(tasksEl as any).__vue_app__) {
    const ti = createApp(TasksPanel, { username, isManager });
    const tm = ti.mount(tasksEl);
    w._tasksVueLoad = () => (tm as any).load?.();
  }

  const lettersEl = document.getElementById('vue-letters');
  if (lettersEl && !(lettersEl as any).__vue_app__) {
    const li = createApp(LettersPanel, { username, userRole, isManager });
    const lm = li.mount(lettersEl);
    w._lettersVueLoad = () => (lm as any).load?.();
  }

  const syncEl = document.getElementById('vue-sync-status');
  if (syncEl && !(syncEl as any).__vue_app__) {
    createApp(SyncStatusBadge).mount(syncEl);
  }

  if (w.currentTab === 'letters' && typeof w._lettersVueLoad === 'function') {
    w._lettersVueLoad();
  }
  if (w.currentTab === 'tasks' && typeof w._tasksVueLoad === 'function') {
    w._tasksVueLoad();
  }
}

(window as any).mountVuePanels = mountVuePanels;

fetch('/api/auth/me', { credentials: 'same-origin' })
  .then(r => (r.ok ? r.json() : null))
  .then(user => {
    if (!user) return;
    mountVuePanels({ username: user.username, role: user.role });
  })
  .catch(() => {});
