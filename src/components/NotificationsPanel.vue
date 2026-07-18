<template>
  <div class="nb-wrapper" dir="rtl" v-click-outside="close">
    <button class="nb-bell" ref="bellRef" @click="toggle" :class="{ active: open }">
      🔔
      <span v-if="unreadCount > 0" class="nb-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="nb-panel" :style="panelStyle">
      <div class="nb-header">
        <span class="nb-title">{{ viewAll ? 'همه اعلان‌ها' : 'اعلان‌های من' }}</span>
        <div class="nb-header-actions">
          <span v-if="isManager" class="nb-toggle">
            <button :class="{ on: !viewAll }" @click.stop="setViewAll(false)">من</button>
            <button :class="{ on: viewAll }" @click.stop="setViewAll(true)">همه</button>
          </span>
          <button v-if="unreadCount > 0 && !viewAll" class="nb-read-all" @click="readAll">همه خوانده شد</button>
          <button v-if="showManualSend && isManager" class="nb-read-all" @click="sendPending">📤 ارسال دستی</button>
          <button class="nb-close" @click="close">✕</button>
        </div>
      </div>

      <div class="nb-filters" v-if="!viewAll">
        <button
          v-for="f in filters"
          :key="f.id"
          :class="['nb-filter', { on: filterType === f.id }]"
          @click="filterType = f.id; load()"
        >{{ f.label }}</button>
      </div>

      <div v-if="loading" class="nb-loading">در حال بارگذاری...</div>
      <div v-else-if="displayItems.length === 0" class="nb-empty">اعلانی وجود ندارد</div>
      <div v-else class="nb-list">
        <div
          v-for="n in displayItems"
          :key="n.id"
          :class="['nb-item', { 'nb-unread': !n.read }]"
        >
          <div class="nb-item-dot" v-if="!n.read"></div>
          <div class="nb-item-body">
            <div class="nb-msg">{{ n.msg }}</div>
            <div class="nb-meta">
              <span v-if="viewAll" class="nb-to">به: {{ displayName(n.to) }}</span>
              <span v-if="n.from">از: {{ displayName(n.from) }}</span>
              <span v-if="n.type && n.type !== 'general'" class="nb-type">{{ typeLabel(n.type) }}</span>
              <span class="nb-time">{{ timeAgo(n.at) }}</span>
            </div>
            <div v-if="n.centerKey" class="nb-center" @click="openCenter(n.centerKey!)">
              📍 {{ centerLabel(n.centerKey) }}
            </div>
            <div v-if="!viewAll" class="nb-actions">
              <template v-for="act in actionsFor(n)" :key="act.id">
                <button class="nb-act" @click="runAction(n, act.id)">{{ act.label }}</button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

interface Notif {
  id: string;
  to: string;
  from?: string | null;
  msg: string;
  centerKey: string | null;
  centerKeys?: string[] | null;
  at: string;
  read: boolean;
  type?: string;
  meta?: { taskId?: string; taskTitle?: string; proformaId?: string; proformaNo?: string; action?: string } | null;
}

const props = defineProps<{
  username: string;
  isManager?: boolean;
}>();

const emit = defineEmits<{ openCenter: [centerKey: string] }>();

const open = ref(false);
const loading = ref(false);
const items = ref<Notif[]>([]);
const viewAll = ref(false);
const filterType = ref('all');
const bellRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const filters = [
  { id: 'all', label: 'همه' },
  { id: 'followup', label: 'معوق' },
  { id: 'task', label: 'وظایف' },
  { id: 'proforma', label: 'پیش‌فاکتور' },
  { id: 'morning_brief', label: 'صبح' },
];

const unreadCount = computed(() =>
  items.value.filter(n => n.to === props.username && !n.read).length
);

const showManualSend = computed(() => {
  const w = window as any;
  const np = w.DB && w.DB.settings && w.DB.settings.notifPrefs;
  return np && np.autoSend === false;
});

const displayItems = computed(() => {
  let list = viewAll.value
    ? items.value.slice()
    : items.value.filter(n => n.to === props.username);
  if (filterType.value !== 'all') {
    list = list.filter(n => (n.type || 'general') === filterType.value);
  }
  return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 100);
});

function displayName(uid: string) {
  const w = window as any;
  return (w.USERS && w.USERS[uid]) || uid;
}

