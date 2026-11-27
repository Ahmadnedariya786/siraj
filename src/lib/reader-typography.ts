/**
 * Royal E-Book Unified Typography Engine, BiDi Isolation, Honorific Sanitizer & Font-Readiness Gate
 * Single persisted store (`siraj_reader_prefs_v1`) governing Hadith, Seerah, Prophets & Daily Hadith readers.
 */
import { useState, useEffect, useCallback } from 'react';
import type { ContentLang } from '@/lib/content-translator';

export type ReaderLineHeightMode = 'compact' | 'standard' | 'relaxed';
export type ReaderLineSpacing = ReaderLineHeightMode;
export type ReaderPresetId = 'compact' | 'comfortable' | 'large-print' | 'custom';
export type ReaderAlignment = 'auto';

export const BODY_SIZE_MIN = 13;
export const BODY_SIZE_MAX = 18;
export const BODY_SIZE_DEFAULT = 15;

export const ARABIC_SIZE_MIN = 18;
export const ARABIC_SIZE_MAX = 30;
export const ARABIC_SIZE_DEFAULT = 22;

export const PARAGRAPH_SPACING_EM = 0.9;
export const MEASURE_CAP_CH = 68;

export const READER_HEADING_SCALE = {
  h1: 22,
  h2: 18,
  h3: 16,
} as const;

export const READER_PREFS_STORAGE_KEY = 'siraj_reader_prefs_v1';
export const READER_PREFS_EVENT = 'siraj-reader-prefs-changed';

export interface BookReaderPrefs {
  bodySize: number; // 13..18, default 15
  arabicSize: number; // 18..30, default 22
  lineHeightMode: ReaderLineHeightMode; // compact | standard | relaxed
  paragraphSpacing: number; // 0.9em
  alignment: ReaderAlignment; // AUTO: LTR left, RTL right (never center)
  measureCapCh: number; // 68ch
  preset: ReaderPresetId;
  // Backward-compatible property aliases strictly synchronized
  bodyFontSize: number;
  arabicFontSize: number;
  lineSpacing: ReaderLineHeightMode;
}

export interface ReaderPresetConfig {
  id: Exclude<ReaderPresetId, 'custom'>;
  label: string;
  bodySize: number;
  arabicSize: number;
  lineHeightMode: ReaderLineHeightMode;
}

export const READER_PRESETS: Record<Exclude<ReaderPresetId, 'custom'>, ReaderPresetConfig> = {
  compact: {
    id: 'compact',
    label: 'Compact',
    bodySize: 14,
    arabicSize: 20,
    lineHeightMode: 'compact',
  },
  comfortable: {
    id: 'comfortable',
    label: 'Comfortable',
    bodySize: 15,
    arabicSize: 22,
    lineHeightMode: 'standard',
  },
  'large-print': {
    id: 'large-print',
    label: 'Large Print',
    bodySize: 18,
    arabicSize: 28,
    lineHeightMode: 'relaxed',
  },
};

export const DEFAULT_READER_PREFS: BookReaderPrefs = {
  bodySize: BODY_SIZE_DEFAULT,
  arabicSize: ARABIC_SIZE_DEFAULT,
  lineHeightMode: 'standard',
  paragraphSpacing: PARAGRAPH_SPACING_EM,
  alignment: 'auto',
  measureCapCh: MEASURE_CAP_CH,
  preset: 'comfortable',
  bodyFontSize: BODY_SIZE_DEFAULT,
  arabicFontSize: ARABIC_SIZE_DEFAULT,
  lineSpacing: 'standard',
};

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

function inferPreset(
  bodySize: number,
  arabicSize: number,
  lineHeightMode: ReaderLineHeightMode
): ReaderPresetId {
  for (const preset of Object.values(READER_PRESETS)) {
    if (
      preset.bodySize === bodySize &&
      preset.arabicSize === arabicSize &&
      preset.lineHeightMode === lineHeightMode
    ) {
      return preset.id;
    }
  }
  return 'custom';
}

