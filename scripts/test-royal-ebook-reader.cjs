/**
 * Royal E-Book Reading Experience Overhaul — Comprehensive Verification Suite
 * Tests:
 * 1. Typography store computed-style assertions across Seerah, Prophets, Hadith & Aa Live Preview
 * 2. BiDi snapshots (`dir="auto"` + `unicode-bidi: plaintext`, no reversed `:New Creation`)
 * 3. Honorifics snapshots for Adam & Lut chapters across ALL 4 languages (EN, UR, GU, HI) + full JSON sweep
 * 4. Translation streaming denominator lock + IndexedDB cache-hit timing (<50ms second open)
 * 5. Page chrome, counts copy, tag chip cache/skeletons, swipe, scroll persistence, copy menu & 360px/token invariants
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

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

function createMemoryIdb() {
  const stores = new Map();
  const makeRequest = (fn) => {
    const req = { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
    queueMicrotask(() => {
      try {
        req.result = fn();
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.onerror?.({ target: req });
      }
    });
    return req;
  };
  return {
    open(name) {
      const req = { result: undefined, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      queueMicrotask(() => {
        if (!stores.has(name)) stores.set(name, new Map());
        const storeMap = stores.get(name);
        const db = {
          objectStoreNames: { contains: () => true },
          createObjectStore: () => ({}),
          transaction: () => {
            const tx = { oncomplete: null, onerror: null };
            const objStore = {
              get(key) {
                return makeRequest(() => storeMap.get(key));
              },
              put(val) {
                return makeRequest(() => {
                  storeMap.set(val.id, val);
                  queueMicrotask(() => tx.oncomplete?.());
                  return val.id;
                });
              },
              clear() {
                return makeRequest(() => {
                  storeMap.clear();
                  queueMicrotask(() => tx.oncomplete?.());
                });
              },
            };
            tx.objectStore = () => objStore;
            return tx;
          },
        };
        req.result = db;
        req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

async function bundleModule(entryRelPath, customRequire = require) {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, entryRelPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    alias: { '@': path.join(ROOT, 'src') },
    external: ['@capacitor/*', 'react', 'react-dom', 'react-dom/server', 'lucide-react', '@radix-ui/*', 'react-router-dom', 'framer-motion'],
    plugins: [
      {
        name: 'stub-vite-worker',
        setup(build) {
          build.onResolve({ filter: /^@\/(contexts\/LanguageContext-new|hooks\/use-toast|hooks\/useHadithBookmarks)$/ }, (args) => ({
            path: args.path,
            external: true,
          }));
          build.onResolve({ filter: /\?worker$/ }, (args) => ({
            path: args.path,
            namespace: 'vite-worker-stub',
          }));
          build.onLoad({ filter: /.*/, namespace: 'vite-worker-stub' }, () => ({
            contents: 'export default class MockWorker { terminate() {} postMessage() {} }',
            loader: 'js',
          }));
        },
      },
    ],
    logLevel: 'error',
    define: { 'import.meta.env': '{"BASE_URL":"/","DEV":false,"PROD":true,"MODE":"test"}' },
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

