<template>
  <div class="tk-panel" dir="rtl">
    <div class="tk-toolbar">
      <div class="tk-filters">
        <button
          v-for="f in FILTERS"
          :key="f.key"
          :class="['tk-filter', { active: activeFilter === f.key }]"
          @click="activeFilter = f.key"
        >{{ f.label }}</button>
      </div>
      <button class="tk-new-btn" @click="openNew">+ وظیفه جدید</button>
      <button v-if="hasVanillaModal" class="tk-adv-btn" @click="openVanillaBoard" title="نمای کانبان کامل">▦ پیشرفته</button>
    </div>

    <div v-if="loading" class="tk-loading">در حال بارگذاری...</div>

    <div v-else class="tk-board">
      <div v-for="col in COLUMNS" :key="col.id" class="tk-col">
        <div class="tk-col-header">
          <span class="tk-col-title">{{ col.label }}</span>
          <span class="tk-col-count">{{ colTasks(col.id).length }}</span>
        </div>
        <div class="tk-col-body">
          <div v-if="colTasks(col.id).length === 0" class="tk-empty">خالی</div>
          <div
            v-for="t in colTasks(col.id)"
            :key="t.id"
            :class="['tk-card', { 'tk-overdue': isOverdue(t) }]"
            @click="openTaskDetail(t)"
          >
            <div class="tk-card-top">
              <span :class="['tk-priority', 'p' + t.priority]">
                {{ t.priority === 1 ? 'بحرانی' : t.priority === 2 ? 'مهم' : 'عادی' }}
              </span>
              <div class="tk-card-actions">
                <button v-if="!t.done" class="tk-btn-done" @click.stop="markDone(t)" title="انجام شد">✓</button>
                <button v-if="isManager || t.createdBy === username" class="tk-btn-del" @click.stop="deleteTask(t)" title="حذف">✕</button>
              </div>
            </div>
            <div class="tk-card-title">{{ t.title }}</div>
            <div class="tk-card-meta">
              <span v-if="t.owner" class="tk-owner">👤 {{ t.owner }}</span>
              <span v-if="t.dueDate" :class="['tk-due', { overdue: isOverdue(t) }]">
                📅 {{ t.dueDate }}
              </span>
            </div>
            <div v-if="t.centerKey" class="tk-center">🏥 {{ t.centerKey }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- New task modal -->
    <div v-if="showModal" class="tk-modal-overlay" @click.self="showModal = false">
      <div class="tk-modal" dir="rtl">
        <div class="tk-modal-header">
          <span>وظیفه جدید</span>
          <button @click="showModal = false">✕</button>
        </div>
        <div class="tk-modal-body">
          <input v-model="form.title" placeholder="عنوان وظیفه *" class="tk-input" />
          <input v-model="form.dueDate" placeholder="تاریخ سررسید (1403/01/01)" class="tk-input" />
          <select v-model="form.priority" class="tk-input">
            <option :value="1">P1 — بحرانی</option>
            <option :value="2">P2 — مهم</option>
            <option :value="3">P3 — عادی</option>
          </select>
          <input v-model="form.note" placeholder="یادداشت" class="tk-input" />
        </div>
        <div class="tk-modal-footer">
          <button class="tk-btn-cancel" @click="showModal = false">انصراف</button>
          <button class="tk-btn-save" @click="saveNew" :disabled="!form.title.trim()">ذخیره</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';

interface Task {
  id: string;
  title: string;
  owner: string | null;
  dueDate: string | null;
  priority: number;
  status: string;
  centerKey: string | null;
  note: string;
  done: boolean;
  createdBy: string | null;
}

const props = defineProps<{ username: string; isManager: boolean }>();

const COLUMNS = [
  { id: 'todo',    label: 'انجام بده' },
  { id: 'doing',   label: 'در حال انجام' },
  { id: 'waiting', label: 'منتظر' },
  { id: 'done',    label: 'انجام شد' },
];
const FILTERS = [
  { key: 'all',     label: 'همه' },
  { key: 'mine',    label: 'مال من' },
  { key: 'overdue', label: 'سررسید گذشته' },
];

const loading = ref(false);
const tasks = ref<Task[]>([]);
const activeFilter = ref('all');
const showModal = ref(false);
const form = reactive({ title: '', dueDate: '', priority: 2, note: '' });

const hasVanillaModal = computed(() => typeof (window as any).openTaskModal === 'function');

function openTaskDetail(t: Task) {
  const w = window as any;
  if (typeof w.openTaskModal === 'function') w.openTaskModal(t.id);
}

function openVanillaBoard() {
  const w = window as any;
  if (w.DB) {
    if (!w.DB.settings) w.DB.settings = {};
    w.DB.settings.useVueTasks = false;
  }
  if (typeof w.renderTasksPanel === 'function') w.renderTasksPanel();
}

const todayJalali = computed(() => {
  // Simple date string for comparison — works with YYYY/MM/DD format
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
});

function isOverdue(t: Task) {
  return !t.done && !!t.dueDate && t.dueDate < todayJalali.value;
}

const filtered = computed(() => {
  switch (activeFilter.value) {
    case 'mine':    return tasks.value.filter(t => t.owner === props.username || t.createdBy === props.username);
    case 'overdue': return tasks.value.filter(isOverdue);
    default:        return tasks.value;
  }
});

function colTasks(colId: string) {
  if (colId === 'done') return filtered.value.filter(t => t.done || t.status === 'done');
  return filtered.value.filter(t => !t.done && t.status === colId);
}

async function load() {
  loading.value = true;
  try {
    const r = await fetch('/api/tasks');
    if (r.ok) tasks.value = await r.json();
  } finally {
    loading.value = false;
  }
}

async function markDone(t: Task) {
  await fetch(`/api/tasks/${t.id}/done`, { method: 'POST' });
  t.done = true;
  t.status = 'done';
}

async function deleteTask(t: Task) {
  if (!confirm(`وظیفه «${t.title}» به سطل زباله منتقل شود؟ (مدیر می‌تواند بازیابی کند)`)) return;
  const r = await fetch(`/api/tasks/${t.id}`, { method: 'DELETE', credentials: 'same-origin' });
  if (!r.ok) {
    const d = await r.json().catch(() => ({}));
    alert((d as { error?: string }).error || 'خطا در حذف وظیفه');
    return;
  }
  tasks.value = tasks.value.filter(x => x.id !== t.id);
}

function openNew() {
  form.title = '';
  form.dueDate = '';
  form.priority = 2;
  form.note = '';
  showModal.value = true;
}

async function saveNew() {
  if (!form.title.trim()) return;
  const id = 'tk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const newTask: Task = {
    id,
    title: form.title.trim(),
    owner: props.username,
    dueDate: form.dueDate || null,
    priority: form.priority,
    status: 'todo',
    centerKey: null,
    note: form.note,
    done: false,
    createdBy: props.username,
  };
  const r = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newTask),
  });
  if (r.ok) {
    tasks.value.unshift(newTask);
    showModal.value = false;
  }
}

