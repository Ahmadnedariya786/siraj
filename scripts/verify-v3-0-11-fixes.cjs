/**
 * Automated Verification Suite for Siraj v3.0.11 Master Fix:
 *  - PART 1: Duas 360px horizontal viewport lock & native scroller (zero ScrollArea blowout)
 *  - PART 2: Complete Hindi removal (EN / UR / GU only) + localStorage 'hi' -> 'en' migration
 *  - PART 3: Habit Tracker Android Capacitor Filesystem + Share export, Copy JSON, Portaled Modal z-[9999], Copy fixes
 *  - PART 4: Sahih Muslim canonical #225 vs #4 lookup, Qisas synchronous 24-Prophet hydration, Startup Check #13 post-TTI window
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function createStorageMock(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get length() { return map.size; },
    clear() { map.clear(); },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    key(i) { return Array.from(map.keys())[i] ?? null; },
  };
}

const storage = createStorageMock({
  noor_content_lang_v1: 'hi',
  'app-language': 'hi',
  i18nextLng: 'hi',
  noor_prayer_hadith_lang: 'hi',
});

global.window = {
  localStorage: storage,
  location: { pathname: '/', search: '', hash: '', origin: 'https://localhost' },
  dispatchEvent() { return true; },
  addEventListener() {},
  removeEventListener() {},
};
global.localStorage = storage;
global.CustomEvent = class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
};
global.document = {
  documentElement: { dir: 'ltr', lang: 'en', style: {} },
  getElementsByTagName: () => [],
};
global.navigator = { language: 'en-US' };
global.performance = {
  now: () => 1200,
};

async function compileTs(relPath) {
  const res = await esbuild.build({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    alias: { '@': path.join(ROOT, 'src') },
    loader: { '.json': 'json' },
    logLevel: 'silent',
    define: {
      'import.meta.env': JSON.stringify({ BASE_URL: '/', DEV: false, PROD: true }),
    },
    plugins: [
      {
        name: 'vite-worker-stub',
        setup(build) {
          build.onResolve({ filter: /\?worker$/ }, (args) => ({
            path: args.path,
            namespace: 'worker-stub',
          }));
          build.onLoad({ filter: /.*/, namespace: 'worker-stub' }, () => ({
            contents: 'export default function WorkerStub() {}',
            loader: 'js',
          }));
        },
      },
    ],
  });
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', res.outputFiles[0].text);
  fn(require, mod, mod.exports);
  return mod.exports;
}

