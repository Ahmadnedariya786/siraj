/**
 * Interactive-First Boot Scheduler & Trace Recorder (P0 -> P1 -> P2 -> P3)
 *
 * Ensures zero post-splash freeze on low/mid-range Android WebViews:
 *  - P0 (sync): theme attr, last-state home cache hydration, route shell, event handlers -> Interactive (TTI)
 *  - P1 (idle-chunked <=30ms): prayer recompute if stale, native alarm batch reschedule, widget sync
 *  - P2 (lazy-on-visit): translation cache hydration, nasheed/quiz metadata, audio index
 *  - P3 (network-idle): OTA update check, bullion rates prefetch, nearby mosques prefetch
 */

function recordBootBreadcrumb(type: string, message: string): void {
  import('@/lib/diagnostics-engine')
    .then(({ recordBreadcrumb }) => {
      recordBreadcrumb(type, message);
    })
    .catch((err) => {
      console.debug('[BootScheduler] Deferred breadcrumb skipped:', err);
    });
}

export const BOOT_TRACE_STORAGE_KEY = 'noor_boot_traces_v1';
export const BOOT_P0_COMPLETE_EVENT = 'noor:boot-p0-complete';
export const BOOT_P1_SLOW_SYNC_EVENT = 'noor:boot-p1-slow-sync';
export const BOOT_P3_READY_EVENT = 'noor:boot-p3-ready';

export const SPLASH_HARD_CAP_MS = 1200;
export const P1_SLOW_SYNC_THRESHOLD_MS = 3000;
export const P1_CHUNK_BUDGET_MS = 30;
export const TARGET_COLD_TTI_MS = 1500;

export type P2FeatureKey = 'translations' | 'nasheeds' | 'quiz' | 'audio';

export interface BootChunkMetric {
  name: string;
  phase: 'P1' | 'P3';
  startMs: number;
  durationMs: number;
  ok: boolean;
}

export interface BootLongTaskEntry {
  name: string;
  startMs: number;
  durationMs: number;
}

export interface BootTraceRecord {
  traceId: string;
  startedAtIso: string;
  launchMode: 'cold' | 'warm';
  homeCacheHit: boolean;
  fontStrategy: 'async-swap';
  p0StartMs: number;
  p0EndMs: number | null;
  ttiMs: number | null;
  splashDismissMs: number | null;
  p1StartMs: number | null;
  p1EndMs: number | null;
  p1DurationMs: number | null;
  alarmArmedAtMs: number | null;
  alarmArmedCount: number;
  p2Triggered: P2FeatureKey[];
  p3StartMs: number | null;
  p3EndMs: number | null;
  p3DurationMs: number | null;
  chunks: BootChunkMetric[];
  longTasksFirst5s: BootLongTaskEntry[];
  slowSyncShown: boolean;
  status: 'booting' | 'interactive' | 'p1-complete' | 'settled';
}

const MAX_TRACES = 10;

function nowMs(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
}

function getBootOriginMs(): number {
  if (typeof window !== 'undefined') {
    const win = window as Window & { __NOOR_BOOT_T0?: number };
    if (typeof win.__NOOR_BOOT_T0 === 'number' && Number.isFinite(win.__NOOR_BOOT_T0)) {
      return win.__NOOR_BOOT_T0;
    }
  }
  return 0;
}

function elapsedSinceBootMs(): number {
  return Math.max(0, Math.round((nowMs() - getBootOriginMs()) * 10) / 10);
}

const isWarmLaunch =
  typeof sessionStorage !== 'undefined' &&
  sessionStorage.getItem('noor_app_booted') === 'true';

let currentTrace: BootTraceRecord = {
  traceId: `boot-${Date.now().toString(36)}`,
  startedAtIso: new Date().toISOString(),
  launchMode: isWarmLaunch ? 'warm' : 'cold',
  homeCacheHit: false,
  fontStrategy: 'async-swap',
  p0StartMs: getBootOriginMs(),
  p0EndMs: null,
  ttiMs: null,
  splashDismissMs: null,
  p1StartMs: null,
  p1EndMs: null,
  p1DurationMs: null,
  alarmArmedAtMs: null,
  alarmArmedCount: 0,
  p2Triggered: [],
  p3StartMs: null,
  p3EndMs: null,
  p3DurationMs: null,
  chunks: [],
  longTasksFirst5s: [],
  slowSyncShown: false,
  status: 'booting',
};

