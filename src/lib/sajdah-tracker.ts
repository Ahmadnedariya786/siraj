import { useEffect, useState } from 'react';
import { safeSetLocalStorageItem } from '@/lib/cache-manager';
import { getFallbackLocationByTimezone, LOCATION_STORAGE_KEY } from '@/lib/location-config';
import { evaluateMakruhState, type MakruhStateResult } from '@/lib/makruh-times';
import { calculatePrayerTimes } from '@/lib/prayer-calculator';
import { getMadhab, type Madhab } from '@/lib/storage';

export type SajdahSource = 'read' | 'listen' | 'manual' | 'heard';
export type SajdahPerformMethod = 'immediate' | 'later';
export type SajdahSchool = 'agreed' | 'shafi-extra';

export interface SajdahAyahEntry {
  readonly id: string;
  readonly order: number;
  readonly surahNumber: number;
  readonly surahName: string;
  readonly surahArabic: string;
  readonly ayahStart: number;
  readonly ayahEnd: number;
  readonly markAyah: number;
  readonly juz: number;
  readonly arabicSnippet: string;
  readonly school: SajdahSchool;
}

export interface SajdahPendingEntry {
  count: number;
  source: SajdahSource;
  lastLoggedAt: string;
}

export interface SajdahCompletedEntry {
  key: string;
  source: SajdahSource;
  performedAt: string;
  method: SajdahPerformMethod;
}

export interface SajdahTrackerState {
  pending: Record<string, SajdahPendingEntry>;
  completedLog: SajdahCompletedEntry[];
  totalPerformedAllTime: number;
}

export type SajdahUndoSnapshot = SajdahTrackerState;

export const SAJDAH_STORAGE_KEY = 'siraj_sajdah_tracker_v1';
export const SAJDAH_REMINDER_ENABLED_KEY = 'siraj_sajdah_reminder_enabled_v1';
export const SAJDAH_TILAWAH_NAG_KEY = 'siraj_sajdah_tilawah_nag_v1';
export const SAJDAH_UPDATED_EVENT = 'siraj-sajdah-updated';
export const SAJDAH_COMPLETED_LOG_CAP = 200;

