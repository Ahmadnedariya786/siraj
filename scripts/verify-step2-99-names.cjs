/**
 * Fast Verification Gate — Final Step 2 of 7:
 * 1. Name Detail Modal uses createPortal(..., document.body) at zIndex: 9999
 * 2. ZERO backdrop-filter / SVG drop-shadow / empty catch
 * 3. ZERO Hindi language options; all 99 Names have EN / UR / GU meanings & reflections
 * 4. ZERO intersection-hidden / AnimatePresence / content-visibility cards
 *
 * Run: node scripts/verify-step2-99-names.cjs
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');

async function loadDataTs() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/components/NamesOfAllahData.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'error',
    write: false,
    alias: { '@': path.join(ROOT, 'src') },
  });
  const mod = { exports: {} };
  const fn = new Function('require', 'module', 'exports', result.outputFiles[0].text);
  fn(require, mod, mod.exports);
  return mod.exports;
}

async function run() {
  const data = await loadDataTs();
  assert.strictEqual(data.NAMES_OF_ALLAH.length, 99, 'Must contain all 99 Names of Allah');
  for (let i = 0; i < 99; i++) {
    const item = data.NAMES_OF_ALLAH[i];
    assert.strictEqual(item.number, i + 1, `Name #${i + 1} number mismatch`);
    assert.ok(item.arabic && item.transliteration, `Missing arabic/transliteration on #${i + 1}`);
    for (const lang of ['en', 'ur', 'gu']) {
      assert.ok(item[lang]?.meaning?.trim(), `Missing ${lang}.meaning on #${i + 1}`);
      assert.ok(item[lang]?.reflection?.trim(), `Missing ${lang}.reflection on #${i + 1}`);
    }
  }

  assert.deepStrictEqual(Object.keys(data.NAMES_UI_I18N).sort(), ['en', 'gu', 'ur'], 'Strictly 3 languages (en/ur/gu)');

  const modalSrc = fs.readFileSync(path.join(ROOT, 'src/components/NamesDetailModal.tsx'), 'utf8');
  assert.ok(modalSrc.includes('createPortal(modalNode, document.body)'), 'Modal must render via createPortal(..., document.body)');
  assert.ok(modalSrc.includes('zIndex: 9999'), 'Modal portal overlay must use zIndex: 9999');
  assert.ok(modalSrc.includes('useBodyScrollLock'), 'Modal must lock background scroll');
  assert.ok(modalSrc.includes('onPrev') && modalSrc.includes('onNext'), 'Modal must support Prev/Next switcher');

  const pageSrc = fs.readFileSync(path.join(ROOT, 'src/pages/NamesOfAllah.tsx'), 'utf8');
  assert.ok(!pageSrc.includes('AnimatePresence') && !pageSrc.includes('motion.'), '99 Names list must NOT use framer-motion AnimatePresence');
  assert.ok(!pageSrc.includes('IntersectionObserver'), '99 Names list must NOT use IntersectionObserver hiding');
  assert.ok(!pageSrc.includes('content-visibility') && !pageSrc.includes('contentVisibility'), '99 Names list must NOT use mismatched content-visibility');
  assert.ok(pageSrc.includes('bg-transparent') || pageSrc.includes("background: 'transparent'"), 'Outer page container must be transparent');
  assert.ok(!pageSrc.includes('hi.json') && !/hindi|हिन्दी/i.test(pageSrc + modalSrc), 'ZERO Hindi allowed');

  const dataSrc = fs.readFileSync(path.join(ROOT, 'src/components/NamesOfAllahData.ts'), 'utf8');
  for (const [name, src] of [
    ['NamesDetailModal.tsx', modalSrc],
    ['NamesOfAllah.tsx', pageSrc],
    ['NamesOfAllahData.ts', dataSrc],
  ]) {
    assert.ok(!/backdrop-filter|backdrop-blur/i.test(src), `${name} must NOT use backdrop-filter`);
    assert.ok(!/drop-shadow/i.test(src), `${name} must NOT use drop-shadow`);
    assert.ok(!/catch\s*(?:\([^)]*\))?\s*\{\s*\}/.test(src), `${name} must NOT have empty catch blocks`);
    assert.ok(!/[\u0900-\u097F]/.test(src), `${name} must NOT contain Devanagari/Hindi script`);
  }

  console.log('ALL STEP 2 (99 NAMES) VERIFICATION CHECKS PASSED!');
}

run().catch((err) => {
  console.error('STEP 2 VERIFICATION FAILED:', err);
  process.exit(1);
});
