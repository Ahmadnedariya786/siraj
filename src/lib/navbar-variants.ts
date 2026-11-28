import { type ThemeId } from '@/types/theme';

export type NavbarVariantId =
  | 'spotlight-beam'
  | 'morph-capsule'
  | 'elevated-orb'
  | 'satin-well'
  | 'split-islands'
  | 'laser-horizon'
  | 'mihrab-arch'
  | 'celestial-orbit';

export const ALL_NAVBAR_VARIANT_IDS: NavbarVariantId[] = [
  'spotlight-beam',
  'morph-capsule',
  'elevated-orb',
  'satin-well',
  'split-islands',
  'laser-horizon',
  'mihrab-arch',
  'celestial-orbit',
];

const VALID_VARIANT_IDS = new Set<string>(ALL_NAVBAR_VARIANT_IDS);

export interface NavbarVariantMeta {
  id: NavbarVariantId;
  name: string;
  subtitle: string;
}

export const ALL_NAVBAR_VARIANTS: NavbarVariantMeta[] = [
  { id: 'spotlight-beam', name: 'Spotlight Beam', subtitle: 'Overhead beam' },
  { id: 'morph-capsule', name: 'Morph Capsule', subtitle: 'Expanding pill' },
  { id: 'elevated-orb', name: 'Elevated Orb', subtitle: 'Pop-out medallion' },
  { id: 'satin-well', name: 'Satin Jewel Well', subtitle: 'Recessed tray' },
  { id: 'split-islands', name: 'Split Islands', subtitle: '3 floating docks' },
  { id: 'laser-horizon', name: 'Laser Horizon', subtitle: 'Bottom rail' },
  { id: 'mihrab-arch', name: 'Mihrab Arch', subtitle: 'Sanctuary arch' },
  { id: 'celestial-orbit', name: 'Celestial Orbit', subtitle: 'Starlight halo' },
];

export const THEME_NAVBAR_VARIANT: Record<ThemeId, NavbarVariantId> = {
  'oxford-gold': 'spotlight-beam',
  'kiswah-noir': 'morph-capsule',
  'imperial-violet': 'elevated-orb',
  'burgundy-velvet': 'satin-well',
  'desert-scroll': 'split-islands',
  'istanbul-sapphire': 'laser-horizon',
  'madinah-emerald': 'mihrab-arch',
  'persian-indigo': 'celestial-orbit',
};

export const NAVBAR_VARIANT_NAMES: Record<NavbarVariantId, string> = {
  'spotlight-beam': 'Spotlight Beam',
  'morph-capsule': 'Morph Capsule',
  'elevated-orb': 'Elevated Orb',
  'satin-well': 'Satin Jewel Well',
  'split-islands': 'Split Islands',
  'laser-horizon': 'Laser Horizon',
  'mihrab-arch': 'Mihrab Arch',
  'celestial-orbit': 'Celestial Orbit',
};

export const NAVBAR_OVERRIDE_ENABLED_KEY = 'noor_navbar_override_enabled_v1';
export const NAVBAR_OVERRIDE_STYLE_KEY = 'noor_navbar_override_style_v1';
export const NAVBAR_STYLE_CHANGE_EVENT = 'noor-navbar-style-change';

export interface NavbarOverrideConfig {
  enabled: boolean;
  style: NavbarVariantId;
}

/**
 * Reads the persistent navbar override configuration from localStorage with storage safety.
 */
export function getNavbarOverrideConfig(fallbackThemeId: ThemeId = 'oxford-gold'): NavbarOverrideConfig {
  try {
    const rawEnabled = typeof window !== 'undefined' ? localStorage.getItem(NAVBAR_OVERRIDE_ENABLED_KEY) : null;
    const enabled = rawEnabled === 'true';
    const rawStyle = typeof window !== 'undefined' ? localStorage.getItem(NAVBAR_OVERRIDE_STYLE_KEY) : null;
    const defaultStyle = THEME_NAVBAR_VARIANT[fallbackThemeId] || 'spotlight-beam';
    const style: NavbarVariantId = (rawStyle && VALID_VARIANT_IDS.has(rawStyle))
      ? (rawStyle as NavbarVariantId)
      : defaultStyle;
    return { enabled, style };
  } catch (err) {
    console.warn('[NavbarVariants] Failed to read override config:', err);
    return { enabled: false, style: THEME_NAVBAR_VARIANT[fallbackThemeId] || 'spotlight-beam' };
  }
}

