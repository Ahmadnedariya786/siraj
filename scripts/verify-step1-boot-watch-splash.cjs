/**
 * Fast Verification Gate — Final Step 1 of 7:
 * 1. Chunked staggered boot scheduler (P0 -> P1 t+350/900/1500 -> P3 t+2200+) + singleton guard + alarmArmed
 * 2. 60fps direct-ref self-correcting Hero Watch hands (zero per-second React setState re-renders)
 * 3. Single-stage 8-theme splash in index.html (both --bg-base & --accent pre-paint, <= 900ms hard cap)
 * 4. Zero backdrop-filter / SVG drop-shadow / empty catch in modified files
 *
 * Run: node scripts/verify-step1-boot-watch-splash.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

async function bundleTs(relPath) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'error',
    write: false,
    jsx: 'automatic',
    alias: { '@': path.join(ROOT, 'src') },
    plugins: [
      {
        name: 'mock-externals',
        setup(build) {
          build.onResolve({ filter: /^@capacitor\/|^react$|^lucide-react$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
        },
      },
    ],
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  const customReq = (id) => {
    if (id === '@capacitor/core') {
      return { Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' } };
    }
    if (id === '@capacitor/app') {
      return { App: { addListener: async () => ({ remove: async () => {} }) } };
    }
    if (id === 'react') {
      return {
        useEffect: () => {},
        useMemo: (fn) => fn(),
        useRef: (v) => ({ current: v }),
        useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
        memo: (c) => c,
      };
    }
    return require(id);
  };
  const fn = new Function('require', 'module', 'exports', '__dirname', '__filename', code);
  fn(customReq, mod, mod.exports, path.dirname(path.join(ROOT, relPath)), path.join(ROOT, relPath));
  return mod.exports;
}

async function run() {
  // 1. Verify Hero Watch uses direct-ref GPU transforms & initializes to real Date.now()
  const handsMod = await bundleTs('src/components/clocks/useAnalogClockHands.ts');
  const testDate = new Date(2026, 10, 28, 3, 15, 30, 500); // 03:15:30.500
  const angles = handsMod.computeClockAngles(testDate.getTime(), false);
  // Hour: (3 + 15.5083/60) * 30 = ~97.75 deg
  assert.ok(angles.hourAngle > 97 && angles.hourAngle < 99, `Unexpected hourAngle: ${angles.hourAngle}`);
  // Minute: (15 + 30.5/60) * 6 = ~93.05 deg
  assert.ok(angles.minuteAngle > 92.5 && angles.minuteAngle < 93.5, `Unexpected minuteAngle: ${angles.minuteAngle}`);
  // Second: 30.5 * 6 = 183 deg
  assert.ok(Math.abs(angles.secondAngle - 183) < 0.01, `Unexpected secondAngle: ${angles.secondAngle}`);
  // Shortest wrap delta across 350 -> 10 must be +20 (never -340)
  assert.strictEqual(handsMod.shortestAngleDelta(350, 10), 20);
  assert.strictEqual(handsMod.shortestAngleDelta(10, 350), -20);
  assert.strictEqual(handsMod.FRAME_GAP_CATCHUP_THRESHOLD_MS, 300);
  assert.strictEqual(handsMod.CATCHUP_EASE_DURATION_MS, 220);

  // Verify analog clocks & digital clocks have ZERO useClockSecondTick (no per-second React setState)
  const clockFiles = [
    'src/components/clocks/OttomanHeritageClock.tsx',
    'src/components/clocks/CrescentMoonClock.tsx',
    'src/components/clocks/HourWedgeClock.tsx',
    'src/components/clocks/PrayerArcClock.tsx',
    'src/components/clocks/DigitalBoldClock.tsx',
    'src/components/clocks/MosqueLedClock.tsx',
  ];
  for (const rel of clockFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!src.includes('useClockSecondTick'), `${rel} must NOT use per-second React setState hook`);
    assert.ok(src.includes('memo('), `${rel} must be React.memo wrapped`);
  }
  for (const rel of clockFiles.slice(0, 4)) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(src.includes('hourHandRef') && src.includes('minuteHandRef') && src.includes('secondHandRef'), `${rel} must bind direct hand refs`);
    assert.ok(src.includes("willChange: 'transform'"), `${rel} must set willChange: transform on hands`);
  }

  const premiumDashSrc = fs.readFileSync(path.join(ROOT, 'src/components/PremiumDashboard.tsx'), 'utf8');
  assert.ok(!premiumDashSrc.includes('useClockSecondTick'), 'PremiumDashboard must have zero per-second re-renders');

  // 2. Verify boot-scheduler.ts staggers P0 -> P1 -> P3 sequentially with singleton guard & alarmArmed
  const store = new Map();
  global.window = {
    __NOOR_BOOT_T0: performance.now(),
    __NOOR_BOOT_LONG_TASKS: [],
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    requestIdleCallback: (cb) => setTimeout(cb, 0),
    CustomEvent: class { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
  };
  global.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(String(k), String(v)),
    removeItem: (k) => store.delete(k),
  };
  global.sessionStorage = { getItem: () => null, setItem: () => {} };
  global.CustomEvent = global.window.CustomEvent;

  const bootMod = await bundleTs('src/lib/boot-scheduler.ts');
  bootMod.__resetBootSchedulerForTest('cold');
  assert.strictEqual(bootMod.markBootOrchestratorStarted(), true, 'First boot orchestrator start must succeed');
  assert.strictEqual(bootMod.markBootOrchestratorStarted(), false, 'Second boot orchestrator start must be blocked by singleton guard');
  assert.strictEqual(bootMod.P1_SW_ALARMS_DELAY_MS, 350);
  assert.strictEqual(bootMod.P1_WIDGET_SYNC_DELAY_MS, 900);
  assert.strictEqual(bootMod.P1_EVENTS_PRAYER_DELAY_MS, 1500);
  assert.strictEqual(bootMod.P3_NETWORK_IDLE_DELAY_MS, 2200);
  assert.strictEqual(bootMod.SPLASH_HARD_CAP_MS, 900);

  bootMod.__resetBootSchedulerForTest('cold');
  bootMod.markP0Interactive({ homeCacheHit: true });
  const order = [];
  await bootMod.runP1IdleChunks([
    { name: 'p1-sw-and-alarms', delayMs: 10, run: () => { order.push('alarms'); bootMod.recordAlarmArmed(35); } },
    { name: 'p1-widget-sync', delayMs: 20, run: () => { order.push('widgets'); } },
    { name: 'p1-events-and-stale-prayer', delayMs: 30, run: () => { order.push('events'); } },
  ]);
  // Attempt duplicate runP1IdleChunks -> must be ignored by singleton guard
  await bootMod.runP1IdleChunks([{ name: 'duplicate', run: () => { order.push('dup'); } }]);
  assert.deepStrictEqual(order, ['alarms', 'widgets', 'events'], 'P1 chunks must run sequentially once');
  const trace = bootMod.getLatestBootTrace();
  assert.strictEqual(trace.alarmArmedCount, 35);
  assert.ok(trace.alarmArmedAtMs !== null && trace.alarmArmedAtMs >= 0);

  // 3. Verify index.html maps all 8 Royal Theme IDs to both --bg-base & --accent and uses single-stage splash
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const requiredThemes = [
    'oxford-gold',
    'haramain-noir',
    'imperial-violet',
    'burgundy-velvet',
    'desert-scroll',
    'royal-sapphire',
    'madinah-emerald',
    'persian-indigo',
  ];
  for (const t of requiredThemes) {
    assert.ok(indexHtml.includes(`'${t}':`), `index.html pre-paint map missing theme ${t}`);
  }
  assert.ok(indexHtml.includes("setProperty('--bg-base'") && indexHtml.includes("setProperty('--accent'"), 'index.html must set both --bg-base and --accent pre-paint');
  assert.ok(!indexHtml.includes('boot-pre-paint-mark'), 'index.html must not have two-stage boot-pre-paint-mark');
  assert.ok(!indexHtml.includes('#150D2E'), 'index.html must not contain legacy purple #150D2E');

  // 4. Verify ZERO backdrop-filter / SVG drop-shadow / empty catch in all modified files
  const modifiedFiles = [
    'index.html',
    'src/main.tsx',
    'src/App.tsx',
    'src/components/SplashScreen.tsx',
    'src/components/SalamGreeting.tsx',
    'src/lib/boot-scheduler.ts',
    'src/lib/diagnostics-engine.ts',
    'src/components/clocks/useAnalogClockHands.ts',
    'src/components/clocks/ClockMinuteParts.tsx',
    'src/components/clocks/ClockRenderer.tsx',
    'src/components/clocks/ClockHero.tsx',
    ...clockFiles,
  ];
  for (const rel of modifiedFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!/backdrop-filter|backdrop-blur/i.test(src), `${rel} must NOT use backdrop-filter`);
    assert.ok(!/drop-shadow/i.test(src), `${rel} must NOT use drop-shadow`);
    assert.ok(!/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(src), `${rel} must NOT have empty catch blocks`);
  }

  console.log('ALL STEP 1 VERIFICATION CHECKS PASSED!');
}

run().catch((err) => {
  console.error('STEP 1 VERIFICATION FAILED:', err);
  process.exit(1);
});
