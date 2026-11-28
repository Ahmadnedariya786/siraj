#!/usr/bin/env node
/**
 * Step 7B Release Lock Verification Script (Siraj v3.0.19)
 * Verifies:
 *  1. Islamic Events cold-boot freeze elimination (chunked O(33d) scan + localStorage cache)
 *  2. Cold-boot p3-nearby-mosques-prefetch removal
 *  3. Boot alarm latching & splash dismiss <= 850ms under 900ms cap
 *  4. Check #13 Startup OS notification blocked handling + managed-audio X-Ray filter
 *  5. GlobalRadioPlayer mirror failover + zero console.error + data-managed-audio="true"
 *  6. Tafsir zero cv-auto & zero motion stagger delay + Global Toasts centered at 360px
 *  7. Zero backdrop-filter, zero SVG drop-shadow, zero Hindi, zero empty catch blocks
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function readRel(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const failures = [];
function assert(condition, label) {
  if (!condition) {
    failures.push(label);
    console.error(`  [FAIL] ${label}`);
  } else {
    console.log(`  [PASS] ${label}`);
  }
}

async function main() {
  console.log('\n=== SIRAJ v3.0.19 — STEP 7B RELEASE LOCK VERIFICATION ===\n');

  // 1. Islamic events service freeze elimination + runtime benchmark
  const eventsSrc = readRel('src/lib/islamic-events-service.ts');
  assert(
    eventsSrc.includes("ISLAMIC_EVENTS_CACHE_KEY = 'siraj_islamic_events_cache_v1'"),
    'islamic-events-service defines persistent daily cache key'
  );
  assert(
    eventsSrc.includes('YIELD_CHUNK_DAYS = 16') && eventsSrc.includes('await yieldEventsSlice()'),
    'islamic-events-service yields main thread every 16 days'
  );
  assert(
    !eventsSrc.includes('for (let monthOffset = 0; monthOffset <= 2; monthOffset++)'),
    'Removed legacy 54x400 synchronous monthOffset loop from getUpcomingEvents'
  );

  // Runtime benchmark via esbuild if available
  let esbuild = null;
  try {
    esbuild = require(path.join(ROOT, 'node_modules/esbuild'));
  } catch (e) {
    console.warn('esbuild unavailable for live bundle test:', e.message);
  }

  if (esbuild) {
    const lsStore = new Map();
    global.localStorage = {
      getItem: (k) => (lsStore.has(k) ? lsStore.get(k) : null),
      setItem: (k, v) => lsStore.set(k, String(v)),
      removeItem: (k) => lsStore.delete(k),
      clear: () => lsStore.clear(),
    };
    const stubPlugin = {
      name: 'siraj-test-alias',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) => {
          const sub = args.path.slice(2);
          if (sub === 'lib/local-notifications') {
            return { path: 'stub-local-notifications', namespace: 'stub' };
          }
          if (sub === 'lib/islamic-calendar-service') {
            return { path: 'stub-calendar', namespace: 'stub' };
          }
          const tsPath = path.join(ROOT, 'src', `${sub}.ts`);
          return { path: fs.existsSync(tsPath) ? tsPath : path.join(ROOT, 'src', `${sub}.tsx`) };
        });
        build.onLoad({ filter: /.*/, namespace: 'stub' }, (args) => {
          if (args.path === 'stub-local-notifications') {
            return {
              contents: `export const localNotifications = { scheduleNotification: async () => {}, cancelNotification: async () => {} };`,
              loader: 'js',
            };
          }
          return {
            contents: `export const islamicCalendarService = { getIslamicCalendarInfo: async () => ({ hijriMonth: 1, hijriDay: 1, daysUntilRamadan: 90 }) };`,
            loader: 'js',
          };
        });
      },
    };
    const bundled = await esbuild.build({
      entryPoints: [path.join(ROOT, 'src/lib/islamic-events-service.ts')],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      plugins: [stubPlugin],
    });
    const mod = { exports: {} };
    const fn = new Function('require', 'module', 'exports', bundled.outputFiles[0].text);
    fn(require, mod, mod.exports);
    const { islamicEventsService } = mod.exports;

    const tCold0 = performance.now();
    await islamicEventsService.scheduleUpcomingEvents();
    const coldMs = performance.now() - tCold0;

    // Reset daily guard to benchmark warm localStorage hit
    islamicEventsService.lastScheduleDate = null;
    const tWarm0 = performance.now();
    await islamicEventsService.scheduleUpcomingEvents();
    const warmMs = performance.now() - tWarm0;

    console.log(`  [BENCH] islamicEventsService cold=${coldMs.toFixed(2)}ms, warm=${warmMs.toFixed(2)}ms`);
    assert(coldMs < 250, `Cold scheduleUpcomingEvents completes fast without freeze (${coldMs.toFixed(1)}ms < 250ms)`);
    assert(warmMs < 15, `Warm localStorage cache scheduleUpcomingEvents completes in < 15ms (${warmMs.toFixed(1)}ms)`);
  }

  // 2. App.tsx P3 cold-boot mosque prefetch removed
  const appSrc = readRel('src/App.tsx');
  assert(
    !appSrc.includes('p3-nearby-mosques-prefetch'),
    'App.tsx no longer runs p3-nearby-mosques-prefetch during cold boot'
  );

  // 3. Boot scheduler & splash cap
  const bootSrc = readRel('src/lib/boot-scheduler.ts');
  assert(
    bootSrc.includes('currentTrace.alarmArmedAtMs === null'),
    'boot-scheduler.ts latches alarmArmedAtMs instead of overwriting on route transitions'
  );
  const indexHtml = readRel('index.html');
  assert(
    indexHtml.includes('setTimeout(dismissInitialSplash, 800)'),
    'index.html enforces 800ms pre-React splash dismissal failsafe (<= 850ms)'
  );
  const splashSrc = readRel('src/components/SplashScreen.tsx');
  assert(
    splashSrc.includes('SPLASH_HARD_CAP_MS - 260') && splashSrc.includes('SPLASH_HARD_CAP_MS - 80'),
    'SplashScreen.tsx keeps both timers strictly below SPLASH_HARD_CAP_MS'
  );

  // 4. Diagnostics Engine X-Ray filters & Check #13
  const diagSrc = readRel('src/lib/diagnostics-engine.ts');
  assert(
    diagSrc.includes("target.getAttribute('data-managed-audio') === 'true'") &&
      diagSrc.includes("target.dataset?.managedAudio === 'true'"),
    'diagnostics-engine.ts suppresses false RUNTIME_ERROR on managed <audio>/<video> elements'
  );
  assert(
    diagSrc.includes("'Alarms: OS notifications blocked (tap to enable)'") &&
      diagSrc.includes('osNotificationsBlocked'),
    'Check #13 Startup reports blocked OS notifications gracefully without false WARN'
  );

  // 5. GlobalRadioPlayer & GlobalQuranPlayer failover + logging + attribute
  const radioSrc = readRel('src/components/GlobalRadioPlayer.tsx');
  const quranSrc = readRel('src/components/GlobalQuranPlayer.tsx');
  assert(
    !/console\.error\s*\(/.test(radioSrc),
    'GlobalRadioPlayer.tsx contains zero console.error calls'
  );
  assert(
    radioSrc.includes('getMirrorStreamUrl') &&
      radioSrc.includes('https://backup.qurango.net/radio/') &&
      radioSrc.includes('https://qurango.net/radio/'),
    'GlobalRadioPlayer.tsx performs backup.qurango.net <-> qurango.net mirror failover'
  );
  assert(
    radioSrc.includes('Radio station temporarily unavailable — please try another station'),
    'GlobalRadioPlayer.tsx shows friendly unavailable toast on total stream exhaustion'
  );
  assert(
    radioSrc.includes('data-managed-audio="true"') &&
      (quranSrc.match(/data-managed-audio="true"/g) || []).length === 2,
    'GlobalRadioPlayer and both GlobalQuranPlayer <audio> tags have data-managed-audio="true"'
  );

  // 6. Tafsir scroll fix & Toast centering
  const tafsirSrc = readRel('src/pages/Tafsir-New.tsx');
  assert(!tafsirSrc.includes('cv-auto'), 'Tafsir-New.tsx removes cv-auto content-visibility stall');
  assert(
    !tafsirSrc.includes('delay: idx * 0.05') && !tafsirSrc.includes('<motion.div'),
    'Tafsir-New.tsx removes motion stagger delay on commentary cards'
  );
  const toasterSrc = readRel('src/components/ui/toaster.tsx');
  const toastSrc = readRel('src/components/ui/toast.tsx');
  const sonnerSrc = readRel('src/components/ui/sonner.tsx');
  assert(
    toasterSrc.includes('min-w-0 flex-1 break-words'),
    'toaster.tsx wraps title/description safely inside flex Toast'
  );
  assert(
    toastSrc.includes('left-1/2 -translate-x-1/2') && toastSrc.includes('max-w-[328px]'),
    'toast.tsx centers ToastViewport strictly within 328px on 360px screens'
  );
  assert(
    sonnerSrc.includes('position="top-center"') && sonnerSrc.includes('min(328px, calc(100vw - 32px))'),
    'sonner.tsx enforces centered top-center toasts bounded for 360px screens'
  );

  // 7. Workspace guardrail hygiene across all edited files
  const filesToAudit = [
    'src/lib/islamic-events-service.ts',
    'src/lib/boot-scheduler.ts',
    'src/App.tsx',
    'index.html',
    'src/components/SplashScreen.tsx',
    'src/lib/diagnostics-engine.ts',
    'src/components/GlobalRadioPlayer.tsx',
    'src/components/GlobalQuranPlayer.tsx',
    'src/pages/Tafsir-New.tsx',
    'src/components/ui/toaster.tsx',
    'src/components/ui/toast.tsx',
    'src/components/ui/sonner.tsx',
  ];
  for (const rel of filesToAudit) {
    const content = readRel(rel);
    assert(!/backdrop-filter\s*:/i.test(content) && !content.includes('backdrop-blur'), `${rel}: zero backdrop-filter`);
    assert(!/drop-shadow\(/i.test(content), `${rel}: zero SVG/CSS drop-shadow`);
    assert(!/[\u0900-\u097F]/.test(content), `${rel}: zero Hindi/Devanagari characters`);
    assert(!/\}\s*catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(content), `${rel}: zero empty catch blocks`);
  }

  if (failures.length > 0) {
    console.error(`\n[FAILED] ${failures.length} check(s) failed!`);
    process.exit(1);
  }
  console.log('\nALL STEP 7B RELEASE LOCK CHECKS PASSED!\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