export const SAJDAH_AYAHS: readonly SajdahAyahEntry[] = Object.freeze([
  Object.freeze({
    id: '7:206',
    order: 1,
    surahNumber: 7,
    surahName: "Al-A'raf",
    surahArabic: 'الأعراف',
    ayahStart: 206,
    ayahEnd: 206,
    markAyah: 206,
    juz: 9,
    arabicSnippet: 'إِنَّ الَّذِينَ عِندَ رَبِّكَ لَا يَسْتَكْبِرُونَ عَنْ عِبَادَتِهِ وَيُسَبِّحُونَهُ وَلَهُ يَسْجُدُونَ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '13:15',
    order: 2,
    surahNumber: 13,
    surahName: "Ar-Ra'd",
    surahArabic: 'الرعد',
    ayahStart: 15,
    ayahEnd: 15,
    markAyah: 15,
    juz: 13,
    arabicSnippet: 'وَلِلَّهِ يَسْجُدُ مَن فِي السَّمَاوَاتِ وَالْأَرْضِ طَوْعًا وَكَرْهًا وَظِلَالُهُم بِالْغُدُوِّ وَالْآصَالِ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '16:50',
    order: 3,
    surahNumber: 16,
    surahName: 'An-Nahl',
    surahArabic: 'النحل',
    ayahStart: 49,
    ayahEnd: 50,
    markAyah: 50,
    juz: 14,
    arabicSnippet: 'يَخَافُونَ رَبَّهُم مِّن فَوْقِهِمْ وَيَفْعَلُونَ مَا يُؤْمَرُونَ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '17:109',
    order: 4,
    surahNumber: 17,
    surahName: 'Al-Isra',
    surahArabic: 'الإسراء',
    ayahStart: 107,
    ayahEnd: 109,
    markAyah: 109,
    juz: 15,
    arabicSnippet: 'وَيَخِرُّونَ لِلْأَذْقَانِ يَبْكُونَ وَيَزِيدُهُمْ خُشُوعًا ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '19:58',
    order: 5,
    surahNumber: 19,
    surahName: 'Maryam',
    surahArabic: 'مريم',
    ayahStart: 58,
    ayahEnd: 58,
    markAyah: 58,
    juz: 16,
    arabicSnippet: 'إِذَا تُتْلَىٰ عَلَيْهِمْ آيَاتُ الرَّحْمَٰنِ خَرُّوا سُجَّدًا وَبُكِيًّا ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '22:18',
    order: 6,
    surahNumber: 22,
    surahName: 'Al-Hajj',
    surahArabic: 'الحج',
    ayahStart: 18,
    ayahEnd: 18,
    markAyah: 18,
    juz: 17,
    arabicSnippet: 'أَلَمْ تَرَ أَنَّ اللَّهَ يَسْجُدُ لَهُ مَن فِي السَّمَاوَاتِ وَمَن فِي الْأَرْضِ وَالشَّمْسُ وَالْقَمَرُ وَالنُّجُومُ وَالْجِبَالُ وَالشَّجَرُ وَالدَّوَابُّ وَكَثِيرٌ مِّنَ النَّاسِ ۖ وَمَن يُهِنِ اللَّهُ فَمَا لَهُ مِن مُّكْرِمٍ ۚ إِنَّ اللَّهَ يَفْعَلُ مَا يَشَاءُ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '25:60',
    order: 7,
    surahNumber: 25,
    surahName: 'Al-Furqan',
    surahArabic: 'الفرقان',
    ayahStart: 60,
    ayahEnd: 60,
    markAyah: 60,
    juz: 19,
    arabicSnippet: 'وَإِذَا قِيلَ لَهُمُ اسْجُدُوا لِلرَّحْمَٰنِ قَالُوا وَمَا الرَّحْمَٰنُ أَنَسْجُدُ لِمَا تَأْمُرُنَا وَزَادَهُمْ نُفُورًا ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '27:26',
    order: 8,
    surahNumber: 27,
    surahName: 'An-Naml',
    surahArabic: 'النمل',
    ayahStart: 25,
    ayahEnd: 26,
    markAyah: 26,
    juz: 19,
    arabicSnippet: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ رَبُّ الْعَرْشِ الْعَظِيمِ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '32:15',
    order: 9,
    surahNumber: 32,
    surahName: 'As-Sajdah',
    surahArabic: 'السجدة',
    ayahStart: 15,
    ayahEnd: 15,
    markAyah: 15,
    juz: 21,
    arabicSnippet: 'إِنَّمَا يُؤْمِنُ بِآيَاتِنَا الَّذِينَ إِذَا ذُكِّرُوا بِهَا خَرُّوا سُجَّدًا وَسَبَّحُوا بِحَمْدِ رَبِّهِمْ وَهُمْ لَا يَسْتَكْبِرُونَ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '38:24',
    order: 10,
    surahNumber: 38,
    surahName: 'Sad',
    surahArabic: 'ص',
    ayahStart: 24,
    ayahEnd: 24,
    markAyah: 24,
    juz: 23,
    arabicSnippet: 'وَظَنَّ دَاوُودُ أَنَّمَا فَتَنَّاهُ فَاسْتَغْفَرَ رَبَّهُ وَخَرَّ رَاكِعًا وَأَنَابَ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '41:38',
    order: 11,
    surahNumber: 41,
    surahName: 'Fussilat',
    surahArabic: 'فصلت',
    ayahStart: 37,
    ayahEnd: 38,
    markAyah: 38,
    juz: 24,
    arabicSnippet: 'فَإِنِ اسْتَكْبَرُوا فَالَّذِينَ عِندَ رَبِّكَ يُسَبِّحُونَ لَهُ بِاللَّيْلِ وَالنَّهَارِ وَهُمْ لَا يَسْأَمُونَ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '53:62',
    order: 12,
    surahNumber: 53,
    surahName: 'An-Najm',
    surahArabic: 'النجم',
    ayahStart: 62,
    ayahEnd: 62,
    markAyah: 62,
    juz: 27,
    arabicSnippet: 'فَاسْجُدُوا لِلَّهِ وَاعْبُدُوا ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '84:21',
    order: 13,
    surahNumber: 84,
    surahName: 'Al-Inshiqaq',
    surahArabic: 'الانشقاق',
    ayahStart: 20,
    ayahEnd: 21,
    markAyah: 21,
    juz: 30,
    arabicSnippet: 'وَإِذَا قُرِئَ عَلَيْهِمُ الْقُرْآنُ لَا يَسْجُدُونَ ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '96:19',
    order: 14,
    surahNumber: 96,
    surahName: 'Al-Alaq',
    surahArabic: 'العلق',
    ayahStart: 19,
    ayahEnd: 19,
    markAyah: 19,
    juz: 30,
    arabicSnippet: 'كَلَّا لَا تُطِعْهُ وَاسْجُدْ وَاقْتَرِب ۩',
    school: 'agreed',
  }),
  Object.freeze({
    id: '22:77',
    order: 15,
    surahNumber: 22,
    surahName: 'Al-Hajj',
    surahArabic: 'الحج',
    ayahStart: 77,
    ayahEnd: 77,
    markAyah: 77,
    juz: 17,
    arabicSnippet: 'يَا أَيُّهَا الَّذِينَ آمَنُوا ارْكَعُوا وَاسْجُدُوا وَاعْبُدُوا رَبَّكُمْ وَافْعَلُوا الْخَيْرَ لَعَلَّكُمْ تُفْلِحُونَ ۩',
    school: 'shafi-extra',
  }),
]);