export function normalizeBookReaderPrefs(
  raw?: Partial<BookReaderPrefs> | null
): BookReaderPrefs {
  const bodySize = clamp(
    Number(raw?.bodySize ?? raw?.bodyFontSize ?? BODY_SIZE_DEFAULT),
    BODY_SIZE_MIN,
    BODY_SIZE_MAX
  );
  const arabicSize = clamp(
    Number(raw?.arabicSize ?? raw?.arabicFontSize ?? ARABIC_SIZE_DEFAULT),
    ARABIC_SIZE_MIN,
    ARABIC_SIZE_MAX
  );
  const rawMode = raw?.lineHeightMode ?? raw?.lineSpacing;
  const lineHeightMode: ReaderLineHeightMode =
    rawMode === 'compact' || rawMode === 'relaxed' ? rawMode : 'standard';

  return {
    bodySize,
    arabicSize,
    lineHeightMode,
    paragraphSpacing: PARAGRAPH_SPACING_EM,
    alignment: 'auto',
    measureCapCh: MEASURE_CAP_CH,
    preset: inferPreset(bodySize, arabicSize, lineHeightMode),
    bodyFontSize: bodySize,
    arabicFontSize: arabicSize,
    lineSpacing: lineHeightMode,
  };
}

export function syncReaderCssVariables(prefs: BookReaderPrefs): void {
  if (typeof document === 'undefined' || !document.documentElement?.style) return;
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty('--reader-body-size', `${prefs.bodySize}px`);
  rootStyle.setProperty('--reader-arabic-size', `${prefs.arabicSize}px`);
  rootStyle.setProperty('--reader-ltr-line-height', String(getReaderLineHeight('en', prefs.lineHeightMode)));
  rootStyle.setProperty('--reader-rtl-line-height', String(getReaderLineHeight('ur', prefs.lineHeightMode)));
  rootStyle.setProperty('--reader-arabic-line-height', String(getArabicLineHeight(prefs.lineHeightMode)));
  rootStyle.setProperty('--reader-paragraph-spacing', `${prefs.paragraphSpacing}em`);
  rootStyle.setProperty('--reader-measure-cap', `${prefs.measureCapCh}ch`);
}

export function loadBookReaderPrefs(): BookReaderPrefs {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_READER_PREFS;
    const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
    if (!raw) {
      syncReaderCssVariables(DEFAULT_READER_PREFS);
      return DEFAULT_READER_PREFS;
    }
    const parsed = JSON.parse(raw) as Partial<BookReaderPrefs>;
    const normalized = normalizeBookReaderPrefs(parsed);
    syncReaderCssVariables(normalized);
    return normalized;
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

export function saveBookReaderPrefs(next: Partial<BookReaderPrefs>): BookReaderPrefs {
  const current =
    typeof localStorage !== 'undefined'
      ? (() => {
          try {
            const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
            return raw ? normalizeBookReaderPrefs(JSON.parse(raw)) : DEFAULT_READER_PREFS;
          } catch {
            return DEFAULT_READER_PREFS;
          }
        })()
      : DEFAULT_READER_PREFS;

  const mergedInput: Partial<BookReaderPrefs> = {
    ...current,
    ...next,
    bodySize: next.bodySize ?? next.bodyFontSize ?? current.bodySize,
    arabicSize: next.arabicSize ?? next.arabicFontSize ?? current.arabicSize,
    lineHeightMode: next.lineHeightMode ?? next.lineSpacing ?? current.lineHeightMode,
  };

  const normalized = normalizeBookReaderPrefs(mergedInput);
  syncReaderCssVariables(normalized);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(READER_PREFS_STORAGE_KEY, JSON.stringify(normalized));
    }
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent(READER_PREFS_EVENT, { detail: normalized }));
    }
  } catch {
    // Ignore storage write restriction cleanly
  }
  return normalized;
}