function typeLabel(t: string) {
  const map: Record<string, string> = {
    followup: 'پیگیری',
    task: 'وظیفه',
    proforma: 'پیش‌فاکتور',
    morning_brief: 'بریفینگ',
    manager_request: 'درخواست مدیر',
    owner_change: 'مالکیت',
    ack: 'تأیید',
  };
  return map[t] || t;
}

function centerLabel(ck: string) {
  const w = window as any;
  if (typeof w._clGetName === 'function') return w._clGetName(ck) || ck;
  return ck;
}

function actionsFor(n: Notif) {
  const t = n.type || 'general';
  const hasCenter = !!(n.centerKey || (n.centerKeys && n.centerKeys.length));
  const acts: { id: string; label: string }[] = [];

  if (t === 'followup' || t === 'manager_request') {
    if (hasCenter) {
      acts.push({ id: 'call', label: '📞 ثبت تماس' });
      acts.push({ id: 'brief', label: '📋 خلاصه' });
    }
    acts.push({ id: 'ack', label: '✓ انجام دادم' });
  } else if (t === 'task') {
    acts.push({ id: 'task', label: '📋 باز کردن وظیفه' });
  } else if (t === 'morning_brief') {
    acts.push({ id: 'weekplan', label: '📅 برنامه هفته' });
  } else if (t === 'owner_change' && hasCenter) {
    acts.push({ id: 'center', label: '🔍 مشاهده مرکز' });
  } else if (t === 'proforma' && props.isManager && n.meta?.proformaId) {
    if (n.meta.action === 'pending' || !n.meta.action) {
      acts.push({ id: 'pf_approve', label: '✅ تأیید' });
      acts.push({ id: 'pf_reject', label: '❌ رد' });
    }
    acts.push({ id: 'proforma', label: '👁 مشاهده' });
  } else if (t === 'proforma') {
    acts.push({ id: 'proforma', label: '👁 پیش‌فاکتور' });
  } else if (t !== 'ack') {
    acts.push({ id: 'ack', label: '✓ انجام دادم' });
  }
  return acts;
}

function calcPanelPos() {
  if (!bellRef.value) return;
  const r = bellRef.value.getBoundingClientRect();
  const panelW = 360;
  const viewW = window.innerWidth;
  let left = r.left;
  if (left + panelW > viewW - 10) left = viewW - panelW - 10;
  if (left < 10) left = 10;
  panelStyle.value = {
    position: 'fixed',
    top: (r.bottom + 8) + 'px',
    left: left + 'px',
    right: 'auto',
  };
}

function toggle() {
  open.value = !open.value;
  if (open.value) { nextTick(calcPanelPos); load(); }
}
function close() { open.value = false; }
function setViewAll(v: boolean) { viewAll.value = v; load(); }

async function load() {
  loading.value = true;
  try {
    const q = viewAll.value ? '?all=true' : '';
    const ft = !viewAll.value && filterType.value !== 'all' ? (q ? '&' : '?') + 'type=' + filterType.value : '';
    const r = await fetch('/api/notifications/inbox' + q + ft);
    if (r.ok) items.value = await r.json();
  } finally {
    loading.value = false;
  }
}

async function readAll() {
  await fetch('/api/notifications/read-all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: props.username }),
  });
  items.value.forEach(n => { if (n.to === props.username) n.read = true; });
}

function openCenter(centerKey: string) {
  emit('openCenter', centerKey);
  close();
}

async function sendPending() {
  const r = await fetch('/api/notifications/send-pending', { method: 'POST' });
  if (r.ok) {
    const w = window as any;
    w.showToast?.('📤 اعلان‌های در صف ارسال شدند', 2500);
    await load();
  }
}

