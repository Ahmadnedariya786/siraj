/**
 * SIRAJ — 5-EDITION LIVING ISLAMIC EMBLEM ENGINE (v3.0.1)
 *
 * Provides 5 distinct sacred living logos with smooth 60 FPS GPU-composited CSS/SVG animations:
 *  1. Edition 0: Royal Mihrab (Flagship Default) — Ornate pointed dome, theme-tinted sanctuary arch,
 *                slow-rotating outer Rub el Hizb octagonal star wireframe with corner light nodes,
 *                and radiant central Siraj Crescent & Lamp / 'س' emblem (ZERO old 'ن' branding).
 *  2. Edition 1: Kaaba Orbit — Minimalist isometric Kaaba with gold Kiswah band, encircled by tilted
 *                elliptical Tawaf orbit rings and 3 glowing light orbs in continuous motion.
 *  3. Edition 2: Haramain Crest — Twin Ottoman minarets flanking the central dome, cradled by a majestic
 *                golden crescent moon with pulsing radiance and twinkling celestial stars.
 *  4. Edition 3: Mamluk Star — 16-point interlocking Mamluk geometric lattice framing a central Kaaba
 *                and sacred sanctuary arch with slow counter-rotating outer ring and breathing center niche.
 *  5. Edition 4: Siraj Star — Luminous 8-point Rub el Hizb geometric rosette framing a radiant central
 *                Siraj star and lamp core with opposing dual rotations and rhythmic pulse.
 *
 * Strict Performance Guarantees:
 *  - ZERO backdrop-filter and ZERO SVG drop-shadow (uses pure CSS @keyframes transform/opacity)
 *  - Adapts to all 8 Royal Themes via CSS root tokens: var(--accent-primary), var(--accent-secondary)
 *  - Fully synchronized with Android Home Screen Launcher Icon switching via LauncherAliasPlugin
 */

import React, { memo, useMemo, useEffect, useState, useCallback } from 'react';
import { setNativeLauncherIcon } from '@/lib/launcher-icon';

export type NoorLogoEditionId = 0 | 1 | 2 | 3 | 4;
export type NoorLogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface LogoEditionMeta {
  id: NoorLogoEditionId;
  name: string;
  shortName: string;
  shortLabel: string;
  cardTitle: string;
  fullTitle: string;
  subtitle: string;
  arabicName: string;
  aliasKey: string;
}

export interface NoorDynamicLogoProps {
  edition?: NoorLogoEditionId;
  size?: NoorLogoSize;
  customSize?: number;
  animated?: boolean;
  showBadge?: boolean;
  className?: string;
  onClick?: () => void;
  noFilters?: boolean;
}

export const NOOR_LOGO_EDITIONS: readonly LogoEditionMeta[] = [
  {
    id: 0,
    name: 'Royal Mihrab & Mushaf',
    shortName: 'Royal Mihrab',
    shortLabel: 'Royal\nMihrab',
    cardTitle: 'Royal Mihrab',
    fullTitle: 'Royal Mihrab & Sacred Sanctuary (Flagship)',
    subtitle: 'Golden Pointed Dome, Sanctuary Arch & Siraj Lamp Emblem',
    arabicName: 'المحراب الملكي وصرح السراج الشريف',
    aliasKey: 'royal-mihrab',
  },
  {
    id: 1,
    name: 'Kaaba Orbit & Celestial Tawaf',
    shortName: 'Kaaba Orbit',
    shortLabel: 'Kaaba\nOrbit',
    cardTitle: 'Kaaba Orbit',
    fullTitle: 'Kaaba Orbit & Celestial Tawaf',
    subtitle: 'Minimal Isometric Kaaba, Golden Kiswah & 3 Tawaf Light Orbs',
    arabicName: 'طواف الكعبة الشريفة المداري',
    aliasKey: 'kaaba-orbit',
  },
  {
    id: 2,
    name: 'Haramain Sanctuary Crest & Minarets',
    shortName: 'Haramain Crest',
    shortLabel: 'Haramain\nCrest',
    cardTitle: 'Haramain Crest',
    fullTitle: 'Haramain Crest & Twin Minarets',
    subtitle: 'Illuminated Dome, Majestic Golden Crescent & Twin Ottoman Minarets',
    arabicName: 'صرح الحرمين الشريفين والمآذن العالية',
    aliasKey: 'haramain-crest',
  },
  {
    id: 3,
    name: 'Mamluk Royal Starburst & Sanctuary',
    shortName: 'Mamluk Star',
    shortLabel: 'Mamluk\nStar',
    cardTitle: 'Mamluk Star',
    fullTitle: 'Mamluk Royal Starburst & Kaaba Sanctuary',
    subtitle: '16-Point Interlocking Lattice, Kaaba Center & Qibla Sanctuary',
    arabicName: 'النجمة المملوكية ومحراب القبلة',
    aliasKey: 'mamluk-star',
  },
  {
    id: 4,
    name: 'Siraj Star Emblem & Rub el Hizb',
    shortName: 'Siraj Star',
    shortLabel: 'Siraj\nStar',
    cardTitle: 'Siraj Star',
    fullTitle: 'Siraj Star Emblem & Rub el Hizb',
    subtitle: 'Luminous 8-Point Geometric Rosette & Radiating Lamp Core',
    arabicName: 'نجمة السراج والمصباح المنير',
    aliasKey: 'siraj-star',
  },
] as const;

export const SELECTED_LOGO_KEY = 'siraj_selected_logo_edition';
const LEGACY_SELECTED_LOGO_KEY = 'noor_selected_logo_edition';
const STORAGE_LAUNCH_KEY = 'siraj_logo_launch_edition_v1';
const STORAGE_MANUAL_KEY = 'siraj_logo_manual_edition';
export const LOGO_EDITION_CHANGE_EVENT = 'siraj-logo-edition-change';
export const LOGO_EDITION_CHANGED_EVENT = 'siraj-logo-edition-changed';

