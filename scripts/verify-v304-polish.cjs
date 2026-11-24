/**
 * Automated Verification Script for Siraj v3.0.4 Polish:
 * 1. Ayah Image Card canvas preview on tab switch
 * 2. Clip Studio toast clearance above footer CTA bar
 * 3. SettingsWidgetsPage live preview single-line strip & quick-pin labels
 * 4. Deep X-Ray dynamic 11-check labels
 * 5. Daily Hadith narrator flex-wrap on 360px viewport
 */
const fs = require('fs');
const path = require('path');

let errors = [];
function assert(condition, message) {
  if (!condition) {
    errors.push(message);
    console.error(`❌ FAIL: ${message}`);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('--- 1. VERIFYING QuranClipStudioModal.tsx ---');
const clipModal = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'QuranClipStudioModal.tsx'), 'utf8');
assert(clipModal.includes("activeTab === 'image'"), 'Handles activeTab === image');
assert(clipModal.includes('ASPECT_RATIO_PRESETS[aspectRatio].image'), 'Sets non-zero image dimensions on activeTab === image');
assert(clipModal.includes('drawProceduralScene(ctx, targetSceneId, dims.width, dims.height, 0, 1.04)'), 'Draws procedural scene on Ayah Image Card canvas');
assert(clipModal.includes('drawClipOverlay(ctx, dims.width, dims.height, 1.0)'), 'Draws watermark overlay on Ayah Image Card canvas');
assert(clipModal.includes('top-[58px]') && clipModal.includes('modalToast'), 'Dedicated top-floating toast slot right below modal header');
assert(!clipModal.includes("bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))'"), 'Old bottom-overlapping toast removed');
assert(clipModal.includes('resolveSceneForAyah'), 'Imports resolveSceneForAyah for dynamic auto-meaning scene resolution');

console.log('\n--- 2. VERIFYING SettingsWidgetsPage & widget-customizer ---');
const widgetSettings = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'WidgetSettings.tsx'), 'utf8');
assert(widgetSettings.includes("item.time.replace(/\\s*(?:AM|PM|am|pm)/i, '').trim()"), '5-Prayer strip times stripped of AM/PM for single-line display');
assert(widgetSettings.includes("slot.time.replace(/\\s*(?:AM|PM|am|pm)/i, '').trim()"), '6-Prayer strip times stripped of AM/PM for single-line display');
assert(widgetSettings.includes("strings.pinCircularClock.replace(/^\\+\\s*/, '')"), 'Quick-pin button drops redundant leading "+ "');

const widgetCustomizer = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'widget-customizer.ts'), 'utf8');
assert(widgetCustomizer.includes("pinCircularClock: 'Circular Clock'"), "pinCircularClock is clean 'Circular Clock'");
assert(widgetCustomizer.includes("pinCompactStrip: '6-Prayer Strip'"), "pinCompactStrip is clean '6-Prayer Strip'");

console.log('\n--- 3. VERIFYING Deep X-Ray Diagnostics (Dynamic 11 checks) ---');
const diagEngine = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'diagnostics-engine.ts'), 'utf8');
assert(diagEngine.includes('export const TOTAL_HEALTH_CHECKS = 11;'), 'diagnostics-engine exports TOTAL_HEALTH_CHECKS = 11');
assert(diagEngine.includes('${scan.totalChecks}-POINT SUBSYSTEM HEALTH SCAN'), 'Markdown report header is dynamic');

const settingsSubPage = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'SettingsSubPage.tsx'), 'utf8');
assert(settingsSubPage.includes('${TOTAL_HEALTH_CHECKS} Ready'), 'Deep X-Ray pre-scan badge uses ${TOTAL_HEALTH_CHECKS} Ready');
assert(settingsSubPage.includes('Scanning {TOTAL_HEALTH_CHECKS} Subsystems...'), 'Deep X-Ray scanning text uses {TOTAL_HEALTH_CHECKS} Subsystems');
assert(settingsSubPage.includes('{healthScanReport.totalChecks} Subsystem Checks'), 'Deep X-Ray post-scan checklist header uses dynamic totalChecks');
assert(!settingsSubPage.includes("'8 Ready'"), "Zero hardcoded '8 Ready'");
assert(!settingsSubPage.includes('8 Subsystem Checks'), 'Zero hardcoded "8 Subsystem Checks"');

console.log('\n--- 4. VERIFYING Daily Hadith 360px Narrator Wrapping ---');
const dailyHadith = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'EnhancedDailyHadith.tsx'), 'utf8');
assert(dailyHadith.includes('flex-wrap gap-x-3 gap-y-1.5'), 'Daily Hadith narrator/source strip uses flex-wrap gap-x-3 gap-y-1.5');
assert(!dailyHadith.includes('min-w-0 truncate bidi-plaintext'), 'Narrator container truncation removed to prevent mid-word clipping');

console.log('\n--- 5. CHECKING ZERO BACKDROP-FILTER IN TOUCHED FILES ---');
const touchedFiles = [
  'src/components/EnhancedDailyHadith.tsx',
  'src/lib/diagnostics-engine.ts',
  'src/pages/SettingsSubPage.tsx',
  'src/pages/WidgetSettings.tsx',
  'src/lib/widget-customizer.ts',
  'src/components/QuranClipStudioModal.tsx'
];
touchedFiles.forEach(f => {
  const content = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  assert(!content.includes('backdrop-filter') && !content.includes('backdrop-blur'), `${f} has ZERO backdrop-filter / backdrop-blur`);
});

if (errors.length > 0) {
  console.error(`\n❌ VERIFICATION FAILED: ${errors.length} error(s)!`);
  process.exit(1);
} else {
  console.log('\n🎉 ALL SIRAJ v3.0.4 POLISH VERIFICATION CHECKS PASSED!');
  process.exit(0);
}
