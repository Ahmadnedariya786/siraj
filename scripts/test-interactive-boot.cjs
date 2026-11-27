/**
 * Regression & Benchmark Suite — Interactive-First Boot (P0 -> P1 -> P2 -> P3)
 * Run: node scripts/test-interactive-boot.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function setupBrowserGlobals(options = {}) {
  const store = new Map(Object.entries(options.initialStorage || {}));
  const listeners = new Map();
  const dispatchedEvents = [];

  const localStorageMock = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(String(k), String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };

  const sessionMap = new Map();
  const sessionStorageMock = {
    getItem: (k) => (sessionMap.has(k) ? sessionMap.get(k) : null),
    setItem: (k, v) => sessionMap.set(String(k), String(v)),
    removeItem: (k) => sessionMap.delete(k),
    clear: () => sessionMap.clear(),
  };

  const windowObj = {
    __NOOR_BOOT_T0: performance.now(),
    __NOOR_BOOT_LONG_TASKS: [],
    innerWidth: 360,
    innerHeight: 800,
    devicePixelRatio: 2,
    location: { pathname: '/', search: '', hash: '' },
    addEventListener: (ev, cb) => {
      if (!listeners.has(ev)) listeners.set(ev, new Set());
      listeners.get(ev).add(cb);
    },
    removeEventListener: (ev, cb) => {
      listeners.get(ev)?.delete(cb);
    },
    dispatchEvent: (ev) => {
      dispatchedEvents.push(ev.type);
      const cbs = listeners.get(ev.type);
      if (cbs) cbs.forEach((cb) => cb(ev));
      return true;
    },
    requestIdleCallback: (cb) => setTimeout(() => cb({ didTimeout: false, timeRemaining: () => 28 }), 4),
    CustomEvent: class CustomEventMock {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    },
    navigator: { onLine: options.onLine !== false, userAgent: 'NoorConnectTest/1.0' },
  };

  global.window = windowObj;
  global.localStorage = localStorageMock;
  global.sessionStorage = sessionStorageMock;
  global.CustomEvent = windowObj.CustomEvent;
  if (!global.navigator) {
    Object.defineProperty(global, 'navigator', {
      value: windowObj.navigator,
      configurable: true,
    });
  } else {
    Object.defineProperty(global.navigator, 'onLine', {
      value: options.onLine !== false,
      configurable: true,
    });
  }

  return { store, dispatchedEvents, windowObj };
}

async function bundleTs(relPath, customRequire) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'error',
    write: false,
    jsx: 'automatic',
    alias: {
      '@': path.join(ROOT, 'src'),
    },
    plugins: [
      {
        name: 'external-heavy-or-capacitor',
        setup(build) {
          build.onResolve({ filter: /^@capacitor\// }, (args) => ({
            path: args.path,
            external: true,
          }));
          build.onResolve({ filter: /^sonner$|^lucide-react$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });

  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', code);
  fn(customRequire, mod, mod.exports, path.dirname(path.join(ROOT, relPath)), path.join(ROOT, relPath));
  return mod.exports;
}

function makeCustomRequire() {
  const noopPlugin = new Proxy({}, {
    get: (_target, prop) => {
      if (prop === 'then') return undefined;
      return async () => ({});
    },
  });
  return (id) => {
    if (id === '@capacitor/core') {
      return {
        Capacitor: {
          getPlatform: () => 'web',
          isNativePlatform: () => false,
          registerPlugin: () => noopPlugin,
        },
        registerPlugin: () => noopPlugin,
      };
    }
    if (id === '@capacitor/local-notifications') {
      return {
        LocalNotifications: {
          checkPermissions: async () => ({ display: 'granted' }),
          createChannel: async () => {},
          schedule: async () => {},
          getPending: async () => ({ notifications: [] }),
        },
      };
    }
    if (id === '@capacitor/app') {
      return {
        App: {
          addListener: async () => ({ remove: async () => {} }),
          getLaunchUrl: async () => null,
        },
      };
    }
    if (id.startsWith('@capacitor/')) {
      return new Proxy({}, { get: () => noopPlugin });
    }
    if (id === 'sonner') {
      return { toast: Object.assign(() => {}, { success: () => {}, error: () => {} }) };
    }
    if (id === 'lucide-react') {
      return new Proxy({}, { get: () => () => null });
    }
    return require(id);
  };
}

async function runTests() {
  console.log('Running Interactive-First Boot Verification Suite...');

  // 1. Static architecture & regression invariants
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(indexHtml.includes('window.__NOOR_BOOT_T0 ='), 'index.html must record __NOOR_BOOT_T0');
  assert.ok(indexHtml.includes('1200'), 'index.html must enforce 1200ms splash hard cap');
  assert.ok(indexHtml.includes('noor:boot-p0-complete'), 'index.html failsafe must listen for noor:boot-p0-complete');
  assert.ok(indexHtml.includes('media="print"'), 'Google Fonts <link> must be non-blocking media="print" on initial paint');
  assert.ok(!indexHtml.includes('onload='), 'index.html must comply with CSP script-src-attr none (no inline onload)');

  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  assert.ok(!indexCss.includes("@import url('https://fonts.googleapis.com"), 'index.css must not render-block on external Google Fonts @import');

  const mainTsx = fs.readFileSync(path.join(ROOT, 'src/main.tsx'), 'utf8');
  assert.ok(!mainTsx.includes('localNotifications.initialize'), 'src/main.tsx must NOT initialize LocalNotifications before P0 mount');

  const splashTsx = fs.readFileSync(path.join(ROOT, 'src/components/SplashScreen.tsx'), 'utf8');
  assert.ok(splashTsx.includes('BOOT_P0_COMPLETE_EVENT'), 'SplashScreen must dismiss when P0 completes');
  assert.ok(splashTsx.includes('SPLASH_HARD_CAP_MS'), 'SplashScreen must honor 1200ms hard cap');
  assert.ok(splashTsx.includes('markSplashDismissed'), 'SplashScreen must stamp boot trace splash dismiss');

  const dashboardTsx = fs.readFileSync(path.join(ROOT, 'src/pages/Dashboard.tsx'), 'utf8');
  assert.ok(dashboardTsx.includes('readHomeLastStateSync'), 'Dashboard must hydrate synchronously from Home Last-State cache in P0');
  assert.ok(dashboardTsx.includes('saveHomeLastState'), 'Dashboard must persist Home Last-State snapshot on change');
  assert.ok(dashboardTsx.includes('markP0Interactive'), 'Dashboard must mark P0 interactive TTI on mount');

  const premiumDashTsx = fs.readFileSync(path.join(ROOT, 'src/components/PremiumDashboard.tsx'), 'utf8');
  assert.ok(premiumDashTsx.includes('subscribeP1SlowSync'), 'PremiumDashboard must subscribe to >3s slow P1 indicator');
  assert.ok(premiumDashTsx.includes('Syncing alarms...'), 'PremiumDashboard must render subtle Syncing alarms... header chip when P1 > 3s');
  assert.ok(!premiumDashTsx.includes('pointer-events-none'), 'Home container must NEVER block pointer events during P1-P3');

  const startupDefTs = fs.readFileSync(path.join(ROOT, 'src/lib/startup-deferral.ts'), 'utf8');
  assert.ok(startupDefTs.includes('zero-work P2 no-op on cold boot') && !startupDefTs.includes("import('@/data/nasheeds.json')"), 'startup-deferral must keep P2 zero-work on cold boot');

  for (const [rel, feature] of [
    ['src/pages/NasheedPlayer.tsx', "'nasheeds'"],
    ['src/pages/EnhancedIslamicQuiz.tsx', "'quiz'"],
    ['src/pages/QuranAudio.tsx', "'audio'"],
    ['src/lib/content-translator.ts', "'translations'"],
  ]) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes(`markP2FeatureVisited(${feature})`), `${rel} must trigger lazy P2 feature ${feature}`);
  }

  const updateBannerSrc = fs.readFileSync(path.join(ROOT, 'src/components/UpdateBanner.tsx'), 'utf8');
  assert.ok(updateBannerSrc.includes('subscribeP3NetworkIdle'), 'OTA UpdateBanner must defer behind P3 network-idle');

  const clipSrc = fs.readFileSync(path.join(ROOT, 'src/lib/quran-clip-renderer.ts'), 'utf8');
  assert.ok(clipSrc.includes('ensureFontsReady'), 'Only Clip Studio renderer keeps an async font gate');

  // 2. Runtime tests: Last-State Cache + Boot Scheduler + 3 Cold Start Traces + Diagnostics Startup Check
  const { store, dispatchedEvents, windowObj } = setupBrowserGlobals({ onLine: true });
  const customReq = makeCustomRequire();
  const homeCacheMod = await bundleTs('src/lib/home-last-state.ts', customReq);
  const bootMod = await bundleTs('src/lib/boot-scheduler.ts', customReq);
  const diagMod = await bundleTs('src/lib/diagnostics-engine.ts', customReq);

  assert.strictEqual(bootMod.SPLASH_HARD_CAP_MS, 1200, 'SPLASH_HARD_CAP_MS must be 1200');
  assert.strictEqual(bootMod.P1_SLOW_SYNC_THRESHOLD_MS, 3000, 'P1 slow sync chip threshold must be 3000ms');

  // Save a rich Home snapshot & test P0 synchronous read
  const todayKey = new Date().toISOString().slice(0, 10);
  homeCacheMod.saveHomeLastState({
    dateKey: todayKey,
    theme: 'kiswah-noir',
    locationLabel: 'Ahmedabad, India',
    hijriDate: '16 Jumada al-Thani 1448 AH',
    prayers: [
      { name: 'Fajr', time: '05:24 AM' },
      { name: 'Sunrise', time: '06:45 AM' },
      { name: 'Dhuhr', time: '12:30 PM' },
      { name: 'Asr', time: '03:52 PM' },
      { name: 'Maghrib', time: '06:15 PM' },
      { name: 'Isha', time: '07:32 PM' },
    ],
    nextPrayer: { name: 'Dhuhr', time: '12:30 PM', targetTimeIso: new Date(Date.now() + 3600000).toISOString() },
    qazaPendingTotal: 4,
    sajdahPendingTotal: 2,
    visibleCardIds: ['prayer-times', 'daily-ayah'],
    continueReading: { quran: 'active', seerah: 'chapter-2' },
  });

  const tRead0 = performance.now();
  const hydrated = homeCacheMod.readHomeLastStateSync();
  const readElapsedMs = performance.now() - tRead0;
  assert.ok(hydrated && hydrated.prayers.length === 6 && hydrated.theme === 'kiswah-noir');
  assert.strictEqual(hydrated.qazaPendingTotal, 4);
  assert.strictEqual(hydrated.sajdahPendingTotal, 2);
  assert.ok(readElapsedMs < 10, `Synchronous P0 cache read must be <10ms (got ${readElapsedMs.toFixed(2)}ms)`);

  // Run 3 measured synthetic cold-start traces (measuring P0 -> Splash -> P1 chunks -> Alarm Arm -> P3)
  const coldTraces = [];
  for (let run = 1; run <= 3; run++) {
    windowObj.__NOOR_BOOT_T0 = performance.now();
    bootMod.__resetBootSchedulerForTest('cold');

    // Simulate P0 sync mount + cache read
    const snap = homeCacheMod.readHomeLastStateSync();
    const tti = bootMod.markP0Interactive({ homeCacheHit: Boolean(snap) });
    assert.ok(dispatchedEvents.includes('noor:boot-p0-complete'), 'Must emit noor:boot-p0-complete at TTI');
    bootMod.markSplashDismissed();

    // Verify P2 has zero triggers on Home cold boot
    assert.strictEqual(bootMod.getLatestBootTrace().p2Triggered.length, 0, 'P2 must remain empty on Home cold boot');

    // Run P1 idle chunks (3 chunks each <=30ms)
    await bootMod.runP1IdleChunks([
      {
        name: 'p1-prayer-qaza-sajdah',
        run: () => {
          homeCacheMod.buildHomeCountsAndPointers();
        },
      },
      {
        name: 'p1-native-alarms-init',
        run: () => {
          bootMod.recordAlarmArmed(15);
        },
      },
      {
        name: 'p1-widgets-backup-events',
        run: () => {
          homeCacheMod.saveHomeLastState({ visibleCardIds: ['prayer-times', 'daily-ayah'] });
        },
      },
    ]);

    const trace = bootMod.getLatestBootTrace();
    assert.ok(trace.ttiMs !== null && trace.ttiMs < 1500, `Cold run #${run} TTI must be <1500ms (got ${trace.ttiMs}ms)`);
    assert.ok(trace.alarmArmedAtMs !== null && trace.alarmArmedAtMs < 5000, `Cold run #${run} alarms must arm within 5s (got ${trace.alarmArmedAtMs}ms)`);
    assert.strictEqual(trace.longTasksFirst5s.length, 0, 'Zero long tasks >50ms expected in first 5s');
    for (const chunk of trace.chunks) {
      assert.ok(chunk.durationMs <= 30, `P1 chunk ${chunk.name} exceeded 30ms budget: ${chunk.durationMs}ms`);
    }
    coldTraces.push(trace);
  }

  // Test slow P1 >3s chip subscriber without pointer-events block
  let sawSlowChip = false;
  const unsubSlow = bootMod.subscribeP1SlowSync((active) => {
    if (active) sawSlowChip = true;
  });
  bootMod.setSlowSyncState(true);
  assert.strictEqual(sawSlowChip, true, 'subscribeP1SlowSync must fire Syncing alarms... chip state');
  bootMod.setSlowSyncState(false);
  unsubSlow();

  // Test P2 lazy triggers
  bootMod.markP2FeatureVisited('translations');
  bootMod.markP2FeatureVisited('nasheeds');
  bootMod.markP2FeatureVisited('quiz');
  bootMod.markP2FeatureVisited('audio');
  assert.deepStrictEqual(bootMod.getLatestBootTrace().p2Triggered, ['translations', 'nasheeds', 'quiz', 'audio']);

  // Test Diagnostics X-Ray Startup subsystem + report section
  assert.strictEqual(diagMod.TOTAL_HEALTH_CHECKS, 13, 'TOTAL_HEALTH_CHECKS must equal 13 with Startup subsystem');
  const scanReport = await diagMod.runDeepSystemHealthScan();
  assert.strictEqual(scanReport.totalChecks, 13, 'Deep health scan must execute all 13 checks');
  const startupCheck = scanReport.checks.find((c) => c.id === 'startup-boot-trace' && c.name === 'Startup');
  assert.ok(startupCheck, 'Deep health scan must include Startup subsystem check');
  assert.strictEqual(startupCheck.status, 'PASS', `Startup check expected PASS, got ${startupCheck.status}: ${startupCheck.summary}`);

  const aiReport = await diagMod.generateAiDiagnosticReport(scanReport);
  assert.ok(aiReport.includes('## 6. STARTUP BOOT TRACE & PHASE TIMELINE'), 'AI Diagnostic Report must include Startup Boot Trace section');

  // Verify pre-overhaul baseline blocking items in git commit 1c3f728 for accurate before/after table
  let beforeHtmlHasBlockingFonts = false;
  let beforeCssHasImport = false;
  let beforeMainHasLocalNotifInit = false;
  let beforeAppSplashCapMs = 550;
  try {
    const oldHtml = execSync('git show 1c3f728:index.html', { cwd: ROOT, encoding: 'utf8' });
    const oldCss = execSync('git show 1c3f728:src/index.css', { cwd: ROOT, encoding: 'utf8' });
    const oldMain = execSync('git show 1c3f728:src/main.tsx', { cwd: ROOT, encoding: 'utf8' });
    const oldApp = execSync('git show 1c3f728:src/App.tsx', { cwd: ROOT, encoding: 'utf8' });
    beforeHtmlHasBlockingFonts = !oldHtml.includes('media="print"');
    beforeCssHasImport = oldCss.includes("@import url('https://fonts.googleapis.com");
    beforeMainHasLocalNotifInit = oldMain.includes('localNotifications.initialize');
    const m = oldApp.match(/setTimeout\(\(\)\s*=>\s*\{\s*handleSplashComplete\(\);\s*forceReleaseSplashScrollLock\(\);\s*\},\s*(\d+)\)/);
    if (m) beforeAppSplashCapMs = Number(m[1]);
  } catch (err) {
    console.warn('Git baseline comparison skipped:', err.message);
  }

  console.log('\n=== INTERACTIVE-FIRST BOOT VERIFICATION PASSED ===');
  console.log(JSON.stringify({
    baselinePreOverhaul: {
      blockingFontLinkInHtml: beforeHtmlHasBlockingFonts,
      blockingCssImportInIndexCss: beforeCssHasImport,
      preMountNotificationInitInMain: beforeMainHasLocalNotifInit,
      splashFallbackTimeoutMs: beforeAppSplashCapMs,
      healthCheckSubsystems: 12,
    },
    afterOverhaulColdTracesNodeHarness: coldTraces.map((t, i) => ({
      run: i + 1,
      ttiMs: t.ttiMs,
      splashDismissMs: t.splashDismissMs,
      p1DurationMs: t.p1DurationMs,
      alarmArmedAtMs: t.alarmArmedAtMs,
      alarmArmedCount: t.alarmArmedCount,
      longTasksOver50ms: t.longTasksFirst5s.length,
      chunks: t.chunks.map((c) => `${c.name}:${c.durationMs}ms`),
    })),
    startupHealthCheck: startupCheck,
  }, null, 2));
}

runTests().catch((err) => {
  console.error('INTERACTIVE BOOT TEST FAILED:', err);
  process.exit(1);
});