const SAJDAH_BY_KEY = new Map<string, SajdahAyahEntry>(
  SAJDAH_AYAHS.map((entry) => [entry.id, entry]),
);

const EMPTY_STATE: SajdahTrackerState = {
  pending: {},
  completedLog: [],
  totalPerformedAllTime: 0,
};

function canUseStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch (err) {
    console.warn('[sajdah-tracker] storage check failed:', err);
    return false;
  }
}

export function cloneSajdahState(state: SajdahTrackerState): SajdahTrackerState {
  const pendingCopy: Record<string, SajdahPendingEntry> = {};
  for (const [k, v] of Object.entries(state.pending)) {
    pendingCopy[k] = {
      count: v.count,
      source: v.source,
      lastLoggedAt: v.lastLoggedAt,
    };
  }
  return {
    pending: pendingCopy,
    completedLog: state.completedLog.map((entry) => ({ ...entry })),
    totalPerformedAllTime: state.totalPerformedAllTime,
  };
}

function isValidSource(value: unknown): value is SajdahSource {
  return value === 'read' || value === 'listen' || value === 'manual' || value === 'heard';
}

function isValidMethod(value: unknown): value is SajdahPerformMethod {
  return value === 'immediate' || value === 'later';
}

export function sanitizeSajdahState(raw: unknown): SajdahTrackerState {
  if (!raw || typeof raw !== 'object') {
    return cloneSajdahState(EMPTY_STATE);
  }
  const obj = raw as Record<string, unknown>;
  const pending: Record<string, SajdahPendingEntry> = {};

  if (obj.pending && typeof obj.pending === 'object') {
    for (const [key, val] of Object.entries(obj.pending as Record<string, unknown>)) {
      if (!SAJDAH_BY_KEY.has(key) || !val || typeof val !== 'object') continue;
      const item = val as Record<string, unknown>;
      const count = typeof item.count === 'number' && Number.isFinite(item.count)
        ? Math.floor(item.count)
        : 0;
      if (count <= 0) continue;
      pending[key] = {
        count,
        source: isValidSource(item.source) ? item.source : 'manual',
        lastLoggedAt: typeof item.lastLoggedAt === 'string' && item.lastLoggedAt
          ? item.lastLoggedAt
          : new Date().toISOString(),
      };
    }
  }

  const completedLog: SajdahCompletedEntry[] = [];
  if (Array.isArray(obj.completedLog)) {
    for (const row of obj.completedLog) {
      if (!row || typeof row !== 'object') continue;
      const item = row as Record<string, unknown>;
      if (typeof item.key !== 'string' || !SAJDAH_BY_KEY.has(item.key)) continue;
      completedLog.push({
        key: item.key,
        source: isValidSource(item.source) ? item.source : 'manual',
        performedAt: typeof item.performedAt === 'string' && item.performedAt
          ? item.performedAt
          : new Date().toISOString(),
        method: isValidMethod(item.method) ? item.method : 'later',
      });
      if (completedLog.length >= SAJDAH_COMPLETED_LOG_CAP) break;
    }
  }

  const totalPerformedAllTime =
    typeof obj.totalPerformedAllTime === 'number' && Number.isFinite(obj.totalPerformedAllTime)
      ? Math.max(0, Math.floor(obj.totalPerformedAllTime))
      : completedLog.length;

  return {
    pending,
    completedLog,
    totalPerformedAllTime,
  };
}

