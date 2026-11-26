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
 * Primes secondary non-critical catalogs during browser idle time:
 * 1. Quiz rewards catalog & store state
 * 2. Nasheed library index
 * 3. Services grid secondary category mapping
 */
export function primeNonCriticalMetadata(): void {
  deferNonCriticalStartup(() => {
    try {
      // 1. Prime Quiz rewards & store metadata
      import('@/lib/quiz-store').catch((err) => console.debug('Idle prime quiz-store skipped:', err));
      import('@/lib/variable-rewards').catch((err) => console.debug('Idle prime variable-rewards skipped:', err));

      // 2. Prime Nasheed library index
      import('@/data/nasheeds.json').catch((err) => console.debug('Idle prime nasheeds skipped:', err));
      import('@/lib/global-nasheed').catch((err) => console.debug('Idle prime global-nasheed skipped:', err));

      // 3. Prime Services grid secondary metadata
      import('@/pages/Services').catch((err) => console.debug('Idle prime Services skipped:', err));
    } catch (err) {
      console.debug('Idle metadata prime skipped:', err);
    }
  }, 3500);
}