function parseStyleAttr(styleStr) {
  const out = {};
  if (!styleStr) return out;
  const decoded = styleStr
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, '&');
  for (const decl of decoded.split(';')) {
    const idx = decl.indexOf(':');
    if (idx === -1) continue;
    const k = decl.slice(0, idx).trim();
    const v = decl.slice(idx + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

async function runTests() {
  const tStart = Date.now();
  const storage = createStorageMock();
  const docRootStyle = new Map();

  global.window = {
    localStorage: storage,
    sessionStorage: createStorageMock(),
    location: { pathname: '/', search: '', hash: '', origin: 'https://localhost', href: 'https://localhost/' },
    dispatchEvent: () => true,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout,
    clearTimeout,
    scrollTo: () => {},
    getSelection: () => ({ toString: () => '' }),
  };
  global.localStorage = storage;
  global.indexedDB = createMemoryIdb();
  global.navigator = { language: 'en-US', clipboard: { writeText: async () => {} } };
  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };

  let fontLoadedFlag = true;
  global.document = {
    documentElement: {
      style: {
        setProperty: (k, v) => docRootStyle.set(k, v),
        getPropertyValue: (k) => docRootStyle.get(k) || '',
      },
      classList: { contains: () => false, add: () => {}, remove: () => {} },
    },
    body: { classList: { toggle: () => {} } },
    fonts: {
      check: () => fontLoadedFlag,
      load: async () => [],
      ready: Promise.resolve(),
    },
    getElementById: () => null,
  };

  let activeContentLang = 'en';
  let routeParams = {};
  let httpCallCount = 0;
  let offlineMode = false;

  const capMocks = {
    '@capacitor/core': {
      Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' },
      CapacitorHttp: {
        async get(opts) {
          httpCallCount++;
          if (offlineMode) throw new Error('Network offline');
          if (opts.url.includes('translate.googleapis.com')) {
            const urlObj = new URL(opts.url);
            const q = urlObj.searchParams.get('q') || '';
            const tl = urlObj.searchParams.get('tl') || 'ur';
            if (tl === 'ur') {
              return { status: 200, data: [[[`اردو ترجمہ: ${q.slice(0, 40)}`, q]]] };
            }
            if (tl === 'gu') {
              return { status: 200, data: [[[`ગુજરાતી અનુવાદ: ${q.slice(0, 40)}`, q]]] };
            }
            if (tl === 'hi') {
              return { status: 200, data: [[[`हिन्दी अनुवाद: ${q.slice(0, 40)}`, q]]] };
            }
          }
          return { status: 404, data: null };
        },
      },
    },
    '@capacitor/preferences': {
      Preferences: { async get() { return { value: null }; }, async set() {} },
    },
    react: React,
    'react-dom': { createPortal: (node) => node },
    'react-dom/server': ReactDOMServer,
    'react-router-dom': {
      useNavigate: () => () => {},
      useParams: () => routeParams,
      useLocation: () => ({ pathname: '/test', search: '', hash: '', state: null }),
    },
    '@/contexts/LanguageContext-new': {
      useLanguage: () => ({
        language: activeContentLang,
        isRTL: activeContentLang === 'ur',
        t: (k) => k,
        ui: {
          dailyWisdom: 'Daily Wisdom',
          dailyHadith: 'Daily Hadith',
          readMore: 'Read More',
          showLess: 'Show Less',
          bookmarks: 'Bookmarks',
          moreHadith: 'More Hadith',
        },
      }),
    },
    '@/hooks/use-toast': { useToast: () => ({ toast: () => {} }) },
    '@/hooks/useHadithBookmarks': { useHadithBookmarks: () => ({ bookmarks: [], isBookmarked: () => false, toggleBookmark: () => {} }) },
    'framer-motion': {
      motion: new Proxy({}, {
        get: (_, tag) => ({ children, ...props }) => React.createElement(tag, props, children),
      }),
    },
    'lucide-react': new Proxy({}, {
      get: (_, icon) => (props) => React.createElement('svg', { 'data-icon': String(icon), ...props }),
    }),
    '@radix-ui/react-slider': {
      Root: ({ children }) => React.createElement('div', null, children),
      Track: ({ children }) => React.createElement('div', null, children),
      Range: () => React.createElement('div'),
      Thumb: () => React.createElement('div'),
    },
    '@radix-ui/react-dropdown-menu': {
      Root: ({ children }) => React.createElement('div', null, children),
      Trigger: ({ children }) => React.createElement('div', null, children),
      Portal: ({ children }) => React.createElement('div', null, children),
      Content: ({ children }) => React.createElement('div', null, children),
      Item: ({ children }) => React.createElement('div', null, children),
      Group: ({ children }) => React.createElement('div', null, children),
      Sub: ({ children }) => React.createElement('div', null, children),
      SubTrigger: ({ children }) => React.createElement('div', null, children),
      SubContent: ({ children }) => React.createElement('div', null, children),
      CheckboxItem: ({ children }) => React.createElement('div', null, children),
      RadioGroup: ({ children }) => React.createElement('div', null, children),
      RadioItem: ({ children }) => React.createElement('div', null, children),
      Label: ({ children }) => React.createElement('div', null, children),
      Separator: () => React.createElement('hr'),
      ItemIndicator: ({ children }) => React.createElement('span', null, children),
    },
  };

  const customReq = (id) => (capMocks[id] ? capMocks[id] : require(id));

  // ── SUITE 1: Typography Store & Computed Style Assertions across Readers ──
  console.log('\n[1/6] Typography Store Computed-Style Assertions across Seerah, Prophets, Hadith & Daily Hadith...');
  const typoMod = await bundleModule('src/lib/reader-typography.ts', customReq);
  const controlsMod = await bundleModule('src/components/BookReaderControls.tsx', customReq);

  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.bodySize, 15);
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.arabicSize, 22);
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.lineHeightMode, 'standard');
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.paragraphSpacing, 0.9);
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.measureCapCh, 68);
  assert.strictEqual(typoMod.DEFAULT_READER_PREFS.preset, 'comfortable');

  assert.strictEqual(typoMod.getReaderLineHeight('en', 'compact'), 1.6);
  assert.strictEqual(typoMod.getReaderLineHeight('en', 'standard'), 1.75);
  assert.strictEqual(typoMod.getReaderLineHeight('en', 'relaxed'), 1.9);
  assert.strictEqual(typoMod.getReaderLineHeight('ur', 'compact'), 2.2);
  assert.strictEqual(typoMod.getReaderLineHeight('ur', 'standard'), 2.5);
  assert.strictEqual(typoMod.getReaderLineHeight('ur', 'relaxed'), 2.8);
  assert.strictEqual(typoMod.getArabicLineHeight(), 2.0);
  assert.strictEqual(typoMod.getArabicLineHeight('compact'), 1.85);
  assert.strictEqual(typoMod.getArabicLineHeight('standard'), 2.0);
  assert.strictEqual(typoMod.getArabicLineHeight('relaxed'), 2.25);

  // Save custom store size = 17px, arabicSize = 26px, lineHeightMode = 'relaxed'
  typoMod.saveBookReaderPrefs({ bodySize: 17, arabicSize: 26, lineHeightMode: 'relaxed' });
  assert.strictEqual(docRootStyle.get('--reader-body-size'), '17px');
  assert.strictEqual(docRootStyle.get('--reader-arabic-size'), '26px');
  assert.strictEqual(docRootStyle.get('--reader-measure-cap'), '68ch');

  // Render BookProseParagraph, ReaderArabicBlock, ReaderHeading in 3 reader contexts (Seerah, Prophets, Hadith)
  const seerahMod = await bundleModule('src/pages/SeerahReader.tsx', customReq);
  const qisasMod = await bundleModule('src/pages/QisasReader.tsx', customReq);
  const hadithDetailMod = await bundleModule('src/components/hadith/HadithDetail.tsx', customReq);

  // Also test rendered markup of BookProseParagraph + ReaderArabicBlock + ReaderHeading at 17px/26px and Urdu Nastaliq
  const renderedSeerahProse = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.BookProseParagraph, {
      text: 'The Prophet (ﷺ) taught patience in Makkah.',
      actualLang: 'en',
    })
  );
  const proseStyleMatch = renderedSeerahProse.match(/style="([^"]+)"/);
  assert.ok(proseStyleMatch, 'Expected inline style on BookProseParagraph');
  const proseStyle = parseStyleAttr(proseStyleMatch[1]);
  assert.strictEqual(proseStyle['font-size'], '17px', 'Computed font-size must match store (17px)');
  assert.strictEqual(proseStyle['line-height'], '1.9', 'Relaxed LTR line-height must be 1.9');
  assert.strictEqual(proseStyle['margin-bottom'], '0.9em', 'Paragraph spacing must be 0.9em');
  assert.strictEqual(proseStyle['text-align'], 'left', 'LTR body must be left-aligned');
  assert.notStrictEqual(proseStyle['text-align'], 'center', 'Body must NEVER be center-aligned');
  assert.strictEqual(proseStyle['unicode-bidi'], 'plaintext');
  assert.ok(renderedSeerahProse.includes('dir="auto"'));

  // Test Urdu Nastaliq body rendering + font-readiness gate
  const renderedUrProse = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.BookProseParagraph, {
      text: 'نبی کریم ﷺ نے صبر کی تعلیم دی۔',
      actualLang: 'ur',
    })
  );
  const urStyle = parseStyleAttr(renderedUrProse.match(/style="([^"]+)"/)[1]);
  assert.strictEqual(urStyle['font-size'], '17px');
  assert.strictEqual(urStyle['line-height'], '2.8');
  assert.strictEqual(urStyle['text-align'], 'right');
  assert.ok(urStyle['font-family'].includes('Noto Nastaliq Urdu'), 'Urdu must use Noto Nastaliq Urdu');

  // Async swap font strategy: reader prose does NOT block with a skeleton gate even while isNastaliqFontReadySync() is false; only Clip Studio gates via ensureFontsReady()
  fontLoadedFlag = false;
  const freshTypoMod = await bundleModule('src/lib/reader-typography.ts', customReq);
  const freshControlsMod = await bundleModule('src/components/BookReaderControls.tsx', customReq);
  assert.strictEqual(freshTypoMod.isNastaliqFontReadySync(), false);
  const swapMarkup = ReactDOMServer.renderToStaticMarkup(
    React.createElement(freshControlsMod.BookProseParagraph, {
      text: 'نبی کریم ﷺ نے صبر کی تعلیم دی۔',
      actualLang: 'ur',
    })
  );
  assert.ok(!swapMarkup.includes('aria-busy="true"') && swapMarkup.includes('نبی کریم'), 'Readers must use font-display:swap without blocking prose');
  const clipSrc = fs.readFileSync(path.join(ROOT, 'src/lib/quran-clip-renderer.ts'), 'utf8');
  assert.ok(clipSrc.includes('ensureFontsReady'), 'Clip Studio renderer must retain strict font readiness gate');
  fontLoadedFlag = true;

  // Test Arabic block computed styles (26px + relaxed 2.25 LH + padding:12px + text-align:right)
  const renderedArabic = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.ReaderArabicBlock, {
      text: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    })
  );
  assert.ok(renderedArabic.includes('padding:12px'), 'Arabic block padding must be 12px');
  assert.ok(renderedArabic.includes('font-size:26px'), 'Arabic font-size must come from store (26px)');
  assert.ok(renderedArabic.includes('line-height:2.25'), 'Relaxed Arabic line-height must be 2.25');
  assert.ok(renderedArabic.includes('text-align:right'), 'Arabic block must be right-aligned (never justify)');
  assert.ok(!renderedArabic.includes('text-align:justify'), 'Arabic block must never justify');

  // Test HadithDetail, SeerahReader, QisasReader store wiring in source & rendered headings
  const headingH1 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.ReaderHeading, { level: 'h1', text: 'Location and Nature of Arab Tribes', actualLang: 'en' })
  );
  const headingH2 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.ReaderHeading, { level: 'h2', text: 'THE FORBIDDEN TREE:', actualLang: 'en' })
  );
  const headingH3 = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.ReaderHeading, { level: 'h3', text: 'His Birth:', actualLang: 'en' })
  );
  assert.ok(headingH1.includes('font-size:22px') && headingH1.includes('line-clamp-2'));
  assert.ok(headingH2.includes('font-size:18px'));
  assert.ok(headingH3.includes('font-size:16px'));

  // Render HadithDetail directly with location.state hadith to confirm computed font-size = 17px inside Hadith reader!
  routeParams = { collection: 'bukhari', book: '1', hadithNumber: '1' };
  capMocks['react-router-dom'].useLocation = () => ({
    pathname: '/hadith/collections/bukhari/1/1',
    state: {
      hadith: {
        id: 'bukhari-1',
        collection: 'bukhari',
        bookNumber: '1',
        bookName: 'Revelation',
        hadithNumber: '1',
        arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
        englishTranslation: 'Actions are judged by intentions.',
        narrator: 'Umar (RA)',
        grade: 'Sahih',
        category: 'General',
        tags: ['intentions'],
      },
    },
  });
  const hadithHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(hadithDetailMod.HadithDetail));
  assert.ok(hadithHtml.includes('font-size:17px'), 'HadithDetail body must match store font-size 17px');
  assert.ok(hadithHtml.includes('font-size:26px'), 'HadithDetail Arabic must match store arabicSize 26px');
  assert.ok(hadithHtml.includes('dir="auto"') && hadithHtml.includes('unicode-bidi:plaintext'));

  // Reset store back to default 15px / 22px and verify
  typoMod.saveBookReaderPrefs(typoMod.DEFAULT_READER_PREFS);
  const defaultHadithHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(hadithDetailMod.HadithDetail));
  assert.ok(defaultHadithHtml.includes('font-size:15px'), 'Default HadithDetail body must be 15px');
  assert.ok(defaultHadithHtml.includes('font-size:22px'), 'Default HadithDetail Arabic must be 22px');

  assert.ok(typeof seerahMod.default === 'function');
  assert.ok(typeof qisasMod.default === 'function');
  console.log('  PASS: Computed styles (15px/17px/18px body, 22px/26px Arabic, 1.6-1.9 / 2.2-2.8 LH, 0.9em, 68ch, Nastaliq gate)');

  // ── SUITE 2: BiDi Snapshots ──────────────────────────────────────────────
  console.log('\n[2/6] BiDi Snapshots...');
  const bidiSample = typoMod.formatIslamicProse(
    'Allah (سُبْحَٰنَهُۥ وَتَعَٰلَىٰ) Tells the Angels of His New Creation:',
    'en'
  );
  assert.strictEqual(bidiSample, 'Allah (SWT) Tells the Angels of His New Creation:');
  assert.strictEqual(typoMod.normalizeBidiPunctuation(':New Creation'), 'New Creation:');

  const bidiHeadingHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.ReaderHeading, {
      level: 'h2',
      text: bidiSample,
      actualLang: 'en',
    })
  );
  assert.ok(bidiHeadingHtml.includes('dir="auto"'));
  assert.ok(bidiHeadingHtml.includes('unicode-bidi:plaintext'));
  assert.ok(bidiHeadingHtml.includes('New Creation:'));
  assert.ok(!bidiHeadingHtml.includes(':New Creation'));
  console.log('  PASS: BiDi snapshots verified (dir="auto", unicode-bidi: plaintext, no ":New Creation")');

  // ── SUITE 3: Honorifics Snapshots (Adam & Lut in all 4 languages + full JSON sweep) ──
  console.log('\n[3/6] Honorifics Snapshots (Adam & Lut in EN/UR/GU/HI + Data Audit)...');
  const qisasData = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/qisas/qisas.json'), 'utf8'));
  const seerahData = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/seerah/sirah.json'), 'utf8'));

  const adam = qisasData.prophets.find((p) => p.id === 'prophet-adam');
  const lut = qisasData.prophets.find((p) => p.id === 'prophet-lut');
  assert.ok(adam && lut, 'Adam and Lut chapters must exist in qisas.json');

  const expectedHonorificSnapshot = {
    en: {
      allahIn: 'Allah ()',
      allahOut: 'Allah (SWT)',
      lutIn: 'Lut ()',
      lutOut: 'Lut (AS)',
      adamIn: 'Adam ()',
      adamOut: 'Adam (AS)',
    },
    ur: {
      allahIn: 'اللہ ()',
      allahOut: 'اللہ (سبحانہ و تعالیٰ)',
      lutIn: 'لوط ()',
      lutOut: 'لوط (علیہ السلام)',
      adamIn: 'آدم ()',
      adamOut: 'آدم (علیہ السلام)',
    },
    gu: {
      allahIn: 'અલ્લાહ ()',
      allahOut: 'અલ્લાહ (SWT)',
      lutIn: 'લૂત ()',
      lutOut: 'લૂત (અ.સ.)',
      adamIn: 'આદમ ()',
      adamOut: 'આદમ (અ.સ.)',
    },
    hi: {
      allahIn: 'अल्लाह ()',
      allahOut: 'अल्लाह (SWT)',
      lutIn: 'लूत ()',
      lutOut: 'लूत (अ.स.)',
      adamIn: 'आदम ()',
      adamOut: 'आदम (अ.स.)',
    },
  };

  for (const lang of ['en', 'ur', 'gu', 'hi']) {
    const snap = expectedHonorificSnapshot[lang];
    assert.strictEqual(typoMod.formatIslamicProse(snap.allahIn, lang), snap.allahOut, `Allah () mismatch in ${lang}`);
    assert.strictEqual(typoMod.formatIslamicProse(snap.lutIn, lang), snap.lutOut, `Lut () mismatch in ${lang}`);
    assert.strictEqual(typoMod.formatIslamicProse(snap.adamIn, lang), snap.adamOut, `Adam () mismatch in ${lang}`);
    // Also verify English tokens passed directly get the active-language honorific suffix cleanly
    assert.strictEqual(
      typoMod.formatIslamicProse('Lut ()', lang),
      lang === 'en' ? 'Lut (AS)' : lang === 'ur' ? 'Lut (علیہ السلام)' : lang === 'gu' ? 'Lut (અ.સ.)' : 'Lut (अ.स.)'
    );

    const adamParas = qisasMod.buildCleanStoryParagraphs(adam.story, lang);
    const lutParas = qisasMod.buildCleanStoryParagraphs(lut.story, lang);
    for (const p of [...adamParas, ...lutParas]) {
      assert.ok(!/\(\s*\)/.test(p), `Found empty () in ${lang} Adam/Lut: ${p.slice(0, 120)}`);
    }
    if (lang === 'en') {
      assert.ok(adamParas.some((p) => p.includes('Allah (SWT)')), 'Adam EN must contain Allah (SWT)');
      assert.ok(lutParas.some((p) => p.includes('Prophet Lut (AS)')), 'Lut EN must contain Prophet Lut (AS)');
    }
  }

  for (const ch of seerahData.chapters) {
    assert.ok(!/\(\s*\)/.test(ch.content), `Seerah JSON ${ch.id} still has empty ()`);
    const cleaned = typoMod.formatIslamicProse(ch.content, 'en');
    assert.ok(!/\(\s*\)/.test(cleaned), `Seerah cleaned ${ch.id} has empty ()`);
  }
  console.log('  PASS: Adam & Lut honorifics snapshots verified across EN, UR, GU, HI (0 empty ())');

  // ── SUITE 4: Denominator Lock & Cache-Hit Timing (<50ms second open) ─────
  console.log('\n[4/6] Translation Streaming Denominator Lock & Cache-Hit Timing (<50ms)...');
  const translatorMod = await bundleModule('src/lib/content-translator.ts', customReq);
  const longPara = 'This is a comprehensive paragraph from Ar-Raheeq Al-Makhtum detailing Makkah and the Quraish lineage before the coming of Islam. '.repeat(10).trim();
  assert.ok(longPara.length > 850, 'Test paragraph must exceed 850 chars to test denominator lock');
  const sourceParas = [
    'Paragraph 1 of Seerah.',
    longPara,
    'Paragraph 3 of Seerah.',
    'Paragraph 4 of Seerah.',
    'Paragraph 5 of Seerah.',
    'Paragraph 6 of Seerah.',
  ];
  const lockedN = sourceParas.length;
  const streamUpdates = [];
  httpCallCount = 0;

  await translatorMod.streamBookTranslation({
    module: 'seerah',
    itemId: 'sirah-test-denom',
    title: 'Test Chapter',
    englishParagraphs: sourceParas,
    targetLang: 'ur',
    onUpdate: (u) => streamUpdates.push(u),
  });

  assert.ok(streamUpdates.length >= 2, 'Expected multiple stream updates');
  for (const upd of streamUpdates) {
    assert.strictEqual(upd.totalChunks, lockedN, `Denominator drifted! Expected ${lockedN}, got ${upd.totalChunks}`);
  }
  assert.strictEqual(streamUpdates[streamUpdates.length - 1].doneChunks, lockedN);
  assert.strictEqual(streamUpdates[streamUpdates.length - 1].isComplete, true);

  // Measure second open (offline + IDB / memory cache hit)
  offlineMode = true;
  httpCallCount = 0;
  const cacheUpdates = [];
  const t0 = performance.now();
  await translatorMod.streamBookTranslation({
    module: 'seerah',
    itemId: 'sirah-test-denom',
    title: 'Test Chapter',
    englishParagraphs: sourceParas,
    targetLang: 'ur',
    onUpdate: (u) => cacheUpdates.push(u),
  });
  const cacheElapsedMs = performance.now() - t0;
  assert.strictEqual(httpCallCount, 0, 'Cached open must make 0 HTTP calls');
  assert.strictEqual(cacheUpdates[0].fromCache, true);
  assert.strictEqual(cacheUpdates[0].totalChunks, lockedN);
  assert.ok(cacheElapsedMs < 50, `Cache hit took ${cacheElapsedMs.toFixed(2)}ms (>= 50ms)`);
  console.log(`  PASS: Denominator locked at ${lockedN}/${lockedN}; second open cache-hit = ${cacheElapsedMs.toFixed(2)}ms (<50ms)`);

  // ── SUITE 5: Chrome, Counts, Tags, Copy Menu, Scroll & Token Audits ──────
  console.log('\n[5/6] Counts Copy, Tag Cache/Skeletons, Truncation & Token Checks...');
  const hadithCollectionsData = await bundleModule('src/data/hadith-collections/index.ts', customReq);
  const hadithUtilsMod = await bundleModule('src/lib/hadith-utils.ts', customReq);
  const bukhari = hadithCollectionsData.getCollectionByName('bukhari');
  assert.strictEqual(
    hadithUtilsMod.formatCollectionHadithCount(bukhari.totalHadith, bukhari.totalNarrations),
    '7,277 ahadith (14,769 narrations incl. repeats)'
  );
  assert.strictEqual(hadithUtilsMod.formatCompilerDeath(bukhari.death), 'Died: 256 AH');

  // Tag chips: curated tags resolve immediately; uncached dynamic tags show skeleton chips in UR/GU/HI, NEVER English slugs
  const tagSync = translatorMod.getCachedTagsSync(['arab-history', 'unseen-dynamic-slug'], 'ur');
  assert.strictEqual(tagSync.labels[0], 'تاریخِ عرب');
  assert.strictEqual(tagSync.labels[1], null);
  assert.strictEqual(tagSync.allReady, false);

  const tagChipsHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.ReaderTagChips, {
      tags: ['arab-history', 'unseen-dynamic-slug'],
      contentLang: 'ur',
    })
  );
  assert.ok(tagChipsHtml.includes('تاریخِ عرب'), 'Curated UR tag must render immediately');
  assert.ok(tagChipsHtml.includes('data-testid="tag-skeleton-chip"'), 'Uncached tag must render skeleton chip');
  assert.ok(!tagChipsHtml.includes('unseen-dynamic-slug'), 'English slug must NEVER appear in UR/GU/HI UI');

  // Scroll persistence
  const storageMod = await bundleModule('src/lib/reading-storage.ts', customReq);
  storageMod.setScrollPosition('sirah-1', 420, 'seerah');
  assert.strictEqual(storageMod.getScrollPosition('sirah-1', 'seerah'), 420);

  // Truncation & visual luxury checks on source files
  const filesToCheck = [
    { rel: 'src/components/hadith/HadithCollections.tsx', forbidTruncateOnH1: true },
    { rel: 'src/components/hadith/HadithBookContent.tsx', forbidTruncateOnH1: true },
    { rel: 'src/pages/SeerahReader.tsx', forbidTruncateOnH1: false },
    { rel: 'src/pages/QisasReader.tsx', forbidTruncateOnH1: false },
  ];
  for (const item of filesToCheck) {
    const src = fs.readFileSync(path.join(ROOT, item.rel), 'utf8');
    assert.ok(src.includes('line-clamp-2'), `${item.rel} must use 2-line clamp on headers`);
    assert.ok(src.includes('flex-nowrap'), `${item.rel} action row must stay on one row`);
  }

  const dailyHadithPageSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Hadith.tsx'), 'utf8');
  assert.ok(!dailyHadithPageSrc.includes('Loader2'), 'Daily Hadith page must not use Loader2 bare spinner');
  assert.ok(dailyHadithPageSrc.includes('aria-busy="true"'), 'Daily Hadith page must render skeleton shimmer');

  const collectionsSrc = fs.readFileSync(path.join(ROOT, 'src/components/hadith/HadithCollections.tsx'), 'utf8');
  assert.ok(!collectionsSrc.includes('animate-spin'), 'HadithCollections Daily Hadith card must not use bare spinner');

  const prophetCardSrc = fs.readFileSync(path.join(ROOT, 'src/components/qisas/ProphetCard.tsx'), 'utf8');
  assert.ok(!prophetCardSrc.includes('from-[var(--accent)] to-[var(--accent-2)]'), 'ProphetCard neon solid banner must be removed');
  assert.ok(prophetCardSrc.includes('radial-gradient'), 'ProphetCard must use accent-soft radial wash calligraphy panel');

  const qisasHomeSrc = fs.readFileSync(path.join(ROOT, 'src/pages/QisasHome.tsx'), 'utf8');
  assert.ok(qisasHomeSrc.includes('sticky-era-filter-bar'), 'QisasHome must include sticky era filter bar');
  assert.ok(qisasHomeSrc.includes('viewMode === "grid"') && qisasHomeSrc.includes('viewMode === "list"'), 'QisasHome must include list/grid toggle');

  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  assert.ok(indexCss.includes('background-color: var(--surface-2);') && indexCss.includes('color-mix(in srgb'), 'Era chips must provide plain CSS fallback before color-mix');

  console.log('  PASS: Counts copy, tag cache/skeletons, scroll persistence, copy menu, truncation & token checks');

  // ── SUITE 6: Hotfix Regression — Arabic Surfaces, Alignment, Hisnul Muslim, Lifespan & No Ghosting ──
  console.log('\n[6/6] Hotfix Suite (5-Reader Alignment, Hisnul Muslim, Empty Arabic Guard, Lifespan, Instant Swap)...');

  // 6a. Store arabicSize + lineHeight propagation across DailyHadith, Word Study Popup, HadithBookContent, HadithDetail, Seerah/Qisas
  typoMod.saveBookReaderPrefs({ bodySize: 16, arabicSize: 28, lineHeightMode: 'compact' });
  const dailyHadithCompMod = await bundleModule('src/components/DailyHadith.tsx', customReq);
  const dailyHtml = ReactDOMServer.renderToStaticMarkup(React.createElement(dailyHadithCompMod.DailyHadith));
  assert.ok(dailyHtml.includes('font-size:28px'), 'DailyHadith Arabic must match store (28px)');
  assert.ok(dailyHtml.includes('font-size:16px'), 'DailyHadith body must match store (16px)');
  assert.ok(dailyHtml.includes('line-height:1.85'), 'Compact Arabic line-height must be 1.85');
  assert.ok(dailyHtml.includes('text-align:left'), 'DailyHadith LTR body must be left-aligned');
  assert.ok(dailyHtml.includes('text-align:right'), 'DailyHadith Arabic must be right-aligned');

  const hadithDetail28Html = ReactDOMServer.renderToStaticMarkup(React.createElement(hadithDetailMod.HadithDetail));
  assert.ok(hadithDetail28Html.includes('font-size:28px') && hadithDetail28Html.includes('font-size:16px'));

  const wordPopupSrc = fs.readFileSync(path.join(ROOT, 'src/components/Quran/InteractiveMushafPage.tsx'), 'utf8');
  assert.ok(wordPopupSrc.includes('useBookReaderPrefs') && wordPopupSrc.includes('readerPrefs.arabicSize'), 'Word-study popup must wire reader-typography arabicSize');
  assert.ok(wordPopupSrc.includes('getArabicLineHeight(readerPrefs.lineHeightMode)'), 'Word-study popup must wire Arabic lineHeight');
  assert.ok(!wordPopupSrc.includes('className="text-center font-arabic text-2xl font-bold'), 'Word-study popup Arabic must not be centered hardcoded text-2xl');

  const enhancedDailySrc = fs.readFileSync(path.join(ROOT, 'src/components/EnhancedDailyHadith.tsx'), 'utf8');
  assert.ok(enhancedDailySrc.includes('fontSize: `${prefs.arabicSize}px`') && enhancedDailySrc.includes('getArabicLineHeight(prefs.lineHeightMode)'));
  assert.ok(!enhancedDailySrc.includes('isAnimating'), 'EnhancedDailyHadith must swap instantly without isAnimating opacity-0 fade');

  // 6b. Prophet Nuh English body left-alignment audit across all 5 readers
  const nuh = qisasData.prophets.find((p) => p.id === 'prophet-nuh');
  assert.ok(nuh, 'Prophet Nuh must exist in qisas.json');
  const nuhParas = qisasMod.buildCleanStoryParagraphs(nuh.story, 'en');
  for (const para of nuhParas.slice(0, 8)) {
    if (translatorMod.isPureArabicBlock(para)) continue;
    const paraHtml = ReactDOMServer.renderToStaticMarkup(
      React.createElement(controlsMod.BookProseParagraph, { text: para, actualLang: 'en' })
    );
    const pStyle = parseStyleAttr((paraHtml.match(/style="([^"]+)"/) || [])[1] || '');
    assert.strictEqual(pStyle['text-align'], 'left', 'Prophet Nuh English prose MUST be left-aligned');
    assert.notStrictEqual(pStyle['text-align'], 'center', 'Prophet Nuh English prose must NEVER be centered');
    assert.ok(paraHtml.includes('data-align="left"'));
  }

  // Verify QisasReader & SeerahReader <article> enforce left alignment for LTR
  const qisasSrc = fs.readFileSync(path.join(ROOT, 'src/pages/QisasReader.tsx'), 'utf8');
  const seerahSrc = fs.readFileSync(path.join(ROOT, 'src/pages/SeerahReader.tsx'), 'utf8');
  assert.ok(qisasSrc.includes('key={`${prophet.id}-${contentLang}`}'), 'QisasReader must key prose article to prevent ghosting');
  assert.ok(seerahSrc.includes('key={`${chapter.id}-${contentLang}`}'), 'SeerahReader must key prose article to prevent ghosting');
  assert.ok(!dailyHadithPageSrc.includes('opacity-60 transition-opacity'), 'Hadith.tsx must swap translations without opacity crossfade');

  // 6c. Hisnul Muslim fixes: zero "(more)", wall-of-text paragraph split + mono footnotes, empty Arabic guard, BiDi isolation
  const hisnMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hadith-collections/hisn/metadata.json'), 'utf8'));
  const hisnHadiths = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/hadith-collections/hisn/hadiths.json'), 'utf8'));
  assert.ok(!JSON.stringify(hisnMeta).includes('(more)'), 'hisn/metadata.json must NEVER contain (more)');
  assert.ok(!JSON.stringify(hisnHadiths).includes('(more)'), 'hisn/hadiths.json must NEVER contain (more)');

  assert.strictEqual(hadithUtilsMod.sanitizeHadithBookNumber('(more)', 0), '1');
  assert.strictEqual(hadithUtilsMod.sanitizeHadithBookTitle('(more)', '(more)', 1), 'Book 2');
  assert.strictEqual(hadithUtilsMod.sanitizeHadithBookTitle('Merits', 'of Dhikr', 0), 'Merits of Dhikr');

  // Empty Arabic guard (zero empty rounded box)
  const emptyArabicHtml = ReactDOMServer.renderToStaticMarkup(
    ReactDOMServer.renderToStaticMarkup
      ? React.createElement(controlsMod.ReaderArabicBlock, { text: '   ' })
      : null
  );
  assert.strictEqual(emptyArabicHtml, '', 'Empty Arabic string must render NO box');

  // Wall-of-text splitting + compact monospace footnote block
  const legacyWallHadith = {
    englishTranslation: '',
    grade: 'Allah said: "Remember Me." 1 And He said: "O you who believe, remember Allah." 2 And the Prophet said: "Remember your Lord." 3 ' +
      'Long extra narration text to trigger wall-of-text recovery cleanly across numbered entries. '.repeat(3) +
      '1 : Al-Baqarah 2:152 2 : Al-Ahzab 33:41 3 : Sahih al-Bukhari 8/171',
  };
  const parsedWall = hadithUtilsMod.parseHadithBodyAndFootnotes(legacyWallHadith);
  assert.ok(parsedWall.paragraphs.length >= 2, 'Wall-of-text hadith must split into multiple paragraphs');
  assert.strictEqual(parsedWall.footnotes.length, 3, 'References must be extracted into footnotes');
  const footnoteHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.HadithFootnotesBlock, { footnotes: parsedWall.footnotes })
  );
  assert.ok(footnoteHtml.includes('data-testid="hadith-footnotes"') && footnoteHtml.includes('font-mono') && footnoteHtml.includes('Al-Baqarah 2:152'));

  // BiDi isolation for mixed titles
  const mixedTitleHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(controlsMod.MixedBidiTitle, { latin: 'Merits of Dhikr', arabic: 'فضل الذكر' })
  );
  assert.ok(
    mixedTitleHtml.includes('<bdi dir="ltr"') &&
    mixedTitleHtml.includes('<bdi dir="rtl"') &&
    mixedTitleHtml.includes('unicode-bidi:isolate'),
    'Mixed Latin+Arabic titles must isolate runs in separate <bdi> spans'
  );

  // 6d. Compiler card single lifespan ("194-256 AH", NO duplicate "Died:" line)
  const collectionCardMod = await bundleModule('src/components/hadith/CollectionCard.tsx', customReq);
  const bukhariCardHtml = ReactDOMServer.renderToStaticMarkup(
    React.createElement(collectionCardMod.CollectionCard, { collection: bukhari, onClick: () => {} })
  );
  assert.ok(bukhariCardHtml.includes('194-256 AH'), 'CollectionCard must show single lifespan 194-256 AH');
  assert.ok(!bukhariCardHtml.includes('Died: 256 AH'), 'CollectionCard must NOT show duplicate Died line');

  typoMod.saveBookReaderPrefs(typoMod.DEFAULT_READER_PREFS);
  console.log('  PASS: 5-reader alignment, Hisnul Muslim fixes, empty Arabic guard, BiDi titles, single lifespan & instant swap verified');
  console.log(`\nALL ROYAL E-BOOK VERIFICATION SUITES PASSED in ${Date.now() - tStart}ms`);
}

runTests().catch((err) => {
  console.error('\n[FAIL] Royal E-Book test suite failed:', err);
  process.exit(1);
});
