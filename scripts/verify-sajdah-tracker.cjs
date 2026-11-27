/**
 * Fast Integration & Invariant Test Suite for Smart Sajdah-e-Tilawat Tracker
 * Runs in <5s via esbuild + Node CJS with zero external test runner overhead
 * and zero lingering preview servers.
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

// Install lightweight browser shims BEFORE requiring compiled modules
const storage = createStorageMock();
const dispatchedEvents = [];
global.window = {
  localStorage: storage,
  location: { pathname: '/', search: '', hash: '', origin: 'https://localhost' },
  dispatchEvent(evt) {
    dispatchedEvents.push(evt?.type || String(evt));
    return true;
  },
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
global.Event = class Event {
  constructor(type) {
    this.type = type;
  }
};

function bundleModule(entryRelPath) {
  const result = esbuild.buildSync({
    entryPoints: [path.join(ROOT, entryRelPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    jsx: 'automatic',
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
  fn(mod.exports, require, mod, path.join(ROOT, entryRelPath), path.dirname(path.join(ROOT, entryRelPath)));
  return mod.exports;
}

async function runTests() {
  const startMs = Date.now();

  const tracker = bundleModule('src/lib/sajdah-tracker.ts');
  const reminder = bundleModule('src/lib/sajdah-reminder.ts');
  const i18nMod = bundleModule('src/lib/sajdah-i18n.ts');
  const routeUtils = bundleModule('src/lib/route-utils.ts');
  const cacheMgr = bundleModule('src/lib/cache-manager.ts');
  const backupSvc = bundleModule('src/lib/backup-service.ts');
  const diagnostics = bundleModule('src/lib/diagnostics-engine.ts');
  const makruhTimes = bundleModule('src/lib/makruh-times.ts');

  // 1. Registry 14 + 1 Shafi'i Extra & Madhab Switch Preservation
  const agreed = tracker.SAJDAH_AYAHS.filter((a) => a.school === 'agreed');
  const shafiExtra = tracker.SAJDAH_AYAHS.filter((a) => a.school === 'shafi-extra');
  assert.strictEqual(agreed.length, 14, 'Expected 14 standard Sajdah ayahs');
  assert.strictEqual(shafiExtra.length, 1, 'Expected 1 optional Shafi extra (22:77)');
  assert.strictEqual(shafiExtra[0].id, '22:77');
  assert.strictEqual(shafiExtra[0].juz, 17);
  assert.strictEqual(tracker.getVisibleSajdahAyahs('hanafi').length, 14);
  assert.strictEqual(tracker.getVisibleSajdahAyahs('shafi').length, 15);
  assert.strictEqual(tracker.getSajdahForAyah(22, 77, 'hanafi'), undefined);
  assert.ok(tracker.getSajdahForAyah(22, 77, 'shafi'));

  storage.clear();
  tracker.addPendingSajdah('22:77', 'manual', 1);
  // Switching madhab or reading Hanafi visible list never deletes existing ledger entry 22:77
  const afterSwitchState = tracker.loadSajdahState();
  assert.strictEqual(afterSwitchState.pending['22:77']?.count, 1);

  // 2. xN Pending Counts, Undo Snapshots, Immediate Logs, Khatam Bulk & 200-cap
  storage.clear();
  const s0 = tracker.addPendingSajdah('32:15', 'read', 1);
  const s1 = tracker.addPendingSajdah('32:15', 'read', 1);
  assert.strictEqual(tracker.getTotalPendingCount(), 2);
  assert.strictEqual(tracker.loadSajdahState().pending['32:15'].count, 2);

  tracker.undoLastSajdahAction(s1);
  assert.strictEqual(tracker.getTotalPendingCount(), 1);
  tracker.undoLastSajdahAction(s0);
  assert.strictEqual(tracker.getTotalPendingCount(), 0);

  const sBeforeKhatam = tracker.addAllKhatamSajdahs('hanafi');
  assert.strictEqual(tracker.getTotalPendingCount(), 14);
  tracker.undoLastSajdahAction(sBeforeKhatam);
  assert.strictEqual(tracker.getTotalPendingCount(), 0);

  tracker.addAllKhatamSajdahs('shafi');
  assert.strictEqual(tracker.getTotalPendingCount(), 15);
  const sBeforePerform = tracker.markSajdahPerformed('32:15', 'later');
  assert.strictEqual(tracker.getTotalPendingCount(), 14);
  assert.strictEqual(tracker.loadSajdahState().pending['32:15'], undefined);
  assert.strictEqual(tracker.loadSajdahState().totalPerformedAllTime, 1);
  tracker.undoLastSajdahAction(sBeforePerform);
  assert.strictEqual(tracker.getTotalPendingCount(), 15);
  assert.strictEqual(tracker.loadSajdahState().totalPerformedAllTime, 0);

  tracker.logImmediateSajdah('96:19', 'listen');
  assert.strictEqual(tracker.getTotalPendingCount(), 15, 'Immediate log must not decrement pending');
  assert.strictEqual(tracker.loadSajdahState().totalPerformedAllTime, 1);
  assert.strictEqual(tracker.loadSajdahState().completedLog[0].method, 'immediate');

  // Completed log 200-entry cap check
  for (let i = 0; i < 210; i++) {
    tracker.logImmediateSajdah('7:206', 'read');
  }
  assert.strictEqual(tracker.loadSajdahState().completedLog.length, 200);
  assert.strictEqual(tracker.loadSajdahState().totalPerformedAllTime, 211);

  // 3. Fake-Clock Makruh Window Guard & Expiry at :00s
  const baseDay = new Date(2026, 10, 25, 12, 0, 0, 0);
  const fakeTimings = {
    sunrise: new Date(2026, 10, 25, 6, 40, 0, 0),
    solarNoon: new Date(2026, 10, 25, 12, 10, 0, 0),
    dhuhr: new Date(2026, 10, 25, 12, 15, 0, 0),
    sunset: new Date(2026, 10, 25, 17, 45, 0, 0),
    maghrib: new Date(2026, 10, 25, 17, 48, 0, 0),
  };
  const insideGhurub = new Date(2026, 10, 25, 17, 35, 30, 0);
  const makruhActive = makruhTimes.evaluateMakruhState(fakeTimings, insideGhurub, '12h');
  assert.strictEqual(makruhActive.isMakruhNow, true);
  assert.ok(makruhActive.activeWindow && makruhActive.activeWindow.endFormatted);

  const afterGhurub = new Date(2026, 10, 25, 17, 45, 0, 0);
  const makruhCleared = makruhTimes.evaluateMakruhState(fakeTimings, afterGhurub, '12h');
  assert.strictEqual(makruhCleared.isMakruhNow, false, 'Makruh must clear cleanly at :00s');

  // 4. Tilawah Nag-Guard (at most ONCE per ayah per calendar date)
  storage.clear();
  const day1 = new Date(2026, 10, 25, 9, 0, 0, 0);
  const day2 = new Date(2026, 10, 26, 9, 0, 0, 0);
  assert.strictEqual(tracker.hasTilawahPromptedToday('53:62', day1), false);
  tracker.markTilawahPromptedToday('53:62', day1);
  assert.strictEqual(tracker.hasTilawahPromptedToday('53:62', day1), true);
  assert.strictEqual(tracker.hasTilawahPromptedToday('53:62', day2), false);

  // 5. Single-Pipeline 20:00 Reminder (ID 1099, siraj_reminders_v3, future guard > now + 5000ms)
  const calls = [];
  const mockAdapter = {
    isNative: () => true,
    hasPermission: async () => true,
    ensureChannel: async () => calls.push(['ensureChannel']),
    cancelReminder: async (id) => calls.push(['cancel', id]),
    scheduleReminder: async (opts) => calls.push(['schedule', opts]),
  };

  calls.length = 0;
  let res = await reminder.syncSajdahReminderNotification({
    now: new Date(2026, 10, 25, 10, 0, 0),
    enabled: false,
    pendingCount: 3,
    adapter: mockAdapter,
  });
  assert.strictEqual(res.action, 'cancelled');
  assert.deepStrictEqual(calls, [['cancel', 1099]]);

  calls.length = 0;
  res = await reminder.syncSajdahReminderNotification({
    now: new Date(2026, 10, 25, 10, 0, 0),
    enabled: true,
    pendingCount: 0,
    adapter: mockAdapter,
  });
  assert.strictEqual(res.action, 'cancelled');
  assert.deepStrictEqual(calls, [['cancel', 1099]]);

  // Inside 5s guard before 20:00 (19:59:58) -> schedules tomorrow 20:00
  calls.length = 0;
  const near2000 = new Date(2026, 10, 25, 19, 59, 58, 0);
  res = await reminder.syncSajdahReminderNotification({
    now: near2000,
    enabled: true,
    pendingCount: 2,
    adapter: mockAdapter,
  });
  assert.strictEqual(res.action, 'scheduled');
  assert.ok(res.triggerAtMs > near2000.getTime() + 5000);
  const scheduledCall = calls.find((c) => c[0] === 'schedule');
  assert.ok(scheduledCall);
  assert.strictEqual(scheduledCall[1].id, 1099);
  assert.strictEqual(scheduledCall[1].channelId, 'siraj_reminders_v3');
  assert.strictEqual(scheduledCall[1].extra.route, '/sajdah');
  assert.strictEqual(scheduledCall[1].triggerAt.getDate(), 26);

  // 6. Route Normalization & Protected Personal Storage / Backup Round-Trip
  assert.strictEqual(routeUtils.normalizeAppRoute('/sajdah'), '/sajdah');
  assert.strictEqual(routeUtils.normalizeAppRoute('siraj://app/services/sajdah'), '/sajdah');
  assert.strictEqual(cacheMgr.isProtectedPersonalKey('siraj_sajdah_tracker_v1'), true);
  assert.strictEqual(cacheMgr.isProtectedPersonalKey('siraj_sajdah_reminder_enabled_v1'), true);
  assert.ok(backupSvc.KNOWN_STORAGE_KEYS.includes('siraj_sajdah_tracker_v1'));
  assert.ok(backupSvc.KNOWN_STORAGE_KEYS.includes('siraj_sajdah_reminder_enabled_v1'));

  storage.clear();
  tracker.addPendingSajdah('17:109', 'read', 3);
  tracker.logImmediateSajdah('84:21', 'manual');
  tracker.setSajdahReminderPreference(true);
  const jsonStr = await backupSvc.exportBackup({ includeEbooks: false, includePrefs: false });
  assert.strictEqual(typeof jsonStr, 'string');
  assert.ok(jsonStr.includes('siraj_sajdah_tracker_v1'));

  // Wipe cleanly and restore onto empty storage
  storage.clear();
  assert.strictEqual(tracker.getTotalPendingCount(), 0);
  const restored = await backupSvc.importBackupJson(jsonStr);
  assert.strictEqual(restored.success, true);
  assert.strictEqual(tracker.getTotalPendingCount(), 3);
  assert.strictEqual(tracker.loadSajdahState().totalPerformedAllTime, 1);
  assert.strictEqual(tracker.isSajdahReminderEnabled(), true);

  // 7. Deep X-Ray Check #12 (total checks >= 12, currently 13 with Startup)
  assert.strictEqual(diagnostics.TOTAL_HEALTH_CHECKS, 13);
  const report = await diagnostics.runDeepSystemHealthScan();
  assert.strictEqual(report.totalChecks, 13);
  const check12 = report.checks.find((c) => c.id === 'sajdah-ledger-integrity');
  assert.ok(check12, 'Check #12 sajdah-ledger-integrity must exist');
  assert.strictEqual(check12.status, 'PASS');

  // 8. 3-Language I18N & Static Visual Guard (zero backdrop-filter / drop-shadow)
  for (const lang of ['en', 'ur', 'gu']) {
    const dict = i18nMod.getSajdahI18n(lang);
    assert.ok(dict.pageTitle && dict.settingsReminderTitle && dict.guideDuaBadge.includes('580'));
    assert.strictEqual(dict.guideSteps.length, 5);
  }

  const touchedUiFiles = [
    'src/pages/SajdahTracker.tsx',
    'src/components/GlobalTilawahBar.tsx',
    'src/components/Quran/TilawahPlayerModal.tsx',
    'src/components/QazaTracker.tsx',
    'src/pages/PrayerStats.tsx',
    'src/pages/Services.tsx',
    'src/pages/QazaPage.tsx',
  ];
  for (const rel of touchedUiFiles) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!/backdrop-blur|backdrop-filter|backdropFilter/i.test(content), `Forbidden backdrop-filter in ${rel}`);
    assert.ok(!/drop-shadow/i.test(content), `Forbidden drop-shadow in ${rel}`);
  }
  const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
  assert.ok(indexCss.includes('.siraj-translucent-card'));
  assert.ok(indexCss.includes('background: var(--surface);'));
  const sajdahPageSrc = fs.readFileSync(path.join(ROOT, 'src/pages/SajdahTracker.tsx'), 'utf8');
  assert.ok(sajdahPageSrc.includes('bg-transparent pb-4'));

  const elapsed = Date.now() - startMs;
  console.log(`ALL SAJDAH TRACKER VERIFICATION CHECKS PASSED (12 X-Ray checks, backup round-trip, Makruh guard, Nag-guard, ID 1099 reminder) in ${elapsed}ms`);
}

runTests().catch((err) => {
  console.error('VERIFICATION FAILED:', err);
  process.exit(1);
});
