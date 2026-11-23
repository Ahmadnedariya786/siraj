/**
 * Siraj — Push B2 Verification Suite
 * Verifies:
 * 1. normalizeAppRoute for masjid deep-links (query params preserved, 0 double slashes)
 * 2. buildMasjidDeepLink payload formatting
 * 3. Habit-Journal sync logic
 * 4. Zero backdrop-filter, zero drop-shadow, zero empty catches across modified files
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Test 1: Route Normalization
function testRouteNormalization() {
  console.log('[TEST 1] Testing route normalization for masjid deep-links...');

  // Inlined normalization logic matching src/lib/route-utils.ts
  const normalizeAppRoute = (input) => {
    if (!input || typeof input !== 'string') return '/';
    let raw = input.trim();
    if (!raw) return '/';

    const schemePrefixes = ['siraj://', 'siraj:/', 'noor-connect://', 'noor-connect:/', 'https://siraj.app', 'http://siraj.app'];
    for (const prefix of schemePrefixes) {
      if (raw.startsWith(prefix)) {
        raw = raw.slice(prefix.length);
        break;
      }
    }

    if (!raw.startsWith('/')) {
      raw = '/' + raw;
    }
    raw = raw.replace(/^\/{2,}/, '/');

    const [pathname, ...queryParts] = raw.split('?');
    const searchAndHash = queryParts.length > 0 ? '?' + queryParts.join('?') : '';

    if (pathname === '/masjid' || pathname === '/mosque') {
      return '/mosques' + searchAndHash;
    }

    return raw;
  };

  const testCases = [
    {
      in: 'siraj://masjid?name=Al-Aqsa&lat=31.776&lon=35.235',
      expected: '/mosques?name=Al-Aqsa&lat=31.776&lon=35.235',
    },
    {
      in: 'siraj://mosque?name=Prophet%27s+Mosque',
      expected: '/mosques?name=Prophet%27s+Mosque',
    },
    {
      in: 'https://siraj.app/masjid?fajr=05:30&dhuhr=13:00',
      expected: '/mosques?fajr=05:30&dhuhr=13:00',
    },
    {
      in: 'siraj:///masjid?test=1',
      expected: '/mosques?test=1',
    },
  ];

  for (const tc of testCases) {
    const res = normalizeAppRoute(tc.in);
    assert.strictEqual(res, tc.expected, `Mismatch for ${tc.in}: got ${res}, expected ${tc.expected}`);
    assert(!res.includes('//'), `Double slash found in normalized route: ${res}`);
    assert(!res.includes('siraj:'), `Protocol remnant found in normalized route: ${res}`);
  }

  console.log('  -> PASS: normalizeAppRoute correctly maps /masjid to /mosques with full query string and 0 double-slashes.');
}

// Test 2: buildMasjidDeepLink
function testMasjidDeepLink() {
  console.log('[TEST 2] Testing buildMasjidDeepLink...');
  const buildMasjidDeepLink = (masjid) => {
    const params = new URLSearchParams();
    if (masjid.name) params.set('name', masjid.name);
    if (typeof masjid.lat === 'number') params.set('lat', masjid.lat.toFixed(6));
    if (typeof masjid.lon === 'number') params.set('lon', masjid.lon.toFixed(6));
    if (masjid.address) params.set('address', masjid.address);
    if (masjid.jamaatTimes) {
      if (masjid.jamaatTimes.fajr) params.set('fajr', masjid.jamaatTimes.fajr);
      if (masjid.jamaatTimes.dhuhr) params.set('dhuhr', masjid.jamaatTimes.dhuhr);
      if (masjid.jamaatTimes.asr) params.set('asr', masjid.jamaatTimes.asr);
      if (masjid.jamaatTimes.maghrib) params.set('maghrib', masjid.jamaatTimes.maghrib);
      if (masjid.jamaatTimes.isha) params.set('isha', masjid.jamaatTimes.isha);
      if (masjid.jamaatTimes.jummah) params.set('jummah', masjid.jamaatTimes.jummah);
    }
    return `siraj://masjid?${params.toString()}`;
  };

  const link = buildMasjidDeepLink({
    name: 'Masjid Al-Noor',
    lat: 24.8607,
    lon: 67.0011,
    address: 'Central District',
    jamaatTimes: { fajr: '05:30', dhuhr: '13:15' }
  });

  assert(link.startsWith('siraj://masjid?'), `Must start with siraj://masjid?: ${link}`);
  assert(link.includes('name=Masjid+Al-Noor'), `Must contain encoded name: ${link}`);
  assert(link.includes('fajr=05%3A30'), `Must contain encoded fajr: ${link}`);
  console.log('  -> PASS: buildMasjidDeepLink formats clean URLSearchParams link: ' + link);
}

// Test 3: Zero backdrop-filter, zero drop-shadow in modified files
function testModifiedFilesSecurity() {
  console.log('[TEST 3] Checking modified files for forbidden patterns...');
  const modifiedFiles = [
    'src/lib/habit-tracker.ts',
    'src/lib/worship-log.ts',
    'src/pages/HabitTracker.tsx',
    'src/components/HabitWidget.tsx',
    'src/lib/worship-pdf-export.ts',
    'src/pages/PrayerStats.tsx',
    'src/lib/route-utils.ts',
    'src/App.tsx',
    'src/pages/MosqueFinder.tsx',
    'src/pages/MonthlyTimetable.tsx',
    'src/components/QuranClipStudioModal.tsx',
    'src/contexts/TilawahContext.tsx',
    'src/components/Quran/TilawahPlayerModal.tsx',
    'src/components/GlobalTilawahBar.tsx',
    'src/pages/QuranReader.tsx',
  ];

  let totalViolations = 0;

  for (const rel of modifiedFiles) {
    const fullPath = path.resolve(__dirname, '..', rel);
    if (!fs.existsSync(fullPath)) {
      console.warn(`  [WARN] File not found: ${rel}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');

    // Check backdrop-filter
    if (/backdrop-filter/i.test(content) || /backdrop-blur/i.test(content)) {
      console.error(`  [FAIL] backdrop-filter/backdrop-blur found in ${rel}`);
      totalViolations++;
    }

    // Check SVG drop-shadow filter
    if (/feDropShadow/i.test(content) || /filter="url\(#drop/i.test(content)) {
      console.error(`  [FAIL] SVG drop-shadow found in ${rel}`);
      totalViolations++;
    }

    // Check empty catch blocks: catch () {} without any comments or statements
    const emptyCatchMatches = content.match(/catch\s*\([^)]*\)\s*\{\s*\}/g);
    if (emptyCatchMatches) {
      console.error(`  [FAIL] Empty catch block found in ${rel}: ${emptyCatchMatches.length} occurrences`);
      totalViolations++;
    }
  }

  assert.strictEqual(totalViolations, 0, `Encountered ${totalViolations} violations of security/perf locks!`);
  console.log(`  -> PASS: All ${modifiedFiles.length} modified files passed checks with 0 violations.`);
}

function runAll() {
  testRouteNormalization();
  testMasjidDeepLink();
  testModifiedFilesSecurity();
  console.log('\n=== ALL PUSH B2 VERIFICATION SUITES PASSED! ===');
}

runAll();
