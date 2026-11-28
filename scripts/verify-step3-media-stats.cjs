const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function loadTsModule(relPath) {
  const result = buildSync({
    entryPoints: [path.join(ROOT, relPath)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    write: false,
    external: ['@capacitor/preferences'],
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', code);
  fn(
    (id) => {
      if (id === '@capacitor/preferences') {
        return {
          Preferences: {
            get: async () => ({ value: null }),
            set: async () => {},
          },
        };
      }
      return require(id);
    },
    mod,
    mod.exports
  );
  return mod.exports;
}

const statsLib = loadTsModule('src/lib/radio-stats.ts');
const achievementsLib = loadTsModule('src/lib/radio-achievements.ts');

// Fixture 1: Video-verified skewed ratio that previously produced Top=98.3% vs Breakdown=100.0%+1.3%+0.4%=101.7%
const fixture1 = [
  { stationId: 's1', stationName: 'Madinah Live', totalSeconds: 983, sessionCount: 10, lastListened: 1000 },
  { stationId: 's2', stationName: 'Makkah Radio', totalSeconds: 13, sessionCount: 2, lastListened: 900 },
  { stationId: 's3', stationName: 'Tafsir Stream', totalSeconds: 4, sessionCount: 1, lastListened: 800 },
];

// Fixture 2: Equal 3-way split (33.333...% each) requiring largest-remainder allocation to hit 100.0%
const fixture2 = [
  { stationId: 'a', stationName: 'Station A', totalSeconds: 100, sessionCount: 2, lastListened: 300 },
  { stationId: 'b', stationName: 'Station B', totalSeconds: 100, sessionCount: 3, lastListened: 200 },
  { stationId: 'c', stationName: 'Station C', totalSeconds: 100, sessionCount: 1, lastListened: 100 },
];

// Fixture 3: Multi-station fractional remainders + zero-second idle station
const fixture3 = [
  { stationId: 'm1', stationName: 'M1', totalSeconds: 3600, sessionCount: 12, lastListened: 500 },
  { stationId: 'm2', stationName: 'M2', totalSeconds: 1200, sessionCount: 4, lastListened: 400 },
  { stationId: 'm3', stationName: 'M3', totalSeconds: 333, sessionCount: 2, lastListened: 300 },
  { stationId: 'm4', stationName: 'M4', totalSeconds: 111, sessionCount: 1, lastListened: 200 },
  { stationId: 'm5', stationName: 'M5', totalSeconds: 7, sessionCount: 1, lastListened: 100 },
  { stationId: 'm0', stationName: 'Idle', totalSeconds: 0, sessionCount: 0, lastListened: 50 },
];

[fixture1, fixture2, fixture3].forEach((fixture, idx) => {
  const summary = statsLib.computeNormalizedMediaSummary(fixture);
  const sumPct = summary.stations.reduce((acc, s) => acc + s.sharePct, 0);
  const sumTenths = summary.stations.reduce((acc, s) => acc + s.shareTenths, 0);
  assert.strictEqual(sumTenths, 1000, `Fixture ${idx + 1} shareTenths must equal 1000, got ${sumTenths}`);
  assert.ok(Math.abs(sumPct - 100.0) < 1e-9, `Fixture ${idx + 1} shares must sum to 100.0%, got ${sumPct}`);
  assert.ok(summary.topStation, `Fixture ${idx + 1} topStation must exist`);
  assert.strictEqual(
    summary.topStation.sharePct,
    summary.stations[0].sharePct,
    `Fixture ${idx + 1} topStationPct must equal breakdown[0].sharePct`
  );
  assert.ok(
    summary.topStation.sharePct <= sumPct,
    `Fixture ${idx + 1} topStationPct must be <= category total`
  );
  console.log(
    `[Fixture ${idx + 1}] sum=${sumPct.toFixed(1)}% topStation=${summary.topStation.sharePct.toFixed(1)}% shares=[${summary.stations
      .map((s) => s.sharePct.toFixed(1) + '%')
      .join(', ')}]`
  );
});

// Empty / zero fixture check
const emptySummary = statsLib.computeNormalizedMediaSummary([]);
assert.strictEqual(emptySummary.totalSeconds, 0);
assert.strictEqual(emptySummary.topStation, null);
assert.strictEqual(emptySummary.stations.length, 0);

// Achievements 3-language lock check (strictly en, ur, gu — zero Hindi)
const langs = Object.keys(achievementsLib.ACHIEVEMENT_I18N).sort();
assert.deepStrictEqual(langs, ['en', 'gu', 'ur'], `Expected ['en', 'gu', 'ur'], got ${langs}`);
for (const achievement of achievementsLib.ACHIEVEMENTS) {
  for (const lang of langs) {
    const entry = achievementsLib.ACHIEVEMENT_I18N[lang][achievement.id];
    assert.ok(entry && entry.title && entry.description, `Missing ${lang} localization for ${achievement.id}`);
  }
}

// Static UI & performance assertions on Step 3 files
const radioStatsSrc = fs.readFileSync(path.join(ROOT, 'src/pages/RadioStats.tsx'), 'utf8');
const radioStatsLibSrc = fs.readFileSync(path.join(ROOT, 'src/lib/radio-stats.ts'), 'utf8');
const radioAchievementsSrc = fs.readFileSync(path.join(ROOT, 'src/lib/radio-achievements.ts'), 'utf8');

for (const [name, src] of [
  ['RadioStats.tsx', radioStatsSrc],
  ['radio-stats.ts', radioStatsLibSrc],
  ['radio-achievements.ts', radioAchievementsSrc],
]) {
  assert.ok(!src.includes('backdrop-filter'), `${name} must NOT use backdrop-filter`);
  assert.ok(!src.includes('drop-shadow'), `${name} must NOT use drop-shadow`);
  assert.ok(!src.includes('box-shadow'), `${name} must NOT use heavy box-shadow glows`);
  assert.ok(!/[\u0900-\u097F]/.test(src) && !/\bHindi\b/i.test(src), `${name} must NOT contain Hindi text`);
  assert.ok(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(src), `${name} must NOT contain empty catch blocks`);
}

assert.ok(radioStatsSrc.includes('React.memo') || radioStatsSrc.includes('= memo('), 'RadioStats must memoize card components');
assert.ok(radioStatsSrc.includes('useMemo('), 'RadioStats must derive summary with useMemo');
assert.ok(!radioStatsSrc.includes('useGlobalRadio'), 'RadioStats must NOT subscribe to 1s useGlobalRadio tick');
assert.ok(radioStatsSrc.includes('subscribeMediaStats'), 'RadioStats must subscribe to decoupled media stats update event');
assert.ok(radioStatsSrc.includes('REFRESH_MINUTES_INTERVAL_MS = 30000'), 'RadioStats must throttle background check to >=30s');
assert.ok(radioStatsSrc.includes('grid-cols-2 gap-2.5'), 'Achievements grid must use 2 columns with gap-2.5 for 360px');
assert.ok(!radioStatsSrc.includes('grid-cols-3'), 'Cramped grid-cols-3 achievements grid must be removed');
assert.ok(radioStatsSrc.includes('bg-transparent'), 'Outer container must remain transparent for 8-theme pattern');

// Verify plain CSS fallback immediately precedes every color-mix() rule
const colorMixLines = radioStatsSrc.split('\n').map((l, i) => ({ line: l, num: i + 1 })).filter((x) => x.line.includes('color-mix('));
assert.ok(colorMixLines.length >= 4, 'Expected color-mix() luxury card styling');
const lines = radioStatsSrc.split('\n');
for (const { num } of colorMixLines) {
  const prevLine = lines[num - 2] || '';
  assert.ok(prevLine.includes('background: var(--'), `Line ${num} color-mix() must have plain CSS fallback on preceding line ${num - 1}: got "${prevLine.trim()}"`);
}

console.log('ALL STEP 3 MEDIA STATS VERIFICATION CHECKS PASSED!');
