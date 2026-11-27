/**
 * Home Last-State Synchronous Cache (P0 Fast Path)
 *
 * Persists a single compact JSON snapshot of Home state (`noor_home_last_state_v1`)
 * covering prayer times, active theme, pending Qaza/Sajdah counts, visible widget cards,
 * and Continue-Reading pointers so P0 hydrates interactively on frame 1 in <5ms,
 * followed by a non-blocking background refresh in P1.
 */

export const HOME_LAST_STATE_KEY = 'noor_home_last_state_v1';

export interface CachedHomePrayerEntry {
  name: string;
  time: string;
  dateIso?: string;
}

export interface HomeLastStateSnapshot {
  version: 1;
  updatedAt: number;
  dateKey: string;
  theme: string;
  locationLabel: string;
  hijriDate: string;
  prayers: CachedHomePrayerEntry[];
  nextPrayer: {
    name: string;
    time: string;
    targetTimeIso: string | null;
  };
  suhoorIftaar?: {
    suhoorTime: string;
    suhoorLabel: string;
    iftaarTime: string;
    iftaarLabel: string;
  };
  qazaPendingTotal: number;
  sajdahPendingTotal: number;
  visibleCardIds: string[];
  continueReading: {
    quran?: string | null;
    seerah?: string | null;
    qisas?: string | null;
    hadith?: string | null;
  };
}

let inMemoryHomeSnapshot: HomeLastStateSnapshot | null = null;

function getLocalDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.debug('[HomeLastState] JSON parse skipped:', err);
    return null;
  }
}

/**
 * Strictly synchronous P0 read — zero network, zero async IDB, zero heavy calculation.
 */
export function readHomeLastStateSync(): HomeLastStateSnapshot | null {
  if (inMemoryHomeSnapshot) return inMemoryHomeSnapshot;
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(HOME_LAST_STATE_KEY);
    if (!raw) return null;
    const parsed = safeParseJson<Partial<HomeLastStateSnapshot>>(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.prayers)) {
      return null;
    }
    inMemoryHomeSnapshot = {
      version: 1,
      updatedAt: Number(parsed.updatedAt || Date.now()),
      dateKey: typeof parsed.dateKey === 'string' ? parsed.dateKey : getLocalDateKey(),
      theme: typeof parsed.theme === 'string' ? parsed.theme : 'oxford-gold',
      locationLabel: typeof parsed.locationLabel === 'string' ? parsed.locationLabel : '',
      hijriDate: typeof parsed.hijriDate === 'string' ? parsed.hijriDate : '',
      prayers: parsed.prayers,
      nextPrayer: parsed.nextPrayer ?? { name: '', time: '--:--', targetTimeIso: null },
      suhoorIftaar: parsed.suhoorIftaar,
      qazaPendingTotal: Number(parsed.qazaPendingTotal ?? 0),
      sajdahPendingTotal: Number(parsed.sajdahPendingTotal ?? 0),
      visibleCardIds: Array.isArray(parsed.visibleCardIds) ? parsed.visibleCardIds : [],
      continueReading: parsed.continueReading ?? {},
    };
    return inMemoryHomeSnapshot;
  } catch (err) {
    console.debug('[HomeLastState] Synchronous read failed:', err);
    return null;
  }
}

/**
 * Computes light summary counts + continue-reading pointers from localStorage cleanly.
 */
export function buildHomeCountsAndPointers(): Pick<
  HomeLastStateSnapshot,
  'theme' | 'qazaPendingTotal' | 'sajdahPendingTotal' | 'continueReading'