export function getSajdahByKey(key: string): SajdahAyahEntry | undefined {
  return SAJDAH_BY_KEY.get(key);
}

export function getSajdahForAyah(
  surahNumber: number,
  ayahNumber: number,
  madhab?: Madhab | 'all',
): SajdahAyahEntry | undefined {
  const entry = SAJDAH_BY_KEY.get(`${surahNumber}:${ayahNumber}`);
  if (!entry) return undefined;
  if (entry.school === 'shafi-extra' && madhab && madhab !== 'shafi' && madhab !== 'all') {
    return undefined;
  }
  return entry;
}

export function getVisibleSajdahAyahs(madhab: Madhab = getMadhab()): SajdahAyahEntry[] {
  return SAJDAH_AYAHS
    .filter((entry) => entry.school === 'agreed' || madhab === 'shafi')
    .slice()
    .sort((a, b) => a.surahNumber - b.surahNumber || a.markAyah - b.markAyah);
}

export function computeTotalPendingCount(state: SajdahTrackerState): number {
  let sum = 0;
  for (const entry of Object.values(state.pending)) {
    if (entry && typeof entry.count === 'number' && entry.count > 0) {
      sum += entry.count;
    }
  }
  return sum;
}

export function loadSajdahState(): SajdahTrackerState {
  if (!canUseStorage()) return cloneSajdahState(EMPTY_STATE);
  try {
    const raw = window.localStorage.getItem(SAJDAH_STORAGE_KEY);
    if (!raw) return cloneSajdahState(EMPTY_STATE);
    return sanitizeSajdahState(JSON.parse(raw));
  } catch (err) {
    console.warn('[sajdah-tracker] failed to parse stored ledger:', err);
    return cloneSajdahState(EMPTY_STATE);
  }
}

export function emitSajdahUpdated(state?: SajdahTrackerState): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(
      new CustomEvent(SAJDAH_UPDATED_EVENT, {
        detail: state ?? loadSajdahState(),
      }),
    );
  } catch (err) {
    console.warn('[sajdah-tracker] failed to dispatch update event:', err);
  }
}

export function persistSajdahState(nextState: SajdahTrackerState): SajdahTrackerState {
  const clean = sanitizeSajdahState(nextState);
  if (canUseStorage()) {
    const serialized = JSON.stringify(clean);
    const saved = safeSetLocalStorageItem(SAJDAH_STORAGE_KEY, serialized);
    if (!saved) {
      try {
        window.localStorage.setItem(SAJDAH_STORAGE_KEY, serialized);
      } catch (err) {
        console.warn('[sajdah-tracker] fallback save failed:', err);
      }
    }
  }
  emitSajdahUpdated(clean);
  return clean;
}

export function getTotalPendingCount(): number {
  return computeTotalPendingCount(loadSajdahState());
}

export function addPendingSajdah(
  key: string,
  source: SajdahSource = 'manual',
  delta: number = 1,
): SajdahUndoSnapshot {
  const prev = loadSajdahState();
  const snapshot = cloneSajdahState(prev);
  const safeDelta = Math.max(1, Math.floor(delta));
  if (!SAJDAH_BY_KEY.has(key)) {
    return snapshot;
  }

  const next = cloneSajdahState(prev);
  const existing = next.pending[key];
  const nowIso = new Date().toISOString();
  next.pending[key] = {
    count: (existing?.count ?? 0) + safeDelta,
    source,
    lastLoggedAt: nowIso,
  };
  persistSajdahState(next);
  return snapshot;
}

