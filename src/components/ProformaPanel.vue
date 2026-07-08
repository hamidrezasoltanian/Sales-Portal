<template>
  <div class="pf-panel" dir="rtl">
    <div class="pf-toolbar">
      <div class="pf-filters">
        <button
          v-for="f in filters"
          :key="f.key"
          :class="['pf-filter-btn', { active: activeFilter === f.key }]"
          @click="setFilter(f.key)"
        >
          {{ f.label }}
          <span v-if="f.count" class="pf-badge">{{ f.count }}</span>
        </button>
      </div>
      <button class="pf-new-btn" @click="$emit('new')">+ پیشفاکتور جدید</button>
    </div>

    <div v-if="loading" class="pf-loading">در حال بارگذاری...</div>

    <div v-else-if="paged.length === 0" class="pf-empty">
      هیچ پیشفاکتوری یافت نشد
    </div>

    <div v-else class="pf-list">
      <div v-for="pf in paged" :key="pf.id" class="pf-card">
        <div class="pf-card-header">
          <span class="pf-no">{{ pf.no }}</span>
          <span :class="['pf-status', 'status-' + pf.status]">{{ statusLabel(pf.status) }}</span>
        </div>
        <div class="pf-card-body">
          <div class="pf-center">{{ pf.centerName || '—' }}</div>
          <div class="pf-total">{{ formatNum(pf.total) }} ﷼</div>
          <div class="pf-date">{{ pf.jalaliDate || '—' }}</div>
        </div>
        <div class="pf-card-actions">
          <button class="pf-btn" @click="openProforma(pf)">مشاهده</button>
          <button v-if="pf.status === 'draft'" class="pf-btn pf-btn-send" @click="$emit('send', pf)">ارسال</button>
          <button v-if="canApprove && pf.status === 'sent'" class="pf-btn pf-btn-approve" @click="$emit('approve', pf)">تأیید</button>
          <button v-if="canApprove && pf.status === 'sent'" class="pf-btn pf-btn-reject" @click="$emit('reject', pf)">رد</button>
        </div>
      </div>
    </div>

    <div v-if="hasMore" class="pf-load-more">
      <button class="pf-load-btn" @click="loadMore">
        بارگذاری بیشتر ({{ remaining }} مورد دیگر)
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';