export function useBookReaderPrefs() {
  const [prefs, setPrefsState] = useState<BookReaderPrefs>(() => loadBookReaderPrefs());

  useEffect(() => {
    syncReaderCssVariables(prefs);
  }, [prefs]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sync = (e: Event) => {
      const custom = e as CustomEvent<BookReaderPrefs>;
      if (custom.detail) {
        const normalized = normalizeBookReaderPrefs(custom.detail);
        setPrefsState(normalized);
      } else {
        setPrefsState(loadBookReaderPrefs());
      }
    };
    window.addEventListener(READER_PREFS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(READER_PREFS_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const updatePrefs = useCallback((partial: Partial<BookReaderPrefs>) => {
    setPrefsState((prev) => {
      const resolvedNext: Partial<BookReaderPrefs> = {
        ...prev,
        ...partial,
        bodySize: partial.bodySize ?? partial.bodyFontSize ?? prev.bodySize,
        arabicSize: partial.arabicSize ?? partial.arabicFontSize ?? prev.arabicSize,
        lineHeightMode: partial.lineHeightMode ?? partial.lineSpacing ?? prev.lineHeightMode,
      };
      return saveBookReaderPrefs(resolvedNext);
    });
  }, []);

  const applyPreset = useCallback((presetId: Exclude<ReaderPresetId, 'custom'>) => {
    const preset = READER_PRESETS[presetId];
    if (!preset) return;
    setPrefsState(
      saveBookReaderPrefs({
        bodySize: preset.bodySize,
        arabicSize: preset.arabicSize,
        lineHeightMode: preset.lineHeightMode,
      })
    );
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState(saveBookReaderPrefs(DEFAULT_READER_PREFS));
  }, []);

  return { prefs, updatePrefs, applyPreset, resetPrefs };
}

/**
 * Strict per-block direction & alignment.
 * Body text and headings always use `dir="auto"` + `unicode-bidi: plaintext` and
 * align strictly to direction (LTR = left, RTL = right; NEVER center-aligned).
 */
export function getReaderBlockDirection(actualBodyLang: ContentLang | string): {
  dir: 'auto';
  resolvedDir: 'ltr' | 'rtl';
  textAlignClass: 'text-left' | 'text-right';
  textAlign: 'left' | 'right';
  unicodeBidi: 'plaintext';
} {
  const isRtlLang = actualBodyLang === 'ur' || actualBodyLang === 'ar';
  return {
    dir: 'auto',
    resolvedDir: isRtlLang ? 'rtl' : 'ltr',
    textAlignClass: isRtlLang ? 'text-right' : 'text-left',
    textAlign: isRtlLang ? 'right' : 'left',
    unicodeBidi: 'plaintext',
  };
}

/**
 * Unified line-height mapping:
 * - LTR (EN/GU/HI): Compact 1.6 / Standard 1.75 / Relaxed 1.9
 * - RTL Nastaliq (UR/AR): Compact 2.2 / Standard 2.5 / Relaxed 2.8
 */
export function getReaderLineHeight(
  actualBodyLang: ContentLang | string,
  mode: ReaderLineHeightMode = 'standard'
): number {
  if (actualBodyLang === 'ur' || actualBodyLang === 'ar') {
    if (mode === 'compact') return 2.2;
    if (mode === 'relaxed') return 2.8;
    return 2.5;
  }
  if (mode === 'compact') return 1.6;
  if (mode === 'relaxed') return 1.9;
  return 1.75;
}

/**
 * Arabic blocks strictly right-align (never justify) and follow active lineHeightMode
 * (Compact 1.85 / Standard 2.0 / Relaxed 2.25).
 */
export function getArabicLineHeight(mode: ReaderLineHeightMode = 'standard'): number {
  if (mode === 'compact') return 1.85;
  if (mode === 'relaxed') return 2.25;
  return 2.0;
}

/**
 * Font stack per active reading language.
 * Urdu and Hindi bodies render with Noto Nastaliq Urdu in stack (Hindi falls back cleanly
 * to Noto Sans Devanagari for Devanagari glyphs while honorific/Urdu glyphs use Nastaliq).
 */
export function getReaderFontFamily(actualBodyLang: ContentLang | string): string | undefined {
  if (actualBodyLang === 'ur') {
    return "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', serif";
  }
  if (actualBodyLang === 'hi') {
    return "'Noto Nastaliq Urdu', 'Noto Sans Devanagari', ui-sans-serif, system-ui, sans-serif";
  }
  if (actualBodyLang === 'gu') {
    return "'Noto Sans Gujarati', ui-sans-serif, system-ui, sans-serif";
  }
  return undefined;
}

// ─── Font-Readiness Gate for Noto Nastaliq Urdu (Zero Naskh Flash) ───────────

let nastaliqFontReadyCache = false;

export function isNastaliqFontReadySync(): boolean {
  if (nastaliqFontReadyCache) return true;
  if (typeof document === 'undefined' || !('fonts' in document)) {
    return true;
  }
  try {
    const loaded =
      document.fonts.check('15px "Noto Nastaliq Urdu"') ||
      document.fonts.check('15px "Jameel Noori Nastaleeq"');
    if (loaded) {
      nastaliqFontReadyCache = true;
    }
    return loaded;
  } catch {
    return true;
  }
}

export async function ensureNastaliqFontReady(timeoutMs = 700): Promise<boolean> {
  if (isNastaliqFontReadySync()) return true;
  if (typeof document === 'undefined' || !('fonts' in document)) {
    nastaliqFontReadyCache = true;
    return true;
  }

  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const loadPromise = Promise.allSettled([
      document.fonts.load('400 15px "Noto Nastaliq Urdu"'),
      document.fonts.load('700 15px "Noto Nastaliq Urdu"'),
      document.fonts.ready,
    ]);
    const timeoutPromise = new Promise<void>((resolve) => {
      timerId = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([loadPromise, timeoutPromise]);
  } catch {
    // Offline or font API rejected — proceed without blocking UI
  } finally {
    if (timerId !== undefined) clearTimeout(timerId);
  }
  nastaliqFontReadyCache = true;
  return true;
}

export function useNastaliqFontReady(lang: ContentLang | string): boolean {
  const needsNastaliq = lang === 'ur' || lang === 'hi';
  const [ready, setReady] = useState<boolean>(() =>
    !needsNastaliq ? true : isNastaliqFontReadySync()
  );

  useEffect(() => {
    if (!needsNastaliq) {
      setReady(true);
      return;
    }
    if (isNastaliqFontReadySync()) {
      setReady(true);
      return;
    }
    let active = true;
    setReady(false);
    ensureNastaliqFontReady(700).then(() => {
      if (active) setReady(true);
    });
    return () => {
      active = false;
    };
  }, [needsNastaliq]);

  return ready;
}

// ─── Honorific Protection, Normalization & BiDi Punctuation Sanitizer ────────

const PROPHET_NAME_PATTERN =
  "Adam|Idris|Nuh|Nooh|Hud|Hood|Saleh|Salih|Saalih|Ibrahim|Ibraheem|Abraham|Lut|Lot|Ismail|Ismaeel|Ishmael|Ishaq|Ishaaq|Isaac|Yaqub|Yaqoob|Jacob|Yusuf|Yousuf|Joseph|Ayyub|Ayyoob|Job|Shu'?ayb|Shuayb|Shuaib|Musa|Moosa|Moses|Harun|Haroon|Aaron|Dawud|Dawood|David|Sulaiman|Sulayman|Solomon|Yunus|Yoonus|Jonah|Ilyas|Elias|Al-?Yasa|Elisha|Dhul-?Kifl|Zul-?Kifl|Zakariyya|Zakariyah|Zachariah|Yahya|John|Isa|Eesa|Jesus|Maryam|Mary|Hawa|آدم|ادریس|نوح|ہود|صالح|ابراہیم|لوط|اسماعیل|اسحاق|یعقوب|یوسف|ایوب|شعیب|موسیٰ|ہارون|داؤد|سلیمان|یونس|الیاس|الیسع|ذوالکفل|زکریا|یحییٰ|عیسیٰ|आदम|इदरीस|नूह|हूद|सालेह|इब्राहीम|लूत|इस्माईल|इस्हाक़|याक़ूब|यूसुफ़|अय्यूब|शुऐब|मूसा|हारून|दाऊद|सुलेमान|यूनुस|इलियास|अल-यसा|ज़ुल-किफ़्ल|ज़करिया|याह्या|ईसा|આદમ|ઇદરીસ|નૂહ|હૂદ|સાલેહ|ઇબ્રાહીમ|લૂત|ઇસ્માઇલ|ઇસ્હાક|યાકૂબ|યૂસુફ|અય્યૂબ|શુએબ|મૂસા|હારૂન|દાઊદ|સુલેમાન|યૂનુસ|ઇલ્યાસ|અલ-યસા|ઝુલ-કિફ્લ|ઝકરિયા|યાહ્યા|ઈસા";

const COMPANION_NAME_PATTERN =
  "Abu Bakr|Umar|Uthman|Ali|Aisha|Khadijah|Fatimah|Hamzah|Bilal|Salman|Abu Hurairah|Ibn Abbas|Ibn Umar|Anas|Mu'awiyah|Tamim|ابوبکر|عمر|عثمان|علی|عائشہ|خدیجہ|فاطمہ|حمزہ|ابوہریرہ";

export function getHonorificLabels(lang: ContentLang = 'en') {
  if (lang === 'ur') {
    return {
      swt: '(سبحانہ و تعالیٰ)',
      pbuh: '(ﷺ)',
      as: '(علیہ السلام)',
      ra: '(رضی اللہ عنہ)',
    };
  }
  if (lang === 'gu') {
    return {
      swt: '(SWT)',
      pbuh: '(ﷺ)',
      as: '(અ.સ.)',
      ra: '(ર.અ.)',
    };
  }
  if (lang === 'hi') {
    return {
      swt: '(SWT)',
      pbuh: '(ﷺ)',
      as: '(अ.स.)',
      ra: '(र.अ.)',
    };
  }
  return {
    swt: '(SWT)',
    pbuh: '(ﷺ)',
    as: '(AS)',
    ra: '(RA)',
  };
}

/**
 * Identifies inline Arabic honorifics (e.g. سُبْحَٰنَهُۥ وَتَعَٰلَىٰ, عَلَيْهِ ٱلسَّلَامُ, صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ)
 * so extractors never rip them out as standalone quote boxes leaving "Allah ()" or "Lut ()".
 */
export function isInlineArabicHonorific(text: string): boolean {
  const cleaned = text.replace(/[\s()[\].,!?;:'"«»﴿﴾]/g, '');
  if (!cleaned || cleaned.length > 48) return false;
  return /^(?:سُ?بْ?حَ?ٰ?نَ?هُۥ?\s*وَتَعَ?ٰ?لَ?ىٰ?|عَلَ?يْ?هِ\s*ٱ?ل?سَّ?لَ?امُ?|عَلَ?يْ?هِمَا?\s*ٱ?ل?سَّ?لَ?امُ?|صَلَّ?ى\s*ٱ?للَّ?ٰ?هُ\s*عَلَ?يْ?هِ\s*وَسَلَّ?مَ?|رَضِ?يَ?\s*ٱ?للَّ?ٰ?هُ\s*عَ?نْ?هُ?م?ا?|تَعَ?الَ?ىٰ?)$/u.test(
    text.replace(/[()[\]]/g, '').trim()
  );
}

/**
 * Fixes reversed BiDi punctuation artifacts (e.g. ":New Creation" -> "New Creation:")
 * and spaces before colons/periods while preserving intentional time ratios like 2:30.
 */
export function normalizeBidiPunctuation(text: string): string {
  if (!text) return '';
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return '';
      // Fix leading colon placed at start of an English/Latin heading or phrase (":New Creation")
      let fixed = trimmed.replace(/^:\s*([A-Za-z"'“‘(].*[^:])$/, '$1:');
      // Fix reversed leading comma/semicolon on Latin lines
      fixed = fixed.replace(/^([,;])\s+([A-Za-z])/, '$2');
      // Tighten stray space before punctuation without breaking ratios
      fixed = fixed.replace(/\s+([,.;:!?])/g, '$1');
      return fixed;
    })
    .join('\n');
}

/**
 * Cleans empty honorific brackets ("Allah ()", "Lut ()", "Prophet ()"),
 * normalizes Arabic honorific phrases inside prose per active language,
 * fixes reversed BiDi punctuation, and unwraps mid-sentence book line breaks.
 */
export function formatIslamicProse(rawText: string, lang: ContentLang = 'en'): string {
  if (!rawText) return '';

  const labels = getHonorificLabels(lang);
  let text = rawText.replace(/\r\n/g, '\n');

  // Fix "(O Muhammad\n)" / "(O\nMuhammad )" / "(O Muhammad )" across Seerah chapters
  text = text.replace(/\(O\s+Muhammad(?:\s*\n+\s*|\s*)\)/gi, '(O Muhammad ﷺ)');
  text = text.replace(/\n+\)/g, ')');

  // Normalize Arabic SWT / AS / PBUH / RA honorifics (both parenthesized & bare) per active language
  const arabicSwtRe =
    /\(\s*(?:سُ?بْ?حَ?ٰ?نَهُۥ?\s*وَتَعَ?ٰ?لَىٰ?|سبحانه\s*وتعالى|تَعَ?الَىٰ?)\s*\)/gu;
  const bareArabicSwtRe =
    /(^|[\s"'“‘(>])(Allah|Allāh|اللہ|अल्लाह|અલ્લાહ)\s+(?:سُ?بْ?حَ?ٰ?نَهُۥ?\s*وَتَعَ?ٰ?لَىٰ?|سبحانه\s*وتعالى)(?=$|[\s.,;:!?'"”’<)])/giu;
  const arabicAsRe =
    /\(\s*(?:عَلَ?يْ?هِ\s*ٱ?ل?سَّ?لَ?امُ?|عليه\s*السلام|عَلَ?يْ?هِمَا?\s*ٱ?ل?سَّ?لَ?امُ?)\s*\)/gu;
  const bareArabicAsRe =
    new RegExp(`(^|[\\s"'“‘(>])(${PROPHET_NAME_PATTERN})\\s+(?:عَلَ?يْ?هِ\\s*ٱ?ل?سَّ?لَ?امُ?|عليه\\s*السلام)`, 'giu');
  const arabicPbuhRe =
    /\(\s*(?:صَلَّ?ى\s*ٱ?للَّ?ٰ?هُ\s*عَلَ?يْ?هِ\s*وَسَلَّ?مَ?|صلى\s*الله\s*عليه\s*وسلم)\s*\)/gu;
  const arabicRaRe =
    /\(\s*(?:رَضِ?يَ?\s*ٱ?للَّ?ٰ?هُ\s*عَ?نْ?هُ?م?ا?|رضی\s*اللہ\s*عنہ)\s*\)/gu;

  text = text
    .replace(arabicSwtRe, labels.swt)
    .replace(bareArabicSwtRe, `$1$2 ${labels.swt}`)
    .replace(arabicAsRe, labels.as)
    .replace(bareArabicAsRe, `$1$2 ${labels.as}`)
    .replace(arabicPbuhRe, labels.pbuh)
    .replace(arabicRaRe, labels.ra);

  // Normalize ASCII / empty honorific parentheses ("Allah ()", "Lut ()", "Prophet ()", "(saws)")
  text = text
    .replace(/(^|[\s"'“‘(>])(Allah|Allāh|اللہ|अल्लाह|અલ્લાહ)\s*\(\s*\)/giu, `$1$2 ${labels.swt}`)
    .replace(/(^|[\s"'“‘(>])(Allah|Allāh)\s*\(\s*(?:SWT|s\.w\.t\.?)\s*\)/gi, `$1$2 ${labels.swt}`)
    .replace(
      /(^|[\s"'“‘(>])(Prophet|Messenger(?:\s+of\s+Allah)?|Prophet\s+of\s+Allah|Muhammad|Rasulullah|نبی|رسول(?:\s+اللہ)?|محمد|पैग़म्बर|रसूल|मुहम्मद|પયગંબર|રસૂલ|મુહમ્મદ)\s*\(\s*\)/giu,
      `$1$2 ${labels.pbuh}`
    )
    .replace(
      /(^|[\s"'“‘(>])(Prophet|Messenger(?:\s+of\s+Allah)?|Prophet\s+of\s+Allah|Muhammad|Rasulullah)\s*\(\s*(?:pbuh|p\.b\.u\.h\.?|saws|s\.a\.w\.?s?\.?|peace be upon him)\s*\)/gi,
      `$1$2 ${labels.pbuh}`
    )
    .replace(
      new RegExp(`(^|[\\s"'“‘(>])(${PROPHET_NAME_PATTERN})(?:['’]s)?\\s*\\(\\s*\\)`, 'giu'),
      (match, lead, name) => {
        const hasPossessive = /['’]s/i.test(match);
        return `${lead}${name}${hasPossessive ? '’s' : ''} ${labels.as}`;
      }
    )
    .replace(
      new RegExp(`(^|[\\s"'“‘(>])(${PROPHET_NAME_PATTERN})(?:['’]s)?\\s*\\(\\s*(?:AS|a\\.s\\.|alayhis[- ]salam)\\s*\\)`, 'giu'),
      (match, lead, name) => {
        const hasPossessive = /['’]s/i.test(match);
        return `${lead}${name}${hasPossessive ? '’s' : ''} ${labels.as}`;
      }
    )
    .replace(
      new RegExp(`(^|[\\s"'“‘(>])(${COMPANION_NAME_PATTERN})\\s*\\(\\s*\\)`, 'giu'),
      `$1$2 ${labels.ra}`
    )
    // Ensure stuck tokens like "Muhammad (ﷺ)is" have a clean space after the honorific
    .replace(/(\((?:ﷺ|SWT|AS|RA|علیہ السلام|سبحانہ و تعالیٰ|رضی اللہ عنہ|અ\.સ\.|ર\.અ\.|अ\.स\.|र\.अ\.)\))(?=\p{L}|\p{N})/gu, '$1 ')
    // Remove any remaining orphan empty parentheses or empty brackets
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '');

  // Unwrap artificial single line breaks inside paragraphs while preserving double-newline breaks
  const paragraphs = text.split(/\n{2,}/);
  const normalizedParagraphs = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      const unwrapped = trimmed.replace(/([^\n])\n([^\n])/g, '$1 $2');
      const collapsed = unwrapped.replace(/[ \t]{2,}/g, ' ');
      return normalizeBidiPunctuation(collapsed);
    })
    .filter(Boolean);

  return normalizedParagraphs.join('\n\n');
}

/**
 * Classifies whether a paragraph is a section heading (H2/H3) vs regular prose.
 * Used to apply heading scale (H1 22px, H2 18px, H3 16px) and place ornamental
 * diamond dividers strictly between major sections.
 */
export function classifyProseParagraph(
  paragraph: string,
  index: number
): 'h2' | 'h3' | 'body' {
  const trimmed = paragraph.trim();
  if (!trimmed || trimmed.length > 105) return 'body';
  if (/[\u0600-\u06FF]{14,}/.test(trimmed) && !/[A-Za-z]/.test(trimmed)) return 'body';
  if (/^\d+:\d+(?:-\d+)?$/.test(trimmed)) return 'body';

  // Explicit major story/chapter intro or ALL-CAPS heading
  const withoutHonorifics = trimmed
    .replace(/\((?:SWT|AS|RA|ﷺ|علیہ السلام|سبحانہ و تعالیٰ|અ\.સ\.|अ\.स\.)\)/g, '')
    .trim();

  if (index === 0 && /^The Story of Prophet\b/i.test(trimmed)) {
    return 'h2';
  }

  // Major section titles in Qisas/Seerah: uppercase title lines or concise colon headings
  if (
    /^[A-Z0-9][A-Z0-9\s'’\-(),]{4,80}:?$/.test(withoutHonorifics) &&
    /[A-Z]{3,}/.test(withoutHonorifics)
  ) {
    return 'h2';
  }

  // Title-cased short headings ending with colon or clear section markers (exclude dialogue lead-ins)
  const isDialogueLeadIn = /\b(?:said|replied|answered|asked|pleaded|declared|whispered|wrote|added|continued|narrated)\s*:$/i.test(
    trimmed
  );
  if (isDialogueLeadIn) return 'body';

  if (
    trimmed.endsWith(':') &&
    trimmed.length <= 75 &&
    trimmed.split(/\s+/).length <= 11 &&
    !/[.!?]/.test(trimmed.slice(0, -1))
  ) {
    return trimmed.split(/\s+/).length <= 5 ? 'h3' : 'h2';
  }

  return 'body';
}

/**
 * Splits text around inline ﷺ / صلى الله عليه وسلم tokens so renderers can style the ligature cleanly without stretching line spacing.
 */
export function splitInlineHonorifics(
  text: string
): Array<{ value: string; isHonorificGlyph: boolean }> {
  if (!text) return [];
  const parts = text.split(/(ﷺ|صلى الله عليه وسلم|صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ|صَلَّى ٱللَّٰهُ عَلَيْهِ وَسَلَّمَ)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      value: part,
      isHonorificGlyph:
        part === 'ﷺ' ||
        part === 'صلى الله عليه وسلم' ||
        part === 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ' ||
        part === 'صَلَّى ٱللَّٰهُ عَلَيْهِ وَسَلَّمَ',
    }));
}
