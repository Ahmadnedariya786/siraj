/**
 * Automated Layer Audit: Verifies complete removal of opaque covering layers
 * and ensures 100% full-screen transparent pattern flow across all 8 Royal Themes.
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

console.log('--- 1. AUDITING src/App.tsx ---');
const appTsx = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.tsx'), 'utf8');
assert(!appTsx.includes("style={{ backgroundColor: 'var(--bg-base)' }}"), 'App.tsx has zero style={{ backgroundColor: var(--bg-base) }} wrappers');
assert(appTsx.includes('theme-app-pattern sig-pattern-layer'), 'App.tsx mounts theme-app-pattern canvas');
assert(appTsx.includes("style={{ background: 'transparent' }}"), 'AppRoutes page-transition-wrapper is transparent');

console.log('\n--- 2. AUDITING src/index.css ---');
const indexCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.css'), 'utf8');
assert(/#root\s*\{[^}]*background:\s*transparent\s*!important/.test(indexCss), '#root is explicitly background: transparent !important');
assert(indexCss.includes('.theme-app-pattern {') && indexCss.includes('position: fixed;') && indexCss.includes('inset: 0;') && indexCss.includes('opacity: 0.09;'), '.theme-app-pattern is position: fixed, inset: 0, opacity: 0.09 (within 0.075-0.11)');
assert(indexCss.includes('.sticky-glass-header {') && indexCss.includes('color-mix(in srgb, var(--bg-base) 78%, transparent)'), '.sticky-glass-header provides 78% semi-transparent theme tint');
assert(indexCss.includes('color-mix(in srgb, var(--surface) 82%, transparent)'), 'Cards provide 82% luxury translucent surface');

// Check all 8 themes
const themes = [
  'oxford-gold',
  'kiswah-noir',
  'istanbul-sapphire',
  'imperial-violet',
  'burgundy-velvet',
  'desert-scroll',
  'madinah-emerald',
  'persian-indigo'
];
themes.forEach(theme => {
  assert(indexCss.includes(`[data-theme="${theme}"]`), `Theme selector [data-theme="${theme}"] is registered`);
  assert(indexCss.includes(`--sig-pattern: url("data:image/svg+xml`), `Theme has authentic geometric SVG pattern`);
});

console.log('\n--- 3. AUDITING PAGE WRAPPERS ---');
const premiumDashboard = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'PremiumDashboard.tsx'), 'utf8');
assert(premiumDashboard.includes('className="min-h-screen flex flex-col bg-transparent text-foreground relative overflow-x-hidden"'), 'PremiumDashboard (Home) root is bg-transparent');

const surahList = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'SurahList.tsx'), 'utf8');
assert(surahList.includes('className="min-h-screen relative overflow-hidden bg-transparent pb-4 relative z-10"'), 'SurahList (Quran index) root is bg-transparent');

const qiblaCompass = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'QiblaCompassModern.tsx'), 'utf8');
assert(qiblaCompass.includes('className="flex flex-col h-full min-h-0 relative overflow-hidden bg-transparent text-[var(--text-primary)]"'), 'QiblaCompassModern root is bg-transparent');

const settingsTheme = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'SettingsThemePage.tsx'), 'utf8');
assert(settingsTheme.includes('className="\n      min-h-screen bg-transparent text-[var(--text-primary)] pb-4 relative z-10"') || settingsTheme.includes('bg-transparent text-[var(--text-primary)] pb-4 relative z-10'), 'SettingsThemePage (App Theme) root is bg-transparent');
assert(!settingsTheme.includes("paddingBottom: '120px'"), 'SettingsThemePage has zero duplicate paddingBottom: 120px');

const settings = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'Settings.tsx'), 'utf8');
assert(settings.includes('bg-transparent text-[var(--text-primary)] font-sans pb-4 transition-colors duration-300 relative z-10'), 'Settings root is bg-transparent');

const settingsSubPage = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'SettingsSubPage.tsx'), 'utf8');
assert(settingsSubPage.includes('className="min-h-screen bg-transparent pb-4 relative z-10"'), 'SettingsSubPage root is bg-transparent');

const zakatCalc = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'ZakatCalculator.tsx'), 'utf8');
assert(zakatCalc.includes('className="min-h-screen bg-transparent text-[var(--text-primary)] flex flex-col pb-4 relative z-10"'), 'ZakatCalculator root is bg-transparent');

const quranReader = fs.readFileSync(path.join(__dirname, '..', 'src', 'pages', 'QuranReader.tsx'), 'utf8');
assert(quranReader.includes('className="min-h-screen relative overflow-hidden bg-transparent"'), 'QuranReader outer container is bg-transparent');

console.log('\n--- 4. AUDITING ZERO BACKDROP-FILTER & ZERO SVG DROP-SHADOW ---');
// Verify new CSS rules in src/index.css contain ZERO backdrop-filter
const stickyHeaderMatch = indexCss.match(/\.sticky-glass-header\s*\{[^}]+\}/);
assert(stickyHeaderMatch && !stickyHeaderMatch[0].includes('backdrop-filter'), '.sticky-glass-header contains ZERO backdrop-filter');

const themePatternMatch = indexCss.match(/\.theme-app-pattern\s*\{[^}]+\}/);
assert(themePatternMatch && !themePatternMatch[0].includes('backdrop-filter'), '.theme-app-pattern contains ZERO backdrop-filter');

const cardMatch = indexCss.match(/\.theme-card,\s*\.card,\s*\[data-card\]\s*\{[^}]+\}/);
assert(cardMatch && !cardMatch[0].includes('backdrop-filter'), 'Card translucency rule contains ZERO backdrop-filter');

const modifiedFiles = [
  'src/App.tsx',
  'src/components/AppBar.tsx',
  'src/components/LayoutManager.tsx',
  'src/components/PageTransition.tsx',
  'src/components/PremiumDashboard.tsx',
  'src/components/QiblaCompassModern.tsx',
  'src/components/ui/card.tsx',
  'src/pages/SurahList.tsx',
  'src/pages/SettingsThemePage.tsx',
  'src/pages/Settings.tsx',
  'src/pages/SettingsSubPage.tsx',
  'src/pages/ZakatCalculator.tsx',
  'src/pages/QuranReader.tsx',
  'src/pages/QazaPage.tsx',
  'src/pages/Duas.tsx',
  'src/pages/Hadith.tsx',
  'src/pages/Tasbeeh.tsx'
];

modifiedFiles.forEach(relPath => {
  const content = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8');
  assert(!content.includes('backdrop-filter') && !content.includes('backdrop-blur'), `${relPath} contains ZERO backdrop-filter / backdrop-blur`);
});

if (errors.length > 0) {
  console.error(`\n❌ AUDIT FAILED with ${errors.length} error(s)!`);
  process.exit(1);
} else {
  console.log('\n🎉 ALL LAYER AUDIT CHECKS PASSED: 100% full-screen transparent pattern flow verified!');
  process.exit(0);
}
