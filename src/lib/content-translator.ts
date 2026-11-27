/**
 * Unified Multi-Language Islamic Content Translation Engine
 * ─────────────────────────────────────────────────────────────
 * Supports: 'en' | 'ur' (Urdu) | 'gu' (Gujarati) | 'hi' (Hindi)
 * Features:
 *  - Permanent IndexedDB offline store (`siraj_translated_books_v1`)
 *  - Authentic Urdu Scholar Hadith Editions (`urd-bukhari`, `urd-muslim`, etc.)
 *  - CORS-free native `CapacitorHttp.get` on Android + Web fetch fallback
 *  - Paragraph chunked streaming (`<= 850` chars/chunk) preserving Arabic & honorifics
 *  - Multi-endpoint fallback (Google GTX -> MyMemory)
 *  - Honest offline reporting (`actualLang = 'en'`, `offlineFallback = true`)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { useLanguage } from '@/contexts/LanguageContext-new';
import { formatIslamicProse, getHonorificLabels, getReaderLineHeight } from '@/lib/reader-typography';

export type ContentLang = 'en' | 'ur' | 'gu' | 'hi';
export type BookModuleType = 'hadith' | 'seerah' | 'prophet' | 'generic';

export const CONTENT_LANG_STORAGE_KEY = 'noor_content_lang_v1';
export const CONTENT_TRANSLATION_CACHE_PREFIX = 'noor_ctr_v1_';
export const TRANSLATED_BOOKS_IDB_NAME = 'siraj_translated_books_v1';
export const TRANSLATED_BOOKS_STORE_NAME = 'translations';

export interface ContentLangOption {
  code: ContentLang;
  label: string;
  nativeLabel: string;
  shortLabel: string;
  dir: 'ltr' | 'rtl';
}

export const CONTENT_LANGUAGES: ContentLangOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', shortLabel: 'EN', dir: 'ltr' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', shortLabel: 'اردو', dir: 'rtl' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', shortLabel: 'ગુજ', dir: 'ltr' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', shortLabel: 'हिं', dir: 'ltr' },
];

export interface CachedBookTranslation {
  id: string; // ${module}:${itemId}:${lang}
  module: BookModuleType;
  itemId: string;
  chapterId?: string;
  lang: ContentLang;
  title?: string;
  paragraphs?: string[];
  totalParagraphs?: number;
  text: string;
  source: 'scholar-edition' | 'chunked-api';
  updatedAt: number;
}

export interface BookTranslationUpdate {
  title?: string;
  text: string;
  actualLang: ContentLang;
  fromCache: boolean;
  offlineFallback: boolean;
  source?: 'scholar-edition' | 'chunked-api' | 'original';
  doneChunks: number;
  totalChunks: number;
  isComplete: boolean;
}

// Fast 0ms in-memory caches
const memoryCache = new Map<string, string>();
const bookMemoryCache = new Map<string, CachedBookTranslation>();
let idbPromise: Promise<IDBDatabase | null> | null = null;

export function fastHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

// ─── Safe IndexedDB Cache (`siraj_translated_books_v1`) ────────────────────

function extractIdbErrorMessage(event: Event | unknown): string {
  const targetErr = (event as { target?: { error?: { message?: string } } })?.target?.error?.message;
  if (targetErr) return targetErr;
  if (event instanceof Error) return event.message;
  return 'Unknown IDB error';
}

function openTranslationDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (idbPromise) return idbPromise;

  idbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(TRANSLATED_BOOKS_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TRANSLATED_BOOKS_STORE_NAME)) {
          db.createObjectStore(TRANSLATED_BOOKS_STORE_NAME, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = (ev) => {
        console.warn(`[IDB_STORAGE] Open ${TRANSLATED_BOOKS_IDB_NAME} failed: ${extractIdbErrorMessage(ev)}`);
        resolve(null);
      };
      req.onblocked = () => {
        console.warn(`[IDB_STORAGE] Open ${TRANSLATED_BOOKS_IDB_NAME} blocked`);
        resolve(null);
      };
    } catch (err) {
      console.warn(`[IDB_STORAGE] Exception opening ${TRANSLATED_BOOKS_IDB_NAME}: ${extractIdbErrorMessage(err)}`);
      resolve(null);
    }
  });

  return idbPromise;
}

export function getBookTranslationFromCacheSync(cacheId: string): CachedBookTranslation | null {
  return bookMemoryCache.get(cacheId) ?? null;
}

export async function getBookTranslationFromCache(cacheId: string): Promise<CachedBookTranslation | null> {
  if (bookMemoryCache.has(cacheId)) {
    return bookMemoryCache.get(cacheId)!;
  }

  try {
    const db = await openTranslationDb();
    if (!db) return null;

    return await new Promise<CachedBookTranslation | null>((resolve) => {
      try {
        const tx = db.transaction([TRANSLATED_BOOKS_STORE_NAME], 'readonly');
        const req = tx.objectStore(TRANSLATED_BOOKS_STORE_NAME).get(cacheId);
        req.onsuccess = () => {
          const res = (req.result as CachedBookTranslation | undefined) ?? null;
          if (res) bookMemoryCache.set(cacheId, res);
          resolve(res);
        };
        req.onerror = (ev) => {
          console.warn(`[IDB_STORAGE] Read ${cacheId} failed: ${extractIdbErrorMessage(ev)}`);
          resolve(null);
        };
      } catch (err) {
        console.warn(`[IDB_STORAGE] Transaction error: ${extractIdbErrorMessage(err)}`);
        resolve(null);
      }
    });
  } catch (err) {
    console.warn(`[IDB_STORAGE] Cache read error: ${extractIdbErrorMessage(err)}`);
    return null;
  }
}

export async function saveBookTranslationToCache(entry: CachedBookTranslation): Promise<void> {
  bookMemoryCache.set(entry.id, entry);
  try {
    const db = await openTranslationDb();
    if (!db) return;

    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction([TRANSLATED_BOOKS_STORE_NAME], 'readwrite');
        tx.objectStore(TRANSLATED_BOOKS_STORE_NAME).put(entry);
        tx.oncomplete = () => resolve();
        tx.onerror = (ev) => {
          console.warn(`[IDB_STORAGE] Write ${entry.id} failed: ${extractIdbErrorMessage(ev)}`);
          resolve();
        };
      } catch (err) {
        console.warn(`[IDB_STORAGE] Put error: ${extractIdbErrorMessage(err)}`);
        resolve();
      }
    });
  } catch (err) {
    console.warn(`[IDB_STORAGE] Cache write error: ${extractIdbErrorMessage(err)}`);
  }
}

// ─── Honorific Protection & Normalization ─────────────────────────────────

const ARABIC_SCRIPT_CHECK = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_OR_DIGIT_CHECK = /[A-Za-z]/g;

export function isPureArabicBlock(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const arabicCount = (trimmed.match(ARABIC_SCRIPT_CHECK) || []).length;
  const latinCount = (trimmed.match(LATIN_OR_DIGIT_CHECK) || []).length;
  return arabicCount >= 12 && latinCount < 8;
}

function tokenizeSacredPhrases(text: string): string {
  return text
    .replace(/\(\s*ﷺ\s*\)|ﷺ|\(\s*(?:peace be upon him|pbuh|p\.b\.u\.h\.|s\.a\.w\.?s?\.?|saws)\s*\)/gi, ' [[SC_PBUH]] ')
    .replace(/\b(?:peace be upon him|pbuh)\b/gi, ' [[SC_PBUH]] ')
    .replace(/\(\s*(?:سُ?بْ?حَ?ٰ?نَهُۥ?\s*وَتَعَ?ٰ?لَىٰ?|سبحانه وتعالى|SWT|s\.w\.t\.?)\s*\)/giu, ' [[SC_SWT]] ')
    .replace(/\(\s*(?:عَلَ?يْ?هِ\s*ٱ?ل?سَّ?لَ?امُ?|عليه السلام|AS|a\.s\.|alayhis[- ]salam|علیہ السلام|અ\.સ\.|अ\.स\.)\s*\)/giu, ' [[SC_AS]] ')
    .replace(/\(\s*(?:رَضِ?يَ?\s*ٱ?للَّ?ٰ?هُ\s*عَ?نْ?هُ?م?ا?|رضی اللہ عنہ|RA|r\.a\.|ર\.અ\.|र\.अ\.)\s*\)/giu, ' [[SC_RA]] ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function restoreSacredPhrases(text: string, targetLang: ContentLang): string {
  const labels = getHonorificLabels(targetLang);

  return text
    .replace(/\[\[\s*SC_PBUH\s*\]\]/gi, labels.pbuh)
    .replace(/\[\[\s*SC_SWT\s*\]\]/gi, labels.swt)
    .replace(/\[\[\s*SC_AS\s*\]\]/gi, labels.as)
    .replace(/\[\[\s*SC_RA\s*\]\]/gi, labels.ra)
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeIslamicHonorifics(text: string, targetLang: ContentLang): string {
  if (!text) return '';
  const labels = getHonorificLabels(targetLang);
  let out = formatIslamicProse(restoreSacredPhrases(text, targetLang), targetLang);

  out = out
    .replace(/\(\s*(?:ﷺ|peace be upon him|pbuh|p\.b\.u\.h\.|saws|s\.a\.w\.?s?\.?)\s*\)/gi, labels.pbuh)
    .replace(/\bpeace be upon him\b/gi, labels.pbuh)
    .replace(/\b(?:PBUH|pbuh)\b/g, labels.pbuh)
    .replace(/\(\s*(?:AS|a\.s\.|alayhis-salam|alayhis salam)\s*\)/gi, labels.as)
    .replace(/\(\s*(?:RA|r\.a\.|radiyallahu 'anhu|radiyallahu anhu)\s*\)/gi, labels.ra)
    .replace(/\(\s*\(\s*(ﷺ|SWT|AS|RA|علیہ السلام|سبحانہ و تعالیٰ|رضی اللہ عنہ|અ\.સ\.|ર\.અ\.|अ\.स\.|र\.अ\.)\s*\)\s*\)/gu, '($1)');

  return out;
}

/**
 * Splits text cleanly along paragraph boundaries into chunks strictly <= maxChunkSize (default 850 chars).
 */
