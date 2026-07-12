import { createEmptyDocument } from '@stll/folio-vue';
import type { FontOption } from '@stll/folio-vue';

/** A4 page in twips (210×297 mm). */
export const A4_LETTER_PAGE = {
  pageWidth: 11906,
  pageHeight: 16838,
  marginTop: 1134,
  marginBottom: 1134,
  marginRight: 1134,
  marginLeft: 851,
} as const;

export const VAZIRMATN_FONTS = [
  {
    family: 'Vazirmatn',
    src: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2',
    weight: 400,
  },
  {
    family: 'Vazirmatn',
    src: 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Bold.woff2',
    weight: 700,
  },
] as const;

/** Folio toolbar passes FontOption.name to setFontFamily — must be the real family id. */
export function primaryFontName(fontFamily: string): string {
  const trimmed = fontFamily.trim();
  if (!trimmed) return '';
  let quote: string | null = null;
  let result = '';
  for (const ch of trimmed) {
    if ((ch === '"' || ch === "'") && quote === null) {
      quote = ch;
      result += ch;
      continue;
    }
    if (ch === quote) {
      quote = null;
      result += ch;
      continue;
    }
    if (ch === ',' && quote === null) break;
    result += ch;
  }
  return result.trim().replace(/^['"]|['"]$/g, '');
}

function letterFont(
  fontFamily: string,
  category: NonNullable<FontOption['category']>,
): FontOption {
  return {
    name: primaryFontName(fontFamily),
    fontFamily,
    category,
  };
}

/** Stable reference — DocxEditor warns against recreating this each render. */
export const LETTER_FONT_FAMILIES: FontOption[] = [
  letterFont('Vazirmatn, Tahoma, sans-serif', 'sans-serif'),
  letterFont('Tahoma, Geneva, sans-serif', 'sans-serif'),
  letterFont('Arial, Helvetica, sans-serif', 'sans-serif'),
  letterFont('"Times New Roman", Times, serif', 'serif'),
  letterFont('"B Nazanin", Vazirmatn, serif', 'serif'),
  letterFont('"B Mitra", Vazirmatn, sans-serif', 'sans-serif'),
];

const VAZIRMATN_FAMILY = {
  ascii: 'Vazirmatn',
  hAnsi: 'Vazirmatn',
  cs: 'Vazirmatn',
} as const;

function applyVazirmatnDefaults(doc: ReturnType<typeof createEmptyDocument>) {
  const pkg = doc.package;
  if (!pkg?.styles?.docDefaults?.rPr) return doc;
  pkg.styles.docDefaults.rPr.fontFamily = { ...VAZIRMATN_FAMILY };
  for (const para of pkg.document?.content ?? []) {
    if (para.type !== 'paragraph') continue;
    for (const block of para.content ?? []) {
      if (block.type !== 'run') continue;
      block.formatting = {
        ...(block.formatting ?? {}),
        fontFamily: { ...VAZIRMATN_FAMILY },
      };
    }
  }
  return doc;
}

export function createRtlLetterDocument(initialText = '') {
  const doc = createEmptyDocument({ ...A4_LETTER_PAGE, initialText: initialText.trim() });
  return applyVazirmatnDefaults(doc);
}

export function htmlToPlainText(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

export function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function fetchLetterDocx(letterId: number): Promise<ArrayBuffer | null> {
  const r = await fetch(`/api/letters/${letterId}/docx`, { credentials: 'same-origin' });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('خطا در بارگذاری سند نامه');
  return r.arrayBuffer();
}
