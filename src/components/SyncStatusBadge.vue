<template>
  <span
    class="sync-badge"
    :class="status"
    :title="title"
  >{{ label }}</span>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';

const status = ref<'ok' | 'warn' | 'err'>('ok');
const label = ref('●');
const title = ref('وضعیت اتصال');

let timer: ReturnType<typeof setInterval> | null = null;

async function poll() {
  try {
    const r = await fetch('/api/health', { credentials: 'include' });
    const j = await r.json();
    if (r.ok && j.ok) {
      status.value = 'ok';
      label.value = '●';
      title.value = 'سرور متصل';
    } else {
      status.value = 'warn';
      label.value = '●';
      title.value = 'مشکل در سرویس';
    }
  } catch {
    status.value = 'err';
    label.value = '●';
    title.value = 'قطع ارتباط';
  }
}

onMounted(() => {
  poll();
  timer = setInterval(poll, 60000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});
</script>

<style scoped>
.sync-badge {
  font-size: 10px;
  margin-inline-start: 6px;
  cursor: default;
  user-select: none;
}
.sync-badge.ok { color: #22c55e; }
.sync-badge.warn { color: #f59e0b; }
.sync-badge.err { color: #ef4444; }
</style>
