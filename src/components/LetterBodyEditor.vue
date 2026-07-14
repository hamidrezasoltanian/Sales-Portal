<template>

  <div
    ref="hostRef"
    class="letter-body-editor letter-folio-island ep-root folio-root"
    :style="{ minHeight: height }"
  >

    <DocxEditor

      v-if="mounted"

      ref="editorRef"

      :key="editorKey"

      :document="initialDocument"

      :document-buffer="documentBuffer"

      :document-key="editorKey"

      :read-only="readOnly"

      :author="author"

      :show-toolbar="!readOnly"

      :show-zoom-control="true"

      :show-margin-guides="false"

      :show-print-button="true"

      :show-review-controls="false"

      :initial-zoom="0.85"

      :font-families="fontFamilies"

      :fonts="fontFaces"

      class="folio-editor-host"

      @error="onEditorError"

      @selection-change="onSelectionChange"

      @selection-text-change="onSelectionChange"

      @editor-view-ready="onEditorViewReady"

    />

    <div v-else class="letter-body-editor-loading">در حال بارگذاری ویرایشگر...</div>

  </div>

</template>



<script setup lang="ts">

import { ref, shallowRef, computed, onMounted } from 'vue';
import { useFolioSelectionOverlay } from '../composables/useFolioSelectionOverlay';

import {

  DocxEditor,

  toMarkdown,

  provideLocale,

  type DocxEditorRef,

  type Document,

} from '@stll/folio-vue';

import '@stll/folio-vue/editor.css';

import '../styles/folio-crm-theme.css';

import {

  VAZIRMATN_FONTS,

  createRtlLetterDocument,

  htmlToPlainText,

  LETTER_FONT_FAMILIES,

} from '../utils/letterDocx';



const props = withDefaults(

  defineProps<{

    readOnly?: boolean;

    documentBuffer?: ArrayBuffer | null;

    author?: string;

    height?: string;

  }>(),

  {

    readOnly: false,

    documentBuffer: null,

    author: '',

    height: '460px',

  },

);



provideLocale('ar');



const hostRef = ref<HTMLElement | null>(null);

const editorRef = ref<DocxEditorRef | null>(null);

const selectionRev = ref(0);

const editorKey = ref(`letter-${Date.now()}`);

const mounted = ref(false);

const documentBuffer = shallowRef<ArrayBuffer | null>(props.documentBuffer);

const seedDocument = shallowRef<Document | null>(null);



const fontFamilies = LETTER_FONT_FAMILIES;



const fontFaces = VAZIRMATN_FONTS.map((f) => ({ ...f }));



const initialDocument = computed(() => {

  if (documentBuffer.value) return null;

  return seedDocument.value || createRtlLetterDocument();

});



const { schedulePaint: scheduleSelectionPaint } = useFolioSelectionOverlay({
  hostRef,
  editorRef,
  selectionRev,
  enabled: computed(() => !props.readOnly && mounted.value),
});

onMounted(() => {

  mounted.value = true;

});



function onSelectionChange() {

  selectionRev.value += 1;

}



function onEditorViewReady() {

  scheduleSelectionPaint();

}



function onEditorError(err: Error) {

  console.error('[LetterBodyEditor]', err);

}



function reset(initialText = '') {

  documentBuffer.value = null;

  seedDocument.value = createRtlLetterDocument(initialText);

  editorKey.value = `letter-${Date.now()}`;

}



function loadFromHtml(html: string) {

  const text = htmlToPlainText(html);

  reset(text);

}



async function loadBuffer(buf: ArrayBuffer) {

  documentBuffer.value = buf;

  seedDocument.value = null;

  editorKey.value = `letter-${Date.now()}`;

}



async function exportDocx(): Promise<ArrayBuffer | null> {

  return (await editorRef.value?.save()) ?? null;

}



function getPlainPreview(maxLen = 400): string {

  const md = getMarkdown();

  if (!md) return '';

  const flat = md.replace(/\s+/g, ' ').trim();

  if (!flat) return '';

  return flat.length > maxLen ? `${flat.slice(0, maxLen)}…` : flat;

}



function getMarkdown(): string {

  const doc = editorRef.value?.getDocument();

  if (!doc) return '';

  try {

    return toMarkdown(doc).trim();

  } catch {

    return '';

  }

}



defineExpose({

  reset,

  loadFromHtml,

  loadBuffer,

  exportDocx,

  getPlainPreview,

  getMarkdown,

  getEditorRef: () => editorRef.value,

});

</script>



<style scoped>

.letter-body-editor {

  border: 1px solid #cbd5e1;

  border-radius: 10px;

  overflow: visible;

  background: var(--doc-page, #e2e8f0);

  display: flex;

  flex-direction: column;

  min-height: 280px;

  height: 100%;

}



.letter-body-editor-loading {

  display: flex;

  align-items: center;

  justify-content: center;

  min-height: 280px;

  color: #64748b;

  font-size: 13px;

  font-weight: 700;

  font-family: Vazirmatn, Tahoma, sans-serif;

}



:deep(.folio-editor-host) {

  flex: 1;

  min-height: 280px;

  height: 100%;

  display: flex;

  flex-direction: column;

}



:deep(.folio-editor-host.docx-editor-vue) {

  min-height: 0;

}



:deep(.folio-editor-host .docx-editor-vue__editor-scroll) {

  background: var(--doc-page, #e2e8f0);

}



:deep(.folio-editor-host [data-folio-pages]) {

  direction: rtl;

}

</style>


