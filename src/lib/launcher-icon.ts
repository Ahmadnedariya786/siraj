/**
 * Siraj — Dynamic Android Home Screen Launcher Icon Switcher
 *
 * Interfaces with the native Capacitor `LauncherAlias` plugin and the `AndroidBridge`
 * JavascriptInterface to toggle Android <activity-alias> components at runtime.
 */

import { registerPlugin } from '@capacitor/core';

export interface LauncherAliasPluginInterface {
  setLauncherIcon(options: { alias?: string; edition?: number }): Promise<{ success: boolean; activeAlias: string }>;
  getActiveLauncherIcon(): Promise<{ activeAlias: string; edition: number }>;
}

export const LauncherAlias = registerPlugin<LauncherAliasPluginInterface>('LauncherAlias');

export const ALIAS_MAP: Record<number, string> = {
  0: 'royal-mihrab',
  1: 'kaaba-orbit',
  2: 'haramain-crest',
  3: 'mamluk-star',
  4: 'siraj-star',
};

/**
 * Triggers native Android launcher icon update.
 * Safely tries Capacitor plugin first, with fallback to window.AndroidBridge.
 */
export async function setNativeLauncherIcon(editionId: number, aliasKey?: string): Promise<void> {
  const safeId = Math.max(0, Math.min(4, Math.floor(editionId)));
  const targetAlias = aliasKey || ALIAS_MAP[safeId] || 'royal-mihrab';

  // 1. Capacitor Plugin Call
  try {
    if (LauncherAlias && typeof LauncherAlias.setLauncherIcon === 'function') {
      await LauncherAlias.setLauncherIcon({
        alias: targetAlias,
        edition: safeId,
      });
    }
  } catch (err) {
    // Non-fatal if plugin is registering or running in browser
  }

  // 2. AndroidBridge JavascriptInterface fallback
  try {
    if (typeof window !== 'undefined') {
      const bridge = (window as unknown as { AndroidBridge?: { setLauncherIconEdition?: (id: number) => void } }).AndroidBridge;
      if (bridge && typeof bridge.setLauncherIconEdition === 'function') {
        bridge.setLauncherIconEdition(safeId);
      }
    }
  } catch (err) {
    // Non-fatal
  }
}
