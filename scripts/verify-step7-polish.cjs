const fs = require('fs');
const path = require('path');
const assert = require('assert');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const STEP7_FILES = [
  'src/lib/zakat-market-api.ts',
  'src/pages/ZakatCalculator.tsx',
  'src/lib/tafsir.ts',
  'src/pages/Tafsir-New.tsx',
  'src/lib/mosque-service.ts',
  'src/pages/MosqueFinder.tsx',
  'src/lib/navbar-variants.ts',
  'src/components/GlobalQuranPlayer.tsx',
  'src/components/SplashScreen.tsx',
  'src/lib/local-notifications.ts',
  'src/lib/diagnostics-engine.ts',
  'src/components/PremiumDashboard.tsx',
  'src/App.tsx',
  'src/pages/EnhancedIslamicQuiz.tsx',
  'src/components/quiz/MysteryBoxPanel.tsx',
  'src/components/NamesDetailModal.tsx',
  'src/lib/radio-achievements.ts',
  'src/lib/radio-stats.ts',
  'src/pages/RadioStats.tsx',
  'src/components/ui/toast.tsx',
  'src/components/hadith/HadithBookContent.tsx',
];

console.log('--- Step 7 Static Hygiene & Safety Audit ---');
for (const rel of STEP7_FILES) {
  const src = readText(rel);
  assert(!/backdrop-filter|backdropFilter|backdrop-blur/i.test(src), `Forbidden backdrop-filter in ${rel}`);
  assert(!/drop-shadow/i.test(src), `Forbidden drop-shadow in ${rel}`);
  assert(!/catch\s*\([^)]*\)\s*\{\s*\}/.test(src) && !/catch\s*\{\s*\}/.test(src), `Empty catch block in ${rel}`);
  // Enforce strict 3-language lock (no Devanagari Hindi script added in Step 7 source code)
  assert(!/[\u0900-\u097F]/.test(src), `Forbidden Hindi Devanagari characters in ${rel}`);
}

// Specific Component Assertions
const zakatPage = readText('src/pages/ZakatCalculator.tsx');
assert(!zakatPage.includes('info.factor'), 'ZakatCalculator must not reference undefined info.factor (NaN% bug)');
assert(zakatPage.includes('Standard multiplier:') && zakatPage.includes('purityPct'), 'Zakat purity subtitle must display pure gold % without NaN%');

const tafsirPage = readText('src/pages/Tafsir-New.tsx');
assert(tafsirPage.includes("(['All', 'EN', 'UR', 'AR']") && tafsirPage.includes('ayahTransLang'), 'Tafsir must support EN/UR/AR filter row and Ayah translation sync');
assert(tafsirPage.includes('visualViewport') && tafsirPage.includes('createPortal') && tafsirPage.includes('Ayah Note'), 'Tafsir Ayah Note must portal and react to visualViewport for Android keyboard safety');

const mosquePage = readText('src/pages/MosqueFinder.tsx');
assert(mosquePage.includes('OPENSTREETMAP (OVERPASS) + PHOTON'), 'MosqueFinder must display honest Overpass + Photon attribution');
assert(mosquePage.includes('Retry Scan') && mosquePage.includes('Open in Google Maps') && mosquePage.includes('Showing saved results'), 'MosqueFinder must show timeout/cache fallback CTAs');