> {
  let theme = 'oxford-gold';
  let qazaPendingTotal = 0;
  let sajdahPendingTotal = 0;
  let continueReading: HomeLastStateSnapshot['continueReading'] = {};

  try {
    if (typeof localStorage === 'undefined') {
      return { theme, qazaPendingTotal, sajdahPendingTotal, continueReading };
    }

    theme =
      localStorage.getItem('noor-theme') ||
      localStorage.getItem('noor_theme') ||
      'oxford-gold';

    // Qaza aggregate count: undated backlog + date-wise pending entries
    const qazaStats = safeParseJson<Record<string, number>>(localStorage.getItem('qaza_prayers_count'));
    if (qazaStats && typeof qazaStats === 'object') {
      for (const k of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha', 'witr']) {
        qazaPendingTotal += Math.max(0, Number(qazaStats[k] || 0));
      }
    }

    // Sajdah pending count
    const sajdahRaw = safeParseJson<{ pending?: Record<string, { count?: number }> }>(
      localStorage.getItem('noor_sajdah_ledger_v1')
    );
    if (sajdahRaw?.pending && typeof sajdahRaw.pending === 'object') {
      for (const entry of Object.values(sajdahRaw.pending)) {
        sajdahPendingTotal += Math.max(0, Number(entry?.count || 0));
      }
    }

    continueReading = {
      quran: localStorage.getItem('quran-reading-progress') ? 'active' : null,
      seerah: localStorage.getItem('noor_seerah_last_read') || localStorage.getItem('noor-seerah-last-read'),
      qisas: localStorage.getItem('noor_qisas_last_read') || localStorage.getItem('noor-qisas-last-read'),
      hadith: localStorage.getItem('noor_hadith_last_read') || localStorage.getItem('noor-hadith-last-read'),
    };
  } catch (err) {
    console.debug('[HomeLastState] Snapshot counts read failed:', err);
  }

  return { theme, qazaPendingTotal, sajdahPendingTotal, continueReading };
}

/**
 * Saves/updates partial Home Last-State snapshot safely in memory & localStorage.
 */
export function saveHomeLastState(partial: Partial<HomeLastStateSnapshot>): HomeLastStateSnapshot {
  const existing = readHomeLastStateSync();
  const baseCounts = buildHomeCountsAndPointers();
  const merged: HomeLastStateSnapshot = {
    version: 1,
    updatedAt: Date.now(),
    dateKey: partial.dateKey ?? existing?.dateKey ?? getLocalDateKey(),
    theme: partial.theme ?? baseCounts.theme ?? existing?.theme ?? 'oxford-gold',
    locationLabel: partial.locationLabel ?? existing?.locationLabel ?? '',
    hijriDate: partial.hijriDate ?? existing?.hijriDate ?? '',
    prayers: partial.prayers ?? existing?.prayers ?? [],
    nextPrayer: partial.nextPrayer ?? existing?.nextPrayer ?? { name: '', time: '--:--', targetTimeIso: null },
    suhoorIftaar: partial.suhoorIftaar ?? existing?.suhoorIftaar,
    qazaPendingTotal: partial.qazaPendingTotal ?? baseCounts.qazaPendingTotal,
    sajdahPendingTotal: partial.sajdahPendingTotal ?? baseCounts.sajdahPendingTotal,
    visibleCardIds: partial.visibleCardIds ?? existing?.visibleCardIds ?? [],
    continueReading: {
      ...(existing?.continueReading ?? {}),
      ...(baseCounts.continueReading ?? {}),
      ...(partial.continueReading ?? {}),
    },
  };

  inMemoryHomeSnapshot = merged;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(HOME_LAST_STATE_KEY, JSON.stringify(merged));
    }
  } catch (err) {
    console.debug('[HomeLastState] localStorage write skipped:', err);
  }
  return merged;
}

/**
 * Installs background listeners to keep Last-State Cache synced whenever state mutates.
 */
export function initHomeLastStateSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {};
  const syncCountsAndTheme = () => {
    const counts = buildHomeCountsAndPointers();
    saveHomeLastState(counts);
  };
  const events = [
    'qaza-updated',
    'qaza-date-updated',
    'noor-qaza-updated',
    'sajdah-updated',
    'noor-theme-changed',
    'dashboard-widget-config-changed',
  ];
  events.forEach((ev) => window.addEventListener(ev, syncCountsAndTheme));
  return () => {
    events.forEach((ev) => window.removeEventListener(ev, syncCountsAndTheme));
  };
}
