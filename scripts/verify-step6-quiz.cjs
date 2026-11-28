const fs = require('fs');
const path = require('path');
const assert = require('assert');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const TOUCHED_FILES = [
  'src/lib/quiz-economy.ts',
  'src/lib/quiz-manager.ts',
  'src/lib/quiz-store.ts',
  'src/lib/mystery-box.ts',
  'src/lib/lives-system.ts',
  'src/lib/psychological-hooks.ts',
  'src/components/quiz/QuizLucideIcon.tsx',
  'src/components/quiz/QuizStore.tsx',
  'src/components/quiz/MysteryBoxPanel.tsx',
  'src/components/quiz/DailyRewards.tsx',
  'src/components/quiz/LivesDisplay.tsx',
  'src/components/quiz/LossAversionBanner.tsx',
  'src/components/quiz/GameModeSelector.tsx',
  'src/components/AchievementDisplay.tsx',
  'src/pages/EnhancedIslamicQuiz.tsx',
];

console.log('--- Step 6 Static Audit ---');
for (const rel of TOUCHED_FILES) {
  const src = readText(rel);
  assert(!/backdrop-filter|backdropFilter|backdrop-blur/i.test(src), `Forbidden backdrop-filter in ${rel}`);
  assert(!/drop-shadow/i.test(src), `Forbidden drop-shadow in ${rel}`);
  assert(!/catch\s*\([^)]*\)\s*\{\s*\}/.test(src) && !/catch\s*\{\s*\}/.test(src), `Empty catch block in ${rel}`);
  // Ensure 3-language lock: no Hindi Devanagari block \u0900-\u097F
  assert(!/[\u0900-\u097F]/.test(src), `Forbidden Hindi characters in ${rel}`);
  // No giant mystery box / party emojis in UI JSX
  assert(!/🎁|🎉|✂️|⏰|💡|⏭️/.test(src), `Raw emoji found in ${rel}; use QuizLucideIcon`);
}

// UI-specific assertions
const storeSrc = readText('src/components/quiz/QuizStore.tsx');
assert(storeSrc.includes('useQuizEconomy'), 'QuizStore must subscribe to useQuizEconomy');
assert(!storeSrc.includes('hidden sm:inline'), 'Store tab labels must be visible on 360px screens');
assert(!/<h3[^>]*truncate/.test(storeSrc), 'Store item titles must allow clean 2-line wrap without truncate');
assert(storeSrc.includes('>Basic<') && storeSrc.includes('>Boosters<') && storeSrc.includes('>Premium<'), 'Store must render 3 labeled tabs: Basic, Boosters, Premium');
assert(storeSrc.includes('Need {deficit} XP more'), 'Store must show Need X XP more when unaffordable');

const boxSrc = readText('src/components/quiz/MysteryBoxPanel.tsx');
assert(boxSrc.includes('useQuizEconomy'), 'MysteryBoxPanel must subscribe to useQuizEconomy');
assert(boxSrc.includes('createPortal'), 'MysteryBoxPanel must portal opening/reveal modals via createPortal');
assert(boxSrc.includes('zIndex: 9999'), 'MysteryBoxPanel reveal portal must use zIndex: 9999');
assert(boxSrc.includes('Claim &amp; Continue') || boxSrc.includes('Claim & Continue'), 'MysteryBoxPanel must show Claim & Continue CTA');
assert(!/setTimeout\([^,]+,\s*(9\d\d|[1-9]\d{3,})\s*\)/.test(boxSrc), 'MysteryBoxPanel opening animation must be <= 800ms');

const quizSrc = readText('src/pages/EnhancedIslamicQuiz.tsx');
assert(quizSrc.includes('useQuizEconomy'), 'EnhancedIslamicQuiz must subscribe to useQuizEconomy');
assert(quizSrc.includes('explanationRef'), 'EnhancedIslamicQuiz must auto-scroll to explanationRef');
assert(quizSrc.includes('var(--player-inset, 0px)'), 'EnhancedIslamicQuiz must pad bottom CTA above --player-inset');
assert(quizSrc.includes('handleGameplayBack') && quizSrc.includes('nativeBackPressed'), 'EnhancedIslamicQuiz must intercept back & hardware back to return to Quiz Lobby');
assert(quizSrc.includes('createPortal') && quizSrc.includes('role="dialog"') && quizSrc.includes('data-state="open"'), 'EnhancedIslamicQuiz must render portal confirm-discard dialog with role="dialog" data-state="open"');

console.log('Static audit passed across all', TOUCHED_FILES.length, 'files!');