export function getSelectedLogoEdition(): NoorLogoEditionId {
  if (typeof window === 'undefined') return 0;
  try {
    const val = localStorage.getItem(SELECTED_LOGO_KEY) || localStorage.getItem(LEGACY_SELECTED_LOGO_KEY);
    if (val !== null) {
      const idx = parseInt(val, 10);
      if (!isNaN(idx) && idx >= 0 && idx <= 4) {
        return idx as NoorLogoEditionId;
      }
    }
    const manual = localStorage.getItem(STORAGE_MANUAL_KEY);
    if (manual !== null) {
      const idx = parseInt(manual, 10);
      if (!isNaN(idx) && idx >= 0 && idx <= 4) {
        return idx as NoorLogoEditionId;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

export function getActiveLogoEdition(): NoorLogoEditionId {
  return getSelectedLogoEdition();
}

export function setSelectedLogoEdition(edition: NoorLogoEditionId): void {
  if (typeof window === 'undefined') return;
  try {
    const safeId = (Math.max(0, Math.min(4, Math.floor(edition))) || 0) as NoorLogoEditionId;
    localStorage.setItem(SELECTED_LOGO_KEY, String(safeId));
    localStorage.setItem(LEGACY_SELECTED_LOGO_KEY, String(safeId));
    localStorage.setItem(STORAGE_MANUAL_KEY, String(safeId));
    localStorage.setItem(STORAGE_LAUNCH_KEY, String(safeId));

    window.dispatchEvent(new CustomEvent(LOGO_EDITION_CHANGE_EVENT, { detail: { edition: safeId } }));
    window.dispatchEvent(new CustomEvent(LOGO_EDITION_CHANGED_EVENT, { detail: safeId }));
    window.dispatchEvent(new CustomEvent('noor-logo-edition-change', { detail: { edition: safeId } }));
    window.dispatchEvent(new CustomEvent('noor-logo-edition-changed', { detail: safeId }));

    // Trigger Native Android Launcher Icon Switch
    const aliasKey = NOOR_LOGO_EDITIONS[safeId]?.aliasKey || 'royal-mihrab';
    setNativeLauncherIcon(safeId, aliasKey);
  } catch (e) {
    console.warn('Failed to persist logo edition:', e);
  }
}

export function cycleLogoEdition(): NoorLogoEditionId {
  const current = getSelectedLogoEdition();
  const next = ((current + 1) % 5) as NoorLogoEditionId;
  setSelectedLogoEdition(next);
  return next;
}

const SIZE_MAP: Record<NoorLogoSize, number> = {
  xs: 28,
  sm: 36,
  md: 48,
  lg: 72,
  xl: 104,
};

/**
 * Returns a self-contained SVG string for offscreen HTML5 canvas rendering / image generators.
 */
export function getLogoEditionStaticSvgString(edition: NoorLogoEditionId = 0, size = 200): string {
  const safeId = (Math.max(0, Math.min(4, Math.floor(edition))) || 0) as NoorLogoEditionId;
  const pfx = `siraj-static-logo-${safeId}`;

  const defs = `<defs>` +
    `<linearGradient id="${pfx}-gold-primary" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="#FFFDF0"/>` +
      `<stop offset="25%" stop-color="#FDE08A"/>` +
      `<stop offset="60%" stop-color="#D4AF37"/>` +
      `<stop offset="100%" stop-color="#8C6614"/>` +
    `</linearGradient>` +
    `<linearGradient id="${pfx}-gold-radiant" x1="0%" y1="100%" x2="100%" y2="0%">` +
      `<stop offset="0%" stop-color="#8C6614"/>` +
      `<stop offset="40%" stop-color="#F5D061"/>` +
      `<stop offset="80%" stop-color="#FFF8D6"/>` +
      `<stop offset="100%" stop-color="#D4AF37"/>` +
    `</linearGradient>` +
    `<radialGradient id="${pfx}-aura" cx="50%" cy="50%" r="50%">` +
      `<stop offset="0%" stop-color="#FDE08A" stop-opacity="0.75"/>` +
      `<stop offset="50%" stop-color="#D4AF37" stop-opacity="0.3"/>` +
      `<stop offset="100%" stop-color="#0B132B" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<linearGradient id="${pfx}-glass" x1="0%" y1="0%" x2="0%" y2="100%">` +
      `<stop offset="0%" stop-color="#D4AF37" stop-opacity="0.2"/>` +
      `<stop offset="100%" stop-color="#050B18" stop-opacity="0.88"/>` +
    `</linearGradient>` +
    `<linearGradient id="${pfx}-kaaba-top" x1="0%" y1="0%" x2="100%" y2="100%">` +
      `<stop offset="0%" stop-color="#2D3748"/>` +
      `<stop offset="100%" stop-color="#1A202C"/>` +
    `</linearGradient>` +
    `<linearGradient id="${pfx}-kaaba-left" x1="0%" y1="0%" x2="0%" y2="100%">` +
      `<stop offset="0%" stop-color="#1A202C"/>` +
      `<stop offset="100%" stop-color="#0B0F19"/>` +
    `</linearGradient>` +
    `<linearGradient id="${pfx}-kaaba-right" x1="0%" y1="0%" x2="0%" y2="100%">` +
      `<stop offset="0%" stop-color="#111827"/>` +
      `<stop offset="100%" stop-color="#030712"/>` +
    `</linearGradient>` +
  `</defs>`;

  let body = '';
  switch (safeId) {
    case 0: // Edition 0: Royal Mihrab (Flagship)
      body = `<g>` +
        `<circle cx="100" cy="100" r="92" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.2" stroke-dasharray="2.5 4" fill="none" opacity="0.6"/>` +
        `<rect x="36" y="36" width="128" height="128" rx="10" stroke="url(#${pfx}-gold-primary)" stroke-width="1.6" fill="none" opacity="0.85"/>` +
        `<rect x="36" y="36" width="128" height="128" rx="10" transform="rotate(45 100 100)" stroke="url(#${pfx}-gold-primary)" stroke-width="1.6" fill="none" opacity="0.85"/>` +
        `<circle cx="100" cy="100" r="66" fill="url(#${pfx}-aura)" opacity="0.45"/>` +
        `<path d="M 100 162 C 84 158 54 152 44 136 C 36 122 46 102 64 98 C 76 96 88 108 96 126 Z" fill="url(#${pfx}-gold-primary)" stroke="#FFFDF0" stroke-width="1"/>` +
        `<path d="M 100 162 C 116 158 146 152 156 136 C 164 122 154 102 136 98 C 124 96 112 108 104 126 Z" fill="url(#${pfx}-gold-primary)" stroke="#FFFDF0" stroke-width="1"/>` +
        `<polygon points="90,162 110,162 105,176 95,176" fill="url(#${pfx}-gold-radiant)" stroke="#FFFDF0" stroke-width="0.8"/>` +
        `<path d="M 76 144 L 76 102 C 76 80 88 64 100 52 C 112 64 124 80 124 102 L 124 144 Z" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="2.2"/>` +
        `<path d="M 72 102 C 72 74 86 52 100 40 C 114 52 128 74 128 102 Z" fill="url(#${pfx}-gold-primary)" stroke="#FFFDF0" stroke-width="1.4"/>` +
        `<line x1="100" y1="40" x2="100" y2="102" stroke="url(#${pfx}-glass)" stroke-width="1.2"/>` +
        `<path d="M 98 24 C 95 24 92 26.5 92 30 C 92 33.5 95 36 98.5 36 C 96.5 35 95.5 33 95.5 30 C 95.5 27 97 25 99 24.2 Z" fill="#FFFDF0" stroke="url(#${pfx}-gold-primary)" stroke-width="0.8"/>` +
        `<polygon points="104,27 105.2,29.5 108,29.8 106,31.7 106.5,34.5 104,33.1 101.5,34.5 102,31.7 100,29.8 102.8,29.5" fill="#FFFDF0"/>` +
        `<line x1="100" y1="36" x2="100" y2="40" stroke="url(#${pfx}-gold-primary)" stroke-width="2" stroke-linecap="round"/>` +
        /* Center Siraj Lamp & Radiant Crescent (Zero 'ن' glyph) */
        `<path d="M 95 110 C 88 110 82 116 82 124 C 82 132 88 138 96 138 C 101 138 105 135 107 131 C 101 133 94 130 91 123 C 88 116 92 112 95 110 Z" fill="#FFFDF0"/>` +
        `<circle cx="106" cy="118" r="3.2" fill="url(#${pfx}-gold-radiant)"/>` +
        `<polygon points="106,112 107.2,114.5 110,114.8 108,116.7 108.5,119.5 106,118.1 103.5,119.5 104,116.7 102,114.8 104.8,114.5" fill="#FFFDF0"/>` +
      `</g>`;
      break;

    case 1: // Edition 1: Kaaba Orbit
      body = `<g>` +
        `<circle cx="100" cy="100" r="92" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.2" stroke-dasharray="3 4" fill="none" opacity="0.5"/>` +
        `<circle cx="100" cy="100" r="75" fill="url(#${pfx}-aura)" opacity="0.65"/>` +
        `<g transform="rotate(-15 100 110)">` +
          `<ellipse cx="100" cy="110" rx="82" ry="34" fill="none" stroke="url(#${pfx}-gold-primary)" stroke-width="2" stroke-dasharray="6 4" opacity="0.85"/>` +
          `<ellipse cx="100" cy="110" rx="66" ry="28" fill="none" stroke="url(#${pfx}-gold-radiant)" stroke-width="1" stroke-dasharray="2 3" opacity="0.5"/>` +
        `</g>` +
        `<g>` +
          `<polygon points="100,68 130,83 100,98 70,83" fill="url(#${pfx}-kaaba-top)" stroke="url(#${pfx}-gold-primary)" stroke-width="1"/>` +
          `<polygon points="70,83 100,98 100,138 70,123" fill="url(#${pfx}-kaaba-left)" stroke="url(#${pfx}-gold-primary)" stroke-width="1"/>` +
          `<polygon points="100,98 130,83 130,123 100,138" fill="url(#${pfx}-kaaba-right)" stroke="url(#${pfx}-gold-primary)" stroke-width="1"/>` +
          `<polygon points="70,91 100,106 100,111 70,96" fill="url(#${pfx}-gold-primary)"/>` +
          `<polygon points="100,106 130,91 130,96 100,111" fill="url(#${pfx}-gold-primary)"/>` +
          `<polygon points="112,104 122,99 122,119 112,124" fill="url(#${pfx}-gold-radiant)" stroke="url(#${pfx}-gold-primary)" stroke-width="0.8"/>` +
        `</g>` +
        `<circle cx="34" cy="120" r="5" fill="url(#${pfx}-gold-primary)"/><circle cx="34" cy="120" r="2" fill="#FFFDF0"/>` +
        `<circle cx="166" cy="96" r="4.5" fill="url(#${pfx}-gold-primary)"/><circle cx="166" cy="96" r="1.8" fill="#FFFDF0"/>` +
        `<circle cx="118" cy="144" r="4" fill="url(#${pfx}-gold-primary)"/><circle cx="118" cy="144" r="1.5" fill="#FFFDF0"/>` +
      `</g>`;
      break;

    case 2: // Edition 2: Haramain Crest
      body = `<g>` +
        `<circle cx="100" cy="100" r="92" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.2" stroke-dasharray="3 4" fill="none" opacity="0.5"/>` +
        `<circle cx="100" cy="96" r="70" fill="url(#${pfx}-aura)" opacity="0.6"/>` +
        /* Twin Ottoman Minarets */
        `<polygon points="46,160 52,160 51,78 47,78" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="1.4"/>` +
        `<polygon points="45,78 53,78 49,60" fill="url(#${pfx}-gold-primary)"/>` +
        `<polygon points="148,160 154,160 153,78 149,78" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="1.4"/>` +
        `<polygon points="147,78 155,78 151,60" fill="url(#${pfx}-gold-primary)"/>` +
        /* Central Grand Dome */
        `<path d="M 66 160 L 66 122 C 66 88 100 68 100 68 C 100 68 134 88 134 122 L 134 160 Z" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="2.2"/>` +
        `<path d="M 76 122 C 76 96 100 80 100 80 C 100 80 124 96 124 122 Z" fill="url(#${pfx}-gold-radiant)" opacity="0.8"/>` +
        `<line x1="100" y1="68" x2="100" y2="52" stroke="url(#${pfx}-gold-primary)" stroke-width="2"/>` +
        `<circle cx="100" cy="48" r="3" fill="#FFFDF0"/>` +
        /* Majestic Cradling Crescent */
        `<path d="M 44 148 C 44 182 156 182 156 148 C 146 172 54 172 44 148 Z" fill="url(#${pfx}-gold-primary)"/>` +
        `<polygon points="100,166 102,170 106,170.5 103,173 104,177 100,175 96,177 97,173 94,170.5 98,170" fill="#FFFDF0"/>` +
      `</g>`;
      break;

    case 3: // Edition 3: Mamluk Star
      body = `<g>` +
        `<circle cx="100" cy="100" r="92" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.4" fill="none" opacity="0.65"/>` +
        `<rect x="36" y="36" width="128" height="128" rx="8" stroke="url(#${pfx}-gold-primary)" stroke-width="1.6" fill="none" opacity="0.8"/>` +
        `<rect x="36" y="36" width="128" height="128" rx="8" transform="rotate(45 100 100)" stroke="url(#${pfx}-gold-primary)" stroke-width="1.6" fill="none" opacity="0.8"/>` +
        `<rect x="36" y="36" width="128" height="128" rx="8" transform="rotate(22.5 100 100)" stroke="url(#${pfx}-gold-radiant)" stroke-width="1" fill="none" opacity="0.6"/>` +
        `<rect x="36" y="36" width="128" height="128" rx="8" transform="rotate(67.5 100 100)" stroke="url(#${pfx}-gold-radiant)" stroke-width="1" fill="none" opacity="0.6"/>` +
        `<circle cx="100" cy="100" r="62" fill="url(#${pfx}-aura)" opacity="0.55"/>` +
        `<path d="M 64 146 L 64 104 C 64 78 100 58 100 58 C 100 58 136 78 136 104 L 136 146 Z" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="2"/>` +
        `<polygon points="100,76 122,87 100,98 78,87" fill="url(#${pfx}-kaaba-top)" stroke="url(#${pfx}-gold-primary)" stroke-width="0.8"/>` +
        `<polygon points="78,87 100,98 100,128 78,117" fill="url(#${pfx}-kaaba-left)" stroke="url(#${pfx}-gold-primary)" stroke-width="0.8"/>` +
        `<polygon points="100,98 122,87 122,117 100,128" fill="url(#${pfx}-kaaba-right)" stroke="url(#${pfx}-gold-primary)" stroke-width="0.8"/>` +
        `<polygon points="78,93 100,104 100,108 78,97" fill="url(#${pfx}-gold-primary)"/>` +
        `<polygon points="100,104 122,93 122,97 100,108" fill="url(#${pfx}-gold-primary)"/>` +
      `</g>`;
      break;

    case 4: // Edition 4: Siraj Star
      body = `<g>` +
        `<circle cx="100" cy="100" r="92" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.2" stroke-dasharray="3 4" fill="none" opacity="0.5"/>` +
        `<circle cx="100" cy="100" r="75" fill="url(#${pfx}-aura)" opacity="0.6"/>` +
        `<rect x="42" y="42" width="116" height="116" rx="8" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="2"/>` +
        `<rect x="42" y="42" width="116" height="116" rx="8" transform="rotate(45 100 100)" fill="url(#${pfx}-glass)" stroke="url(#${pfx}-gold-primary)" stroke-width="2"/>` +
        `<rect x="54" y="54" width="92" height="92" rx="4" fill="none" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8"/>` +
        `<rect x="54" y="54" width="92" height="92" rx="4" transform="rotate(45 100 100)" fill="none" stroke="url(#${pfx}-gold-radiant)" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8"/>` +
        `<circle cx="100" cy="100" r="26" fill="url(#${pfx}-gold-radiant)" opacity="0.25"/>` +
        `<polygon points="86,94 114,94 108,118 92,118" fill="url(#${pfx}-gold-radiant)" stroke="url(#${pfx}-gold-primary)" stroke-width="1.2"/>` +
        `<path d="M 100 98 C 96 104 96 108 100 112 C 104 108 104 104 100 98 Z" fill="#FFFDF0"/>` +
      `</g>`;
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="${size}" height="${size}" fill="none">` +
    defs +
    body +
  `</svg>`;
}

// ─── SVG GRADIENT DEFS ───

const SvgDefs: React.FC<{ prefix: string }> = ({ prefix }) => (
  <defs>
    <linearGradient id={`${prefix}-gold-primary`} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="var(--accent-secondary, #FFFDF0)" />
      <stop offset="25%" stopColor="#FDE08A" />
      <stop offset="60%" stopColor="var(--accent-primary, #D4AF37)" />
      <stop offset="100%" stopColor="#8C6614" />
    </linearGradient>

    <linearGradient id={`${prefix}-gold-radiant`} x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stopColor="#8C6614" />
      <stop offset="40%" stopColor="#F5D061" />
      <stop offset="80%" stopColor="#FFF8D6" />
      <stop offset="100%" stopColor="var(--accent-primary, #D4AF37)" />
    </linearGradient>

    <radialGradient id={`${prefix}-aura`} cx="50%" cy="50%" r="50%">
      <stop offset="0%" stopColor="var(--accent-secondary, #FDE08A)" stopOpacity="0.75" />
      <stop offset="50%" stopColor="var(--accent-primary, #D4AF37)" stopOpacity="0.3" />
      <stop offset="100%" stopColor="var(--surface, #0B132B)" stopOpacity="0" />
    </radialGradient>

    <linearGradient id={`${prefix}-glass`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="var(--accent-primary, #D4AF37)" stopOpacity="0.22" />
      <stop offset="100%" stopColor="var(--surface, #050B18)" stopOpacity="0.9" />
    </linearGradient>

    <linearGradient id={`${prefix}-kaaba-top`} x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#2D3748" />
      <stop offset="100%" stopColor="#1A202C" />
    </linearGradient>
    <linearGradient id={`${prefix}-kaaba-left`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#1A202C" />
      <stop offset="100%" stopColor="#0B0F19" />
    </linearGradient>
    <linearGradient id={`${prefix}-kaaba-right`} x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#111827" />
      <stop offset="100%" stopColor="#030712" />
    </linearGradient>
  </defs>
);

// ─── EDITION 0: ROYAL MIHRAB (FLAGSHIP DEFAULT) ───

const Edition0Vector: React.FC<{ prefix: string; animated: boolean }> = ({ prefix, animated }) => (
  <g>
    {/* Outer Wireframe: Slow counter-rotating Rub el Hizb octagonal star (28s) */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajSpinSlow 28s linear infinite reverse' : undefined,
      }}
    >
      <circle
        cx="100"
        cy="100"
        r="92"
        stroke={`url(#${prefix}-gold-radiant)`}
        strokeWidth="1.2"
        strokeDasharray="2.5 4"
        fill="none"
        opacity="0.6"
      />
      <rect
        x="36"
        y="36"
        width="128"
        height="128"
        rx="10"
        stroke={`url(#${prefix}-gold-primary)`}
        strokeWidth="1.6"
        fill="none"
        opacity="0.85"
      />
      <rect
        x="36"
        y="36"
        width="128"
        height="128"
        rx="10"
        transform="rotate(45 100 100)"
        stroke={`url(#${prefix}-gold-primary)`}
        strokeWidth="1.6"
        fill="none"
        opacity="0.85"
      />
      {/* 8 Starlight Nodes with Twinkle */}
      {[
        [100, 8], [192, 100], [100, 192], [8, 100],
        [165, 35], [165, 165], [35, 165], [35, 35],
      ].map(([cx, cy], i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r="2.8"
          fill="#FFFDF0"
          stroke={`url(#${prefix}-gold-primary)`}
          strokeWidth="1.2"
          style={{
            animation: animated ? `sirajTwinkle ${2.4 + (i % 3) * 0.5}s ease-in-out infinite` : undefined,
          }}
        />
      ))}
    </g>

    {/* Inner Ambient Glow Disk with Breathing Pulse */}
    <circle
      cx="100"
      cy="100"
      r="66"
      fill={`url(#${prefix}-aura)`}
      opacity="0.45"
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajPulseAura 4s ease-in-out infinite' : undefined,
      }}
    />

    {/* Centerpiece Sanctuary Arch & Dome with Gentle Float */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajGentleFloat 4s ease-in-out infinite' : undefined,
      }}
    >
      {/* Symmetrical Blooming Golden Base Rehal Leaves */}
      <path
        d="M 100 162 C 84 158 54 152 44 136 C 36 122 46 102 64 98 C 76 96 88 108 96 126 Z"
        fill={`url(#${prefix}-gold-primary)`}
        stroke="#FFFDF0"
        strokeWidth="1"
      />
      <path
        d="M 96 156 C 80 150 56 142 50 130 C 46 120 54 108 66 106 C 76 104 86 114 94 128 Z"
        fill={`url(#${prefix}-glass)`}
        opacity="0.85"
      />
      <path
        d="M 100 162 C 116 158 146 152 156 136 C 164 122 154 102 136 98 C 124 96 112 108 104 126 Z"
        fill={`url(#${prefix}-gold-primary)`}
        stroke="#FFFDF0"
        strokeWidth="1"
      />
      <path
        d="M 104 156 C 120 150 144 142 150 130 C 154 120 146 108 134 106 C 124 104 114 114 106 128 Z"
        fill={`url(#${prefix}-glass)`}
        opacity="0.85"
      />
      <polygon points="90,162 110,162 105,176 95,176" fill={`url(#${prefix}-gold-radiant)`} stroke="#FFFDF0" strokeWidth="0.8" />

      {/* Royal Mihrab Arch */}
      <path
        d="M 76 144 L 76 102 C 76 80 88 64 100 52 C 112 64 124 80 124 102 L 124 144 Z"
        fill={`url(#${prefix}-glass)`}
        stroke={`url(#${prefix}-gold-primary)`}
        strokeWidth="2.2"
      />
      <path
        d="M 82 142 L 82 104 C 82 92 88 84 94 76 C 96 80 100 82 100 82 C 100 82 104 80 106 76 C 112 84 118 92 118 104 L 118 142 Z"
        fill="none"
        stroke={`url(#${prefix}-gold-radiant)`}
        strokeWidth="1.2"
        strokeDasharray="1.5 2"
        opacity="0.9"
      />

      {/* Pointed Dome Roof */}
      <path
        d="M 72 102 C 72 74 86 52 100 40 C 114 52 128 74 128 102 Z"
        fill={`url(#${prefix}-gold-primary)`}
        stroke="#FFFDF0"
        strokeWidth="1.4"
      />
      <line x1="100" y1="40" x2="100" y2="102" stroke={`url(#${prefix}-glass)`} strokeWidth="1.2" />

      {/* Crown Apex Finial */}
      <path
        d="M 98 24 C 95 24 92 26.5 92 30 C 92 33.5 95 36 98.5 36 C 96.5 35 95.5 33 95.5 30 C 95.5 27 97 25 99 24.2 Z"
        fill="#FFFDF0"
        stroke={`url(#${prefix}-gold-primary)`}
        strokeWidth="0.8"
      />
      <polygon points="104,27 105.2,29.5 108,29.8 106,31.7 106.5,34.5 104,33.1 101.5,34.5 102,31.7 100,29.8 102.8,29.5" fill="#FFFDF0" />
      <line x1="100" y1="36" x2="100" y2="40" stroke={`url(#${prefix}-gold-primary)`} strokeWidth="2" strokeLinecap="round" />

      {/* Central Niche: Radiant Siraj Crescent & Lamp Emblem (ZERO old 'ن' branding!) */}
      <g
        style={{
          transformOrigin: '100px 124px',
          animation: animated ? 'sirajPulseCrescent 3.6s ease-in-out infinite' : undefined,
        }}
      >
        {/* Radiant Crescent Vessel */}
        <path
          d="M 94 112 C 86 112 80 118 80 126 C 80 134 87 140 96 140 C 102 140 107 136 109 131 C 102 133 94 130 91 123 C 88 116 92 113 94 112 Z"
          fill="#FFFDF0"
        />
        {/* Golden Siraj Star Lamp */}
        <circle cx="106" cy="118" r="3.6" fill={`url(#${prefix}-gold-radiant)`} />
        <polygon
          points="106,112 107.5,115 110.5,115.3 108.2,117.3 108.8,120.3 106,118.8 103.2,120.3 103.8,117.3 101.5,115.3 104.5,115"
          fill="#FFFDF0"
        />
        {/* Subtle Lamp Ray */}
        <line x1="106" y1="122" x2="106" y2="128" stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </g>
  </g>
);

// ─── EDITION 1: KAABA ORBIT ───

const Edition1Vector: React.FC<{ prefix: string; animated: boolean }> = ({ prefix, animated }) => (
  <g>
    <circle cx="100" cy="100" r="92" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1.2" strokeDasharray="3 4" fill="none" opacity="0.5" />
    <circle
      cx="100"
      cy="100"
      r="75"
      fill={`url(#${prefix}-aura)`}
      opacity="0.65"
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajPulseAura 4s ease-in-out infinite' : undefined,
      }}
    />

    {/* Tilted Luminous Tawaf Orbit Ring */}
    <g transform="rotate(-15 100 110)">
      <ellipse
        cx="100"
        cy="110"
        rx="82"
        ry="34"
        fill="none"
        stroke={`url(#${prefix}-gold-primary)`}
        strokeWidth="2"
        strokeDasharray="6 4"
        opacity="0.85"
        style={{
          animation: animated ? 'sirajShimmer 3s ease-in-out infinite' : undefined,
        }}
      />
      <ellipse cx="100" cy="110" rx="66" ry="28" fill="none" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
    </g>

    {/* Isometric Kaaba Core */}
    <g>
      <polygon points="100,68 130,83 100,98 70,83" fill={`url(#${prefix}-kaaba-top)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1" />
      <polygon points="70,83 100,98 100,138 70,123" fill={`url(#${prefix}-kaaba-left)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1" />
      <polygon points="100,98 130,83 130,123 100,138" fill={`url(#${prefix}-kaaba-right)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1" />
      <polygon points="70,91 100,106 100,111 70,96" fill={`url(#${prefix}-gold-primary)`} />
      <polygon points="100,106 130,91 130,96 100,111" fill={`url(#${prefix}-gold-primary)`} />
      <polygon points="112,104 122,99 122,119 112,124" fill={`url(#${prefix}-gold-radiant)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="0.8" />
    </g>

    {/* 3 Luminous Tawaf Orbs in Continuous Orbital Rotation (10s) */}
    <g
      style={{
        transformOrigin: '100px 110px',
        animation: animated ? 'sirajSpinSlow 10s linear infinite' : undefined,
      }}
    >
      <circle cx="34" cy="110" r="4.5" fill={`url(#${prefix}-gold-primary)`} />
      <circle cx="34" cy="110" r="1.8" fill="#FFFDF0" />

      <circle cx="166" cy="110" r="4.5" fill={`url(#${prefix}-gold-primary)`} />
      <circle cx="166" cy="110" r="1.8" fill="#FFFDF0" />

      <circle cx="100" cy="144" r="4" fill={`url(#${prefix}-gold-primary)`} />
      <circle cx="100" cy="144" r="1.5" fill="#FFFDF0" />
    </g>
  </g>
);

// ─── EDITION 2: HARAMAIN CREST ───

const Edition2Vector: React.FC<{ prefix: string; animated: boolean }> = ({ prefix, animated }) => (
  <g>
    <circle cx="100" cy="100" r="92" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1.2" strokeDasharray="3 4" fill="none" opacity="0.5" />

    {/* Vertical Halo Breathe */}
    <circle
      cx="100"
      cy="96"
      r="70"
      fill={`url(#${prefix}-aura)`}
      opacity="0.6"
      style={{
        transformOrigin: '100px 96px',
        animation: animated ? 'sirajVerticalBreathe 4s ease-in-out infinite' : undefined,
      }}
    />

    {/* Twin Ottoman Minarets with Twinkling Stars */}
    <g>
      <polygon points="46,160 52,160 51,78 47,78" fill={`url(#${prefix}-glass)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1.4" />
      <polygon points="45,78 53,78 49,60" fill={`url(#${prefix}-gold-primary)`} />
      <circle
        cx="49"
        cy="56"
        r="2.5"
        fill="#FFFDF0"
        style={{
          animation: animated ? 'sirajTwinkle 2.5s ease-in-out infinite' : undefined,
        }}
      />

      <polygon points="148,160 154,160 153,78 149,78" fill={`url(#${prefix}-glass)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1.4" />
      <polygon points="147,78 155,78 151,60" fill={`url(#${prefix}-gold-primary)`} />
      <circle
        cx="151"
        cy="56"
        r="2.5"
        fill="#FFFDF0"
        style={{
          animation: animated ? 'sirajTwinkle 2.8s ease-in-out infinite' : undefined,
        }}
      />
    </g>

    {/* Central Grand Dome */}
    <path
      d="M 66 160 L 66 122 C 66 88 100 68 100 68 C 100 68 134 88 134 122 L 134 160 Z"
      fill={`url(#${prefix}-glass)`}
      stroke={`url(#${prefix}-gold-primary)`}
      strokeWidth="2.2"
    />
    <path d="M 76 122 C 76 96 100 80 100 80 C 100 80 124 96 124 122 Z" fill={`url(#${prefix}-gold-radiant)`} opacity="0.8" />
    <line x1="100" y1="68" x2="100" y2="52" stroke={`url(#${prefix}-gold-primary)`} strokeWidth="2" />
    <circle cx="100" cy="48" r="3" fill="#FFFDF0" />

    {/* Majestic Cradling Crescent with Pulsing Radiance (4.5s) */}
    <g
      style={{
        transformOrigin: '100px 158px',
        animation: animated ? 'sirajPulseCrescent 4.5s ease-in-out infinite' : undefined,
      }}
    >
      <path d="M 44 148 C 44 182 156 182 156 148 C 146 172 54 172 44 148 Z" fill={`url(#${prefix}-gold-primary)`} />
      <polygon points="100,166 102,170 106,170.5 103,173 104,177 100,175 96,177 97,173 94,170.5 98,170" fill="#FFFDF0" />
    </g>
  </g>
);

// ─── EDITION 3: MAMLUK STAR ───

const Edition3Vector: React.FC<{ prefix: string; animated: boolean }> = ({ prefix, animated }) => (
  <g>
    {/* 16-Point Interlocking Mamluk Starburst Frame: Counter-rotating (32s) */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajSpinSlow 32s linear infinite reverse' : undefined,
      }}
    >
      <circle cx="100" cy="100" r="92" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1.4" fill="none" opacity="0.65" />
      <rect x="36" y="36" width="128" height="128" rx="8" stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1.6" fill="none" opacity="0.8" />
      <rect x="36" y="36" width="128" height="128" rx="8" transform="rotate(45 100 100)" stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1.6" fill="none" opacity="0.8" />
      <rect x="36" y="36" width="128" height="128" rx="8" transform="rotate(22.5 100 100)" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1" fill="none" opacity="0.6" />
      <rect x="36" y="36" width="128" height="128" rx="8" transform="rotate(67.5 100 100)" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1" fill="none" opacity="0.6" />
    </g>

    {/* Centerpiece: Holy Kaaba Sanctuary & Rhythmic Breathing Pulse */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajPulseAura 3.2s ease-in-out infinite' : undefined,
      }}
    >
      <circle cx="100" cy="100" r="62" fill={`url(#${prefix}-aura)`} opacity="0.55" />
      <path
        d="M 64 146 L 64 104 C 64 78 100 58 100 58 C 100 58 136 78 136 104 L 136 146 Z"
        fill={`url(#${prefix}-glass)`}
        stroke={`url(#${prefix}-gold-primary)`}
        strokeWidth="2"
      />
      <polygon points="100,76 122,87 100,98 78,87" fill={`url(#${prefix}-kaaba-top)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="0.8" />
      <polygon points="78,87 100,98 100,128 78,117" fill={`url(#${prefix}-kaaba-left)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="0.8" />
      <polygon points="100,98 122,87 122,117 100,128" fill={`url(#${prefix}-kaaba-right)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="0.8" />
      <polygon points="78,93 100,104 100,108 78,97" fill={`url(#${prefix}-gold-primary)`} />
      <polygon points="100,104 122,93 122,97 100,108" fill={`url(#${prefix}-gold-primary)`} />
    </g>
  </g>
);

// ─── EDITION 4: SIRAJ STAR ───

const Edition4Vector: React.FC<{ prefix: string; animated: boolean }> = ({ prefix, animated }) => (
  <g>
    <circle cx="100" cy="100" r="92" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1.2" strokeDasharray="3 4" fill="none" opacity="0.5" />

    {/* Opposing Slow Rotations: Outer Star Square (24s) */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajSpinSlow 24s linear infinite' : undefined,
      }}
    >
      <rect x="42" y="42" width="116" height="116" rx="8" fill={`url(#${prefix}-glass)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="2" />
      <rect x="42" y="42" width="116" height="116" rx="8" transform="rotate(45 100 100)" fill={`url(#${prefix}-glass)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="2" />
    </g>

    {/* Opposing Inner Star Filigree (36s reverse) */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajSpinSlow 36s linear infinite reverse' : undefined,
      }}
    >
      <rect x="54" y="54" width="92" height="92" rx="4" fill="none" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />
      <rect x="54" y="54" width="92" height="92" rx="4" transform="rotate(45 100 100)" fill="none" stroke={`url(#${prefix}-gold-radiant)`} strokeWidth="1.2" strokeDasharray="3 3" opacity="0.8" />
    </g>

    {/* Pulsing Central Siraj Star & Lamp Core */}
    <g
      style={{
        transformOrigin: '100px 100px',
        animation: animated ? 'sirajPulseAura 3s ease-in-out infinite' : undefined,
      }}
    >
      <circle cx="100" cy="100" r="26" fill={`url(#${prefix}-gold-radiant)`} opacity="0.25" />
      <circle cx="100" cy="100" r="18" fill={`url(#${prefix}-aura)`} opacity="0.6" />
      <polygon points="86,94 114,94 108,118 92,118" fill={`url(#${prefix}-gold-radiant)`} stroke={`url(#${prefix}-gold-primary)`} strokeWidth="1.2" />
      <path d="M 100 98 C 96 104 96 108 100 112 C 104 108 104 104 100 98 Z" fill="#FFFDF0" />
    </g>
  </g>
);

// ─── MAIN DYNAMIC LOGO COMPONENT ───

export const NoorDynamicLogo: React.FC<NoorDynamicLogoProps> = ({
  edition,
  size = 'md',
  customSize,
  animated = true,
  showBadge = false,
  className = '',
  onClick,
}) => {
  const [selectedEdition, setSelectedEdition] = useState<NoorLogoEditionId>(() => getSelectedLogoEdition());

  useEffect(() => {
    if (edition !== undefined) return;
    const handleUpdate = () => {
      setSelectedEdition(getSelectedLogoEdition());
    };
    window.addEventListener(LOGO_EDITION_CHANGE_EVENT, handleUpdate);
    window.addEventListener(LOGO_EDITION_CHANGED_EVENT, handleUpdate);
    window.addEventListener('noor-logo-edition-change', handleUpdate);
    window.addEventListener('noor-logo-edition-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(LOGO_EDITION_CHANGE_EVENT, handleUpdate);
      window.removeEventListener(LOGO_EDITION_CHANGED_EVENT, handleUpdate);
      window.removeEventListener('noor-logo-edition-change', handleUpdate);
      window.removeEventListener('noor-logo-edition-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [edition]);

  const activeEdition: NoorLogoEditionId = useMemo(() => {
    if (edition !== undefined) {
      return (Math.max(0, Math.min(4, Math.floor(edition))) || 0) as NoorLogoEditionId;
    }
    return selectedEdition;
  }, [edition, selectedEdition]);

  const currentMeta = NOOR_LOGO_EDITIONS[activeEdition] || NOOR_LOGO_EDITIONS[0];
  const dimension = customSize ?? SIZE_MAP[size];
  const prefix = `siraj-logo-${activeEdition}`;

  const renderedVector = useMemo(() => {
    switch (activeEdition) {
      case 0:
        return <Edition0Vector prefix={prefix} animated={animated} />;
      case 1:
        return <Edition1Vector prefix={prefix} animated={animated} />;
      case 2:
        return <Edition2Vector prefix={prefix} animated={animated} />;
      case 3:
        return <Edition3Vector prefix={prefix} animated={animated} />;
      case 4:
        return <Edition4Vector prefix={prefix} animated={animated} />;
      default:
        return <Edition0Vector prefix={prefix} animated={animated} />;
    }
  }, [activeEdition, prefix, animated]);

  return (
    <div
      className={`inline-flex flex-col items-center justify-center select-none ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`Siraj Logo — ${currentMeta.name}`}
    >
      {/* 60 FPS GPU-Composited CSS Keyframes (No backdrop-filter, No drop-shadow) */}
      <style>{`
        @keyframes sirajSpinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes sirajPulseAura {
          0%, 100% { opacity: 0.35; transform: scale(0.96); }
          50% { opacity: 0.7; transform: scale(1.04); }
        }
        @keyframes sirajGentleFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes sirajPulseCrescent {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.05); opacity: 1; }
        }
        @keyframes sirajTwinkle {
          0%, 100% { opacity: 0.4; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes sirajVerticalBreathe {
          0%, 100% { transform: scaleY(0.95); opacity: 0.5; }
          50% { transform: scaleY(1.05); opacity: 0.8; }
        }
        @keyframes sirajShimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.95; }
        }
      `}</style>

      {/* SVG Container */}
      <svg
        width={dimension}
        height={dimension}
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible pointer-events-none"
      >
        <SvgDefs prefix={prefix} />
        {renderedVector}
      </svg>

      {/* Optional Edition Badge Indicator */}
      {showBadge && (
        <div
          className="mt-2 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase border"
          style={{
            background: 'var(--accent-soft, rgba(212,175,55,0.12))',
            borderColor: 'var(--border, rgba(212,175,55,0.3))',
            color: 'var(--accent-text, #F3E5AB)',
          }}
        >
          ✦ {currentMeta.shortName} ✦
        </div>
      )}
    </div>
  );
};

// ─── 5-LOGO VISUAL SELECTOR GRID COMPONENT ───

export interface NoorLogoVisualPickerProps {
  className?: string;
  onSelect?: (edition: NoorLogoEditionId) => void;
}

interface LogoEditionCardProps {
  editionId: NoorLogoEditionId;
  isActive: boolean;
  onSelect: (editionId: NoorLogoEditionId) => void;
}

export const LogoEditionCard = memo<LogoEditionCardProps>(({
  editionId,
  isActive,
  onSelect,
}) => {
  const ed = NOOR_LOGO_EDITIONS[editionId];

  const handleClick = () => {
    onSelect(editionId);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`group relative flex flex-col items-center justify-between rounded-xl border select-none min-w-0 cursor-pointer ${
        isActive
          ? 'border-[var(--accent)] ring-1 ring-[var(--accent)] bg-[var(--accent-soft)]'
          : 'border-[var(--border)] hover:border-[var(--accent)]/40 bg-[var(--surface-2)]/60 hover:bg-[var(--surface-2)] opacity-85 hover:opacity-100'
      }`}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: 'auto 74px',
        padding: '10px 6px',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'border-color 0.15s ease, background-color 0.15s ease',
        boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.25)' : 'none',
      }}
      title={`${ed.name} (Tap to set as App & Launcher Icon)`}
      aria-label={`Select ${ed.name}`}
    >
      {/* Active Checkmark Badge */}
      {isActive && (
        <div
          className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center shadow-sm z-10"
          style={{ background: 'var(--accent)', color: 'var(--on-accent, #000)' }}
        >
          <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      <div
        className="flex items-center justify-center pointer-events-none shrink-0 my-0.5 mx-auto"
        style={{ width: '38px', height: '38px', maxWidth: '100%', overflow: 'hidden' }}
      >
        <NoorDynamicLogo edition={editionId} customSize={36} animated={false} noFilters={true} />
      </div>

      <span
        style={{
          fontSize: '0.68rem',
          lineHeight: 1.25,
          fontWeight: 700,
          textAlign: 'center',
          display: 'block',
          width: '100%',
          whiteSpace: 'normal',
          wordBreak: 'keep-all',
          color: isActive ? 'var(--accent-text)' : 'var(--text-secondary)',
        }}
      >
        {ed.cardTitle || ed.shortLabel?.replace('\n', ' ') || ed.shortName}
      </span>
    </button>
  );
});

LogoEditionCard.displayName = 'LogoEditionCard';

export const NoorLogoVisualPicker: React.FC<NoorLogoVisualPickerProps> = ({
  className = '',
  onSelect,
}) => {
  const [selected, setSelected] = useState<NoorLogoEditionId>(() => getSelectedLogoEdition());

  useEffect(() => {
    const handleUpdate = () => {
      setSelected(getSelectedLogoEdition());
    };
    window.addEventListener(LOGO_EDITION_CHANGE_EVENT, handleUpdate);
    window.addEventListener(LOGO_EDITION_CHANGED_EVENT, handleUpdate);
    window.addEventListener('noor-logo-edition-change', handleUpdate);
    window.addEventListener('noor-logo-edition-changed', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(LOGO_EDITION_CHANGE_EVENT, handleUpdate);
      window.removeEventListener(LOGO_EDITION_CHANGED_EVENT, handleUpdate);
      window.removeEventListener('noor-logo-edition-change', handleUpdate);
      window.removeEventListener('noor-logo-edition-changed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const handlePick = useCallback((edition: NoorLogoEditionId) => {
    setSelected(edition);
    setSelectedLogoEdition(edition);
    if (onSelect) {
      onSelect(edition);
    }
  }, [onSelect]);

  return (
    <div className={`space-y-2 select-none w-full ${className}`}>
      <div className="grid grid-cols-3 gap-2.5 w-full">
        {NOOR_LOGO_EDITIONS.map((ed) => (
          <LogoEditionCard
            key={ed.id}
            editionId={ed.id}
            isActive={selected === ed.id}
            onSelect={handlePick}
          />
        ))}
      </div>
    </div>
  );
};

export default NoorDynamicLogo;
