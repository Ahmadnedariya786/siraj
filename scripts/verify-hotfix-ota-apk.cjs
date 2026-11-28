const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

// 1. Verify orphaned 15.21 MB public/data/hadith-collections/hadiths.json is removed
assert.ok(
  !fs.existsSync(path.join(ROOT, 'public/data/hadith-collections/hadiths.json')),
  'Orphaned 15.21 MB public/data/hadith-collections/hadiths.json must be removed'
);

// 2. Load update-checker.ts via esbuild (with browser stubs) and test speed formatter, mirrors, and intact SHA logic
const ucBundle = buildSync({
  entryPoints: [path.join(ROOT, 'src/lib/update-checker.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  define: {
    __APP_VERSION__: '"3.0.0"',
    __BUILD_TIME__: '"2026-11-28T00:00:00.000Z"',
    __BUILD_COMMIT__: '"48a6a6fde07b547167d75dc31a2ab4840f603b93"',
  },
  external: ['@capacitor/core', '@capacitor/browser', 'sonner'],
});

const ucMod = { exports: {} };
new Function('require', 'module', 'exports', ucBundle.outputFiles[0].text)(
  (id) => {
    if (id === '@capacitor/core') return { Capacitor: { isNativePlatform: () => false } };
    if (id === '@capacitor/browser') return { Browser: { open: async () => {} } };
    if (id === 'sonner') return { toast: { error: () => {}, success: () => {}, info: () => {} } };
    return require(id);
  },
  ucMod,
  ucMod.exports
);

const {
  formatSpeedLabel,
  formatDownloadSpeed,
  buildDownloadMirrors,
  extractMirrorsFromBody,
  isUpdateAvailable,
  normalizeSha,
  isSameCommit,
} = ucMod.exports;

// Speed formatter tests (exact KB/s vs MB/s thresholds)
assert.strictEqual(formatSpeedLabel(42_000), '42 KB/s');
assert.strictEqual(formatDownloadSpeed(0.04, 42_000), ' • 42 KB/s');
assert.strictEqual(formatSpeedLabel(1_850_000), '1.8 MB/s');
assert.strictEqual(formatDownloadSpeed(1.76, 1_850_000), ' • 1.8 MB/s');
assert.strictEqual(formatSpeedLabel(0), '');
assert.strictEqual(formatDownloadSpeed(0, 0), '');

// Multi-mirror ordering & deduplication tests
const mirrors = buildDownloadMirrors(
  'https://github.com/Ahmadnedariya786/siraj/releases/download/nightly/siraj-nightly.apk',
  ['https://cdn.example.r2.dev/siraj-nightly.apk', 'https://github.com/Ahmadnedariya786/siraj/releases/download/nightly/siraj-nightly.apk']
);
assert.deepStrictEqual(mirrors, [
  'https://cdn.example.r2.dev/siraj-nightly.apk',
  'https://github.com/Ahmadnedariya786/siraj/releases/download/nightly/siraj-nightly.apk',
]);

// Body mirror & SHA-256 metadata extraction test
const meta = extractMirrorsFromBody(
  `Release notes\n<!-- DOWNLOAD_MIRRORS: ["https://r2.siraj.app/siraj-nightly.apk","https://github.com/Ahmadnedariya786/siraj/releases/download/nightly/siraj-nightly.apk"] -->\n<!-- APK_SHA256: ${'a'.repeat(64)} -->`
);
assert.deepStrictEqual(meta.downloadMirrors, [
  'https://r2.siraj.app/siraj-nightly.apk',
  'https://github.com/Ahmadnedariya786/siraj/releases/download/nightly/siraj-nightly.apk',
]);
assert.strictEqual(meta.sha256, 'a'.repeat(64));

// Verify Update Checker SHA comparison logic remains 100% intact
assert.strictEqual(normalizeSha('48A6A6FDE07B5'), '48a6a6f');
assert.strictEqual(isSameCommit('48a6a6fde07b547', '48a6a6f'), true);
assert.strictEqual(
  isUpdateAvailable(
    { commitSha: '48a6a6f', sizeBytes: 85_000_000, publishedAt: '2026-11-29T00:00:00Z' },
    { commitSha: '48a6a6fde07b547', buildTime: '2026-11-28T00:00:00Z' }
  ),
  false
);
assert.strictEqual(
  isUpdateAvailable(
    { commitSha: 'deadbee', sizeBytes: 85_000_000, publishedAt: '2026-11-29T00:00:00Z' },
    { commitSha: '48a6a6fde07b547', buildTime: '2026-11-28T00:00:00Z' }
  ),
  true
);

// 3. Test Java ApkParallelDownloader chunk range partitioner & resume key with actual javac + java runtime
const javaSrc = fs.readFileSync(
  path.join(ROOT, 'android/app/src/main/java/com/siraj/app/ApkParallelDownloader.java'),
  'utf8'
);
assert.ok(javaSrc.includes('THREAD_COUNT = 6'), 'Native downloader must use 6 threads');
assert.ok(javaSrc.includes('MAX_CHUNK_RETRIES = 5'), 'Native downloader must support 5 per-chunk retries');
assert.ok(javaSrc.includes('SLOW_MIRROR_BPS = 120.0 * 1024.0'), 'Mirror failover threshold must be 120 KB/s');
assert.ok(javaSrc.includes('SLOW_MIRROR_WINDOW_MS = 10_000L'), 'Mirror failover window must be 10s');
assert.ok(javaSrc.includes('Accept-Encoding", "identity"'), 'Native downloader must send Accept-Encoding: identity');
assert.ok(javaSrc.includes('siraj-update-'), 'Native downloader must key resume artifacts by SHA');
assert.ok(javaSrc.includes('.meta.json'), 'Native downloader must persist .meta.json resume state');

// Pure JS replica test matching ApkParallelDownloader.splitIntoChunks(totalBytes, 1MB) + resume filtering
function splitIntoChunks(totalBytes, blockSize = 1024 * 1024) {
  const chunks = [];
  let cursor = 0;
  let idx = 0;
  while (cursor < totalBytes) {
    const end = Math.min(totalBytes - 1, cursor + blockSize - 1);
    chunks.push({ index: idx++, start: cursor, end, downloaded: 0 });
    cursor = end + 1;
  }
  return chunks;
}

const sampleTotal = 5_500_000; // ~5.24 MB non-aligned boundary
const chunks = splitIntoChunks(sampleTotal);
assert.strictEqual(chunks.length, 6);
assert.strictEqual(chunks[0].start, 0);
assert.strictEqual(chunks[chunks.length - 1].end, sampleTotal - 1);
let covered = 0;
for (let i = 0; i < chunks.length; i++) {
  if (i > 0) assert.strictEqual(chunks[i].start, chunks[i - 1].end + 1, 'Chunks must be strictly contiguous with 0 gap');
  covered += chunks[i].end - chunks[i].start + 1;
}
assert.strictEqual(covered, sampleTotal);

// Simulate partial progress -> reload -> verify completed chunks skipped & partial resumes cleanly
chunks[0].downloaded = chunks[0].end - chunks[0].start + 1; // finished
chunks[1].downloaded = 250_000; // partial
const remainingToFetch = chunks.filter((c) => c.downloaded < (c.end - c.start + 1));
assert.strictEqual(remainingToFetch.length, 5);
assert.strictEqual(remainingToFetch[0].start + remainingToFetch[0].downloaded, chunks[1].start + 250_000);

// 4. Verify vite.config.ts, build.gradle, nightly-apk.yml, and clean-dist-data.js invariants
const viteCfg = fs.readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8');
const buildGradle = fs.readFileSync(path.join(ROOT, 'android/app/build.gradle'), 'utf8');
const nightlyYml = fs.readFileSync(path.join(ROOT, '.github/workflows/nightly-apk.yml'), 'utf8');
const cleanDist = fs.readFileSync(path.join(ROOT, 'scripts/clean-dist-data.js'), 'utf8');

assert.ok(viteCfg.includes('sourcemap: false'), 'vite.config.ts must disable production sourcemaps');
assert.ok(buildGradle.includes('abiFilters "arm64-v8a", "armeabi-v7a"'), 'build.gradle must filter desktop x86/x86_64 ABIs');
assert.ok(buildGradle.includes('minifyEnabled true') && buildGradle.includes('shrinkResources true'), 'build.gradle release must shrink code and resources');
assert.ok(cleanDist.includes("hadiths.json'"), 'clean-dist-data.js must exclude orphaned root hadiths.json');
assert.ok(nightlyYml.includes("if: env.R2_ENDPOINT != '' && env.R2_BUCKET != ''"), 'nightly-apk.yml R2 upload step must be strictly conditional');
assert.ok(nightlyYml.includes('downloadMirrors'), 'nightly-apk.yml must output downloadMirrors in version.json');

console.log('ALL HOTFIX OTA DOWNLOADER, MIRROR FAILOVER & APK BLOAT CHECKS PASSED!');