// --- Runtime functional test of bundled Quiz Economy + Store + MysteryBox + QuizManager ---
console.log('--- Step 6 Runtime Economy & Migration Tests ---');
const bundleResult = esbuild.buildSync({
  stdin: {
    contents: `
      export { quizEconomy, QUIZ_ECONOMY_STORAGE_KEY } from './src/lib/quiz-economy.ts';
      export { quizManager } from './src/lib/quiz-manager.ts';
      export { quizStore } from './src/lib/quiz-store.ts';
      export { mysteryBoxSystem } from './src/lib/mystery-box.ts';
      export { livesSystem } from './src/lib/lives-system.ts';
    `,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  write: false,
  alias: {
    '@': path.join(ROOT, 'src'),
  },
});

const memStore = new Map();
global.localStorage = {
  getItem(k) {
    return memStore.has(k) ? memStore.get(k) : null;
  },
  setItem(k, v) {
    memStore.set(k, String(v));
  },
  removeItem(k) {
    memStore.delete(k);
  },
  clear() {
    memStore.clear();
  },
};

const mod = { exports: {} };
const fn = new Function('exports', 'require', 'module', bundleResult.outputFiles[0].text);
fn(mod.exports, require, mod);

const {
  quizEconomy,
  QUIZ_ECONOMY_STORAGE_KEY,
  quizManager,
  quizStore,
  mysteryBoxSystem,
  livesSystem,
} = mod.exports;

// 1. Legacy migration: seed legacy keys only (no siraj_quiz_state_v1)
memStore.clear();
localStorage.setItem('enhanced-quiz-stats', JSON.stringify({ xp: 100, bestStreak: 4 }));
localStorage.setItem('quiz-inventory', JSON.stringify({ items: { hint: 2 }, activeBoosters: [] }));
quizEconomy.refreshFromStorage();

assert.strictEqual(quizEconomy.getState().xp, 100, 'Migrated legacy XP must equal 100');
assert.strictEqual(quizManager.getStats().xp, 100, 'quizManager.getStats().xp must match 100');
assert.strictEqual(quizStore.getXPSummary().current, 100, 'quizStore.getXPSummary().current must match 100');
assert.strictEqual(quizStore.getItemQuantity('hint'), 2, 'Migrated hint powerup count must equal 2');

// 2. Add +50 XP -> synchronized across all services -> 150 XP
quizEconomy.addXP(50, 'Test bonus', false);
assert.strictEqual(quizEconomy.getState().xp, 150, 'Unified XP after +50 should be 150');
assert.strictEqual(quizManager.getStats().xp, 150, 'quizManager XP after +50 should be 150');
assert.strictEqual(quizStore.getXPSummary().current, 150, 'quizStore XP after +50 should be 150');

// 3. Purchase 50 XP item ('fifty_fifty') -> XP decrements by 50 (100 XP), owned +1 globally
const beforeOwned = quizStore.getItemQuantity('fifty_fifty');
const purchaseRes = quizStore.purchaseItem('fifty_fifty');
assert.strictEqual(purchaseRes.success, true, 'Purchase of 50 XP item must succeed');
assert.strictEqual(quizEconomy.getState().xp, 100, 'XP must decrement by 50 -> 100');
assert.strictEqual(quizManager.getStats().xp, 100, 'quizManager XP must decrement to 100');
assert.strictEqual(quizStore.getItemQuantity('fifty_fifty'), beforeOwned + 1, 'Store inventory owned must increment +1');
assert.strictEqual(
  quizManager.getPowerUps().find((p) => p.id === 'fifty_fifty').uses,
  beforeOwned + 1,
  'quizManager.getPowerUps uses must increment +1 atomically'
);

// Verify canonical localStorage key contains updated XP & powerups
const persisted = JSON.parse(localStorage.getItem(QUIZ_ECONOMY_STORAGE_KEY));
assert.strictEqual(persisted.xp, 100);
assert.strictEqual(persisted.powerups.fifty_fifty, beforeOwned + 1);

// 4. Deterministic Mystery Box opening (+25 XP drop via rng = 0.99 on daily_free_box)
const boxesBefore = mysteryBoxSystem.getTotalBoxesOpened();
assert.strictEqual(mysteryBoxSystem.canClaimDailyBox(), true, 'Daily free box should initially be claimable');
const openRes = mysteryBoxSystem.openBox('daily_free_box', () => 0.99);
assert.strictEqual(openRes.success, true, 'Opening daily_free_box must succeed');
assert.strictEqual(openRes.results[0].itemId, 'xp_25', 'Deterministic 0.99 roll must hit xp_25 drop');
assert.strictEqual(quizEconomy.getState().xp, 125, 'XP must immediately reflect +25 XP drop -> 125');
assert.strictEqual(mysteryBoxSystem.getTotalBoxesOpened(), boxesBefore + 1, 'totalBoxesOpened must increment +1');
assert.strictEqual(mysteryBoxSystem.canClaimDailyBox(), false, 'Daily box cannot be double-claimed same day');

// 5. Lives refill spend sync
livesSystem.useLife();
assert.strictEqual(livesSystem.getCurrentLives(), 4, 'Using 1 life reduces lives to 4');
const refillRes = livesSystem.refillLivesWithXP();
assert.strictEqual(refillRes.success, true, 'Refill 100 XP must succeed when xp=125');
assert.strictEqual(quizEconomy.getState().xp, 25, 'Lives refill must deduct 100 XP -> 25');
assert.strictEqual(livesSystem.getCurrentLives(), 5, 'Lives restored to 5');

// 6. Store tabs partition check (all 21 store items distributed across 3 non-empty tabs)
const items = quizStore.getStoreItems();
const basicTab = items.filter((i) => i.type !== 'booster' && i.type !== 'protection' && i.category === 'basic');
const boosterTab = items.filter((i) => i.type === 'booster' || i.type === 'protection');
const premiumTab = items.filter(
  (i) => i.type !== 'booster' && i.type !== 'protection' && (i.category === 'premium' || i.category === 'legendary')
);
assert(basicTab.length > 0 && boosterTab.length > 0 && premiumTab.length > 0, 'All 3 tabs must be non-empty');
assert.strictEqual(basicTab.length + boosterTab.length + premiumTab.length, items.length, 'Every store item belongs cleanly to one of 3 tabs');

console.log('ALL STEP 6 STATIC & RUNTIME CHECKS PASSED!');
