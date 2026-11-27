/**
 * Siraj — Startup Deferral Engine
 * Defers non-critical startup metadata (Quiz rewards catalog, Nasheed library index,
 * Services grid secondary metadata, secondary route preloads) behind requestIdleCallback
 * (with setTimeout 300ms fallback) AFTER first paint so Home Prayer Times & Hero Clock
 * mount instantaneously with 0ms jank.
 */

export function deferNonCriticalStartup(callback: () => void, timeoutMs = 300): void {
  if (typeof window === 'undefined') return;
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(callback, { timeout: timeoutMs });
  } else {
    setTimeout(callback, timeoutMs);
  }
}

/**
 * Runs a non-critical task strictly AFTER first paint via rAF + requestIdleCallback
 * (with setTimeout fallback) so cold boot & splash handoff never stall.
 */
export function deferAfterFirstPaint(callback: () => void, timeoutMs = 250): void {
  if (typeof window === 'undefined') return;
  const scheduleIdle = () => deferNonCriticalStartup(callback, timeoutMs);
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => scheduleIdle());
  } else {
    setTimeout(scheduleIdle, timeoutMs);
  }
}

/**
 * Legacy helper retained as a zero-work P2 no-op on cold boot.
 * P2 secondary features (Quiz, Nasheeds, Audio, Translations) initialize strictly
 * lazily on first visit via `markP2FeatureVisited` in `boot-scheduler.ts`.
 */
export function primeNonCriticalMetadata(): void {
  // Intentionally empty at cold boot: P2 work runs only on first visit to each module.
}