let slowSyncActive = false;
let p1Started = false;
let p1Completed = false;
let p3Scheduled = false;
let p3ReadyFlag = false;
let longTaskObserverInstalled = false;
const p2InitializedSet = new Set<P2FeatureKey>();
const slowSyncListeners = new Set<(slow: boolean) => void>();
const p3ReadyListeners = new Set<() => void>();

function persistCurrentTrace(): void {
  try {
    if (typeof window !== 'undefined') {
      (window as Window & { __NOOR_BOOT_TRACE__?: BootTraceRecord }).__NOOR_BOOT_TRACE__ = currentTrace;
    }
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(BOOT_TRACE_STORAGE_KEY);
    let existing: BootTraceRecord[] = [];
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) existing = parsed;
      } catch (parseErr) {
        console.debug('[BootTrace] Resetting malformed trace history:', parseErr);
      }
    }
    const idx = existing.findIndex((t) => t.traceId === currentTrace.traceId);
    if (idx >= 0) {
      existing[idx] = currentTrace;
    } else {
      existing.unshift(currentTrace);
    }
    localStorage.setItem(BOOT_TRACE_STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_TRACES)));
  } catch (err) {
    console.debug('[BootTrace] Persist trace skipped:', err);
  }
}

export function getLatestBootTrace(): BootTraceRecord {
  if (typeof window !== 'undefined') {
    const winTrace = (window as Window & { __NOOR_BOOT_TRACE__?: BootTraceRecord }).__NOOR_BOOT_TRACE__;
    if (winTrace && (currentTrace.ttiMs === null || winTrace.traceId === currentTrace.traceId)) {
      return { ...winTrace };
    }
  }
  return { ...currentTrace };
}

export function getRecentBootTraces(limit = 3): BootTraceRecord[] {
  try {
    if (typeof localStorage === 'undefined') return [currentTrace];
    const raw = localStorage.getItem(BOOT_TRACE_STORAGE_KEY);
    if (!raw) return [currentTrace];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return [currentTrace];
    return parsed.slice(0, limit);
  } catch (err) {
    console.debug('[BootTrace] Read recent traces fallback:', err);
    return [currentTrace];
  }
}

export function setSlowSyncState(active: boolean): void {
  if (slowSyncActive === active) return;
  slowSyncActive = active;
  if (active) {
    currentTrace.slowSyncShown = true;
    persistCurrentTrace();
  }
  slowSyncListeners.forEach((cb) => {
    try {
      cb(active);
    } catch (err) {
      console.debug('[BootScheduler] Slow-sync listener error:', err);
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BOOT_P1_SLOW_SYNC_EVENT, { detail: { slowSyncing: active } }));
  }
}

export function isP1SlowSyncing(): boolean {
  return slowSyncActive;
}

export function subscribeP1SlowSync(listener: (slow: boolean) => void): () => void {
  slowSyncListeners.add(listener);
  listener(slowSyncActive);
  return () => {
    slowSyncListeners.delete(listener);
  };
}

export function isP3NetworkIdleReady(): boolean {
  return p3ReadyFlag;
}

export function subscribeP3NetworkIdle(listener: () => void): () => void {
  if (p3ReadyFlag) {
    listener();
    return () => {};
  }
  p3ReadyListeners.add(listener);
  return () => {
    p3ReadyListeners.delete(listener);
  };
}

function installLongTaskObserver(ttiPerfMs: number): void {
  if (longTaskObserverInstalled || typeof window === 'undefined') return;
  longTaskObserverInstalled = true;

  // Ingest ONLY post-interactive long tasks (startMs >= ttiPerfMs within first 5s post-TTI)
  try {
    const win = window as Window & { __NOOR_BOOT_LONG_TASKS?: BootLongTaskEntry[] };
    if (Array.isArray(win.__NOOR_BOOT_LONG_TASKS)) {
      for (const entry of win.__NOOR_BOOT_LONG_TASKS) {
        if (entry.durationMs > 50 && entry.startMs >= ttiPerfMs && entry.startMs <= ttiPerfMs + 5000) {
          currentTrace.longTasksFirst5s.push(entry);
        }
      }
    }
  } catch (err) {
    console.debug('[BootTrace] Pre-JS long task import skipped:', err);
  }

  try {
    if (typeof PerformanceObserver === 'undefined') return;
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 50 && entry.startTime >= ttiPerfMs && entry.startTime <= ttiPerfMs + 5000) {
          currentTrace.longTasksFirst5s.push({
            name: entry.name || 'self',
            startMs: Math.round(entry.startTime * 10) / 10,
            durationMs: Math.round(entry.duration * 10) / 10,
          });
        }
      }
      persistCurrentTrace();
    });
    observer.observe({ type: 'longtask', buffered: true });
    setTimeout(() => {
      try {
        observer.disconnect();
      } catch (err) {
        console.debug('[BootTrace] LongTaskObserver disconnect skipped:', err);
      }
    }, 5200);
  } catch (err) {
    console.debug('[BootTrace] LongTask PerformanceObserver unsupported:', err);
  }
}