export function splitTranslationChunks(text: string, maxChunkSize = 850): string[] {
  const clean = text.trim();
  if (!clean) return [];
  if (clean.length <= maxChunkSize) return [clean];

  const chunks: string[] = [];
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  let currentChunk = '';

  const pushChunk = (val: string) => {
    const trimmed = val.trim();
    if (trimmed) chunks.push(trimmed);
  };

  for (const para of paragraphs) {
    if (para.length > maxChunkSize) {
      if (currentChunk) {
        pushChunk(currentChunk);
        currentChunk = '';
      }
      const sentences = para.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [para];
      for (const sentence of sentences) {
        const sTrim = sentence.trim();
        if (!sTrim) continue;
        if (sTrim.length > maxChunkSize) {
          // Hard split overly long run-on sentence on whitespace <= maxChunkSize
          if (currentChunk) {
            pushChunk(currentChunk);
            currentChunk = '';
          }
          let cursor = 0;
          while (cursor < sTrim.length) {
            let sliceEnd = Math.min(cursor + maxChunkSize, sTrim.length);
            if (sliceEnd < sTrim.length) {
              const lastSpace = sTrim.lastIndexOf(' ', sliceEnd);
              if (lastSpace > cursor + Math.floor(maxChunkSize * 0.5)) {
                sliceEnd = lastSpace;
              }
            }
            pushChunk(sTrim.slice(cursor, sliceEnd));
            cursor = sliceEnd + 1;
          }
        } else if ((currentChunk ? `${currentChunk} ${sTrim}` : sTrim).length > maxChunkSize) {
          pushChunk(currentChunk);
          currentChunk = sTrim;
        } else {
          currentChunk = currentChunk ? `${currentChunk} ${sTrim}` : sTrim;
        }
      }
    } else {
      const candidate = currentChunk ? `${currentChunk}\n\n${para}` : para;
      if (candidate.length > maxChunkSize) {
        pushChunk(currentChunk);
        currentChunk = para;
      } else {
        currentChunk = candidate;
      }
    }
  }

  if (currentChunk.trim()) {
    pushChunk(currentChunk);
  }

  return chunks;
}

