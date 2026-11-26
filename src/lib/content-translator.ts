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
import { formatIslamicProse } from '@/lib/reader-typography';

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
  lang: ContentLang;
  title?: string;
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
    .replace(/\(\s*ﷺ\s*\)|ﷺ|\(\s*(?:peace be upon him|pbuh|p\.b\.u\.h\.|s\.a\.w\.?|saw)\s*\)/gi, ' [[SC_PBUH]] ')
    .replace(/\b(?:peace be upon him|pbuh)\b/gi, ' [[SC_PBUH]] ')
    .replace(/\(\s*(?:سُبْحَٰنَهُۥ وَتَعَٰلَىٰ|سبحانه وتعالى|SWT|s\.w\.t\.)\s*\)/gi, ' [[SC_SWT]] ')
    .replace(/\(\s*(?:عَلَيْهِ ٱلسَّلَامُ|عليه السلام|AS|a\.s\.|alayhis[- ]salam)\s*\)/gi, ' [[SC_AS]] ')
    .replace(/\(\s*(?:رَضِيَ اللَّهُ عَنْهُ|رضی اللہ عنہ|RA|r\.a\.)\s*\)/gi, ' [[SC_RA]] ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function restoreSacredPhrases(text: string, targetLang: ContentLang): string {
  const pbuh = targetLang === 'ur' ? 'ﷺ' : 'ﷺ';
  const swt = targetLang === 'ur' ? '(سبحانہ و تعالیٰ)' : targetLang === 'gu' ? '(SWT)' : targetLang === 'hi' ? '(SWT)' : '(SWT)';
  const asPhrase = targetLang === 'ur' ? '(علیہ السلام)' : targetLang === 'gu' ? '(અ.સ.)' : targetLang === 'hi' ? '(अ.स.)' : '(AS)';
  const raPhrase = targetLang === 'ur' ? '(رضی اللہ عنہ)' : targetLang === 'gu' ? '(ર.અ.)' : targetLang === 'hi' ? '(र.अ.)' : '(RA)';

  return text
    .replace(/\[\[\s*SC_PBUH\s*\]\]/gi, pbuh)
    .replace(/\[\[\s*SC_SWT\s*\]\]/gi, swt)
    .replace(/\[\[\s*SC_AS\s*\]\]/gi, asPhrase)
    .replace(/\[\[\s*SC_RA\s*\]\]/gi, raPhrase)
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function sanitizeIslamicHonorifics(text: string, targetLang: ContentLang): string {
  if (!text) return '';
  let out = formatIslamicProse(restoreSacredPhrases(text, targetLang), targetLang);

  if (targetLang === 'ur') {
    out = out
      .replace(/\((?:ﷺ|peace be upon him|pbuh|p\.b\.u\.h\.)\)/gi, 'ﷺ')
      .replace(/\bpeace be upon him\b/gi, 'ﷺ')
      .replace(/\b(?:PBUH|pbuh)\b/g, 'ﷺ')
      .replace(/\((?:AS|a\.s\.|alayhis-salam|alayhis salam)\)/gi, '(علیہ السلام)')
      .replace(/\((?:RA|r\.a\.|radiyallahu 'anhu|radiyallahu anhu)\)/gi, '(رضی اللہ عنہ)');
  } else if (targetLang === 'gu') {
    out = out
      .replace(/\((?:ﷺ|peace be upon him|pbuh|p\.b\.u\.h\.)\)/gi, ' ﷺ')
      .replace(/\bpeace be upon him\b/gi, 'ﷺ')
      .replace(/\b(?:PBUH|pbuh)\b/g, 'ﷺ')
      .replace(/\((?:AS|a\.s\.|alayhis-salam|alayhis salam)\)/gi, ' (અ.સ.)')
      .replace(/\((?:RA|r\.a\.|radiyallahu 'anhu|radiyallahu anhu)\)/gi, ' (ર.અ.)');
  } else if (targetLang === 'hi') {
    out = out
      .replace(/\((?:ﷺ|peace be upon him|pbuh|p\.b\.u\.h\.)\)/gi, ' ﷺ')
      .replace(/\bpeace be upon him\b/gi, 'ﷺ')
      .replace(/\b(?:PBUH|pbuh)\b/g, 'ﷺ')
      .replace(/\((?:AS|a\.s\.|alayhis-salam|alayhis salam)\)/gi, ' (अ.स.)')
      .replace(/\((?:RA|r\.a\.|radiyallahu 'anhu|radiyallahu anhu)\)/gi, ' (र.अ.)');
  }

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
 * Translates multi-paragraph chapters (Seerah, Prophets) progressively:
 * 1) Checks permanent IndexedDB (`siraj_translated_books_v1`) -> 0ms offline load
 * 2) Translates first 2-3 paragraphs immediately so user starts reading < 1.5s
 * 3) Streams remaining chunks (`<= 850` chars each) keeping pure Arabic blocks untouched
 * 4) Saves completed translation permanently to IndexedDB
 * 5) Falls back honestly to English (`actualLang: 'en'`, `offlineFallback: true`) if offline
 */
export async function streamBookTranslation(opts: StreamBookOptions): Promise<void> {
  const { module, itemId, title, englishParagraphs, targetLang, signal, onUpdate } = opts;
  const cleanParas = englishParagraphs
    .map((p) => formatIslamicProse(p, 'en'))
    .filter(Boolean);
  const fullEnText = cleanParas.join('\n\n');

  if (targetLang === 'en' || cleanParas.length === 0) {
    onUpdate({
      title: title ? formatIslamicProse(title, 'en') : undefined,
      text: fullEnText,
      actualLang: 'en',
      fromCache: false,
      offlineFallback: false,
      source: 'original',
      doneChunks: cleanParas.length,
      totalChunks: cleanParas.length,
      isComplete: true,
    });
    return;
  }

  const cacheId = `${module}:${itemId}:${targetLang}`;
  const cached = await getBookTranslationFromCache(cacheId);
  if (cached?.text) {
    if (signal?.aborted) return;
    onUpdate({
      title: cached.title || title,
      text: cached.text,
      actualLang: targetLang,
      fromCache: true,
      offlineFallback: false,
      source: cached.source,
      doneChunks: 1,
      totalChunks: 1,
      isComplete: true,
    });
    return;
  }

  // Group paragraphs into chunks <= 850 chars while tracking paragraph order
  // Keep individual paragraphs separated via a unique delimiter inside chunks where possible,
  // or translate paragraph-chunks cleanly
  const workChunks: string[] = [];
  for (const para of cleanParas) {
    if (para.length <= 850) {
      workChunks.push(para);
    } else {
      workChunks.push(...splitTranslationChunks(para, 850));
    }
  }

  const totalChunks = workChunks.length;
  const translatedChunks: string[] = [...workChunks];
  let succeededCount = 0;

  let translatedTitle = title ? formatIslamicProse(title, 'en') : undefined;
  if (title && !signal?.aborted) {
    const titleRes = await translateSingleChunkViaApi(title, targetLang);
    if (titleRes.ok) {
      translatedTitle = titleRes.text;
    }
  }

  // First batch: translate first 3 chunks immediately so reader sees target language right away!
  const firstBatchCount = Math.min(3, totalChunks);
  for (let i = 0; i < totalChunks; ) {
    if (signal?.aborted) return;

    const batchSize = i === 0 ? firstBatchCount : 2;
    const endIdx = Math.min(i + batchSize, totalChunks);
    const results = await Promise.all(
      workChunks.slice(i, endIdx).map((ch) => translateSingleChunkViaApi(ch, targetLang))
    );

    let batchOk = 0;
    results.forEach((res, offsetIdx) => {
      if (res.ok) {
        translatedChunks[i + offsetIdx] = res.text;
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
          totalChunks,
          isComplete: true,
        });
      }
      return;
    }

    i = endIdx;
    const isComplete = i >= totalChunks;

    if (!signal?.aborted) {
      onUpdate({
        title: translatedTitle,
        text: translatedChunks.slice(0, i).join('\n\n') + (isComplete ? '' : `\n\n${workChunks.slice(i).join('\n\n')}`),
        actualLang: targetLang,
        fromCache: false,
        offlineFallback: false,
        source: 'chunked-api',
        doneChunks: i,
        totalChunks,
        isComplete,
      });
    }
  }

  if (succeededCount > 0 && !signal?.aborted) {
    const finalJoined = translatedChunks.join('\n\n');
    await saveBookTranslationToCache({
      id: cacheId,
      module,
      itemId,
      lang: targetLang,
      title: translatedTitle,
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
        lineHeight: 2.0,
        paddingTop: '4px',
        paddingBottom: '4px',
      };
    }
    return {
      direction: 'ltr' as const,
      textAlign: 'left' as const,
      lineHeight: 1.65,
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