interface ProformaItem {
  prodId: string;
  name: string;
  unit: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

interface Proforma {
  id: string;
  no: string;
  jalaliDate: string;
  validDays: number;
  centerKey: string;
  centerName: string;
  items: ProformaItem[];
  subtotal: number;
  discountPct: number;
  discAmt: number;
  taxPct: number;
  taxAmt: number;
  total: number;
  note: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected' | 'cancelled';
  createdBy: string;
  createdAt: string;
}

const props = defineProps<{
  userRole?: string;
}>();

defineEmits<{
  new: [];
  view: [pf: Proforma];
  send: [pf: Proforma];
  approve: [pf: Proforma];
  reject: [pf: Proforma];
}>();

const PER_PAGE = 25;
const all = ref<Proforma[]>([]);
const loading = ref(true);
const activeFilter = ref('all');
const page = ref(0);

const canApprove = computed(() =>
  props.userRole === 'مدیر' || props.userRole === 'سوپر ادمین'
);

const STATUS_LABELS: Record<string, string> = {
  draft: 'پیش‌نویس',
  sent: 'ارسال شده',
  approved: 'تأیید شده',
  rejected: 'رد شده',
  cancelled: 'لغو شده',
};

function statusLabel(s: string) {
  return STATUS_LABELS[s] || s;
}

function formatNum(n: number) {
  return Number(n || 0).toLocaleString('fa-IR');
}

const filtered = computed(() => {
  if (activeFilter.value === 'all') return all.value;
  return all.value.filter(p => p.status === activeFilter.value);
});

const paged = computed(() =>
  filtered.value.slice(0, (page.value + 1) * PER_PAGE)
);

const hasMore = computed(() => filtered.value.length > paged.value.length);
const remaining = computed(() => filtered.value.length - paged.value.length);

const filters = computed(() => {
  const counts: Record<string, number> = {};
  all.value.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
  return [
    { key: 'all', label: 'همه', count: all.value.length },
    { key: 'draft', label: 'پیش‌نویس', count: counts.draft || 0 },
    { key: 'sent', label: 'در انتظار', count: counts.sent || 0 },
    { key: 'approved', label: 'تأیید شده', count: counts.approved || 0 },
    { key: 'rejected', label: 'رد شده', count: counts.rejected || 0 },
  ].filter(f => f.key === 'all' || f.count > 0);
});

async function fetchAll() {
  loading.value = true;
  try {
    const r = await fetch('/api/proforma');
    if (r.ok) all.value = await r.json();
  } finally {
    loading.value = false;
  }
}

function setFilter(key: string) {
  activeFilter.value = key;
  page.value = 0;
}

function loadMore() {
  page.value++;
}

watch(activeFilter, () => { page.value = 0; });

onMounted(fetchAll);

function openProforma(pf: Proforma) {
  // Try window._pfView first (defined in proforma.js), fallback to emit
  const w = window as any;
  if (typeof w._pfView === 'function') {
    w._pfView(pf);
  } else {
    // _pfView not ready yet — try pfOpenEdit directly
    if (typeof w.pfOpenEdit === 'function') {
      w.pfOpenEdit(pf.id);
    }
  }
}

defineExpose({ refresh: fetchAll });
</script>

<style scoped>
.pf-panel { display: flex; flex-direction: column; gap: 12px; padding: 16px; }
.pf-toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.pf-filters { display: flex; gap: 6px; flex-wrap: wrap; }
.pf-filter-btn { padding: 5px 12px; border-radius: 20px; border: 1px solid #c7d2fe; background: #fff; cursor: pointer; font-family: inherit; font-size: 13px; }
.pf-filter-btn.active { background: #6366f1; color: #fff; border-color: #6366f1; }
.pf-badge { background: #e0e7ff; color: #3730a3; border-radius: 10px; padding: 1px 6px; font-size: 11px; margin-right: 4px; }
.pf-filter-btn.active .pf-badge { background: rgba(255,255,255,0.25); color: #fff; }
.pf-new-btn { padding: 7px 16px; background: #6366f1; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 13px; }
.pf-loading, .pf-empty { text-align: center; padding: 40px; color: #6b7280; }
.pf-list { display: grid; gap: 10px; }
.pf-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; }
.pf-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.pf-no { font-weight: 600; color: #1f2937; font-size: 14px; }
.pf-status { font-size: 12px; padding: 2px 10px; border-radius: 12px; }
.status-draft { background: #f3f4f6; color: #6b7280; }
.status-sent { background: #eff6ff; color: #1d4ed8; }
.status-approved { background: #f0fdf4; color: #15803d; }
.status-rejected { background: #fef2f2; color: #dc2626; }
.status-cancelled { background: #fafafa; color: #9ca3af; }
.pf-card-body { display: flex; gap: 16px; align-items: baseline; margin-bottom: 10px; font-size: 13px; }
.pf-center { color: #374151; flex: 1; }
.pf-total { font-weight: 600; color: #111827; }
.pf-date { color: #9ca3af; font-size: 12px; }
.pf-card-actions { display: flex; gap: 6px; }
.pf-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid #d1d5db; background: #fff; cursor: pointer; font-family: inherit; font-size: 12px; }
.pf-btn-send { border-color: #3b82f6; color: #3b82f6; }
.pf-btn-approve { border-color: #16a34a; color: #16a34a; }
.pf-btn-reject { border-color: #dc2626; color: #dc2626; }
.pf-load-more { text-align: center; padding: 8px; }
.pf-load-btn { padding: 8px 24px; border: 1px dashed #6366f1; color: #6366f1; background: #fff; border-radius: 8px; cursor: pointer; font-family: inherit; }
</style>