// ─── CORS-Free Native + Web Transport ─────────────────────────────────────

async function safeHttpGetJson<T = unknown>(url: string, timeoutMs = 5500): Promise<T | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const res = await CapacitorHttp.get({
        url,
        connectTimeout: timeoutMs,
        readTimeout: timeoutMs,
        headers: {
          Accept: 'application/json',
        },
      });
      if (res.status < 200 || res.status >= 300) return null;
      if (typeof res.data === 'string') {
        try {
          return JSON.parse(res.data) as T;
        } catch {
          return null;
        }
      }
      return (res.data as T) ?? null;
    } catch {
      return null;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function translateSingleChunkViaApi(
  chunk: string,
  targetLang: ContentLang
): Promise<{ text: string; ok: boolean }> {
  if (targetLang === 'en' || !chunk.trim()) {
    return { text: chunk, ok: true };
  }

  if (isPureArabicBlock(chunk)) {
    return { text: chunk, ok: true };
  }

  const tokenized = tokenizeSacredPhrases(formatIslamicProse(chunk, 'en'));

  // 1. Primary endpoint: Google Translate GTX (via CapacitorHttp on Android -> zero CORS)
  const gtxUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(tokenized)}`;
  const gtxData = await safeHttpGetJson<unknown[]>(gtxUrl, 5500);
  if (Array.isArray(gtxData) && Array.isArray(gtxData[0])) {
    const joined = gtxData[0]
      .map((item) => (Array.isArray(item) && typeof item[0] === 'string' ? item[0] : ''))
      .join('');
    if (joined.trim()) {
      return { text: sanitizeIslamicHonorifics(joined, targetLang), ok: true };
    }
  }

  // 2. Resilient Fallback: MyMemory API
  const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(tokenized)}&langpair=en|${targetLang}`;
  const mmData = await safeHttpGetJson<{
    responseStatus?: number;
    responseData?: { translatedText?: string };
  }>(mmUrl, 6000);
  const mmText = mmData?.responseData?.translatedText;
  if (mmData?.responseStatus === 200 && typeof mmText === 'string' && mmText.trim()) {
    return { text: sanitizeIslamicHonorifics(mmText, targetLang), ok: true };
  }

  return { text: chunk, ok: false };
}

// ─── Authentic Scholar Urdu Hadith Loader ─────────────────────────────────

const URDU_HADITH_EDITIONS: Record<string, string> = {
  bukhari: 'urd-bukhari',
  muslim: 'urd-muslim',
  abudawud: 'urd-abudawud',
  tirmidhi: 'urd-tirmidhi',
  nasai: 'urd-nasai',
  ibnmajah: 'urd-ibnmajah',
  malik: 'urd-malik',
  forty: 'urd-nawawi',
  nawawi: 'urd-nawawi',
};

export function getUrduHadithEditionSlug(collectionSlug: string): string | null {
  const key = (collectionSlug || '').toLowerCase().trim();
  return URDU_HADITH_EDITIONS[key] ?? null;
}

export async function fetchAuthenticUrduHadith(
  collectionSlug: string,
  hadithNumber: string | number
): Promise<string | null> {
  const edition = getUrduHadithEditionSlug(collectionSlug);
  if (!edition) return null;

  const numStr = String(hadithNumber).replace(/[^\d]/g, '');
  if (!numStr) return null;

  const cacheId = `hadith:${collectionSlug.toLowerCase()}:${numStr}:ur`;
  const cached = await getBookTranslationFromCache(cacheId);
  if (cached?.text && cached.source === 'scholar-edition') {
    return cached.text;
  }

  const url = `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${edition}/${numStr}.json`;
  const json = await safeHttpGetJson<{ hadiths?: Array<{ text?: string }> }>(url, 5000);
  const urduText = json?.hadiths?.[0]?.text?.trim();
  if (!urduText) return null;

  const cleaned = sanitizeIslamicHonorifics(urduText, 'ur');
  await saveBookTranslationToCache({
    id: cacheId,
    module: 'hadith',
    itemId: `${collectionSlug.toLowerCase()}:${numStr}`,
    lang: 'ur',
    text: cleaned,
    source: 'scholar-edition',
    updatedAt: Date.now(),
  });
  return cleaned;
}

