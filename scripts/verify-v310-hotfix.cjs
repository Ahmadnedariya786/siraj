/**
 * Siraj v3.0.10 Surgical Fix Verification Suite (<5s via Node + esbuild)
 * Verifies:
 *  1) Ramadan Ends (9-30) resolves cleanly across 1447-1450 AH & offsets -1/0/+1 (0 errors)
 *  2) Worship Journal Hijri parity + Hijri -> Gregorian 360px Month selector width & label
 *  3) Quran Audio reciter count parity (299) + themed searchable picker sheet (zero <select>)
 *  4) Theme-tokenized sliders + Nasheed Recent filtered empty state + honest X-Ray Test Capture toast + 0 backdrop-filter
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function createStorageMock() {
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(String(key), String(value));
    },
    removeItem(key) {
      map.delete(String(key));
    },
    key(idx) {
      return Array.from(map.keys())[idx] ?? null;
    },
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
    external: ['@capacitor/*'],
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
  const realNow = Date.now();
  const storage = createStorageMock();
  const sessionMock = createStorageMock();
  const consoleErrors = [];
  const origConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.map(String).join(' '));
  };

  try {
    global.window = {
      localStorage: storage,
      sessionStorage: sessionMock,
      location: {
        pathname: '/',
        search: '',
        hash: '',
        origin: 'https://localhost',
        protocol: 'https:',
        hostname: 'localhost',
      },
      dispatchEvent: () => true,
      addEventListener: () => {},
      removeEventListener: () => {},
      setTimeout,
      clearTimeout,
    };
    global.localStorage = storage;
    global.sessionStorage = sessionMock;
    global.navigator = { language: 'en-US' };
    global.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };
    global.Event = class Event {
      constructor(type) {
        this.type = type;
      }
    };

    const capMocks = {
      '@capacitor/core': {
        Capacitor: {
          isNativePlatform: () => false,
          getPlatform: () => 'web',
          registerPlugin: () => ({}),
        },
      },
      '@capacitor/local-notifications': {
        LocalNotifications: {
          async checkPermissions() {
            return { display: 'granted' };
          },
          async requestPermissions() {
            return { display: 'granted' };
          },
          async createChannel() {},
          async getPending() {
            return { notifications: [] };
          },
          async cancel() {},
          async schedule() {},
        },
      },
      '@capacitor/preferences': {
        Preferences: {
          async get() {
            return { value: null };
          },
          async set() {},
          async remove() {},
          async keys() {
            return { keys: [] };
          },
        },
      },
    };

    const hijriMod = bundleModule('src/lib/hijri-date.ts');
    const eventsMod = bundleModule('src/lib/islamic-events-service.ts', (id) =>
      capMocks[id] ? capMocks[id] : require(id),
    );
    const eventsSvc = eventsMod.islamicEventsService;

    // =========================================================================
    // PART 1: Ramadan Ends (9-30) across 1447-1450 AH & 2026-2029, offsets -1/0/+1
    // =========================================================================
    for (const offset of [-1, 0, 1]) {
      storage.setItem('hijri-date-offset', String(offset));
      for (const hYear of [1447, 1448, 1449, 1450]) {
        const dt = await eventsSvc.getGregorianDateForHijriEvent(9, 30, hYear, offset);
        assert.ok(dt instanceof Date && !isNaN(dt.getTime()), `Invalid Date for Hijri ${hYear}-9-30 (offset ${offset})`);
        const verified = hijriMod.convertGregorianToHijri(dt, offset);
        assert.ok(verified, `Failed round-trip verify for Hijri ${hYear}-9-30 (offset ${offset})`);
        assert.strictEqual(verified.hijriMonthNumber, 9, `Month mismatch for ${hYear}-9-30: got month ${verified.hijriMonthNumber}`);
        assert.ok(
          verified.hijriDay === 29 || verified.hijriDay === 30,
          `Expected Ramadan final day 29 or 30, got ${verified.hijriDay} for ${hYear}`,
        );
      }
      for (const gYear of [2026, 2027, 2028, 2029]) {
        const dt = await eventsSvc.getGregorianDateForHijriEvent(9, 30, gYear, offset);
        assert.ok(dt instanceof Date && !isNaN(dt.getTime()), `Invalid Date for Gregorian ${gYear} Ramadan Ends`);
        const verified = hijriMod.convertGregorianToHijri(dt, offset);
        assert.strictEqual(verified.hijriMonthNumber, 9);
        assert.ok(verified.hijriDay === 29 || verified.hijriDay === 30);
      }
    }

    assert.strictEqual(
      consoleErrors.length,
      0,
      `Expected 0 console.error calls during Ramadan Ends checks, got: ${consoleErrors.join('; ')}`,
    );
    console.log('[PASS] Part 1: Ramadan Ends (9-30) resolves cleanly across 1447-1450 AH & offsets -1/0/+1 (0 errors)');

    // =========================================================================
    // PART 2: Worship Journal Hijri Offset Parity & Hijri->Gregorian Month Selector
    // =========================================================================
    storage.setItem('hijri-date-offset', '-1');
    const nov26 = hijriMod.convertGregorianToHijri(new Date(2026, 10, 26, 12, 0, 0), hijriMod.getStoredHijriOffset());
    assert.strictEqual(`${nov26.hijriDay} ${nov26.hijriMonthEn}`, '15 Jumādā al-ākhirah');

    const prayerStatsSrc = fs.readFileSync(path.join(ROOT, 'src/pages/PrayerStats.tsx'), 'utf8');
    assert.ok(prayerStatsSrc.includes('convertGregorianToHijri'), 'PrayerStats must use convertGregorianToHijri');
    assert.ok(prayerStatsSrc.includes('hijri-date-offset-changed'), 'PrayerStats must react to hijri-date-offset-changed');
    assert.ok(
      prayerStatsSrc.includes('`${unifiedHijri.hijriDay} ${unifiedHijri.hijriMonthEn}`'),
      'PrayerStats formattedHijri must derive directly from unifiedHijri',
    );

    const calSrc = fs.readFileSync(path.join(ROOT, 'src/pages/IslamicCalendar.tsx'), 'utf8');
    assert.ok(
      calSrc.includes('grid-cols-[64px_minmax(0,1fr)_76px]'),
      'Hijri->Gregorian converter grid must prioritize Month width at 360px',
    );
    assert.ok(calSrc.includes("6: 'Jumādā II'"), 'Month select must provide concise Jumādā II label to avoid 360px clip');
    console.log('[PASS] Part 2: Worship Journal Hijri offset parity & 360px unclipped Hijri->Gregorian Month selector');

    // =========================================================================
    // PART 3: Quran Audio Reciter Count Parity (299) & Searchable Picker Sheet
    // =========================================================================
    const i18nSrc = fs.readFileSync(path.join(ROOT, 'src/lib/i18n-ui.ts'), 'utf8');
    assert.ok(!i18nSrc.includes('289 reciters'), 'Stale 289 reciters found in i18n-ui.ts');
    assert.ok(!i18nSrc.includes("'289 "), 'Stale localized 289 count found in i18n-ui.ts');
    assert.ok(!i18nSrc.includes('২৮৯'), 'Stale Bengali 289 count found in i18n-ui.ts');
    assert.ok(i18nSrc.includes('299 reciters (MP3Quran)'), 'Expected 299 reciters default in i18n-ui.ts');

    const servicesSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Services.tsx'), 'utf8');
    assert.ok(servicesSrc.includes('useReciters'), 'Services.tsx must read live reciter count via useReciters');
    assert.ok(servicesSrc.includes('liveReciterCount'), 'Services.tsx must inject liveReciterCount into Quran Audio tile');

    const globalQuranSrc = fs.readFileSync(path.join(ROOT, 'src/components/GlobalQuranPlayer.tsx'), 'utf8');
    assert.ok(!globalQuranSrc.includes('<Select'), 'GlobalQuranPlayer must not use Radix/native <Select> dropdown');
    assert.ok(!globalQuranSrc.includes('<select'), 'GlobalQuranPlayer must not use native <select>');
    assert.ok(globalQuranSrc.includes('createPortal'), 'GlobalQuranPlayer reciter picker must render via createPortal');
    assert.ok(globalQuranSrc.includes('isReciterPickerOpen'), 'GlobalQuranPlayer must implement themed searchable picker state');
    console.log('[PASS] Part 3: Quran Audio 299 parity & themed portal searchable reciter picker');

    // =========================================================================
    // PART 4 & PART 5: Sliders, Nasheed Empty State, X-Ray Toast, Security Lock
    // =========================================================================
    const sliderSrc = fs.readFileSync(path.join(ROOT, 'src/components/ui/slider.tsx'), 'utf8');
    assert.ok(!sliderSrc.includes('bg-secondary') && !sliderSrc.includes('bg-primary'), 'Slider must not use hardcoded secondary blue or dark amber primary');
    assert.ok(sliderSrc.includes('var(--accent)') && sliderSrc.includes('var(--surface-2)'), 'Slider must use theme CSS tokens');

    const globalNasheedSrc = fs.readFileSync(path.join(ROOT, 'src/components/GlobalNasheedPlayer.tsx'), 'utf8');
    const nasheedPageSrc = fs.readFileSync(path.join(ROOT, 'src/pages/NasheedPlayer.tsx'), 'utf8');
    const settingsSubSrc = fs.readFileSync(path.join(ROOT, 'src/pages/SettingsSubPage.tsx'), 'utf8');

    assert.ok(nasheedPageSrc.includes('No matching recent tracks'), 'Missing filtered Recent empty-state headline');
    assert.ok(nasheedPageSrc.includes('Clear filter'), 'Missing 1-tap Clear filter button in Recent empty state');

    assert.ok(
      settingsSubSrc.includes('recordedErrorCount} recorded error(s) captured'),
      'SettingsSubPage Test Capture must report real recorded error count',
    );

    const touchedPaths = [
      'src/lib/hijri-date.ts',
      'src/lib/islamic-events-service.ts',
      'src/pages/PrayerStats.tsx',
      'src/pages/IslamicCalendar.tsx',
      'src/pages/Services.tsx',
      'src/components/ui/slider.tsx',
      'src/components/GlobalQuranPlayer.tsx',
      'src/components/GlobalNasheedPlayer.tsx',
      'src/pages/NasheedPlayer.tsx',
      'src/pages/SettingsSubPage.tsx',
    ];
    for (const rel of touchedPaths) {
      const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      assert.ok(
        !text.includes('backdrop-blur') && !text.includes('backdrop-filter') && !text.includes('backdropFilter'),
        `Forbidden backdrop-filter/blur found in ${rel}`,
      );
      assert.ok(
        !text.includes('drop-shadow'),
        `Forbidden SVG/CSS drop-shadow found in ${rel}`,
      );
    }

    console.log('[PASS] Part 4 & 5: Sliders tokenized, Nasheeds Recent empty state fixed, honest X-Ray toast, zero blur/drop-shadow');
    console.log(`ALL v3.0.10 SURGICAL FIX CHECKS PASSED in ${Date.now() - realNow}ms`);
  } finally {
    console.error = origConsoleError;
  }
}

runTests().catch((err) => {
  console.error('[FAIL] verify-v310-hotfix failed:', err);
  process.exit(1);
});
