const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { buildSync } = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

// 1. Verify zero "redeemption" typo across src/ and public/
function scanFilesForTypo(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanFilesForTypo(full);
    } else if (/\.(ts|tsx|js|jsx|json|css|html|md)$/i.test(entry.name)) {
      const content = fs.readFileSync(full, 'utf8');
      if (full.endsWith('IslamicRemedies.tsx')) continue; // sanitizer regex legitimately mentions pattern
      assert.ok(
        !/redeemption/i.test(content),
        `Found misspelled "redeemption" in ${path.relative(ROOT, full)}`
      );
    }
  }
}
scanFilesForTypo(path.join(ROOT, 'src'));
scanFilesForTypo(path.join(ROOT, 'public'));

// 2. Load mood-data.ts and verify strictly 12 real moods with zero blanks
const moodBundle = buildSync({
  entryPoints: [path.join(ROOT, 'src/data/mood-data.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  external: ['lucide-react'],
});
const moodMod = { exports: {} };
new Function('require', 'module', 'exports', moodBundle.outputFiles[0].text)(
  (id) => (id === 'lucide-react' ? new Proxy({}, { get: () => () => null }) : require(id)),
  moodMod,
  moodMod.exports
);

const { moods } = moodMod.exports;
assert.strictEqual(moods.length, 12, `Expected 12 moods, got ${moods.length}`);
for (const mood of moods) {
  assert.ok(mood.id && mood.label && mood.description, `Mood ${mood.id} missing label or description`);
  assert.ok(Array.isArray(mood.content) && mood.content.length > 0, `Mood ${mood.id} has empty content`);
  for (const item of mood.content) {
    assert.ok(!/redeemption/i.test(item.category || ''), `Mood ${mood.id} contains typo tag ${item.category}`);
  }
}
console.log(`[Moods] Verified ${moods.length} non-empty mood cards (6 rows x 2 cols, 0 blank cards)`);

// 3. Verify --player-inset wiring across index.css, players, LayoutManager, Duas, HadithDetail
const indexCss = fs.readFileSync(path.join(ROOT, 'src/index.css'), 'utf8');
const playerInsetLib = fs.readFileSync(path.join(ROOT, 'src/lib/player-inset.ts'), 'utf8');
const layoutMgr = fs.readFileSync(path.join(ROOT, 'src/components/LayoutManager.tsx'), 'utf8');
const toastTsx = fs.readFileSync(path.join(ROOT, 'src/components/ui/toast.tsx'), 'utf8');
const radioPlayer = fs.readFileSync(path.join(ROOT, 'src/components/GlobalRadioPlayer.tsx'), 'utf8');
const quranPlayer = fs.readFileSync(path.join(ROOT, 'src/components/GlobalQuranPlayer.tsx'), 'utf8');
const nasheedPlayer = fs.readFileSync(path.join(ROOT, 'src/components/GlobalNasheedPlayer.tsx'), 'utf8');
const tilawahBar = fs.readFileSync(path.join(ROOT, 'src/components/GlobalTilawahBar.tsx'), 'utf8');
const duasPage = fs.readFileSync(path.join(ROOT, 'src/pages/Duas.tsx'), 'utf8');
const hadithDetail = fs.readFileSync(path.join(ROOT, 'src/components/hadith/HadithDetail.tsx'), 'utf8');

assert.ok(indexCss.includes('--player-inset: 0px;'), 'src/index.css must define --player-inset: 0px on :root');
assert.ok(playerInsetLib.includes("maxInset > 0 ? `${Math.ceil(maxInset) + 8}px` : '0px'"), 'player-inset.ts must compute height + 8px or 0px');
assert.ok(layoutMgr.includes('var(--player-inset, 0px)'), 'LayoutManager.tsx must include var(--player-inset, 0px)');
assert.ok(duasPage.includes('var(--player-inset, 0px)'), 'Duas.tsx must include var(--player-inset, 0px)');
assert.ok(hadithDetail.includes('var(--player-inset, 0px)'), 'HadithDetail.tsx must include var(--player-inset, 0px)');
for (const [name, src] of [
  ['GlobalRadioPlayer', radioPlayer],
  ['GlobalQuranPlayer', quranPlayer],
  ['GlobalNasheedPlayer', nasheedPlayer],
  ['GlobalTilawahBar', tilawahBar],
]) {
  assert.ok(src.includes('usePlayerInsetRef'), `${name} must register height via usePlayerInsetRef`);
}

assert.ok(toastTsx.includes('max-w-[328px]') && toastTsx.includes('left-4 right-4'), 'ToastViewport must center inside left-4 right-4 max-w-[328px]');
assert.ok(toastTsx.includes('calc(var(--safe-top, 34px) + 58px)'), 'ToastViewport must sit below header');

// 4. Verify IslamicRemedies.tsx and RemedyFavorites.tsx layout, theme tokens, 3-lang lock & zero banned patterns
const remediesSrc = fs.readFileSync(path.join(ROOT, 'src/pages/IslamicRemedies.tsx'), 'utf8');
const favSrc = fs.readFileSync(path.join(ROOT, 'src/pages/RemedyFavorites.tsx'), 'utf8');

assert.ok(remediesSrc.includes('w-full max-w-full min-h-screen overflow-x-hidden bg-transparent'), 'Remedies root must lock 360px overflow-x-hidden');
assert.ok(remediesSrc.includes('w-full max-w-full overflow-x-auto no-scrollbar'), 'Filter strip must use isolated horizontal scroll');
assert.ok(remediesSrc.includes('flex flex-nowrap items-center gap-2'), 'Filter strip must use flex-nowrap');
assert.ok(remediesSrc.includes('grid grid-cols-2 gap-2.5'), 'Mood grid must use 2-column compact layout');
assert.ok(!remediesSrc.includes('sm:grid-cols-3'), 'Mood grid must NOT use 3-column breakpoint');
assert.ok(!remediesSrc.includes('moodCardVariants'), 'Mood grid must NOT use hidden Framer Motion stagger cards');
assert.ok(remediesSrc.includes('marginBottom: "var(--player-inset, 0px)"'), 'Detail action row must use --player-inset');
assert.ok(remediesSrc.includes('calc(12px + env(safe-area-inset-top, 0px))'), 'Detail header must include safe-area top padding');
assert.ok(remediesSrc.includes('formatTagTitleCase'), 'Detail tags must format to Title Case');

for (const [name, src] of [
  ['IslamicRemedies.tsx', remediesSrc],
  ['RemedyFavorites.tsx', favSrc],
  ['player-inset.ts', playerInsetLib],
]) {
  for (const banned of ['backdrop-filter', 'drop-shadow', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-teal-500', 'bg-primary', '#2196F3', '#FF9800']) {
    assert.ok(!src.includes(banned), `${name} must NOT contain off-theme/disallowed "${banned}"`);
  }
  assert.ok(!/[\u0900-\u097F]/.test(src) && !/\bHindi\b/i.test(src), `${name} must NOT contain Hindi text`);
  assert.ok(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(src), `${name} must NOT contain empty catch blocks`);

  const lines = src.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('color-mix(')) {
      const prev = lines[idx - 1] || '';
      assert.ok(prev.includes('background: var(--'), `${name}:${idx + 1} color-mix() must be preceded by plain var(--surface*) fallback`);
    }
  });
}

console.log('ALL STEP 4 REMEDIES & PLAYER-INSET VERIFICATION CHECKS PASSED!');