// ─── Progressive Book & Hadith Translation Pipelines ──────────────────────

export interface TranslateHadithOptions {
  collection: string;
  hadithNumber: string | number;
  englishText: string;
  targetLang: ContentLang;
}

export async function translateHadithContent(
  opts: TranslateHadithOptions
): Promise<{
  text: string;
  actualLang: ContentLang;
  fromCache: boolean;
  offlineFallback: boolean;
  source: 'scholar-edition' | 'chunked-api' | 'original';
}> {
  const cleanEn = formatIslamicProse(opts.englishText || '', 'en');
  if (!cleanEn || opts.targetLang === 'en') {
    return {
      text: cleanEn,
      actualLang: 'en',
      fromCache: false,
      offlineFallback: false,
      source: 'original',
    };
  }

  const cleanCol = (opts.collection || 'generic').toLowerCase().trim();
  const cleanNum = String(opts.hadithNumber || fastHash(cleanEn)).trim();
  const cacheId = `hadith:${cleanCol}:${cleanNum}:${opts.targetLang}`;
  try {
    const { markP2FeatureVisited } = await import('@/lib/boot-scheduler');
    markP2FeatureVisited('translations');
  } catch (err) {
    console.debug('[ContentTranslator] P2 mark skipped:', err);
  }

  const cached = await getBookTranslationFromCache(cacheId);
  if (cached?.text) {
    return {
      text: cached.text,
      actualLang: opts.targetLang,
      fromCache: true,
      offlineFallback: false,
      source: cached.source,
    };
  }

  // Try authentic scholar Urdu Hadith edition first when lang === 'ur'
  if (opts.targetLang === 'ur') {
    const scholarUr = await fetchAuthenticUrduHadith(cleanCol, cleanNum);
    if (scholarUr) {
      return {
        text: scholarUr,
        actualLang: 'ur',
        fromCache: false,
        offlineFallback: false,
        source: 'scholar-edition',
      };
    }
  }

  // Fallback to chunked CORS-free translation + permanent IDB cache
  const chunks = splitTranslationChunks(cleanEn, 850);
  const translatedParts: string[] = [];
  let succeededCount = 0;

  for (const chunk of chunks) {
    const res = await translateSingleChunkViaApi(chunk, opts.targetLang);
    translatedParts.push(res.text);
    if (res.ok) succeededCount++;
  }

  if (succeededCount === 0) {
    return {
      text: cleanEn,
      actualLang: 'en',
      fromCache: false,
      offlineFallback: true,
      source: 'original',
    };
  }

  const joined = translatedParts.join('\n\n');
  await saveBookTranslationToCache({
    id: cacheId,
    module: 'hadith',
    itemId: `${cleanCol}:${cleanNum}`,
    lang: opts.targetLang,
    text: joined,
    source: 'chunked-api',
    updatedAt: Date.now(),
  });

  return {
    text: joined,
    actualLang: opts.targetLang,
    fromCache: false,
    offlineFallback: false,
    source: 'chunked-api',
  };
}

export interface StreamBookOptions {
  module: BookModuleType;
  itemId: string;
  title?: string;
  englishParagraphs: string[];
  targetLang: ContentLang;
  signal?: { aborted: boolean };
  onUpdate: (update: BookTranslationUpdate) => void;
}

/**
 * Translates a single source paragraph cleanly without mutating the locked paragraph denominator.
 */
async function translateSourceParagraphViaApi(
  para: string,
  targetLang: ContentLang
): Promise<{ text: string; ok: boolean }> {
  if (targetLang === 'en' || !para.trim()) {
    return { text: para, ok: true };
  }
  if (isPureArabicBlock(para)) {
    return { text: para, ok: true };
  }
  if (para.length <= 850) {
    return translateSingleChunkViaApi(para, targetLang);
  }
  const subChunks = splitTranslationChunks(para, 850);
  const translatedSubs: string[] = [];
  let anyOk = false;
  for (const sub of subChunks) {
    const res = await translateSingleChunkViaApi(sub, targetLang);
    translatedSubs.push(res.text);
    if (res.ok) anyOk = true;
  }
  return {
    text: sanitizeIslamicHonorifics(translatedSubs.join(' '), targetLang),
    ok: anyOk,
  };
}

/**
 * Translates multi-paragraph chapters (Seerah, Prophets) progressively:
 * 1) Checks permanent IndexedDB (`siraj_translated_books_v1`) -> <50ms offline load
 * 2) Locks denominator `N = sourceParagraphs.length` at stream start (never mutates during stream)
 * 3) Translates first 3 paragraphs immediately so user starts reading right away
 * 4) Streams remaining paragraphs keeping pure Arabic blocks untouched
 * 5) Saves translated paragraphs permanently to IndexedDB per `(chapterId, lang)`
 * 6) Falls back honestly to English (`actualLang: 'en'`, `offlineFallback: true`) if offline
 */
