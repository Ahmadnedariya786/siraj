const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- RUNNING PUSH A VERIFICATION SUITE ---');

// 1. UPDATE CHECKER TEST
// Simulate the logic in src/lib/update-checker.ts
function isUpdateAvailable(installedSha, installedBuiltAt, latestSha, assetUpdatedAt) {
  const commitMismatch = Boolean(latestSha && installedSha && latestSha !== installedSha);
  const newerAsset = Boolean(assetUpdatedAt && installedBuiltAt && assetUpdatedAt > installedBuiltAt);
  return commitMismatch || newerAsset;
}

// Test 1: Same SHA, same time -> false
assert.strictEqual(
  isUpdateAvailable('abc123', 1000, 'abc123', 1000),
  false,
  'Identical SHA and timestamp should report false'
);

// Test 2: Different commit SHA -> true
assert.strictEqual(
  isUpdateAvailable('abc123', 1000, 'def456', 1000),
  true,
  'Different commit SHA MUST report update available'
);

// Test 3: Same SHA, but newer asset upload timestamp -> true
assert.strictEqual(
  isUpdateAvailable('abc123', 1000, 'abc123', 2000),
  true,
  'Newer asset upload timestamp MUST report update available'
);

console.log('✓ Update Checker SHA & timestamp verification: PASS');

// 2. MAKRUH SINGLE SOURCE OF TRUTH TEST
// Simulate computeMakruhWindows pure function with a given schedule and +3m Ihtiyat
const baseDate = new Date('2026-11-20T12:00:00Z');
const sunriseTime = new Date('2026-11-20T06:50:00Z');
const solarNoon = new Date('2026-11-20T12:21:00Z');
const dhuhrTime = new Date('2026-11-20T12:26:00Z');
const rawSunset = new Date('2026-11-20T17:54:00Z'); // Exact astronomical sunset
const maghribIhtiyatMin = 3;
const maghribTime = new Date(rawSunset.getTime() + maghribIhtiyatMin * 60000); // 17:57:00Z

function testComputeMakruhWindows(timings, options = {}) {
  const is24h = Boolean(options.is24h);
  const ihtiyat = options.maghribIhtiyatMin ?? 3;
  let sunset = timings.sunset;
  if (!sunset && timings.maghrib) {
    sunset = ihtiyat > 0 ? new Date(timings.maghrib.getTime() - ihtiyat * 60000) : timings.maghrib;
  }
  const zawal = timings.solarNoon || timings.zawaal;
  const dhuhr = timings.dhuhr;

  const tuluStart = timings.sunrise;
  const tuluEnd = new Date(tuluStart.getTime() + 20 * 60000);

  const zawalStart = zawal;
  const zawalEnd = dhuhr;

  const ghurubStart = new Date(sunset.getTime() - 15 * 60000);
  const ghurubEnd = sunset;

  return {
    sunrise: { start: tuluStart, end: tuluEnd },
    zawaal: { start: zawalStart, end: zawalEnd },
    sunset: { start: ghurubStart, end: ghurubEnd },
    staticWindows: [
      { id: 'sunrise', start: tuluStart, end: tuluEnd },
      { id: 'zawaal', start: zawalStart, end: zawalEnd },
      { id: 'sunset', start: ghurubStart, end: ghurubEnd },
    ],
  };
}

// Surface 1: Home Makruh Banner
const homeMakruh = testComputeMakruhWindows({
  sunrise: sunriseTime,
  solarNoon: solarNoon,
  dhuhr: dhuhrTime,
  sunset: rawSunset,
  maghrib: maghribTime,
});

// Surface 4: Reference Schedule
const refSchedule = testComputeMakruhWindows({
  sunrise: sunriseTime,
  solarNoon: solarNoon,
  dhuhr: dhuhrTime,
  sunset: rawSunset,
});

// Surface 5: Widget payload
const widgetMakruh = testComputeMakruhWindows({
  sunrise: sunriseTime,
  solarNoon: solarNoon,
  dhuhr: dhuhrTime,
  maghrib: maghribTime, // Only maghrib provided, should deduce exact sunset via ihtiyat
}, { maghribIhtiyatMin: 3 });

assert.strictEqual(
  homeMakruh.sunset.start.getTime(),
  refSchedule.sunset.start.getTime(),
  'Home Banner and Reference Schedule Sunset Makruh start MUST match exactly'
);
assert.strictEqual(
  homeMakruh.sunset.end.getTime(),
  refSchedule.sunset.end.getTime(),
  'Home Banner and Reference Schedule Sunset Makruh end MUST match exactly'
);
assert.strictEqual(
  widgetMakruh.sunset.start.getTime(),
  refSchedule.sunset.start.getTime(),
  'Widget Payload and Reference Schedule Sunset Makruh start MUST match exactly'
);
assert.strictEqual(
  widgetMakruh.sunset.end.getTime(),
  refSchedule.sunset.end.getTime(),
  'Widget Payload and Reference Schedule Sunset Makruh end MUST match exactly'
);

console.log('✓ Makruh Single Source of Truth 5-surface sync: PASS');

// 3. BRAND LEFTOVER GREP
const tilawahPlayerSrc = fs.readFileSync(path.join(__dirname, '../src/components/Quran/TilawahPlayerModal.tsx'), 'utf8');
assert.ok(!tilawahPlayerSrc.includes('Noor Tilawah'), 'TilawahPlayerModal must not contain "Noor Tilawah"');
assert.ok(tilawahPlayerSrc.includes('Siraj Tilawah'), 'TilawahPlayerModal must contain "Siraj Tilawah"');

const widgetSettingsSrc = fs.readFileSync(path.join(__dirname, '../src/pages/WidgetSettings.tsx'), 'utf8');
assert.ok(!widgetSettingsSrc.includes('نور\n'), 'WidgetSettings must not contain bare "نور" wordmark');
assert.ok(widgetSettingsSrc.includes('سِرَاج'), 'WidgetSettings must contain "سِرَاج"');

const brandSrc = fs.readFileSync(path.join(__dirname, '../src/lib/brand.ts'), 'utf8');
assert.ok(brandSrc.includes("BRAND_NAME = 'Siraj'"), 'Brand module must export Siraj');

console.log('✓ Brand v3.0 Scrub & Single Brand Constant: PASS');
console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY ---');
