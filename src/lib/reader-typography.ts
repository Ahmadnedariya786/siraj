/**
 * Shared Book-Grade Typography Preferences, BiDi Direction & Prose Sanitizer
 * Used across Hadith, Seerah, and Prophets Readers (`siraj_reader_prefs_v1`).
 */
import { useState, useEffect, useCallback } from 'react';
import type { ContentLang } from '@/lib/content-translator';

export type ReaderLineSpacing = 'compact' | 'standard' | 'relaxed';

export interface BookReaderPrefs {
  bodyFontSize: number; // 13..21, default 15
  arabicFontSize: number; // 16..26, default 20
  lineSpacing: ReaderLineSpacing;
}

export const READER_PREFS_STORAGE_KEY = 'siraj_reader_prefs_v1';
export const READER_PREFS_EVENT = 'siraj-reader-prefs-changed';

export const DEFAULT_READER_PREFS: BookReaderPrefs = {
  bodyFontSize: 15,
  arabicFontSize: 20,
  lineSpacing: 'standard',
};

function clamp(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export function loadBookReaderPrefs(): BookReaderPrefs {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_READER_PREFS;
    const raw = localStorage.getItem(READER_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_READER_PREFS;
    const parsed = JSON.parse(raw) as Partial<BookReaderPrefs>;
    const spacing: ReaderLineSpacing =
      parsed.lineSpacing === 'compact' || parsed.lineSpacing === 'relaxed'
        ? parsed.lineSpacing
        : 'standard';
    return {
      bodyFontSize: clamp(Number(parsed.bodyFontSize ?? 15), 13, 21),
      arabicFontSize: clamp(Number(parsed.arabicFontSize ?? 20), 16, 26),
      lineSpacing: spacing,
    };
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

export function saveBookReaderPrefs(next: BookReaderPrefs): BookReaderPrefs {
  const normalized: BookReaderPrefs = {
    bodyFontSize: clamp(next.bodyFontSize, 13, 21),
    arabicFontSize: clamp(next.arabicFontSize, 16, 26),
    lineSpacing: next.lineSpacing,
  };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(READER_PREFS_STORAGE_KEY, JSON.stringify(normalized));
    }
    if (typeof window !== 'undefined') {
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
    const sync = (e: Event) => {
      const custom = e as CustomEvent<BookReaderPrefs>;
      if (custom.detail) {
        setPrefsState(custom.detail);
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
    setPrefsState((prev) => saveBookReaderPrefs({ ...prev, ...partial }));
  }, []);

  const resetPrefs = useCallback(() => {
    setPrefsState(saveBookReaderPrefs(DEFAULT_READER_PREFS));
  }, []);

  return { prefs, updatePrefs, resetPrefs };
}

/**
 * Strict per-block direction & alignment.
 * Ensures English fallback text is NEVER rendered RTL even if Urdu UI/preference is selected.
 */
export function getReaderBlockDirection(actualBodyLang: ContentLang | string): {
  dir: 'ltr' | 'rtl';
  textAlignClass: 'text-left' | 'text-right';
  textAlign: 'left' | 'right';
} {
  const isUrdu = actualBodyLang === 'ur';
  return {
    dir: isUrdu ? 'rtl' : 'ltr',
    textAlignClass: isUrdu ? 'text-right' : 'text-left',
    textAlign: isUrdu ? 'right' : 'left',
  };
}

export function getReaderLineHeight(
  actualBodyLang: ContentLang | string,
  spacing: ReaderLineSpacing = 'standard'
): number {
  if (actualBodyLang === 'ur') {
    if (spacing === 'compact') return 1.85;
    if (spacing === 'relaxed') return 2.2;
    return 2.0;
  }
  if (spacing === 'compact') return 1.5;
  if (spacing === 'relaxed') return 1.85;
  return 1.65;
}

export function getArabicLineHeight(spacing: ReaderLineSpacing = 'standard'): number {
  if (spacing === 'compact') return 1.8;
  if (spacing === 'relaxed') return 2.15;
  return 1.95;
}

const PROPHET_NAME_PATTERN =
  'Adam|Idris|Nuh|Hud|Saleh|Salih|Ibrahim|Abraham|Lut|Lot|Ismail|Ishmael|Ishaq|Isaac|Yaqub|Jacob|Yusuf|Joseph|Ayyub|Job|Shu\'?ayb|Shuayb|Musa|Moses|Harun|Aaron|Dawud|David|Sulaiman|Solomon|Yunus|Jonah|Ilyas|Elias|Al-?Yasa|Elisha|Dhul-?Kifl|Zakariyya|Yahya|Isa|Jesus';

/**
 * Cleans empty honorific brackets ("Allah ()", "Prophet ()", "Ibrahim ()") and
 * unwraps mid-sentence line-wrap newlines inside multi-line book chapters.
 */
export function formatIslamicProse(rawText: string, lang: ContentLang = 'en'): string {
  if (!rawText) return '';

  // Normalize CRLF -> LF first
  let text = rawText.replace(/\r\n/g, '\n');

  // Fix "(O Muhammad\n\n)" style splits in Seerah JSON before unwrapping paragraphs
  text = text.replace(/\(O\s+Muhammad\s*\n+\s*\)/gi, '(O Muhammad ﷺ)');
  text = text.replace(/\n+\)/g, ')');

  // Fix empty honorific brackets before machine translation or rendering
  text = text
    .replace(/\bAllah\s*\(\s*\)/gi, lang === 'ur' ? 'اللہ تعالیٰ' : 'Allah (SWT)')
    .replace(
      /\b(Prophet|Messenger(?:\s+of\s+Allah)?|Muhammad|Rasulullah)\s*\(\s*\)/gi,
      '$1 (ﷺ)'
    )
    .replace(
      new RegExp(`\\b(${PROPHET_NAME_PATTERN})\\s*\\(\\s*\\)`, 'gi'),
      lang === 'ur' ? '$1 علیہ السلام' : '$1 (AS)'
    )
    // Remove leftover empty parentheses or empty footnote brackets [] / ()
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '');

  // Unwrap artificial single line breaks inside paragraphs (preserving double-newline paragraph breaks)
  const paragraphs = text.split(/\n{2,}/);
  const normalizedParagraphs = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Preserve single newlines only in short multi-line lists or headings ending cleanly, else unwrap wrapped book lines
      const unwrapped = trimmed.replace(/([^\n])\n([^\n])/g, '$1 $2');
      return unwrapped.replace(/[ \t]{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1');
    })
    .filter(Boolean);

  return normalizedParagraphs.join('\n\n');
}

/**
 * Splits text around inline ﷺ / صلى الله عليه وسلم tokens so renderers can style the ligature cleanly without stretching line spacing.
 */
export function splitInlineHonorifics(
  text: string
): Array<{ value: string; isHonorificGlyph: boolean }> {
  if (!text) return [];
  const parts = text.split(/(ﷺ|صلى الله عليه وسلم|صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ)/g);
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      value: part,
      isHonorificGlyph:
        part === 'ﷺ' ||
        part === 'صلى الله عليه وسلم' ||
        part === 'صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ',
    }));
}