export async function streamBookTranslation(opts: StreamBookOptions): Promise<void> {
  const { module, itemId, title, englishParagraphs, targetLang, signal, onUpdate } = opts;
  if (targetLang !== 'en') {
    try {
      const { markP2FeatureVisited } = await import('@/lib/boot-scheduler');
      markP2FeatureVisited('translations');
    } catch (err) {
      console.debug('[ContentTranslator] P2 mark skipped:', err);
    }
  }
  const cleanParas = englishParagraphs
    .map((p) => formatIslamicProse(p, 'en'))
    .filter(Boolean);
  const lockedDenominator = cleanParas.length;
  const fullEnText = cleanParas.join('\n\n');

  if (targetLang === 'en' || lockedDenominator === 0) {
    onUpdate({
      title: title ? formatIslamicProse(title, 'en') : undefined,
      text: fullEnText,
      actualLang: 'en',
      fromCache: false,
      offlineFallback: false,
      source: 'original',
      doneChunks: lockedDenominator,
      totalChunks: lockedDenominator,
      isComplete: true,
    });
    return;
  }

  const cacheId = `${module}:${itemId}:${targetLang}`;
  const cached = await getBookTranslationFromCache(cacheId);
  if (cached?.text) {
    if (signal?.aborted) return;
    const cachedText = cached.paragraphs?.length
      ? cached.paragraphs.join('\n\n')
      : cached.text;
    const cachedCount = cached.paragraphs?.length ?? lockedDenominator;
    onUpdate({
      title: cached.title || title,
      text: cachedText,
      actualLang: targetLang,
      fromCache: true,
      offlineFallback: false,
      source: cached.source,
      doneChunks: lockedDenominator || cachedCount,
      totalChunks: lockedDenominator || cachedCount,
      isComplete: true,
    });
    return;
  }

  const translatedParas: string[] = [...cleanParas];
  let succeededCount = 0;

  // Emit initial progress with locked denominator immediately
  if (!signal?.aborted) {
    onUpdate({
      title: title ? formatIslamicProse(title, 'en') : undefined,
      text: fullEnText,
      actualLang: 'en',
      fromCache: false,
      offlineFallback: false,
      source: 'chunked-api',
      doneChunks: 0,
      totalChunks: lockedDenominator,
      isComplete: false,
    });
  }

  let translatedTitle = title ? formatIslamicProse(title, 'en') : undefined;
  const titlePromise =
    title && !signal?.aborted
      ? translateSingleChunkViaApi(title, targetLang).then((titleRes) => {
          if (titleRes.ok) {
            translatedTitle = titleRes.text;
          }
        })
      : Promise.resolve();

  // First batch: translate first 3 paragraphs immediately alongside title
  const firstBatchCount = Math.min(3, lockedDenominator);
  for (let i = 0; i < lockedDenominator; ) {
    if (signal?.aborted) return;

    const batchSize = i === 0 ? firstBatchCount : 2;
    const endIdx = Math.min(i + batchSize, lockedDenominator);
    const batchPromises = cleanParas
      .slice(i, endIdx)
      .map((para) => translateSourceParagraphViaApi(para, targetLang));

    const results =
      i === 0
        ? (await Promise.all([titlePromise, ...batchPromises])).slice(1) as Array<{ text: string; ok: boolean }>
        : await Promise.all(batchPromises);

    let batchOk = 0;
    results.forEach((res, offsetIdx) => {
      if (res.ok) {
        translatedParas[i + offsetIdx] = res.text;
        succeededCount++;
        batchOk++;
      }
    });

    // If the very first batch fails completely (device offline), fail honestly immediately without dangling spinners!
    if (i === 0 && batchOk === 0) {
      if (!signal?.aborted) {
        onUpdate({
          title: title ? formatIslamicProse(title, 'en') : undefined,
          text: fullEnText,
          actualLang: 'en',
          fromCache: false,
          offlineFallback: true,
          source: 'original',
          doneChunks: 0,
          totalChunks: lockedDenominator,
          isComplete: true,
        });
      }
      return;
    }

    i = endIdx;
    const isComplete = i >= lockedDenominator;

    if (!signal?.aborted) {
      onUpdate({
        title: translatedTitle,
        text:
          translatedParas.slice(0, i).join('\n\n') +
          (isComplete ? '' : `\n\n${cleanParas.slice(i).join('\n\n')}`),
        actualLang: targetLang,
        fromCache: false,
        offlineFallback: false,
        source: 'chunked-api',
        doneChunks: i,
        totalChunks: lockedDenominator,
        isComplete,
      });
    }
  }

  if (succeededCount > 0 && !signal?.aborted) {
    const finalJoined = translatedParas.join('\n\n');
    await saveBookTranslationToCache({
      id: cacheId,
      module,
      itemId,
      chapterId: itemId,
      lang: targetLang,
      title: translatedTitle,
      paragraphs: translatedParas,
      totalParagraphs: lockedDenominator,
      text: finalJoined,
      source: 'chunked-api',
      updatedAt: Date.now(),
    });
  }
}

/**
 * Legacy-compatible single-string translator (now powered by CORS-free CapacitorHttp + GTX/MyMemory + IDB/LocalStorage cache).
 */