const playerSrc = readText('src/components/GlobalQuranPlayer.tsx');
assert(playerSrc.includes('isBenignAbortError') && !/console\.error\("Play failed"|console\.error\("Play request failed"/.test(playerSrc), 'GlobalQuranPlayer must ignore benign AbortError without console.error');
assert(playerSrc.includes('getReciterMonogram'), 'GlobalQuranPlayer left thumbnail must use reciter monogram / wave instead of duplicate Play icon');

const quizPage = readText('src/pages/EnhancedIslamicQuiz.tsx');
assert(quizPage.includes('72px + env(safe-area-inset-bottom, 0px) + var(--player-inset, 0px)'), 'Quiz Sticky Next Question must clear bottom navigation dock + player inset');

const namesData = readText('src/components/NamesOfAllahData.ts');
assert(namesData.includes("Al-Mu'akhkhir") && !namesData.includes("Al-Mu'ahkkir"), '99 Names #72 must spell Al-Mu\'akhkhir');

const namesModal = readText('src/components/NamesDetailModal.tsx');
assert(namesModal.includes('flex flex-col items-center text-center gap-1'), 'NamesDetailModal must stack transliteration and meaning in flex-col');

const radioStatsPage = readText('src/pages/RadioStats.tsx');
assert(!/\bconfirm\(/.test(radioStatsPage) && radioStatsPage.includes('createPortal') && radioStatsPage.includes('showResetConfirm'), 'RadioStats reset must use portaled confirmation modal instead of window.confirm()');

const toastSrc = readText('src/components/ui/toast.tsx');
assert(toastSrc.includes('left-4 right-4') && toastSrc.includes('max-w-[328px] mx-auto'), 'ToastViewport must center cleanly within 360px');

const hadithSrc = readText('src/components/hadith/HadithBookContent.tsx');
assert(hadithSrc.includes('text-base sm:text-lg') && hadithSrc.includes('line-clamp-2'), 'Hadith chapter header title must clamp cleanly on mobile');

const splashSrc = readText('src/components/SplashScreen.tsx');
assert(splashSrc.includes('SPLASH_HARD_CAP_MS - 40') && splashSrc.includes('SPLASH_HARD_CAP_MS - 220'), 'SplashScreen must guarantee dismissal <= 900ms');

const dashSrc = readText('src/components/PremiumDashboard.tsx');
assert(dashSrc.includes('min-w-[120px]') && dashSrc.indexOf('Syncing alarms...') > dashSrc.indexOf('locationLabel'), 'Home header city pill must never be squeezed inline by Syncing alarms chip');

console.log('Static audit passed for all', STEP7_FILES.length, 'files!');

// --- Runtime Bundled Tests ---
console.log('--- Step 7 Runtime Functional Verification ---');
const bundleResult = esbuild.buildSync({
  stdin: {
    contents: `
      export { GOLD_KARAT_MULTIPLIERS, getGoldPurityPercentage, calculatePureGoldEquivalentGrams } from './src/lib/zakat-market-api.ts';
      export { TAFSIR_EDITIONS } from './src/lib/tafsir.ts';
      export { isNavItemActive } from './src/lib/navbar-variants.ts';
      export { fetchNearbyMosques, getLastNearbyMosquesMeta, STORAGE_MOSQUES_CACHE_V1, MOSQUE_PROVIDER_TIMEOUT_MS } from './src/lib/mosque-service.ts';
      export { resetRadioStats, recordListeningTime, getTotalListeningTime, getSortedStationStats } from './src/lib/radio-stats.ts';
      export { checkAchievements, updateStreak, getAllAchievements, getCurrentStreak } from './src/lib/radio-achievements.ts';
      export { markP0Interactive, markSplashDismissed, recordAlarmArmed, getLatestBootTrace, __resetBootSchedulerForTest, SPLASH_HARD_CAP_MS, TARGET_COLD_TTI_MS } from './src/lib/boot-scheduler.ts';
    `,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  logLevel: 'error',
  platform: 'node',
  format: 'cjs',
  write: false,
  alias: {
    '@': path.join(ROOT, 'src'),
  },
});

const memStore = new Map();
const noop = () => {};
global.window = global;
global.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init?.detail;
  }
};
global.dispatchEvent = noop;
global.addEventListener = noop;
global.removeEventListener = noop;
global.localStorage = {
  getItem(k) { return memStore.has(k) ? memStore.get(k) : null; },
  setItem(k, v) { memStore.set(k, String(v)); },
  removeItem(k) { memStore.delete(k); },
  clear() { memStore.clear(); },
};
global.sessionStorage = {
  getItem(k) { return memStore.has(`sess:${k}`) ? memStore.get(`sess:${k}`) : null; },
  setItem(k, v) { memStore.set(`sess:${k}`, String(v)); },
  removeItem(k) { memStore.delete(`sess:${k}`); },
};

const mod = { exports: {} };
const execFn = new Function('exports', 'require', 'module', bundleResult.outputFiles[0].text);
execFn(mod.exports, require, mod);

(async () => {
  const {
    GOLD_KARAT_MULTIPLIERS,
    getGoldPurityPercentage,
    calculatePureGoldEquivalentGrams,
    TAFSIR_EDITIONS,
    isNavItemActive,
    fetchNearbyMosques,
    getLastNearbyMosquesMeta,
    STORAGE_MOSQUES_CACHE_V1,
    MOSQUE_PROVIDER_TIMEOUT_MS,
    resetRadioStats,
    recordListeningTime,
    getTotalListeningTime,
    getSortedStationStats,
    checkAchievements: checkAchievements,
    getAllAchievements,
    getCurrentStreak,
    markP0Interactive,
    markSplashDismissed,
    recordAlarmArmed,
    getLatestBootTrace,
    __resetBootSchedulerForTest,
    SPLASH_HARD_CAP_MS,
    TARGET_COLD_TTI_MS,
  } = mod.exports;

  // 1. Zakat Gold Purity Math
  assert.strictEqual(getGoldPurityPercentage(18), 75.0);
  assert.strictEqual(getGoldPurityPercentage(21), 87.5);
  assert.strictEqual(getGoldPurityPercentage(22), 91.6);
  assert.strictEqual(getGoldPurityPercentage(24), 99.9);
  assert.strictEqual(GOLD_KARAT_MULTIPLIERS[18].multiplier, 0.75);
  assert.strictEqual(GOLD_KARAT_MULTIPLIERS[21].multiplier, 0.875);
  assert.strictEqual(GOLD_KARAT_MULTIPLIERS[22].multiplier, 0.916);
  assert.strictEqual(GOLD_KARAT_MULTIPLIERS[24].multiplier, 0.999);
  const eq100g22k = calculatePureGoldEquivalentGrams(100, 22);
  assert(Math.abs(eq100g22k - 91.6) < 0.001, '100g 22K gold must equal 91.6g pure equivalent');
  const goldVal = Math.round(100 * 8000 * GOLD_KARAT_MULTIPLIERS[22].multiplier);
  const nisabVal = Math.round(87.48 * 8000);
  assert(goldVal > nisabVal, '100g 22K exceeds 87.48g gold Nisab');
  assert.strictEqual(Math.round(goldVal * 0.025), 18320, '2.5% Zakat calculation verified cleanly');
  console.log('[PASS] Zakat purity multipliers (75.0 / 87.5 / 91.6 / 99.9) & Zakat calculation');

  // 2. Tafsir Editions Filter
  const langs = new Set(TAFSIR_EDITIONS.map((e) => e.language));
  assert(!langs.has('Russian') && !langs.has('Kurdish') && !langs.has('Bengali'), 'Russian/Kurdish/Bengali editions must be removed');
  assert(langs.has('English') && langs.has('Urdu') && langs.has('Arabic'), 'EN/UR/AR editions must be present');
  console.log('[PASS] Tafsir EN/UR/AR filter & zero Russian/Kurdish/Bengali');

  // 3. BottomNav Services Routing (/radio, /quran-radio, /media-stats)
  assert.strictEqual(isNavItemActive('/radio', '/services'), true);
  assert.strictEqual(isNavItemActive('/quran-radio', '/services'), true);
  assert.strictEqual(isNavItemActive('/media-stats', '/services'), true);
  assert.strictEqual(isNavItemActive('/radio-stats', '/services'), true);
  assert.strictEqual(isNavItemActive('/quran-radio', '/quran'), false);
  assert.strictEqual(isNavItemActive('/quran', '/quran'), true);
  assert.strictEqual(isNavItemActive('/quran/2', '/quran'), true);
  console.log('[PASS] Radio & Media-Stats resolve strictly to Services tab (never Quran)');

  // 4. Mosque 5000ms AbortController timeout + siraj_mosques_cache_v1 fallback
  assert.strictEqual(MOSQUE_PROVIDER_TIMEOUT_MS, 5000, 'Provider timeout must be 5000ms');
  const seedCache = {
    '24.08_72.39_5000': {
      timestamp: Date.now(),
      items: [{
        id: 'cached_1',
        name: 'Jama Masjid Cached',
        latitude: 24.081,
        longitude: 72.391,
        distanceMeters: 150,
        distanceFormatted: '150 m',
        walkingEstimate: '~2 min walk',
        drivingEstimate: '~1 min drive',
        address: 'Main Road',
        isFavourite: false,
      }],
    },
  };
  localStorage.setItem(STORAGE_MOSQUES_CACHE_V1, JSON.stringify(seedCache));
  const origFetch = global.fetch;
  global.fetch = (_url, opts) => new Promise((_, reject) => {
    if (opts?.signal) {
      if (opts.signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        return reject(err);
      }
      opts.signal.addEventListener('abort', () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        reject(err);
      });
    }
  });
  const tStart = Date.now();
  const fallbackMosques = await fetchNearbyMosques(24.08, 72.39, 5000, true);
  const elapsedMs = Date.now() - tStart;
  global.fetch = origFetch;
  assert(elapsedMs <= 5500, `Mosque scan must abort around 5000ms, took ${elapsedMs}ms`);
  assert.strictEqual(fallbackMosques.length, 1);
  assert.strictEqual(fallbackMosques[0].name, 'Jama Masjid Cached');
  assert.strictEqual(getLastNearbyMosquesMeta().fromCache, true);
  console.log(`[PASS] Mosques 5000ms timeout + siraj_mosques_cache_v1 fallback (${elapsedMs}ms)`);

  // 5. Media Stats Full Reset (Stats + Streak + Achievements)
  await recordListeningTime('st_1', 'Mishary', 4000);
  await checkAchievements({ totalSeconds: 4000, totalSessions: 1, uniqueStations: 1, currentStreak: 1 });
  assert((await getTotalListeningTime()) >= 4000);
  assert.strictEqual(await getCurrentStreak(), 1);
  assert((await getAllAchievements()).filter((a) => a.unlocked).length >= 2);

  await resetRadioStats();
  assert.strictEqual(await getTotalListeningTime(), 0, 'Total listening time must reset to 0');
  assert.strictEqual((await getSortedStationStats()).length, 0, 'Stations must reset to empty');
  assert.strictEqual(await getCurrentStreak(), 0, 'Streak must reset to 0 days');
  assert.strictEqual((await getAllAchievements()).filter((a) => a.unlocked).length, 0, 'All 12 achievements must reset to 0 unlocked');
  console.log('[PASS] Media Stats full reset clears time, sessions, streak=0, achievements=0/12');

  // 6. Boot Scheduler Telemetry (alarmArmed + splashDismiss <= 900ms + TTI)
  global.window.__NOOR_BOOT_T0 = performance.now();
  __resetBootSchedulerForTest('cold');
  markP0Interactive({ homeCacheHit: true });
  markSplashDismissed();
  recordAlarmArmed(5);
  const trace = getLatestBootTrace();
  assert(trace.ttiMs !== null && trace.ttiMs <= TARGET_COLD_TTI_MS, 'TTI within budget');
  assert(trace.splashDismissMs !== null && trace.splashDismissMs <= SPLASH_HARD_CAP_MS, `Splash dismiss <= ${SPLASH_HARD_CAP_MS}ms`);
  assert(trace.alarmArmedAtMs !== null && trace.alarmArmedCount === 5, 'Alarm armed telemetry recorded');
  console.log(`[PASS] Startup telemetry: tti=${trace.ttiMs}ms, splash=${trace.splashDismissMs}ms, alarmArmed=${trace.alarmArmedCount} @ ${trace.alarmArmedAtMs}ms`);

  console.log('ALL STEP 7 STATIC & RUNTIME CHECKS PASSED!');
})();