onMounted(load);
defineExpose({ load });
</script>

<style scoped>
.tk-panel { display: flex; flex-direction: column; gap: 12px; padding: 16px; height: 100%; box-sizing: border-box; }
.tk-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.tk-filters { display: flex; gap: 4px; }
.tk-filter { padding: 5px 12px; border-radius: 20px; border: 1px solid #e5e7eb; background: #fff; cursor: pointer; font-family: inherit; font-size: 13px; }
.tk-filter.active { background: #6366f1; color: #fff; border-color: #6366f1; }
.tk-new-btn { padding: 7px 16px; background: #6366f1; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; }
.tk-adv-btn { padding: 7px 12px; background: #fff; color: #6366f1; border: 1px solid #c7d2fe; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px; }
.tk-loading { text-align: center; padding: 40px; color: #9ca3af; }
.tk-board { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; flex: 1; min-height: 0; }
@media (max-width: 900px) { .tk-board { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 600px) { .tk-board { grid-template-columns: 1fr; } }
.tk-col { background: #f9fafb; border-radius: 10px; display: flex; flex-direction: column; min-height: 200px; }
.tk-col-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-bottom: 2px solid #e5e7eb; }
.tk-col-title { font-weight: 600; font-size: 13px; color: #374151; }
.tk-col-count { background: #e5e7eb; color: #6b7280; border-radius: 10px; padding: 1px 8px; font-size: 12px; }
.tk-col-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; flex: 1; overflow-y: auto; }
.tk-empty { text-align: center; padding: 20px; color: #d1d5db; font-size: 12px; }
.tk-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 12px; box-shadow: 0 1px 3px rgba(0,0,0,.05); }
.tk-card.tk-overdue { border-right: 3px solid #ef4444; }
.tk-card-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.tk-priority { font-size: 11px; padding: 2px 8px; border-radius: 10px; font-weight: 500; }
.p1 { background: #fef2f2; color: #dc2626; }
.p2 { background: #fff7ed; color: #ea580c; }
.p3 { background: #f9fafb; color: #6b7280; }
.tk-card-actions { display: flex; gap: 4px; }
.tk-btn-done, .tk-btn-del { background: none; border: none; cursor: pointer; font-size: 13px; padding: 2px 5px; border-radius: 4px; }
.tk-btn-done { color: #16a34a; }
.tk-btn-done:hover { background: #f0fdf4; }
.tk-btn-del { color: #dc2626; }
.tk-btn-del:hover { background: #fef2f2; }
.tk-card-title { font-size: 13px; color: #1f2937; line-height: 1.5; margin-bottom: 6px; }
.tk-card-meta { display: flex; gap: 10px; font-size: 11px; color: #9ca3af; flex-wrap: wrap; }
.tk-due.overdue { color: #ef4444; }
.tk-center { font-size: 11px; color: #6b7280; margin-top: 4px; }
.tk-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 2000; display: flex; align-items: center; justify-content: center; }
.tk-modal { background: #fff; border-radius: 12px; width: 400px; max-width: 95vw; overflow: hidden; }
.tk-modal-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
.tk-modal-header button { background: none; border: none; cursor: pointer; color: #9ca3af; font-size: 16px; }
.tk-modal-body { padding: 20px; display: flex; flex-direction: column; gap: 10px; }
.tk-input { width: 100%; padding: 9px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-family: inherit; font-size: 13px; box-sizing: border-box; }
.tk-input:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,.1); }
.tk-modal-footer { display: flex; gap: 8px; justify-content: flex-end; padding: 12px 20px; border-top: 1px solid #f3f4f6; }
.tk-btn-cancel, .tk-btn-save { padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; font-family: inherit; font-size: 13px; }
.tk-btn-cancel { background: #f3f4f6; color: #374151; }
.tk-btn-save { background: #6366f1; color: #fff; }
.tk-btn-save:disabled { opacity: .5; cursor: not-allowed; }
</style>
