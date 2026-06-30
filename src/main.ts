import { createApp } from 'vue';
import ProformaPanel from './components/ProformaPanel.vue';
import NotificationsPanel from './components/NotificationsPanel.vue';
import TasksPanel from './components/TasksPanel.vue';
import LettersPanel from './components/LettersPanel.vue';

fetch('/api/auth/me')
  .then(r => r.ok ? r.json() : null)
  .then(user => {
    if (!user) return;
    const userRole = user.role || '';
    const username = user.username || '';
    const isManager = userRole === 'مدیر' || userRole === 'سوپر ادمین';

    // ProformaPanel
    const pfEl = document.getElementById('vue-proforma');
    if (pfEl) {
      const instance = createApp(ProformaPanel, {
        userRole,
        onNew:     () => (window as any)._pfNew?.(),
        onView:    (pf: any) => (window as any)._pfView?.(pf),
        onSend:    (pf: any) => (window as any)._pfSend?.(pf),
        onApprove: (pf: any) => (window as any)._pfApprove?.(pf),
        onReject:  (pf: any) => (window as any)._pfReject?.(pf),
      });
      const mounted = instance.mount(pfEl);
      (window as any)._pfVueRefresh = () => (mounted as any).refresh?.();
    }

    // NotificationsPanel
    const notifEl = document.getElementById('vue-notifications');
    if (notifEl) {
      const ni = createApp(NotificationsPanel, {
        username,
        onOpenCenter: (key: string) => {
          // key is a centerKey like "pc_p4||88" or "center_123" — parse to (rtype, id)
          // and open the center modal. Do NOT call openProvince (it expects a province id).
          if (!key || typeof key !== 'string') return;
          const us = key.indexOf('_');
          if (us < 0) return;
          const rtype = key.slice(0, us);
          const rid = key.slice(us + 1);
          const w = window as any;
          try { w._buildPCCache?.(); } catch (_) {}
          if (typeof w.openCenterModal === 'function') {
            w.openCenterModal(rtype, rid);
          }
        },
      });
      const nm = ni.mount(notifEl);
      (window as any)._notifVueLoad = () => (nm as any).load?.();
    }

    // TasksPanel
    const tasksEl = document.getElementById('vue-tasks');
    if (tasksEl) {
      const ti = createApp(TasksPanel, { username, isManager });
      const tm = ti.mount(tasksEl);
      (window as any)._tasksVueLoad = () => (tm as any).load?.();
    }

    // LettersPanel — دبیرخانه دیجیتال
    const lettersEl = document.getElementById('vue-letters');
    if (lettersEl) {
      const li = createApp(LettersPanel, { username, userRole, isManager });
      const lm = li.mount(lettersEl);
      (window as any)._lettersVueLoad = () => (lm as any).load?.();
    }
  })
  .catch(() => {});

