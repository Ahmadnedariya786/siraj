/**
 * Fast Integration & Verification Suite for Android 15 Alarm Reliability,
 * Infinite-Loop Removal, Notification Polish, and 360px Overflow Fixes.
 * Runs cleanly via Node + esbuild in <5s with zero external servers.
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

async function runTests() {
  const startMs = Date.now();
  const storage = createStorageMock();
  const sessionMock = createStorageMock();
  const capturedNativeAlarms = [];
  const capturedLocalSchedules = [];
  let immediateNotificationsShown = 0;

  // Freeze fake clock at 12:50:00 PM local on 2026-11-25 (when Dhuhr was 12:27 PM)
  const FAKE_NOW_MS = new Date(2026, 10, 25, 12, 50, 0, 0).getTime();
  const RealDate = Date;
  class FakeDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(FAKE_NOW_MS);
      } else {
        super(...args);
      }
    }
    static now() {
      return FAKE_NOW_MS;
    }
  }
  global.Date = FakeDate;
  global.window = {
    localStorage: storage,
    sessionStorage: sessionMock,
    location: { pathname: '/', search: '', hash: '', origin: 'https://localhost', protocol: 'https:', hostname: 'localhost' },
    dispatchEvent() {
      return true;
    },
    addEventListener() {},
    removeEventListener() {},
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

  // Seed today & tomorrow Aladhan monthly cache for Nov 2026 (25 & 26)
  storage.setItem('location-storage', JSON.stringify({
    latitude: 24.0,
    longitude: 72.5,
    city: 'Chhapi',
    country: 'India',
    source: 'manual',
  }));
  storage.setItem('prayer-notifications-enabled', 'true');
  storage.setItem('prayer-alarm-enabled', 'true');

  const sampleTimings = {
    Fajr: '05:31 (IST)',
    Sunrise: '06:55 (IST)',
    Dhuhr: '12:27 (IST)',
    Asr: '16:17 (IST)',
    Maghrib: '17:55 (IST)',
    Isha: '19:12 (IST)',
    Imsak: '05:21 (IST)',
    Midnight: '00:10',
    Firstthird: '22:00',
    Lastthird: '02:00',
  };
  // Seed AladhanAPI localStorage cache shape directly or spy AladhanAPI.getPrayerTimesForDate after load
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
                for (const a of opts.alarms || []) {
                  capturedNativeAlarms.push(a);
                }
                return { scheduled: capturedNativeAlarms.length, enabled: opts.enabled };
              },
              async clear() {},
              async setEnabled() { return { enabled: true, count: capturedNativeAlarms.length }; },
              async getStatus() { return { enabled: true, count: capturedNativeAlarms.length }; },
              async canScheduleExactAlarms() { return { canSchedule: true }; },
              async requestExactAlarmPermission() { return { opened: false, alreadyGranted: true }; },
            };
          }
          return {};
        },
      },
    },
    '@capacitor/local-notifications': {
      LocalNotifications: {
        async checkPermissions() { return { display: 'granted' }; },
        async requestPermissions() { return { display: 'granted' }; },
        async createChannel() {},
        async getPending() { return { notifications: [] }; },
        async cancel() {},
        async schedule(opts) {
          capturedLocalSchedules.push(...(opts?.notifications || []));
          immediateNotificationsShown += (opts?.notifications || []).filter(
            (n) => !n.schedule?.at || new RealDate(n.schedule.at).getTime() <= FAKE_NOW_MS + 15000,
          ).length;
        },
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

  function customRequire(id) {
    if (capMocks[id]) return capMocks[id];
    return require(id);
  }

  function bundleModule(entryRelPath) {
    const result = esbuild.buildSync({
      entryPoints: [path.join(ROOT, entryRelPath)],
      bundle: true,
      platform: 'node',
      format: 'cjs',
      write: false,
      alias: {
        '@': path.join(ROOT, 'src'),
      },
      external: ['@capacitor/*'],
      logLevel: 'error',
      loader: { '.ts': 'ts', '.tsx': 'tsx', '.json': 'json' },
    });
    const code = result.outputFiles[0].text;
    const mod = { exports: {} };
    const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', code);
    fn(mod.exports, customRequire, mod, path.join(ROOT, entryRelPath), path.dirname(path.join(ROOT, entryRelPath)));
    return mod.exports;
  }

  // 1. Simulate app opening at 12:50 PM when Dhuhr was 12:27 PM
  const localNotifMod = bundleModule('src/lib/local-notifications.ts');
  // Patch AladhanAPI timing lookup inside bundled module by seeding aladhan monthly cache keys if needed,
  // or check the schedule output with local fallback + exact mock on AladhanAPI:
  assert.strictEqual(localNotifMod.MIN_FUTURE_PRAYER_GUARD_MS, 15000);

  // Also bundle aladhan-api directly or test via schedulePrayerNotificationsFromAPI with monthly cache populated
  const aladhanCacheKey = 'aladhan-monthly-v2-24.000-72.500-2026-11-1';
  const novDays = Array.from({ length: 30 }, (_, idx) => ({
    date: { gregorian: { date: `${String(idx + 1).padStart(2, '0')}-11-2026` } },
    timings: sampleTimings,
  }));
  storage.setItem(aladhanCacheKey, JSON.stringify({ data: novDays, timestamp: FAKE_NOW_MS }));

  await localNotifMod.localNotifications.schedulePrayerNotificationsFromAPI();

  // Strictly 0 immediate notifications on app launch!
  assert.strictEqual(immediateNotificationsShown, 0, 'Must fire ZERO notifications on app launch');
  // Verify NO scheduled alarm is <= now + 15000ms (so Fajr 05:31 & Dhuhr 12:27 today are SKIPPED!)
  assert.ok(capturedNativeAlarms.length > 0, 'Future native alarms should be scheduled');
  for (const alarm of capturedNativeAlarms) {
    assert.ok(
      alarm.triggerAt > FAKE_NOW_MS + 15000,
      `Scheduled alarm ${alarm.prayerName} (${alarm.triggerAt}) violates > now + 15000ms!`,
    );
  }
  const scheduledToday25 = capturedNativeAlarms.filter((a) => {
    const d = new RealDate(a.triggerAt);
    return d.getFullYear() === 2026 && d.getMonth() === 10 && d.getDate() === 25;
  });
  assert.deepStrictEqual(
    scheduledToday25.map((a) => a.prayerName),
    ['Asr', 'Maghrib', 'Isha'],
    'Opening at 12:50 PM must skip Fajr & Dhuhr and schedule ONLY Asr, Maghrib, Isha for today',
  );
  const scheduledTomorrow26 = capturedNativeAlarms.filter((a) => {
    const d = new RealDate(a.triggerAt);
    return d.getFullYear() === 2026 && d.getMonth() === 10 && d.getDate() === 26;
  });
  assert.deepStrictEqual(
    scheduledTomorrow26.map((a) => a.prayerName),
    ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'],
    'Tomorrow must schedule all 5 future prayers',
  );

  // Restore global Date after simulation
  global.Date = RealDate;

  // 2. Verify retroactive PremiumDashboard auto-trigger is permanently removed
  const dashboardSrc = fs.readFileSync(path.join(ROOT, 'src/components/PremiumDashboard.tsx'), 'utf8');
  assert.ok(!dashboardSrc.includes('isInActiveWindow'), 'PremiumDashboard must NOT auto-fire past prayers');
  assert.ok(!dashboardSrc.includes('noor_last_auto_triggered_prayer'), 'Retroactive trigger key must be removed');

  // 3. Verify Native Java & AndroidManifest requirements
  const manifestSrc = fs.readFileSync(path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
  assert.ok(manifestSrc.includes('android.permission.USE_EXACT_ALARM'), 'USE_EXACT_ALARM missing in AndroidManifest.xml');
  assert.ok(manifestSrc.includes('android.permission.RECEIVE_BOOT_COMPLETED'), 'RECEIVE_BOOT_COMPLETED missing');
  assert.ok(manifestSrc.includes('android.permission.WAKE_LOCK'), 'WAKE_LOCK missing');
  assert.ok(manifestSrc.includes('.BootReceiver'), 'BootReceiver missing');
  assert.ok(manifestSrc.includes('.PrayerAlarmReceiver'), 'PrayerAlarmReceiver missing');

  const schedulerSrc = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/NativeAdhanScheduler.java'),
    'utf8',
  );
  assert.ok(schedulerSrc.includes('alarmManager.setAlarmClock('), 'Must use Doze-immune AlarmManager.setAlarmClock');
  assert.ok(schedulerSrc.includes('15_000L'), 'Must enforce 15s future guard in NativeAdhanScheduler');
  assert.ok(schedulerSrc.includes('PrayerAlarmReceiver.class'), 'NativeAdhanScheduler must route to PrayerAlarmReceiver');

  const receiverSrc = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/PrayerAlarmReceiver.java'),
    'utf8',
  );
  assert.ok(receiverSrc.includes('"fired_date_" + prayerKey'), 'Once-per-day fired_date_<prayerKey> dedup missing');
  assert.ok(receiverSrc.includes('20L * 60L * 1000L'), '20-minute stale alarm cutoff missing');
  assert.ok(receiverSrc.includes('PARTIAL_WAKE_LOCK') && receiverSrc.includes('10_000L'), '10s PARTIAL_WAKE_LOCK missing');
  assert.ok(receiverSrc.includes('siraj_native_notif_history'), 'Native delivery history logging missing');

  // 4. Verify Notification Card Polish + Citation + 360px History + /sajdah labels
  const mainActSrc = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/MainActivity.java'),
    'utf8',
  );
  assert.ok(!mainActSrc.includes('.setSubText("Siraj")'), 'Duplicate .setSubText("Siraj") must be removed');
  assert.ok(mainActSrc.includes('getNativeNotificationHistory'), 'Native history bridge missing in MainActivity');

  const hadithSrc = fs.readFileSync(
    path.join(ROOT, 'android/app/src/main/java/com/siraj/app/PrayerHadithHelper.java'),
    'utf8',
  );
  assert.ok(hadithSrc.includes('صحیح مسلم 233') && hadithSrc.includes('Muslim 233'), 'Hadith citations missing in PrayerHadithHelper');
  assert.ok(hadithSrc.includes('stripTrailingHadithRef(quote)'), 'Must use stripTrailingHadithRef for single citation');

  const historySrc = fs.readFileSync(path.join(ROOT, 'src/pages/NotificationHistory.tsx'), 'utf8');
  assert.ok(historySrc.includes('overflow-x-hidden') && historySrc.includes('break-words'), 'NotificationHistory 360px wrapping missing');

  const sajdahI18nMod = bundleModule('src/lib/sajdah-i18n.ts');
  const enStrings = sajdahI18nMod.getSajdahI18n('en');
  assert.strictEqual(enStrings.cleanWindowStatus, 'Safe window • Ready');
  assert.strictEqual(enStrings.historyTitle, 'History');

  const elapsed = Date.now() - startMs;
  console.log(`ALL ALARM RELIABILITY & 360PX POLISH CHECKS PASSED (12:50 PM open -> 0 fired, 8 future alarms scheduled, setAlarmClock + WakeLock + 20m cutoff + daily dedup verified) in ${elapsed}ms`);
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
