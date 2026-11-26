/**
 * Siraj v3.0.9 Surgical Hotfix Verification Suite (<5s via Node + esbuild)
 * Verifies:
 *  1) Hijri Date Converter single-source parity across offsets -1 / 0 / +1 & round-trip
 *  2) Removal of duplicate weekday line & native <input type="date"> in IslamicCalendar.tsx
 *  3) Single MEDIA_FOLDER = "Siraj" gallery constant across TS + Android native (0 NoorConnect gallery hits)
 *  4) OS Kernel Next & Scheduled alarm count when Fard prayers are enabled + honest status reporting
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
  const startMs = Date.now();
  const storage = createStorageMock();
  const sessionMock = createStorageMock();

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

  // =========================================================================
  // PART 1: Hijri Date Converter Single-Source Parity (Nov 26, 2026)
  // =========================================================================
  const hijriMod = bundleModule('src/lib/hijri-date.ts');
  const serviceMod = bundleModule('src/lib/islamic-calendar-service.ts');

  const expectedDays = {
    [-1]: 15,
    [0]: 16,
    [1]: 17,
  };

  for (const offset of [-1, 0, 1]) {
    storage.setItem('hijri-date-offset', String(offset));
    const fromIso = hijriMod.convertGregorianToHijri('2026-11-26', offset);
    const fromLocalDate = hijriMod.convertGregorianToHijri(new Date(2026, 10, 26, 0, 0, 0), offset);
    const fromService = serviceMod.islamicCalendarService.calculateIslamicDate(
      new Date(2026, 10, 26, 12, 0, 0),
      offset,
    );

    assert.ok(fromIso, `ISO conversion returned null for offset ${offset}`);
    assert.ok(fromLocalDate, `Date conversion returned null for offset ${offset}`);

    assert.strictEqual(fromIso.hijriDay, expectedDays[offset], `ISO day mismatch for offset ${offset}`);
    assert.strictEqual(fromLocalDate.hijriDay, fromIso.hijriDay, `Date vs ISO day mismatch for offset ${offset}`);
    assert.strictEqual(parseInt(fromService.hijri.day, 10), fromIso.hijriDay, `Service vs Converter day mismatch for offset ${offset}`);

    assert.strictEqual(fromIso.hijriMonthNumber, 6);
    assert.strictEqual(fromIso.hijriMonthEn, 'Jumādā al-ākhirah');
    assert.strictEqual(fromLocalDate.hijriMonthEn, fromIso.hijriMonthEn);
    assert.strictEqual(fromService.hijri.month.en, fromIso.hijriMonthEn);
    assert.strictEqual(fromIso.hijriYear, 1448);
    assert.strictEqual(parseInt(fromService.hijri.year, 10), 1448);

    // Hijri -> Gregorian round-trip MUST resolve back to 2026-11-26
    const roundTrip = hijriMod.convertHijriToGregorian(1448, 6, expectedDays[offset], offset);
    assert.ok(roundTrip, `Round-trip returned null for offset ${offset}`);
    assert.strictEqual(roundTrip.gregorianIso, '2026-11-26', `Round-trip ISO mismatch for offset ${offset}`);
    assert.strictEqual(roundTrip.hijriDay, expectedDays[offset]);
    assert.strictEqual(roundTrip.hijriMonthEn, 'Jumādā al-ākhirah');
  }
  console.log('[PASS] Part 1: Hijri Converter parity across offsets -1/0/+1 & H->G round-trip');

  // =========================================================================
  // PART 2: Converter Copy Cleanup & RoyalDatePickerModal Reuse
  // =========================================================================
  const calSrc = fs.readFileSync(path.join(ROOT, 'src/pages/IslamicCalendar.tsx'), 'utf8');
  const modalSrc = fs.readFileSync(path.join(ROOT, 'src/components/RoyalDatePickerModal.tsx'), 'utf8');
  assert.ok(!calSrc.includes('type="date"'), 'IslamicCalendar.tsx must not contain native <input type="date">');
  assert.ok(calSrc.includes('<RoyalDatePickerModal'), 'IslamicCalendar.tsx must render RoyalDatePickerModal');
  assert.ok(calSrc.includes('mode="calendar"'), 'IslamicCalendar.tsx must open RoyalDatePickerModal in calendar mode');
  assert.ok(!calSrc.includes('>{gToHResult.weekday}</span>'), 'Duplicate standalone {gToHResult.weekday} line must be removed');
  assert.ok(!calSrc.includes('>{hToGResult.weekday}</span>'), 'Duplicate standalone {hToGResult.weekday} line must be removed');
  assert.ok(!modalSrc.includes('backdrop-filter') && !modalSrc.includes('backdropFilter'), 'RoyalDatePickerModal must not use backdrop-filter');
  assert.ok(modalSrc.includes('createPortal'), 'RoyalDatePickerModal must render via createPortal');
  console.log('[PASS] Part 2: Duplicate weekday removed & RoyalDatePickerModal wired cleanly');

  // =========================================================================
  // PART 3: Single MEDIA_FOLDER = "Siraj" Constant (0 NoorConnect gallery hits)
  // =========================================================================
  const brandMod = bundleModule('src/lib/brand.ts');
  assert.strictEqual(brandMod.MEDIA_FOLDER, 'Siraj');
  assert.strictEqual(brandMod.GALLERY_PICTURES_FOLDER, 'Pictures/Siraj');
  assert.strictEqual(brandMod.GALLERY_MOVIES_FOLDER, 'Movies/Siraj');

  const clipStudioSrc = fs.readFileSync(path.join(ROOT, 'src/components/QuranClipStudioModal.tsx'), 'utf8');
  const mediaBridgeSrc = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/NoorMediaBridgePlugin.java'),
    'utf8',
  );
  assert.ok(!clipStudioSrc.includes('NoorConnect'), 'QuranClipStudioModal.tsx still contains NoorConnect');
  assert.ok(clipStudioSrc.includes('GALLERY_PICTURES_FOLDER') && clipStudioSrc.includes('GALLERY_MOVIES_FOLDER'));
  assert.ok(mediaBridgeSrc.includes('MEDIA_FOLDER = "Siraj"'), 'NoorMediaBridgePlugin.java missing MEDIA_FOLDER = "Siraj"');
  assert.ok(!mediaBridgeSrc.includes('NoorConnect'), 'NoorMediaBridgePlugin.java still contains NoorConnect gallery paths');
  console.log('[PASS] Part 3: MEDIA_FOLDER = "Siraj" unified across TS & Native MediaStore');

  // =========================================================================
  // PART 4: Real Native Fard Scheduling + Kernel Alarm Diagnostics
  // =========================================================================
  const FAKE_NOW_MS = new Date(2026, 10, 26, 10, 0, 0, 0).getTime(); // 10:00 AM Nov 26, 2026
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(FAKE_NOW_MS);
      else super(...args);
    }
    static now() {
      return FAKE_NOW_MS;
    }
  }
  global.Date = FakeDate;

  storage.clear();
  storage.setItem(
    'location-storage',
    JSON.stringify({ latitude: 24.0, longitude: 72.5, city: 'Chhapi', country: 'India', source: 'manual' }),
  );
  storage.setItem('prayer-notifications-enabled', 'true');
  storage.setItem('prayer-alarm-enabled', 'true');

  const sampleTimings = {
    Fajr: '05:31 (IST)',
    Sunrise: '06:55 (IST)',
    Dhuhr: '12:27 (IST)',
    Asr: '16:17 (IST)',
    Maghrib: '17:55 (IST)',
    Isha: '19:12 (IST)',
  };
  const novDays = Array.from({ length: 30 }, (_, idx) => ({
    date: { gregorian: { date: `${String(idx + 1).padStart(2, '0')}-11-2026` } },
    timings: sampleTimings,
  }));
  // AladhanAPI checks month-keyed or location cache keys; seed November 2026 cache:
  storage.setItem('aladhan-monthly-v2-24.000-72.500-2026-11-1-2', JSON.stringify({ days: novDays, ts: FAKE_NOW_MS }));
  storage.setItem('aladhan-monthly-v2-24.000-72.500-2026-11-1-3', JSON.stringify({ days: novDays, ts: FAKE_NOW_MS }));

  const capturedNativeAlarms = [];
  const capMocks = {
    '@capacitor/core': {
      Capacitor: {
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        registerPlugin: (name) => {
          if (name === 'NativeAdhanPlugin') {
            return {
              async schedule(opts) {
                capturedNativeAlarms.length = 0;
                for (const a of opts.alarms || []) capturedNativeAlarms.push(a);
                return { scheduled: capturedNativeAlarms.length, enabled: opts.enabled, alarmMethod: 'setAlarmClock' };
              },
              async clear() {
                capturedNativeAlarms.length = 0;
              },
              async setEnabled() {
                return { enabled: true, count: capturedNativeAlarms.length };
              },
              async getStatus() {
                return { enabled: true, count: capturedNativeAlarms.length };
              },
              async canScheduleExactAlarms() {
                return { canSchedule: true };
              },
              async getAlarmKernelDiagnostics() {
                return {
                  osNextAlarmClock: capturedNativeAlarms[0] ? `Thu 12:27 PM (${capturedNativeAlarms[0].prayerName})` : 'NONE',
                  scheduledCount: capturedNativeAlarms.length,
                  exactAlarmGranted: true,
                  notificationsGranted: true,
                  alarmMethod: capturedNativeAlarms.length > 0 ? 'setAlarmClock' : 'none',
                  nextScheduledPrayer: capturedNativeAlarms[0]?.prayerName || 'NONE',
                  nextScheduledEpochMs: capturedNativeAlarms[0]?.triggerAt || -1,
                };
              },
            };
          }
          return {};
        },
      },
    },
    '@capacitor/local-notifications': {
      LocalNotifications: {
        // Simulate pre-permission state where POST_NOTIFICATIONS is initially 'prompt'
        // Native AlarmManager scheduling MUST STILL proceed!
        async checkPermissions() {
          return { display: 'prompt' };
        },
        async requestPermissions() {
          return { display: 'granted' };
        },
        async createChannel() {},
        async getPending() {
          return { notifications: [{ id: 1099, extra: { kind: 'sajdah_reminder' } }] };
        },
        async cancel() {},
        async schedule() {},
      },
    },
    '@capacitor/preferences': {
      Preferences: {
        async get() { return { value: null }; },
        async set() {},
        async remove() {},
        async keys() { return { keys: [] }; },
      },
    },
  };

  // Inject fetch stub returning novDays in case coordinates trigger a live fetch fallback
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ code: 200, data: novDays }),
  });

  const localNotifMod = bundleModule('src/lib/local-notifications.ts', (id) =>
    capMocks[id] ? capMocks[id] : require(id),
  );
  await localNotifMod.localNotifications.schedulePrayerNotificationsFromAPI(24.0, 72.5, 'Chhapi');

  // Expect >= 9 alarms across Nov 26 (Dhuhr, Asr, Maghrib, Isha = 4) + Nov 27 (5) + more across 7d window
  assert.ok(
    capturedNativeAlarms.length >= 9,
    `Expected >= 9 Fard native alarms even when display perm='prompt', got ${capturedNativeAlarms.length}`,
  );
  for (const alarm of capturedNativeAlarms) {
    assert.ok(alarm.triggerAt > FAKE_NOW_MS + 15000, `Scheduled non-future alarm: ${JSON.stringify(alarm)}`);
  }

  // Verify Java & TSX source markers for alarm diagnostics & honest UI reporting
  const javaSchedulerSrc = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/NativeAdhanScheduler.java'),
    'utf8',
  );
  const settingsSubSrc = fs.readFileSync(path.join(ROOT, 'src/pages/SettingsSubPage.tsx'), 'utf8');
  assert.ok(javaSchedulerSrc.includes('KEY_LAST_SCHEDULE_METHOD'), 'Missing KEY_LAST_SCHEDULE_METHOD in Java scheduler');
  assert.ok(javaSchedulerSrc.includes('setAlarmClock'), 'Missing setAlarmClock in Java scheduler');
  assert.ok(javaSchedulerSrc.includes('nextScheduledPrayer'), 'Missing nextScheduledPrayer diagnostics in Java scheduler');
  assert.ok(settingsSubSrc.includes('Resync Now'), 'Missing 1-tap Resync Now recovery action in SettingsSubPage');
  assert.ok(settingsSubSrc.includes('nativeCount + reminderCount'), 'Missing nativeCount + reminderCount sum in SettingsSubPage');

  console.log(
    `[PASS] Part 4: Armed ${capturedNativeAlarms.length} future Fard native alarms & verified OS Kernel Next diagnostics`,
  );
  console.log(`ALL v3.0.9 HOTFIX VERIFICATION CHECKS PASSED in ${Date.now() - startMs}ms`);
}

runTests().catch((err) => {
  console.error('[FAIL] verify-v309-hotfix failed:', err);
  process.exit(1);
});
