import {
  onBeforeUnmount,
  onMounted,
  watch,
  type Ref,
} from 'vue';
import type { DocxEditorRef } from '@stll/folio-vue';
import {
  clearFolioSelection,
  getFolioPagesViewport,
  paintFolioSelection,
} from '../utils/folioSelectionOverlay';

export function useFolioSelectionOverlay(opts: {
  hostRef: Ref<HTMLElement | null>;
  editorRef: Ref<DocxEditorRef | null>;
  selectionRev: Ref<number>;
  enabled?: Ref<boolean>;
}) {
  let raf: number | null = null;
  let paintGen = 0;
  let scrollEl: HTMLElement | null = null;
  let observer: MutationObserver | null = null;

  function schedulePaint() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      raf = null;
      void doPaint();
    });
  }

  async function doPaint() {
    const gen = ++paintGen;
    const host = opts.hostRef.value;
    const editor = opts.editorRef.value;
    if (!host || !editor || opts.enabled?.value === false) {
      if (host) clearFolioSelection(host);
      return;
    }

    const paged = editor.getEditorRef();
    const state = paged?.getState();
    if (!paged || !state) {
      clearFolioSelection(host);
      return;
    }

    const { from, to } = state.selection;
    const zoom = editor.getZoom() || 1;
    const layout = paged.getLayout();

    await paintFolioSelection(host, from, to, zoom, layout);
    if (gen !== paintGen) return;
  }

  function bindScroll() {
    unbindScroll();
    const host = opts.hostRef.value;
    if (!host) return;
    scrollEl = getFolioPagesViewport(host);
    scrollEl?.addEventListener('scroll', schedulePaint, { passive: true });
  }

  function unbindScroll() {
    scrollEl?.removeEventListener('scroll', schedulePaint);
    scrollEl = null;
  }

  function bindObserver() {
    observer?.disconnect();
    observer = null;
    const host = opts.hostRef.value;
    const pages = host?.querySelector('.docx-editor-vue__pages');
    if (!pages) return;
    observer = new MutationObserver(schedulePaint);
    observer.observe(pages, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-pm-start', 'data-pm-end', 'style', 'class'],
    });
  }

  function bindHost() {
    bindScroll();
    bindObserver();
    schedulePaint();
  }

  watch(() => opts.selectionRev.value, schedulePaint);
  watch(() => opts.hostRef.value, bindHost);
  watch(() => opts.editorRef.value, schedulePaint);

  onMounted(bindHost);

  onBeforeUnmount(() => {
    if (raf !== null) cancelAnimationFrame(raf);
    unbindScroll();
    observer?.disconnect();
    const host = opts.hostRef.value;
    if (host) clearFolioSelection(host);
  });

  return { schedulePaint };
}