export async function translateIslamicText(
  text: string,
  targetLang: ContentLang = 'en'
): Promise<string> {
  if (!text || !text.trim() || targetLang === 'en') {
    return formatIslamicProse(text || '', 'en');
  }

  const trimmed = formatIslamicProse(text.trim(), 'en');
  const cacheKey = `${CONTENT_TRANSLATION_CACHE_PREFIX}${targetLang}_${fastHash(trimmed)}`;

  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  try {
    const stored = localStorage.getItem(cacheKey);
    if (stored) {
      memoryCache.set(cacheKey, stored);
      return stored;
    }
  } catch {
    // LocalStorage access denied — ignore silently
  }

  const idbEntry = await getBookTranslationFromCache(`generic:${fastHash(trimmed)}:${targetLang}`);
  if (idbEntry?.text) {
    memoryCache.set(cacheKey, idbEntry.text);
    return idbEntry.text;
  }

  const chunks = splitTranslationChunks(trimmed, 850);
  const translatedChunks: string[] = [];
  let okCount = 0;

  for (const chunk of chunks) {
    const res = await translateSingleChunkViaApi(chunk, targetLang);
    translatedChunks.push(res.text);
    if (res.ok) okCount++;
  }

  if (okCount === 0) {
    return trimmed;
  }

  const polished = sanitizeIslamicHonorifics(translatedChunks.join('\n\n'), targetLang);
  memoryCache.set(cacheKey, polished);
  try {
    localStorage.setItem(cacheKey, polished);
  } catch {
    // Storage quota exceeded — continue via IDB + memory cache
  }
  await saveBookTranslationToCache({
    id: `generic:${fastHash(trimmed)}:${targetLang}`,
    module: 'generic',
    itemId: fastHash(trimmed),
    lang: targetLang,
    text: polished,
    source: 'chunked-api',
    updatedAt: Date.now(),
  });

  return polished;
}

export async function translateIslamicBatch(
  texts: string[],
  targetLang: ContentLang = 'en'
): Promise<string[]> {
  if (!texts || texts.length === 0 || targetLang === 'en') {
    return texts.map((t) => formatIslamicProse(t, 'en'));
  }
  return Promise.all(texts.map((t) => translateIslamicText(t, targetLang)));
}

// ─── Curated & Cached Tag Chip Translator (Never Expose English Slugs in UR/GU/HI) ─