/**
 * Persists navbar override configuration and emits reactive event so bottom navbar updates instantaneously (<8ms).
 */
export function setNavbarOverrideConfig(enabled: boolean, style?: NavbarVariantId): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(NAVBAR_OVERRIDE_ENABLED_KEY, enabled ? 'true' : 'false');
      if (style && VALID_VARIANT_IDS.has(style)) {
        localStorage.setItem(NAVBAR_OVERRIDE_STYLE_KEY, style);
      }
    }
  } catch (err) {
    console.warn('[NavbarVariants] Failed to save override config:', err);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NAVBAR_STYLE_CHANGE_EVENT, {
      detail: { enabled, style }
    }));
  }
}

/**
 * Resolves the currently active navbar variant based on override state and active theme.
 */
export function resolveActiveNavbarVariant(themeId: ThemeId): NavbarVariantId {
  const config = getNavbarOverrideConfig(themeId);
  if (config.enabled && VALID_VARIANT_IDS.has(config.style)) {
    return config.style;
  }
  return THEME_NAVBAR_VARIANT[themeId] || 'spotlight-beam';
}

export function getNavbarVariantForTheme(themeId?: string | null): NavbarVariantId {
  if (!themeId) return 'spotlight-beam';
  return resolveActiveNavbarVariant(themeId as ThemeId);
}

const SERVICES_TOOL_PREFIXES = [
  '/services',
  '/radio',
  '/quran-radio',
  '/media-stats',
  '/radio-stats',
  '/nasheeds',
  '/live',
  '/tasbeeh',
  '/duas',
  '/calendar',
  '/ebooks',
  '/qaza',
  '/ramadan',
  '/zakat',
  '/names-of-allah',
  '/quiz',
  '/prayer-stats',
  '/habit-tracker',
  '/islamic-remedies',
  '/remedy-favorites',
  '/eid-checklist',
  '/fitrana-calculator',
  '/mosques',
  '/nearby-mosques',
  '/hadith',
  '/seerah',
  '/qisas',
  '/tafsir',
  '/sunnah-checklist',
  '/noor-cycle',
];

function matchesPathPrefix(currentPath: string, prefix: string): boolean {
  return currentPath === prefix || currentPath.startsWith(`${prefix}/`);
}

/**
 * Robust active-route matcher supporting root aliases (/ and /dashboard),
 * Quran subroutes (excluding /quran-radio), Services tools (/radio, /media-stats, etc.),
 * and settings/profile subroutes.
 */
export function isNavItemActive(currentPath: string, targetPath: string, exact?: boolean): boolean {
  const cleanPath = (currentPath || '/').split('?')[0].split('#')[0];

  if (targetPath === '/') {
    return cleanPath === '/' || cleanPath === '/dashboard';
  }
  if (targetPath === '/quran') {
    return (
      cleanPath === '/quran' ||
      cleanPath.startsWith('/quran/') ||
      cleanPath === '/quran-progress' ||
      cleanPath === '/quran-audio'
    );
  }
  if (targetPath === '/services') {
    return SERVICES_TOOL_PREFIXES.some((prefix) => matchesPathPrefix(cleanPath, prefix));
  }
  if (targetPath === '/profile') {
    return matchesPathPrefix(cleanPath, '/profile') || matchesPathPrefix(cleanPath, '/settings');
  }
  if (exact) {
    return cleanPath === targetPath;
  }
  return matchesPathPrefix(cleanPath, targetPath);
}