async function runAction(n: Notif, action: string) {
  const w = window as any;
  if (action === 'pf_approve' || action === 'pf_reject') {
    const pid = n.meta?.proformaId;
    if (!pid) return;
    const note = action === 'pf_reject' ? (prompt('دلیل رد (اختیاری):') || '') : '';
    const r = await fetch('/api/proforma/' + encodeURIComponent(pid) + '/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: action === 'pf_approve' ? 'approve' : 'reject', note }),
    });
    if (r.ok) {
      n.read = true;
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PUT' });
      w.showToast?.(action === 'pf_approve' ? '✅ تأیید شد' : '❌ رد شد', 2500);
      await load();
    } else {
      w.showToast?.('❌ خطا در عملیات پیش‌فاکتور', 3000);
    }
    return;
  }
  try {
    const r = await fetch(`/api/notifications/${n.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if (r.ok) {
      n.read = true;
      const data = await r.json();
      if (action === 'call' && data.center) {
        close();
        setTimeout(() => w.quickCallLog?.(data.center.rtype, data.center.rid, ''), 100);
      } else if (action === 'brief' && data.center) {
        close();
        setTimeout(() => w.openPreCallBrief?.(data.center.rtype, data.center.rid), 100);
      } else if (action === 'task') {
        close();
        const tid = data.taskId || n.meta?.taskId;
        if (tid) setTimeout(() => w.openTaskModal?.(tid), 100);
        else w.switchTab?.('tasks');
      } else if (action === 'weekplan') {
        close();
        w.switchTab?.('weekplan');
      } else if (action === 'center' && data.center) {
        openCenter(data.center.centerKey);
      } else if (action === 'proforma') {
        close();
        w.switchTab?.('proforma');
      } else if (action === 'ack') {
        w.showToast?.('✅ تأیید ثبت شد', 2000);
      }
    }
  } catch (_) {}
  await load();
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'لحظاتی پیش';
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  return `${Math.floor(h / 24)} روز پیش`;
}

const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    (el as any)._clickOutside = (e: Event) => {
      if (!el.contains(e.target as Node)) binding.value();
    };
    document.addEventListener('click', (el as any)._clickOutside);
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener('click', (el as any)._clickOutside);
  },
};

onMounted(() => {
  load();
  refreshTimer = setInterval(load, 60000);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
});

defineExpose({ load });
</script>

<style scoped>
.nb-wrapper { position: relative; display: inline-block; }
.nb-bell { position: relative; background: none; border: none; font-size: 18px; cursor: pointer; padding: 4px 8px; border-radius: 8px; transition: background .15s; }
.nb-bell:hover, .nb-bell.active { background: rgba(99,102,241,.1); }
.nb-badge { position: absolute; top: -2px; left: -2px; background: #ef4444; color: #fff; font-size: 10px; min-width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; padding: 0 3px; }
.nb-panel { position: fixed; width: 360px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,.12); z-index: 3500; overflow: hidden; max-height: calc(100vh - 80px); display: flex; flex-direction: column; }
.nb-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; gap: 8px; }
.nb-title { font-weight: 600; font-size: 14px; color: #111827; white-space: nowrap; }
.nb-header-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.nb-toggle { display: inline-flex; gap: 2px; background: #f3f4f6; border-radius: 6px; padding: 2px; }
.nb-toggle button { font-size: 10px; border: none; border-radius: 4px; padding: 2px 8px; cursor: pointer; background: transparent; color: #6b7280; }
.nb-toggle button.on { background: #6366f1; color: #fff; }
.nb-read-all { font-size: 12px; color: #6366f1; background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.nb-read-all:hover { background: #eef2ff; }
.nb-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 14px; padding: 2px 6px; }
.nb-filters { display: flex; flex-wrap: wrap; gap: 4px; padding: 8px 12px; border-bottom: 1px solid #f3f4f6; }
.nb-filter { font-size: 10px; border: 1px solid #e5e7eb; background: #fff; border-radius: 12px; padding: 3px 8px; cursor: pointer; }
.nb-filter.on { background: #eef2ff; border-color: #6366f1; color: #4338ca; }
.nb-loading, .nb-empty { padding: 32px; text-align: center; color: #9ca3af; font-size: 13px; }
.nb-list { flex: 1; overflow-y: auto; }
.nb-item { display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; border-bottom: 1px solid #f9fafb; }
.nb-item-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; margin-top: 5px; flex-shrink: 0; }
.nb-unread { background: #fafbff; }
.nb-item-body { flex: 1; min-width: 0; }
.nb-msg { font-size: 13px; color: #374151; line-height: 1.5; }
.nb-meta { font-size: 10px; color: #9ca3af; margin-top: 4px; display: flex; flex-wrap: wrap; gap: 6px; }
.nb-type { background: #f3f4f6; padding: 1px 5px; border-radius: 4px; }
.nb-center { font-size: 11px; color: #6366f1; margin-top: 4px; cursor: pointer; }
.nb-center:hover { text-decoration: underline; }
.nb-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
.nb-act { font-size: 10px; border: 1px solid #e5e7eb; background: #fff; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
.nb-act:hover { background: #f9fafb; border-color: #6366f1; }
</style>
