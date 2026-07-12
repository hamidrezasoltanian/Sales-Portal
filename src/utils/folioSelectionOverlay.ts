import { projectRangesToRects } from '@stll/folio-core/paged-layout/rangeProjection';
import {
  FOLIO_CARET_RECT_ATTRIBUTE,
  FOLIO_SELECTION_RECT_ATTRIBUTE,
} from '@stll/folio-core/paged-layout/selectionViewportRect';
import type { Layout } from '@stll/folio-core/layout-engine';
import type { FlowBlock, Measure } from '@stll/folio-core/layout-engine/types';

const LAYER_CLASS = 'letter-folio-selection-layer';
const SELECTION_COLOR = 'rgba(99, 102, 241, 0.35)';
const CARET_COLOR = '#6366f1';

type LocalRect = { left: number; top: number; width: number; height: number };

function getEditorElements(host: HTMLElement) {
  const pagesContainer = host.querySelector(
    '.docx-editor-vue__pages.paged-editor__pages',
  ) as HTMLElement | null;
  const overlayOrigin = host.querySelector(
    '[data-testid="selection-overlay"]',
  ) as HTMLElement | null;
  const viewport = host.querySelector(
    '.docx-editor-vue__pages-viewport',
  ) as HTMLElement | null;
  return { pagesContainer, overlayOrigin, viewport };
}

function ensureLayer(overlayOrigin: HTMLElement): HTMLElement {
  let layer = overlayOrigin.querySelector(`.${LAYER_CLASS}`) as HTMLElement | null;
  if (!layer) {
    layer = document.createElement('div');
    layer.className = LAYER_CLASS;
    layer.setAttribute('aria-hidden', 'true');
    overlayOrigin.appendChild(layer);
  }
  return layer;
}

function getTextNode(spanEl: HTMLElement): Text | null {
  if (spanEl.firstChild?.nodeType === Node.TEXT_NODE) {
    return spanEl.firstChild as Text;
  }
  const anchor = spanEl.firstChild;
  if (
    anchor instanceof HTMLElement
    && anchor.tagName === 'A'
    && anchor.firstChild?.nodeType === Node.TEXT_NODE
  ) {
    return anchor.firstChild as Text;
  }
  return null;
}

function domCaretRect(
  pagesContainer: HTMLElement,
  overlayRect: DOMRect,
  zoom: number,
  pos: number,
): LocalRect | null {
  const spans = pagesContainer.querySelectorAll(
    '.layout-page-content span[data-pm-start][data-pm-end]',
  );
  for (const span of spans) {
    const spanEl = span as HTMLElement;
    const pmStart = Number(spanEl.dataset.pmStart);
    const pmEnd = Number(spanEl.dataset.pmEnd);
    if (Number.isNaN(pmStart) || Number.isNaN(pmEnd)) continue;
    if (pos < pmStart || pos > pmEnd) continue;

    if (spanEl.classList.contains('layout-run-tab')) {
      const box = spanEl.getBoundingClientRect();
      const x = pos <= pmStart ? box.left : box.right;
      return {
        left: (x - overlayRect.left) / zoom,
        top: (box.top - overlayRect.top) / zoom,
        width: 2,
        height: box.height / zoom,
      };
    }

    const textNode = getTextNode(spanEl);
    if (textNode) {
      const char = Math.max(0, Math.min(textNode.length, pos - pmStart));
      const range = document.createRange();
      range.setStart(textNode, char);
      range.setEnd(textNode, char);
      const clientRects = Array.from(range.getClientRects());
      if (clientRects.length > 0) {
        const rect = clientRects[0]!;
        return {
          left: (rect.left - overlayRect.left) / zoom,
          top: (rect.top - overlayRect.top) / zoom,
          width: 2,
          height: rect.height / zoom,
        };
      }
      const box = spanEl.getBoundingClientRect();
      const x = char >= textNode.length ? box.right : box.left;
      return {
        left: (x - overlayRect.left) / zoom - 1,
        top: (box.top - overlayRect.top) / zoom,
        width: 2,
        height: box.height / zoom,
      };
    }
  }
  return null;
}

function paintRectEl(
  layer: HTMLElement,
  rect: LocalRect,
  zoom: number,
  attr: string,
  background: string,
) {
  const el = document.createElement('span');
  el.setAttribute(attr, '');
  Object.assign(el.style, {
    position: 'absolute',
    left: `${rect.left * zoom}px`,
    top: `${rect.top * zoom}px`,
    width: `${Math.max(rect.width, 1) * zoom}px`,
    height: `${Math.max(rect.height, 1) * zoom}px`,
    background,
    pointerEvents: 'none',
  });
  layer.appendChild(el);
}

export async function paintFolioSelection(
  host: HTMLElement,
  from: number,
  to: number,
  zoom: number,
  layout: Layout | null,
  blocks: FlowBlock[] = [],
  measures: Measure[] = [],
): Promise<void> {
  const { pagesContainer, overlayOrigin } = getEditorElements(host);
  if (!pagesContainer || !overlayOrigin) return;

  const layer = ensureLayer(overlayOrigin);
  layer.replaceChildren();
  const overlayRect = overlayOrigin.getBoundingClientRect();

  if (from === to) {
    const caret = domCaretRect(pagesContainer, overlayRect, zoom, from);
    if (caret) {
      paintRectEl(layer, caret, zoom, FOLIO_CARET_RECT_ATTRIBUTE, CARET_COLOR);
    }
    return;
  }

  const projected = await projectRangesToRects([{ from, to }], {
    pagesContainer,
    zoom,
    layout,
    blocks,
    measures,
  });

  for (const { rects } of projected) {
    for (const rect of rects) {
      paintRectEl(
        layer,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
        },
        zoom,
        FOLIO_SELECTION_RECT_ATTRIBUTE,
        SELECTION_COLOR,
      );
    }
  }
}

export function clearFolioSelection(host: HTMLElement): void {
  host.querySelector('[data-testid="selection-overlay"]')
    ?.querySelector(`.${LAYER_CLASS}`)
    ?.replaceChildren();
}

export function getFolioPagesViewport(host: HTMLElement): HTMLElement | null {
  return getEditorElements(host).viewport;
}