(async () => {
  console.log('Running Siraj v3.0.11 Master Fix Verification...');

  // ─── PART 1: Duas 360px Viewport Lock & Translucent Theme CSS ──────────
  const duasSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Duas.tsx'), 'utf8');
  assert.ok(duasSrc.includes('w-full max-w-full overflow-x-hidden bg-transparent'), 'Duas root must lock 360px horizontal overflow');
  assert.ok(!duasSrc.includes('ScrollArea'), 'Duas must NOT use Radix ScrollArea (caused ~900px blowout)');
  assert.ok(duasSrc.includes('overflow-x-auto no-scrollbar'), 'Duas category bar must use clean horizontal scroll container');
  assert.ok(duasSrc.includes('siraj-translucent-card'), 'Duas must use theme-aware translucent cards');
  assert.ok(!/backdrop-blur|backdrop-filter|backdropFilter/i.test(duasSrc), 'Duas must have zero backdrop-filter');
  assert.ok(!/drop-shadow/i.test(duasSrc), 'Duas must have zero SVG drop-shadow');
  assert.ok(!duasSrc.includes('हिन्दी') && !duasSrc.includes("'hi'"), 'Duas must have zero Hindi UI strings');

  // ─── PART 2: Hindi Removal App-Wide + Legacy 'hi' -> 'en' Migration ────
  const translator = await compileTs('src/lib/content-translator.ts');
  const langConfig = await compileTs('src/lib/language-config.ts');
  const prayerHadith = await compileTs('src/lib/prayer-hadith-i18n.ts');

  assert.deepStrictEqual(
    translator.CONTENT_LANGUAGES.map((l) => l.code),
    ['en', 'ur', 'gu'],
    'CONTENT_LANGUAGES must contain strictly en, ur, gu'
  );
  assert.ok(
    !('hi' in langConfig.LANGUAGES),
    'LANGUAGES must exclude hi'
  );
  assert.deepStrictEqual(
    prayerHadith.PRAYER_HADITH_LANG_OPTIONS.map((o) => o.id),
    ['ur', 'en', 'gu'],
    'PRAYER_HADITH_LANG_OPTIONS must contain strictly ur, en, gu'
  );

  // Migration check when localStorage had legacy 'hi'
  assert.strictEqual(translator.getStoredContentLang(), 'en', 'noor_content_lang_v1="hi" must migrate to "en"');
  assert.strictEqual(storage.getItem('noor_content_lang_v1'), 'en', 'migrated content lang must persist');
  assert.strictEqual(prayerHadith.getPrayerHadithLang(), 'en', 'noor_prayer_hadith_lang="hi" must migrate to "en"');
  assert.strictEqual(storage.getItem('noor_prayer_hadith_lang'), 'en', 'migrated prayer hadith lang must persist');

  // Ensure Java native PrayerHadithHelper also migrates 'hi' -> 'en'
  const javaHelper = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/PrayerHadithHelper.java'),
    'utf8'
  );
  assert.ok(javaHelper.includes('"hi".equals(lang)'), 'PrayerHadithHelper.java must safely migrate hi -> en');
  assert.ok(!javaHelper.includes('हिन्दी'), 'PrayerHadithHelper.java must contain zero Hindi strings');

  // Static sweep for any leftover Hindi selector pill/option across UI
  const uiDirs = ['src/pages', 'src/components', 'src/lib'];
  const walk = (d) => {
    let list = [];
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) list = list.concat(walk(rel));
      else if (/\.(ts|tsx)$/.test(e.name)) list.push(rel);
    }
    return list;
  };
  for (const rel of uiDirs.flatMap(walk)) {
    const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!/हिन्दी|हिं/.test(code), `Found leftover Hindi script label in ${rel}`);
    assert.ok(!/\bhi:\s*["'{]/.test(code), `Found leftover hi dictionary block in ${rel}`);
  }

  // ─── PART 3: Habit Tracker Native Export, Modal Portal & Polish ────────
  const habitSrc = fs.readFileSync(path.join(ROOT, 'src/pages/HabitTracker.tsx'), 'utf8');
  const habitLib = await compileTs('src/lib/habit-tracker.ts');
  assert.ok(habitSrc.includes('@capacitor/filesystem'), 'HabitTracker must import @capacitor/filesystem');
  assert.ok(habitSrc.includes('@capacitor/share'), 'HabitTracker must import @capacitor/share');
  assert.ok(habitSrc.includes('Directory.Cache') && habitSrc.includes('Share.share'), 'HabitTracker must write Cache JSON and invoke Share.share');
  assert.ok(habitSrc.includes('createPortal(') && habitSrc.includes('zIndex: 9999'), 'HabitTracker modal must render via createPortal at zIndex 9999 above radio player');
  assert.ok(habitSrc.includes('e.g. pages, mins'), 'Unit placeholder must be updated cleanly');
  assert.ok(!/backdrop-blur|backdrop-filter|backdropFilter/i.test(habitSrc), 'HabitTracker must have zero backdrop-filter');

  const maghribDefault = habitLib.DEFAULT_HABITS.find((h) => h.id === 'maghrib-prayer');
  assert.ok(maghribDefault, 'maghrib-prayer default habit must exist');
  assert.strictEqual(maghribDefault.description, 'Perform Maghrib on time');

  // ─── PART 4A: Sahih Muslim Scholar Urdu Canonical Numbering ────────────
  assert.strictEqual(
    translator.extractCanonicalHadithNumber('muslim', '4', 'Sahih Muslim 225', '2'),
    '225',
    'Book 2 Hadith 4 with reference "Sahih Muslim 225" must resolve to global 225'
  );
  assert.strictEqual(
    translator.extractCanonicalHadithNumber('muslim', '4', undefined, '2'),
    null,
    'Book 2 Hadith 4 without canonical reference must return null (no false global #4)'
  );
  assert.strictEqual(
    translator.extractCanonicalHadithNumber('muslim', '3', 'Sahih Muslim 224b', '2'),
    null,
    'Sub-narration suffix b..z must return null to avoid colliding with a narration'
  );
  assert.strictEqual(
    translator.extractCanonicalHadithNumber('muslim', '3a', 'Sahih Muslim 224a', '2'),
    '224',
    'Primary narration 224a resolves to canonical 224'
  );
  assert.strictEqual(
    translator.extractCanonicalHadithNumber('bukhari', '12', 'Sahih al-Bukhari 527', '9'),
    '527'
  );
  assert.strictEqual(
    translator.extractCanonicalHadithNumber('nawawi', '1', undefined, '1'),
    '1'
  );

  // ─── PART 4B: Blank Prophets List in Urdu (QisasHome synchronous load) ──
  const qisasData = await compileTs('src/data/qisas/index.ts');
  const syncProphets = qisasData.getCachedProphetListSync();
  assert.ok(Array.isArray(syncProphets) && syncProphets.length >= 3, 'getCachedProphetListSync must synchronously return initial prophets');
  const qisasHomeSrc = fs.readFileSync(path.join(ROOT, 'src/pages/QisasHome.tsx'), 'utf8');
  const prophetCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/qisas/ProphetCard.tsx'), 'utf8');
  assert.ok(qisasHomeSrc.includes('getCachedProphetListSync') && qisasHomeSrc.includes('loadProphetList'), 'QisasHome must hydrate synchronously and load all 24');
  assert.ok(!qisasHomeSrc.includes('initial={{ opacity: 0'), 'QisasHome must not hide cards at opacity: 0');
  assert.ok(!prophetCardSrc.includes('initial={{ opacity: 0'), 'ProphetCard must not hide at opacity: 0');

  // ─── PART 4C: Deep X-Ray Check #13 Startup Telemetry ───────────────────
  const bootScheduler = await compileTs('src/lib/boot-scheduler.ts');
  const appSrc = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
  const diagSrc = fs.readFileSync(path.join(ROOT, 'src/lib/diagnostics-engine.ts'), 'utf8');

  global.window.__NOOR_BOOT_LONG_TASKS = [
    { name: 'pre-tti-js-eval', startMs: 180, durationMs: 95 },
    { name: 'post-tti-heavy', startMs: 1450, durationMs: 65 },
  ];
  bootScheduler.markP0Interactive();
  const trace = bootScheduler.getLatestBootTrace();
  assert.strictEqual(
    trace.longTasksFirst5s.length,
    1,
    'BootTrace must include post-TTI task (1450ms) and exclude pre-TTI task (180ms)'
  );
  assert.strictEqual(trace.longTasksFirst5s[0].name, 'post-tti-heavy');
  const p1OrderIdxAlarm = appSrc.indexOf('p1-native-alarms-init');
  const p1OrderIdxPrayer = appSrc.indexOf('p1-prayer-qaza-sajdah');
  assert.ok(p1OrderIdxAlarm !== -1 && p1OrderIdxAlarm < p1OrderIdxPrayer, 'p1-native-alarms-init must run FIRST in runP1IdleChunks');
  assert.ok(diagSrc.includes('nativeAdhan.getStatus()'), 'Check #13 Startup must support live nativeAdhan.getStatus() check');

  console.log('ALL SIRAJ v3.0.11 VERIFICATION CHECKS PASSED!');
})();
