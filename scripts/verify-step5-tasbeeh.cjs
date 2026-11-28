const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const tasbeehSrc = fs.readFileSync(path.join(ROOT, 'src/pages/Tasbeeh.tsx'), 'utf8');
const zenSrc = fs.readFileSync(path.join(ROOT, 'src/components/TasbeehZenOverlay.tsx'), 'utf8');
const sheetSrc = fs.readFileSync(path.join(ROOT, 'src/components/TasbeehDhikrSheet.tsx'), 'utf8');

// 1. Both Zen Mode & Dhikr Selector Sheet portal to document.body at zIndex: 9999
assert.ok(zenSrc.includes('createPortal(') && zenSrc.includes('document.body'), 'Zen overlay must use createPortal(..., document.body)');
assert.ok(zenSrc.includes('zIndex: 9999'), 'Zen overlay must mount at zIndex: 9999');
assert.ok(zenSrc.includes('position: "fixed"') && zenSrc.includes('inset: 0'), 'Zen overlay must be position: fixed; inset: 0');
assert.ok(zenSrc.includes('height: "100dvh"'), 'Zen overlay must use 100dvh flexbox layout');
assert.ok(zenSrc.includes('data-state="open"') && zenSrc.includes('role="dialog"'), 'Zen overlay must expose dialog state for Android back dismissal');

assert.ok(sheetSrc.includes('createPortal(') && sheetSrc.includes('document.body'), 'Dhikr sheet must use createPortal(..., document.body)');
assert.ok(sheetSrc.includes('zIndex: 9999'), 'Dhikr sheet must mount at zIndex: 9999');
assert.ok(sheetSrc.includes('max-h-[70dvh] overflow-y-auto'), 'Dhikr sheet must cap height to 70dvh with internal scroll');
assert.ok(sheetSrc.includes('data-state="open"') && sheetSrc.includes('role="dialog"'), 'Dhikr sheet must expose dialog state for Android back dismissal');
assert.ok(sheetSrc.includes('Custom Dhikr') && sheetSrc.includes('customArabic'), 'Dhikr sheet must include Custom Dhikr option');

// 2. Centered clamped numeral, w-52 h-52 ring, 80ms bounce guard, stopPropagation on controls
assert.ok(zenSrc.includes('w-52 h-52'), 'Zen overlay must render w-52 h-52 progress ring');
assert.ok(zenSrc.includes('clamp(44px, 14vw, 68px)'), 'Zen count numeral must clamp between 44px and 68px');
assert.ok(!zenSrc.includes('text-[12rem]') && !zenSrc.includes('text-[15rem]'), 'Oversized top-clipped Zen numeral must be removed');
assert.ok(zenSrc.includes('MULTI_TOUCH_BOUNCE_GUARD_MS = 80'), 'Zen overlay must enforce 80ms multi-touch bounce guard');
assert.ok(zenSrc.includes('tasbeeh-zen-ripple'), 'Zen overlay must render GPU tap ripple');

// Verify stopPropagation on Exit Zen, Reset, and Feedback toggle
const exitBlock = zenSrc.slice(zenSrc.indexOf('zen-exit-btn'), zenSrc.indexOf('zen-reset-btn'));
assert.ok(exitBlock.includes('e.stopPropagation()'), 'Exit Zen button must call stopPropagation()');
const resetBlock = zenSrc.slice(zenSrc.indexOf('zen-reset-btn'));
assert.ok(resetBlock.includes('e.stopPropagation()'), 'Reset button in Zen must call stopPropagation()');
const feedbackBlock = zenSrc.slice(zenSrc.indexOf('zen-feedback-toggle'), zenSrc.indexOf('Center Tap Zone'));
assert.ok(feedbackBlock.includes('e.stopPropagation()'), 'Sound/Haptic toggle in Zen must call stopPropagation()');

// 3. Inline overlapping Select removed from Tasbeeh.tsx
assert.ok(!tasbeehSrc.includes('<SelectContent') && !tasbeehSrc.includes('<SelectTrigger'), 'Inline overlapping Radix Select dropdown must be replaced by portal sheet');
assert.ok(tasbeehSrc.includes('<TasbeehDhikrSheet') && tasbeehSrc.includes('<TasbeehZenOverlay'), 'Tasbeeh.tsx must render TasbeehDhikrSheet & TasbeehZenOverlay');

// 4. Safety & CSS sentinel invariants across all 3 files
for (const [name, src] of [
  ['Tasbeeh.tsx', tasbeehSrc],
  ['TasbeehZenOverlay.tsx', zenSrc],
  ['TasbeehDhikrSheet.tsx', sheetSrc],
]) {
  assert.ok(!src.includes('backdrop-filter'), `${name} must NOT use backdrop-filter`);
  assert.ok(!src.includes('drop-shadow'), `${name} must NOT use SVG drop-shadow`);
  assert.ok(!/[\u0900-\u097F]/.test(src) && !/\bHindi\b/i.test(src), `${name} must NOT contain Hindi text`);
  assert.ok(!/catch\s*(\([^)]*\))?\s*\{\s*\}/.test(src), `${name} must NOT contain empty catch blocks`);
}

console.log('ALL STEP 5 TASBEEH ZEN & DHIKR PORTAL VERIFICATION CHECKS PASSED!');
