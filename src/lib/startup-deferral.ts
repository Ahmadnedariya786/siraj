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
 * Primes secondary non-critical catalogs during browser idle time:
 * 1. Quiz rewards catalog & store state
 * 2. Nasheed library index
 * 3. Services grid secondary category mapping
 */
export function primeNonCriticalMetadata(): void {
  deferNonCriticalStartup(() => {
    try {
      // 1. Prime Quiz rewards & store metadata
      import('@/lib/quiz-store').catch(() => {});
      import('@/lib/variable-rewards').catch(() => {});

      // 2. Prime Nasheed library index
      import('@/data/nasheeds.json').catch(() => {});
      import('@/lib/global-nasheed').catch(() => {});

      // 3. Prime Services grid secondary metadata
      import('@/pages/Services').catch(() => {});
    } catch {
      // Non-critical startup prime error ignored
    }
  }, 400);
}
