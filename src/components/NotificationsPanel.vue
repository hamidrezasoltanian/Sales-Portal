<template>
  <div class="nb-wrapper" dir="rtl" v-click-outside="close">
    <button class="nb-bell" ref="bellRef" @click="toggle" :class="{ active: open }">
      🔔
      <span v-if="unreadCount > 0" class="nb-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
    </button>

    <div v-if="open" class="nb-panel" :style="panelStyle">
      <div class="nb-header">
        <span class="nb-title">اعلان‌ها</span>
        <div class="nb-header-actions">
          <button v-if="unreadCount > 0" class="nb-read-all" @click="readAll">همه خوانده شد</button>
          <button class="nb-close" @click="close">✕</button>
        </div>
      </div>

      <div v-if="loading" class="nb-loading">در حال بارگذاری...</div>
      <div v-else-if="items.length === 0" class="nb-empty">اعلانی وجود ندارد</div>
      <div v-else class="nb-list">
        <div
          v-for="n in items"
          :key="n.id"
          :class="['nb-item', { 'nb-unread': !n.read }]"
          @click="handleClick(n)"
        >
          <div class="nb-item-dot" v-if="!n.read"></div>
          <div class="nb-item-body">
            <div class="nb-msg">{{ n.msg }}</div>
            <div class="nb-time">{{ timeAgo(n.at) }}</div>
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
  msg: string;
  centerKey: string | null;
  at: string;
  read: boolean;
}

const props = defineProps<{ username: string }>();
const emit = defineEmits<{ openCenter: [centerKey: string] }>();

const open = ref(false);
const loading = ref(false);
const items = ref<Notif[]>([]);
const bellRef = ref<HTMLElement | null>(null);
const panelStyle = ref<Record<string, string>>({});
let refreshTimer: ReturnType<typeof setInterval> | null = null;

const unreadCount = computed(() => items.value.filter(n => !n.read).length);

function calcPanelPos() {
  if (!bellRef.value) return;
  const r = bellRef.value.getBoundingClientRect();
  const panelW = 320;
  const viewW = window.innerWidth;
  // Position panel below the bell, staying within viewport
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

async function load() {
  loading.value = true;
  try {
    const r = await fetch('/api/notifications');
    if (r.ok) items.value = await r.json();
  } finally {
    loading.value = false;
  }
}

async function readAll() {
  await fetch('/api/notifications/read-all', { method: 'POST' });
  items.value.forEach(n => { n.read = true; });
}

async function handleClick(n: Notif) {
  if (!n.read) {
    await fetch(`/api/notifications/${n.id}/read`, { method: 'PUT' });
    n.read = true;
  }
  if (n.centerKey) {
    emit('openCenter', n.centerKey);
    close();
  }
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'لحظاتی پیش';
  if (m < 60) return `${m} دقیقه پیش`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعت پیش`;
  const d = Math.floor(h / 24);
  return `${d} روز پیش`;
}

// click-outside directive
const vClickOutside = {
  mounted(el: HTMLElement, binding: any) {
    el._clickOutside = (e: Event) => {
      if (!el.contains(e.target as Node)) binding.value();
    };
    document.addEventListener('click', el._clickOutside);
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener('click', el._clickOutside);
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
.nb-panel { position: fixed; width: 320px; background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,.12); z-index: 3500; overflow: hidden; max-height: calc(100vh - 80px); display: flex; flex-direction: column; }
.nb-header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid #f3f4f6; }
.nb-title { font-weight: 600; font-size: 14px; color: #111827; }
.nb-header-actions { display: flex; gap: 8px; align-items: center; }
.nb-read-all { font-size: 12px; color: #6366f1; background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px; }
.nb-read-all:hover { background: #eef2ff; }
.nb-close { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 14px; padding: 2px 6px; }
.nb-loading, .nb-empty { padding: 32px; text-align: center; color: #9ca3af; font-size: 13px; }
.nb-list { flex: 1; overflow-y: auto; }
.nb-item { display: flex; gap: 10px; align-items: flex-start; padding: 12px 16px; cursor: pointer; border-bottom: 1px solid #f9fafb; transition: background .1s; }
.nb-item:hover { background: #f9fafb; }
.nb-item-dot { width: 8px; height: 8px; border-radius: 50%; background: #6366f1; margin-top: 5px; flex-shrink: 0; }
.nb-unread { background: #fafbff; }
.nb-item-body { flex: 1; min-width: 0; }
.nb-msg { font-size: 13px; color: #374151; line-height: 1.5; }
.nb-time { font-size: 11px; color: #9ca3af; margin-top: 3px; }
</style>