/**
 * Yields back to the browser event loop between P1/P3 chunks so main-thread slices stay <=30ms
 * and user touches/scrolls remain responsive at 60 FPS.
 */
export function yieldToMainThread(preferIdle = true, timeoutMs = 450): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve();
      return;
    }
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (preferIdle && typeof win.requestIdleCallback === 'function') {
      win.requestIdleCallback(() => resolve(), { timeout: timeoutMs });
      return;
    }
    setTimeout(resolve, 0);
  });
}

/**
 * Marks P0 complete (first paint interactive = TTI), unlocks splash listeners,
 * and starts the 5-second post-interactive long-task monitor.
 */
export function markP0Interactive(opts?: { homeCacheHit?: boolean }): number {
  if (currentTrace.p0EndMs !== null) {
    return currentTrace.ttiMs ?? currentTrace.p0EndMs;
  }
  const elapsed = elapsedSinceBootMs();
  const perfNow = nowMs();
  currentTrace.p0EndMs = elapsed;
  currentTrace.ttiMs = elapsed;
  currentTrace.homeCacheHit = Boolean(opts?.homeCacheHit);
  currentTrace.status = 'interactive';
  installLongTaskObserver(perfNow);
  persistCurrentTrace();
  recordBootBreadcrumb('BOOT_P0', `Interactive (TTI=${elapsed}ms, cacheHit=${currentTrace.homeCacheHit})`);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BOOT_P0_COMPLETE_EVENT, { detail: { ttiMs: elapsed } }));
  }
  return elapsed;
}

export function markSplashDismissed(): void {
  if (currentTrace.splashDismissMs !== null) return;
  currentTrace.splashDismissMs = elapsedSinceBootMs();
  persistCurrentTrace();
  recordBootBreadcrumb('BOOT_SPLASH', `Splash dismissed at ${currentTrace.splashDismissMs}ms`);
}

export function recordAlarmArmed(count: number): void {
  currentTrace.alarmArmedAtMs = elapsedSinceBootMs();
  currentTrace.alarmArmedCount = Math.max(currentTrace.alarmArmedCount, count);
  persistCurrentTrace();
  recordBootBreadcrumb('BOOT_ALARM', `Alarms armed (${count}) at ${currentTrace.alarmArmedAtMs}ms`);
}

export interface P1TaskSpec {
  name: string;
  run: () => Promise<void> | void;
}

/**
 * Executes P1 initialization tasks across chunked idle slices (yielding between every slice)
 * while NEVER blocking Home pointer-events. Shows the header "Syncing alarms..." chip only
 * if P1 exceeds 3000ms.
 */
export async function runP1IdleChunks(tasks: P1TaskSpec[]): Promise<void> {
  if (p1Started) return;
  p1Started = true;
  currentTrace.p1StartMs = elapsedSinceBootMs();
  persistCurrentTrace();

  const slowTimer =
    typeof window !== 'undefined'
      ? setTimeout(() => {
          if (!p1Completed) {
            setSlowSyncState(true);
          }
        }, P1_SLOW_SYNC_THRESHOLD_MS)
      : null;

  try {
    for (const task of tasks) {
      await yieldToMainThread(true, 600);
      const t0 = nowMs();
      const startSinceBoot = elapsedSinceBootMs();
      let ok = true;
      try {
        await task.run();
      } catch (err) {
        ok = false;
        console.warn(`[BootScheduler] P1 chunk "${task.name}" failed:`, err);
      }
      const durationMs = Math.round((nowMs() - t0) * 10) / 10;
      currentTrace.chunks.push({
        name: task.name,
        phase: 'P1',
        startMs: startSinceBoot,
        durationMs,
        ok,
      });
      persistCurrentTrace();
    }
  } finally {
    p1Completed = true;
    if (slowTimer !== null) clearTimeout(slowTimer);
    setSlowSyncState(false);
    currentTrace.p1EndMs = elapsedSinceBootMs();
    currentTrace.p1DurationMs =
      currentTrace.p1StartMs !== null
        ? Math.max(0, Math.round((currentTrace.p1EndMs - currentTrace.p1StartMs) * 10) / 10)
        : 0;
    if (currentTrace.status !== 'settled') {
      currentTrace.status = 'p1-complete';
    }
    persistCurrentTrace();
    recordBootBreadcrumb('BOOT_P1', `P1 complete in ${currentTrace.p1DurationMs}ms`);
  }
}

