/**
 * Fast Verification Suite for Hadith, Seerah & Prophets Reader + Translation Overhaul
 * Runs in <5s via Node + esbuild (no external server).
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function createStorageMock() {
  const map = new Map();
  return {
    get length() { return map.size; },
    clear() { map.clear(); },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(String(k), String(v)); },
    removeItem(k) { map.delete(String(k)); },
    key(i) { return Array.from(map.keys())[i] ?? null; },
  };
}

function bundleModule(entryRelPath, customRequire = require) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(ROOT, entryRelPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    alias: { '@': path.join(ROOT, 'src') },
    external: ['@capacitor/*', 'react', 'react-dom', 'react/jsx-runtime', 'lucide-react'],
    logLevel: 'error',
    loader: { '.ts': 'ts', '.tsx': 'tsx', '.json': 'json' },
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', code);
  fn(
    mod.exports,
    customRequire,
    mod,
    path.join(ROOT, entryRelPath),
    path.dirname(path.join(ROOT, entryRelPath)),
  );
  return mod.exports;
}

async function runTests() {
  const t0 = Date.now();
  const storage = createStorageMock();
  global.window = {
    localStorage: storage,
    sessionStorage: createStorageMock(),
    location: { pathname: '/', search: '', hash: '', origin: 'https://localhost' },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout,
    clearTimeout,
  };
  global.localStorage = storage;
  global.navigator = { language: 'en-US' };
  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };

  let nativeHttpCalls = [];
  let offlineMode = false;

  const capMocks = {
    '@capacitor/core': {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
      },
      CapacitorHttp: {
        async get(opts) {
          nativeHttpCalls.push(opts.url);
          if (offlineMode) throw new Error('Network offline');
          if (opts.url.includes('urd-bukhari/1.json')) {
            return {
              status: 200,
              data: { hadiths: [{ text: 'اعمال کا دارومدار نیتوں پر ہے ﷺ' }] },
            };
          }
          if (opts.url.includes('translate.googleapis.com')) {
            return {
              status: 200,
              data: [[['Translated chunk in Urdu [[SC_SWT]]', 'input']]],
            };
          }
          return { status: 404, data: null };
        },
      },
    },
    '@capacitor/preferences': {
      Preferences: {
        async get() { return { value: null }; },
        async set() {},
      },
    },
    react: {
      useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
      useEffect: () => {},
      useCallback: (fn) => fn,
      useMemo: (fn) => fn(),
      useContext: () => ({ language: 'en' }),
      createContext: () => ({ Provider: () => null }),
    },
  };

  const customReq = (id) => (capMocks[id] ? capMocks[id] : require(id));

  // 1. Typography, Sanitizer, Line Heights & Bidi Helper
  const typoMod = bundleModule('src/lib/reader-typography.ts', customReq);
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.bodySize, 15);
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.arabicSize, 22);
  assert.strictEqual(typoMod.getReaderLineHeight('en', 'standard'), 1.75);
  assert.strictEqual(typoMod.getReaderLineHeight('ur', 'standard'), 2.5);
  assert.strictEqual(typoMod.getArabicLineHeight('standard'), 2.0);

  const sanitized = typoMod.formatIslamicProse(
    'Indeed, whom Allah () would punish on that day\nwill know that Prophet () and Ibrahim () spoke truth ().',
    'en',
  );
  assert.ok(sanitized.includes('whom Allah (SWT) would punish'), `Got: ${sanitized}`);
  assert.ok(sanitized.includes('Prophet (ﷺ)'), `Got: ${sanitized}`);
  assert.ok(sanitized.includes('Ibrahim (AS)'), `Got: ${sanitized}`);
  assert.ok(!sanitized.includes('()'), `Found stray (): ${sanitized}`);
  assert.ok(!sanitized.includes('\n'), `Mid-sentence wrap newline not unwrapped: ${sanitized}`);

  assert.strictEqual(typoMod.getReaderBlockDirection('en').dir, 'auto');
  assert.strictEqual(typoMod.getReaderBlockDirection('en').textAlign, 'left');
  assert.strictEqual(typoMod.getReaderBlockDirection('gu').dir, 'auto');
  assert.strictEqual(typoMod.getReaderBlockDirection('hi').dir, 'auto');
  assert.strictEqual(typoMod.getReaderBlockDirection('ur').dir, 'auto');
  assert.strictEqual(typoMod.getReaderBlockDirection('ur').textAlign, 'right');
  console.log('[PASS] 1: Typography defaults (15px/22px), Allah () sanitizer & strict LTR/RTL direction');

  // 2. Hadith Grade Deduplication
  const hadithUtils = bundleModule('src/lib/hadith-utils.ts', customReq);
  assert.strictEqual(
    hadithUtils.dedupeHadithGrade('Sahih (Darussalam) (Darussalam)'),
    'Sahih (Darussalam)',
  );
  assert.strictEqual(
    hadithUtils.dedupeHadithGrade('Hasan Darussalam (Darussalam)'),
    'Hasan (Darussalam)',
  );
  assert.strictEqual(
    hadithUtils.dedupeHadithGrade('Sahih (Darussalam) [Bukhari 3615 and Muslim 2009] (Darussalam)'),
    'Sahih (Darussalam) [Bukhari 3615 and Muslim 2009]',
  );
  console.log('[PASS] 2: Duplicate (Darussalam) grading deduplicated cleanly');

  // 3. Chunk Splitting, Native CapacitorHttp, Authentic Urdu Hadith & Offline Fallback
  const translatorMod = bundleModule('src/lib/content-translator.ts', customReq);
  const longPara = 'Paragraph sentence one about Makkan patience and persistence. '.repeat(22).trim();
  const longChapter = [longPara, 'Second paragraph of Seerah. '.repeat(25).trim(), longPara].join('\n\n');
  const chunks = translatorMod.splitTranslationChunks(longChapter, 850);
  assert.ok(chunks.length >= 4, `Expected >= 4 chunks for 4000+ char chapter, got ${chunks.length}`);
  for (const ch of chunks) {
    assert.ok(ch.length <= 850, `Chunk exceeded 850 chars: ${ch.length}`);
  }
  assert.ok(
    translatorMod.isPureArabicBlock('فَأَمَّا عَادٌ فَاسْتَكْبَرُوا فِي الْأَرْضِ بِغَيْرِ الْحَقِّ'),
    'Pure Arabic verse must be detected & kept untouched',
  );

  // Authentic Urdu edition test via CapacitorHttp
  nativeHttpCalls = [];
  const urBukhari = await translatorMod.translateHadithContent({
    collection: 'bukhari',
    hadithNumber: '1',
    englishText: 'Actions are according to intentions.',
    targetLang: 'ur',
  });
  assert.strictEqual(urBukhari.actualLang, 'ur');
  assert.strictEqual(urBukhari.source, 'scholar-edition');
  assert.strictEqual(urBukhari.offlineFallback, false);
  assert.ok(nativeHttpCalls.some((u) => u.includes('urd-bukhari/1.json')), 'Expected CapacitorHttp call to urd-bukhari');

  // Progressive chunk streaming test + permanent cache reuse + offline honest fallback
  const updates = [];
  await translatorMod.streamBookTranslation({
    module: 'seerah',
    itemId: 'sirah-2',
    title: 'Early Prophethood',
    englishParagraphs: ['Paragraph one.', 'Paragraph two.', 'Paragraph three.', 'Paragraph four.'],
    targetLang: 'ur',
    onUpdate: (u) => updates.push(u),
  });
  assert.ok(updates.length >= 2, 'Expected progressive partial + final stream updates');
  assert.strictEqual(updates[updates.length - 1].isComplete, true);
  assert.strictEqual(updates[updates.length - 1].actualLang, 'ur');

  // Cached hit while offline MUST still return UR from cache
  offlineMode = true;
  nativeHttpCalls = [];
  const cachedUpdates = [];
  await translatorMod.streamBookTranslation({
    module: 'seerah',
    itemId: 'sirah-2',
    title: 'Early Prophethood',
    englishParagraphs: ['Paragraph one.', 'Paragraph two.', 'Paragraph three.', 'Paragraph four.'],
    targetLang: 'ur',
    onUpdate: (u) => cachedUpdates.push(u),
  });
  assert.strictEqual(nativeHttpCalls.length, 0, 'Cached chapter should load offline with 0 HTTP calls');
  assert.strictEqual(cachedUpdates[0].fromCache, true);
  assert.strictEqual(cachedUpdates[0].actualLang, 'ur');

  // Uncached offline chapter MUST fall back honestly with actualLang='en' & offlineFallback=true
  const offlineUpdates = [];
  await translatorMod.streamBookTranslation({
    module: 'prophet',
    itemId: 'prophet-nuh',
    title: 'Prophet Nuh (AS)',
    englishParagraphs: ['Whom Allah () warned.'],
    targetLang: 'ur',
    onUpdate: (u) => offlineUpdates.push(u),
  });
  const finalOffline = offlineUpdates[offlineUpdates.length - 1];
  assert.strictEqual(finalOffline.offlineFallback, true);
  assert.strictEqual(finalOffline.actualLang, 'en');
  assert.ok(finalOffline.text.includes('Allah (SWT)'), 'Offline English fallback must still sanitize Allah ()');
  console.log('[PASS] 3: CapacitorHttp chunked translation, urd-* scholar edition, cache hit & honest offline fallback');

  // 4. Prophets 24 Count Parity + Transparent Theme Backgrounds + FAB Positioning + Blur/Shadow Lock
  const i18nSrc = fs.readFileSync(path.join(ROOT, 'src/lib/i18n-ui.ts'), 'utf8');
  assert.ok(!i18nSrc.includes('25 Quranic') && !i18nSrc.includes('25 واقعات') && !i18nSrc.includes('২৫টি'), 'Stale 25 prophet count in i18n-ui.ts');
  assert.ok(i18nSrc.includes('24 Quranic stories'), 'Expected 24 Quranic stories');

  const servicesSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Services.tsx'), 'utf8');
  assert.ok(servicesSrc.includes('TOTAL_PROPHETS_COUNT'), 'Services.tsx must sync Prophets count from TOTAL_PROPHETS_COUNT');

  const seerahReaderSrc = fs.readFileSync(path.join(ROOT, 'src/pages/SeerahReader.tsx'), 'utf8');
  const qisasReaderSrc = fs.readFileSync(path.join(ROOT, 'src/pages/QisasReader.tsx'), 'utf8');
  assert.ok(seerahReaderSrc.includes('148px + env(safe-area-inset-bottom'), 'SeerahReader FAB must clear Next > pagination');
  assert.ok(qisasReaderSrc.includes('148px + env(safe-area-inset-bottom'), 'QisasReader FAB must clear Next > pagination');
  assert.ok(qisasReaderSrc.includes('getCachedProphetStorySync'), 'QisasReader must skip blank Loading flash via sync cache');

  const transparentFiles = [
    'src/components/hadith/HadithCollections.tsx',
    'src/components/hadith/HadithBookView.tsx',
    'src/components/hadith/HadithBookContent.tsx',
    'src/components/hadith/HadithDetail.tsx',
    'src/pages/HadithBookmarks.tsx',
    'src/pages/SeerahHome.tsx',
    'src/pages/SeerahReader.tsx',
    'src/pages/QisasHome.tsx',
    'src/pages/QisasReader.tsx',
  ];
  for (const rel of transparentFiles) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!src.includes('min-h-screen bg-background'), `${rel} has opaque bg-background hiding Royal theme patterns`);
    assert.ok(!src.includes('backdrop-blur') && !src.includes('backdrop-filter') && !src.includes('backdropFilter'), `Forbidden blur in ${rel}`);
    assert.ok(!src.includes('drop-shadow'), `Forbidden drop-shadow in ${rel}`);
  }

  for (const rel of ['src/lib/reader-typography.ts', 'src/lib/content-translator.ts', 'src/components/BookReaderControls.tsx']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!src.includes('backdrop-blur') && !src.includes('backdrop-filter') && !src.includes('backdropFilter'), `Forbidden blur in ${rel}`);
    assert.ok(!src.includes('drop-shadow'), `Forbidden drop-shadow in ${rel}`);
  }

  console.log('[PASS] 4: Prophets 24 count sync, FAB clearance, transparent theme canvases & 0 blur/drop-shadow');
  console.log(`ALL READER & TRANSLATION OVERHAUL CHECKS PASSED in ${Date.now() - t0}ms`);
}

runTests().catch((err) => {
  console.error('[FAIL] verify-reader-overhaul failed:', err);
  process.exit(1);
});