const CURATED_TAG_TRANSLATIONS: Record<string, { ur: string; gu: string; hi: string }> = {
  ahzab: { ur: 'غزوۂ احزاب', gu: 'અહઝાબ', hi: 'अहज़ाब' },
  'arab-history': { ur: 'تاریخِ عرب', gu: 'અરબ ઇતિહાસ', hi: 'अरब इतिहास' },
  ark: { ur: 'کشتیِ نوح', gu: 'નૂહનું વહાણ', hi: 'नूह की नाव' },
  ascension: { ur: 'معراج النبی ﷺ', gu: 'મેરાજ', hi: 'मेराज' },
  badr: { ur: 'غزوۂ بدر', gu: 'બદ્રની લડાઈ', hi: 'बद्र की जंग' },
  battle: { ur: 'غزوہ', gu: 'જંગ', hi: 'जंग' },
  birth: { ur: 'ولادتِ باسعادت', gu: 'જન્મ', hi: 'जन्म' },
  'birth-miracle': { ur: 'معجزاتی ولادت', gu: 'ચમત્કારિક જન્મ', hi: 'चमत्कारिक जन्म' },
  'children-of-israel': { ur: 'بنی اسرائیل', gu: 'બની ઇઝરાયેલ', hi: 'बनी इस्राईल' },
  conquest: { ur: 'فتحِ مکہ', gu: 'ફતેહ', hi: 'फ़तह' },
  covenant: { ur: 'عہد و میثاق', gu: 'કરાર', hi: 'अहद' },
  creation: { ur: 'تخلیقِ کائنات', gu: 'સર્જન', hi: 'सृष्टि' },
  death: { ur: 'وصالِ مبارک', gu: 'વફાત', hi: 'वफ़ात' },
  dreams: { ur: 'تعبیرِ خواب', gu: 'સ્વપ્ન', hi: 'ख़्वाब' },
  'early-life': { ur: 'ابتدائی حیات', gu: 'પ્રારંભિક જીવન', hi: 'प्रारंभिक जीवन' },
  exodus: { ur: 'ہجرتِ بنی اسرائیل', gu: 'હિજરત', hi: 'पलायन' },
  farewell: { ur: 'حجۃ الوداع', gu: 'અંતિમ વિદાય', hi: 'विदाई' },
  'final-days': { ur: 'آخری ایام', gu: 'અંતિમ દિવસો', hi: 'अंतिम दिन' },
  fire: { ur: 'آگ کا معجزہ', gu: 'અગ્નિ પરીક્ષા', hi: 'अग्नि परीक्षा' },
  'first-prophet': { ur: 'پہلے نبی', gu: 'પ્રથમ પયગંબર', hi: 'प्रथम नबी' },
  flood: { ur: 'طوفانِ نوح', gu: 'મહાપૂર', hi: 'महाप्रलय' },
  hijrah: { ur: 'ہجرتِ مدینہ', gu: 'હિજરત', hi: 'हिजरत' },
  hudaibiyah: { ur: 'صلحِ حدیبیہ', gu: 'હુદૈબિયા સંધિ', hi: 'हुदैबिया संधि' },
  idolatry: { ur: 'بت پرستی کا رد', gu: 'મૂર્તિપૂજા વિરોધ', hi: 'मूर्तिपूजा विरोध' },
  illness: { ur: 'ابتلا و بیماری', gu: 'બીમારીમાં સબ્ર', hi: 'बीमारी में सब्र' },
  justice: { ur: 'عدل و انصاف', gu: 'ન્યાય', hi: 'न्याय' },
  kaaba: { ur: 'خانہ کعبہ', gu: 'કાબા શરીફ', hi: 'काबा शरीफ़' },
  kingdom: { ur: 'سلطنت و حکمرانی', gu: 'શાસન', hi: 'सल्तनत' },
  lineage: { ur: 'نسبِ مبارک', gu: 'વંશાવળી', hi: 'वंश' },
  madinah: { ur: 'مدینہ منورہ', gu: 'મદીના', hi: 'मदीना' },
  makkah: { ur: 'مکہ مکرمہ', gu: 'મક્કા', hi: 'मक्का' },
  migration: { ur: 'ہجرت', gu: 'હિજરત', hi: 'हिजरत' },
  military: { ur: 'سرایا و مہمات', gu: 'લશ્કરી અભિયાન', hi: 'सैन्य अभियान' },
  miracles: { ur: 'معجزات', gu: 'મોઅજેઝા', hi: 'मोजिज़ात' },
  monotheism: { ur: 'توحید', gu: 'તૌહીદ', hi: 'तौहीद' },
  patience: { ur: 'صبر و استقامت', gu: 'સબ્ર અને ધીરજ', hi: 'सब्र और धैर्य' },
  persecution: { ur: 'مظالم و صبر', gu: 'અત્યાચાર અને ધીરજ', hi: 'अत्याचार व सब्र' },
  pharaoh: { ur: 'فرعون', gu: 'ફિરઔન', hi: 'फ़िरऔन' },
  pilgrimage: { ur: 'حج و عمرہ', gu: 'હજ', hi: 'हज' },
  prayer: { ur: 'نماز و دعا', gu: 'નમાઝ અને દુઆ', hi: 'नमाज़ और दुआ' },
  'pre-islam': { ur: 'عہدِ جاہلیت', gu: 'ઇસ્લામ પૂર્વે', hi: 'इस्लाम-पूर्व' },
  preaching: { ur: 'دعوت و تبلیغ', gu: 'દાઅવત', hi: 'दावत व प्रचार' },
  prophecy: { ur: 'نبوت', gu: 'પયગંબરી', hi: 'नुबुव्वत' },
  repentance: { ur: 'توبہ و استغفار', gu: 'તૌબા', hi: 'तौबा' },
  return: { ur: 'واپسی', gu: 'વાપસી', hi: 'वापसी' },
  revelation: { ur: 'نزولِ وحی', gu: 'વહીનું અવતરણ', hi: 'वह्य का अवतरण' },
  sacrifice: { ur: 'قربانی', gu: 'કુરબાની', hi: 'क़ुर्बानी' },
  shepherd: { ur: 'گلہ بانی', gu: 'ભરવાડ', hi: 'चरवाहा' },
  society: { ur: 'اسلامی معاشرہ', gu: 'ઇસ્લામી સમાજ', hi: 'इस्लामी समाज' },
  taif: { ur: 'سفرِ طائف', gu: 'તાઇફ યાત્રા', hi: 'ताइफ़ की यात्रा' },
  trade: { ur: 'تجارت', gu: 'વેપાર', hi: 'व्यापार' },
  treaty: { ur: 'معاہدہ', gu: 'સંધિ', hi: 'संधि' },
  trial: { ur: 'آزمائش', gu: 'કસોટી', hi: 'आज़माइश' },
  tribes: { ur: 'قبائلِ عرب', gu: 'કબીલાઓ', hi: 'क़बीले' },
  uhud: { ur: 'غزوۂ احد', gu: 'ઉહુદની લડાઈ', hi: 'उहुद की जंग' },
  well: { ur: 'کنواں', gu: 'કૂવો', hi: 'कुआं' },
  whale: { ur: 'مچھلی کا واقعہ', gu: 'માછલીની ઘટના', hi: 'मछली की घटना' },
  wisdom: { ur: 'حکمت و دانائی', gu: 'હિકમત', hi: 'हिकमत' },
  intentions: { ur: 'نیت', gu: 'નિયત', hi: 'नीयत' },
  actions: { ur: 'اعمال', gu: 'કર્મો', hi: 'अमल' },
  faith: { ur: 'ایمان', gu: 'ઈમાન', hi: 'ईमान' },
  companions: { ur: 'صحابہ کرام', gu: 'સહાબા', hi: 'सहाबा' },
  virtue: { ur: 'فضیلت', gu: 'ફઝીલત', hi: 'फ़ज़ीलत' },
  islam: { ur: 'اسلام', gu: 'ઇસ્લામ', hi: 'इस्लाम' },
  general: { ur: 'عمومی', gu: 'સામાન્ય', hi: 'सामान्य' },
  charity: { ur: 'صدقہ و خیرات', gu: 'સદકો', hi: 'सदक़ा' },
  knowledge: { ur: 'علم', gu: 'જ્ઞાન', hi: 'इल्म' },
  manners: { ur: 'اخلاق و آداب', gu: 'શિષ્ટાચાર', hi: 'अख़लाक़' },
};