/**
 * P2 — Lazy-on-first-visit feature initialization (0ms on Home cold boot).
 */
export function markP2FeatureVisited(feature: P2FeatureKey, initFn?: () => void | Promise<unknown>): void {
  if (p2InitializedSet.has(feature)) return;
  p2InitializedSet.add(feature);
  if (!currentTrace.p2Triggered.includes(feature)) {
    currentTrace.p2Triggered.push(feature);
    persistCurrentTrace();
  }
  recordBootBreadcrumb('BOOT_P2', `Lazy-initialized P2 feature: ${feature}`);
  if (initFn) {
    Promise.resolve()
      .then(() => initFn())
      .catch((err) => console.debug(`[BootScheduler] P2 ${feature} init skipped:`, err));
  }
}

/**
 * P3 — Network-idle background prefetch (OTA update check, bullion rates, mosques prefetch).
 * Runs strictly AFTER interactive + P1 and skips network hits when offline.
 */
export function scheduleP3NetworkIdle(tasks: P1TaskSpec[], delayMs = 2600): void {
  if (p3Scheduled || typeof window === 'undefined') return;
  p3Scheduled = true;

  setTimeout(async () => {
    await yieldToMainThread(true, 1500);
    currentTrace.p3StartMs = elapsedSinceBootMs();
    p3ReadyFlag = true;
    p3ReadyListeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.debug('[BootScheduler] P3 listener error:', err);
      }
    });
    window.dispatchEvent(new CustomEvent(BOOT_P3_READY_EVENT));

    const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
    for (const task of tasks) {
      if (!online) {
        currentTrace.chunks.push({
          name: `${task.name}:offline-skipped`,
          phase: 'P3',
          startMs: elapsedSinceBootMs(),
          durationMs: 0,
          ok: true,
        });
        continue;
      }
      await yieldToMainThread(true, 1500);
      const t0 = nowMs();
      const startSinceBoot = elapsedSinceBootMs();
      let ok = true;
      try {
        await task.run();
      } catch (err) {
        ok = false;
        console.debug(`[BootScheduler] P3 "${task.name}" skipped cleanly:`, err);
      }
      currentTrace.chunks.push({
        name: task.name,
        phase: 'P3',
        startMs: startSinceBoot,
        durationMs: Math.round((nowMs() - t0) * 10) / 10,
        ok,
      });
    }

    currentTrace.p3EndMs = elapsedSinceBootMs();
    currentTrace.p3DurationMs =
      currentTrace.p3StartMs !== null
        ? Math.max(0, Math.round((currentTrace.p3EndMs - currentTrace.p3StartMs) * 10) / 10)
        : 0;
    currentTrace.status = 'settled';
    persistCurrentTrace();
    recordBootBreadcrumb('BOOT_P3', `P3 network-idle settled (${tasks.length} tasks)`);
  }, delayMs);
}

/**
 * Helper for test harness: resets scheduler state between synthetic trace runs.
 */
export function __resetBootSchedulerForTest(launchMode: 'cold' | 'warm' = 'cold'): void {
  p1Started = false;
  p1Completed = false;
  p3Scheduled = false;
  p3ReadyFlag = false;
  slowSyncActive = false;
  p2InitializedSet.clear();
  currentTrace = {
    traceId: `boot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    startedAtIso: new Date().toISOString(),
    launchMode,
    homeCacheHit: false,
    fontStrategy: 'async-swap',
    p0StartMs: getBootOriginMs(),
    p0EndMs: null,
    ttiMs: null,
    splashDismissMs: null,
    p1StartMs: null,
    p1EndMs: null,
    p1DurationMs: null,
    alarmArmedAtMs: null,
    alarmArmedCount: 0,
    p2Triggered: [],
    p3StartMs: null,
    p3EndMs: null,
    p3DurationMs: null,
    chunks: [],
    longTasksFirst5s: [],
    slowSyncShown: false,
    status: 'booting',
  };
  persistCurrentTrace();
}