export function addAllKhatamSajdahs(madhab: Madhab = 'hanafi'): SajdahUndoSnapshot {
  const prev = loadSajdahState();
  const snapshot = cloneSajdahState(prev);
  const next = cloneSajdahState(prev);
  const targets = getVisibleSajdahAyahs(madhab);
  const nowIso = new Date().toISOString();

  for (const ayah of targets) {
    const existing = next.pending[ayah.id];
    next.pending[ayah.id] = {
      count: (existing?.count ?? 0) + 1,
      source: 'manual',
      lastLoggedAt: nowIso,
    };
  }

  persistSajdahState(next);
  return snapshot;
}

export function markSajdahPerformed(
  key: string,
  method: SajdahPerformMethod = 'later',
): SajdahUndoSnapshot {
  const prev = loadSajdahState();
  const snapshot = cloneSajdahState(prev);
  const existing = prev.pending[key];
  if (!existing || existing.count <= 0 || !SAJDAH_BY_KEY.has(key)) {
    return snapshot;
  }

  const next = cloneSajdahState(prev);
  if (existing.count <= 1) {
    delete next.pending[key];
  } else {
    next.pending[key] = {
      ...existing,
      count: existing.count - 1,
    };
  }

  const logEntry: SajdahCompletedEntry = {
    key,
    source: existing.source,
    performedAt: new Date().toISOString(),
    method,
  };
  next.completedLog = [logEntry, ...next.completedLog].slice(0, SAJDAH_COMPLETED_LOG_CAP);
  next.totalPerformedAllTime += 1;

  persistSajdahState(next);
  return snapshot;
}

export function logImmediateSajdah(
  key: string,
  source: SajdahSource = 'read',
): SajdahUndoSnapshot {
  const prev = loadSajdahState();
  const snapshot = cloneSajdahState(prev);
  if (!SAJDAH_BY_KEY.has(key)) {
    return snapshot;
  }

  const next = cloneSajdahState(prev);
  const logEntry: SajdahCompletedEntry = {
    key,
    source,
    performedAt: new Date().toISOString(),
    method: 'immediate',
  };
  next.completedLog = [logEntry, ...next.completedLog].slice(0, SAJDAH_COMPLETED_LOG_CAP);
  next.totalPerformedAllTime += 1;

  persistSajdahState(next);
  return snapshot;
}

export function undoLastSajdahAction(snapshot: SajdahUndoSnapshot): SajdahTrackerState {
  return persistSajdahState(cloneSajdahState(snapshot));
}

export function formatAyahRef(entry: SajdahAyahEntry): string {
  if (entry.ayahStart !== entry.ayahEnd) {
    return `${entry.surahNumber}:${entry.ayahStart}-${entry.ayahEnd}`;
  }
  return `${entry.surahNumber}:${entry.markAyah}`;
}

export function formatAyahRefByKey(key: string): string {
  const found = SAJDAH_BY_KEY.get(key);
  return found ? formatAyahRef(found) : key;
}

// ── Tilawah Daily Nag-Guard (at most ONCE per ayah per YYYY-MM-DD calendar day) ──

export function getLocalCalendarDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function readNagMap(): Record<string, string[]> {
  if (!canUseStorage()) return {};
  try {
    const raw = window.localStorage.getItem(SAJDAH_TILAWAH_NAG_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, string[]> = {};
    for (const [dateKey, list] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(list)) {
        out[dateKey] = list.filter((x): x is string => typeof x === 'string');
      }
    }
    return out;
  } catch (err) {
    console.warn('[sajdah-tracker] failed to read Tilawah nag map:', err);
    return {};
  }
}

export function hasTilawahPromptedToday(key: string, now: Date = new Date()): boolean {
  const today = getLocalCalendarDateKey(now);
  const map = readNagMap();
  return Boolean(map[today]?.includes(key));
}

export function markTilawahPromptedToday(key: string, now: Date = new Date()): void {
  if (!canUseStorage()) return;
  const today = getLocalCalendarDateKey(now);
  const existing = readNagMap();
  const prevKeys = existing[today] ?? [];
  if (prevKeys.includes(key)) return;

  // Retain only recent 3 calendar days to keep storage minimal
  const recentEntries = Object.entries(existing)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 2);
  const pruned: Record<string, string[]> = {};
  for (const [k, v] of recentEntries) {
    if (k !== today) pruned[k] = v;
  }
  pruned[today] = [...prevKeys, key];

  safeSetLocalStorageItem(SAJDAH_TILAWAH_NAG_KEY, JSON.stringify(pruned));
}