function normalizeTagSlug(tag: string): string {
  return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

export function formatEnglishTagLabel(tag: string): string {
  return tag
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/**
 * Synchronous tag lookup for UI chips.
 * In UR/GU/HI, unresolved tags return `null` so the UI renders skeleton chips
 * instead of flashing raw English slugs.
 */
export function getCachedTagsSync(
  tags: string[],
  targetLang: ContentLang
): { labels: Array<string | null>; allReady: boolean } {
  if (!tags || tags.length === 0) return { labels: [], allReady: true };
  if (targetLang === 'en') {
    return {
      labels: tags.map((t) => formatEnglishTagLabel(t)),
      allReady: true,
    };
  }

  let allReady = true;
  const labels = tags.map((rawTag) => {
    const slug = normalizeTagSlug(rawTag);
    const curated = CURATED_TAG_TRANSLATIONS[slug]?.[targetLang];
    if (curated) return curated;

    const cleanPhrase = formatIslamicProse(rawTag.replace(/[-_]+/g, ' ').trim(), 'en');
    const cacheKey = `${CONTENT_TRANSLATION_CACHE_PREFIX}${targetLang}_${fastHash(cleanPhrase)}`;
    if (memoryCache.has(cacheKey)) {
      return memoryCache.get(cacheKey)!;
    }
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(cacheKey);
        if (stored) {
          memoryCache.set(cacheKey, stored);
          return stored;
        }
      }
    } catch {
      // Ignore storage access restriction
    }
    allReady = false;
    return null;
  });

  return { labels, allReady };
}

export async function translateTagsBatch(
  tags: string[],
  targetLang: ContentLang
): Promise<{ labels: Array<string | null>; allReady: boolean }> {
  const syncRes = getCachedTagsSync(tags, targetLang);
  if (syncRes.allReady || targetLang === 'en') {
    return syncRes;
  }

  const out: Array<string | null> = [...syncRes.labels];
  let resolvedCount = 0;

  await Promise.all(
    tags.map(async (rawTag, idx) => {
      if (out[idx]) {
        resolvedCount++;
        return;
      }
      const cleanPhrase = rawTag.replace(/[-_]+/g, ' ').trim();
      const res = await translateSingleChunkViaApi(cleanPhrase, targetLang);
      if (res.ok && res.text && res.text.toLowerCase() !== cleanPhrase.toLowerCase()) {
        const cacheKey = `${CONTENT_TRANSLATION_CACHE_PREFIX}${targetLang}_${fastHash(formatIslamicProse(cleanPhrase, 'en'))}`;
        memoryCache.set(cacheKey, res.text);
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(cacheKey, res.text);
          }
        } catch {
          // Ignore quota error
        }
        out[idx] = res.text;
        resolvedCount++;
      }
    })
  );

  return {
    labels: out,
    allReady: resolvedCount === tags.length,
  };
}

export function getStoredContentLang(globalLang?: string): ContentLang {
  try {
    const saved = localStorage.getItem(CONTENT_LANG_STORAGE_KEY) as ContentLang | null;
    if (saved && (saved === 'en' || saved === 'ur' || saved === 'gu' || saved === 'hi')) {
      return saved;
    }
  } catch {
    // Ignore storage read error
  }

  if (globalLang === 'ur' || globalLang === 'gu' || globalLang === 'hi') {
    return globalLang;
  }
  return 'en';
}

export function useContentLanguage() {
  const { language: globalLang } = useLanguage();
  const [contentLang, setContentLangState] = useState<ContentLang>(() => getStoredContentLang(globalLang));

  useEffect(() => {
    if (globalLang === 'ur' || globalLang === 'gu' || globalLang === 'hi' || globalLang === 'en') {
      const saved = localStorage.getItem(CONTENT_LANG_STORAGE_KEY);
      if (!saved || saved === globalLang) {
        setContentLangState(globalLang as ContentLang);
      }
    }
  }, [globalLang]);

  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const customEvent = e as CustomEvent<ContentLang>;
      if (customEvent.detail && customEvent.detail !== contentLang) {
        setContentLangState(customEvent.detail);
      }
    };

    window.addEventListener('noor-content-lang-change', handleLangChange);
    window.addEventListener('noor-content-lang-changed', handleLangChange);
    return () => {
      window.removeEventListener('noor-content-lang-change', handleLangChange);
      window.removeEventListener('noor-content-lang-changed', handleLangChange);
    };
  }, [contentLang]);

  const setContentLang = useCallback((newLang: ContentLang) => {
    setContentLangState(newLang);
    try {
      localStorage.setItem(CONTENT_LANG_STORAGE_KEY, newLang);
    } catch {
      // Ignore storage error
    }
    window.dispatchEvent(new CustomEvent('noor-content-lang-change', { detail: newLang }));
    window.dispatchEvent(new CustomEvent('noor-content-lang-changed', { detail: newLang }));
  }, []);

  const isRtl = contentLang === 'ur';
  const dir = isRtl ? 'rtl' : 'ltr';

  const fontClass = useMemo(() => {
    if (contentLang === 'ur') {
      return 'font-urdu text-right tracking-normal pt-1 pb-1';
    }
    return '';
  }, [contentLang]);

  const contentStyle = useMemo(() => {
    if (contentLang === 'ur') {
      return {
        fontFamily: 'var(--font-urdu)',
        direction: 'rtl' as const,
        textAlign: 'right' as const,
        lineHeight: getReaderLineHeight('ur', 'standard'),
        paddingTop: '4px',
        paddingBottom: '4px',
      };
    }
    return {
      direction: 'ltr' as const,
      textAlign: 'left' as const,
      lineHeight: getReaderLineHeight(contentLang, 'standard'),
    };
  }, [contentLang]);

  return {
    contentLang,
    setContentLang,
    isRtl,
    dir,
    fontClass,
    contentStyle,
  };
}