// ── Reminder Preference Store ──

export function isSajdahReminderEnabled(): boolean {
  if (!canUseStorage()) return false;
  try {
    return window.localStorage.getItem(SAJDAH_REMINDER_ENABLED_KEY) === 'true';
  } catch (err) {
    console.warn('[sajdah-tracker] failed to read reminder flag:', err);
    return false;
  }
}

export function setSajdahReminderPreference(enabled: boolean): void {
  if (!canUseStorage()) return;
  safeSetLocalStorageItem(SAJDAH_REMINDER_ENABLED_KEY, enabled ? 'true' : 'false');
}

// ── Live Makruh Window Helper (single source of truth: computeMakruhWindows) ──

function readSavedCoordinates(): { lat: number; lon: number } {
  if (canUseStorage()) {
    try {
      const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          typeof parsed?.latitude === 'number' &&
          typeof parsed?.longitude === 'number' &&
          Number.isFinite(parsed.latitude) &&
          Number.isFinite(parsed.longitude)
        ) {
          return { lat: parsed.latitude, lon: parsed.longitude };
        }
        if (
          typeof parsed?.lat === 'number' &&
          typeof parsed?.lon === 'number' &&
          Number.isFinite(parsed.lat) &&
          Number.isFinite(parsed.lon)
        ) {
          return { lat: parsed.lat, lon: parsed.lon };
        }
      }
    } catch (err) {
      console.warn('[sajdah-tracker] failed to parse saved location:', err);
    }
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const fallback = getFallbackLocationByTimezone(tz);
  return { lat: fallback.lat, lon: fallback.lon };
}

export function getLiveMakruhStatus(
  nowDate: Date = new Date(),
  timeFormat: '12h' | '24h' = '12h',
): MakruhStateResult {
  try {
    const { lat, lon } = readSavedCoordinates();
    const calculated = calculatePrayerTimes(lat, lon, nowDate);
    return evaluateMakruhState(
      {
        sunrise: calculated.sunrise,
        solarNoon: calculated.solarNoon,
        dhuhr: calculated.dhuhr,
        sunset: calculated.sunset,
        maghrib: calculated.maghrib,
      },
      nowDate,
      timeFormat,
    );
  } catch (err) {
    console.warn('[sajdah-tracker] Makruh calculation fallback:', err);
    return evaluateMakruhState(null, nowDate, timeFormat);
  }
}

// ── Reactive Hook ──

export function useSajdahTracker() {
  const [state, setState] = useState<SajdahTrackerState>(() => loadSajdahState());
  const [madhab, setMadhabState] = useState<Madhab>(() => getMadhab());

  useEffect(() => {
    const refreshState = () => {
      setState(loadSajdahState());
    };
    const refreshMadhab = () => {
      setMadhabState(getMadhab());
    };
    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key === SAJDAH_STORAGE_KEY) {
        refreshState();
      }
      if (!e.key || e.key === 'madhab-preference' || e.key === 'prayer-madhab') {
        refreshMadhab();
      }
    };

    window.addEventListener(SAJDAH_UPDATED_EVENT, refreshState as EventListener);
    window.addEventListener('madhab-changed', refreshMadhab as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(SAJDAH_UPDATED_EVENT, refreshState as EventListener);
      window.removeEventListener('madhab-changed', refreshMadhab as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const totalPendingCount = computeTotalPendingCount(state);
  const visibleAyahs = getVisibleSajdahAyahs(madhab);

  return {
    state,
    madhab,
    visibleAyahs,
    totalPendingCount,
    pendingCountByKey: (key: string) => state.pending[key]?.count ?? 0,
    addPendingSajdah,
    addAllKhatamSajdahs: (targetMadhab: Madhab = madhab) => addAllKhatamSajdahs(targetMadhab),
    markSajdahPerformed,
    logImmediateSajdah,
    undoLastSajdahAction,
  };
}
