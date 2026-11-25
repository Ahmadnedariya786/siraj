import { registerPlugin } from '@capacitor/core';

export interface OemGuidance {
  manufacturer: string;
  model: string;
  androidApi: number;
  batteryUnrestricted: boolean;
  hasOemAutoStartPage: boolean;
  tip: string;
}

export interface BatteryOptimizationPlugin {
  /**
   * Check if the app is ignoring battery optimizations
   */
  isIgnoringBatteryOptimizations(): Promise<{ isIgnoring: boolean }>;

  /**
   * Request to ignore battery optimizations
   * Opens the system settings page where the user can disable battery optimization
   */
  requestIgnoreBatteryOptimizations(): Promise<void>;

  /**
   * Open the app's battery optimization settings page
   */
  openBatterySettings(): Promise<void>;

  /**
   * Open the device's OEM-specific battery / auto-start settings with universal safe fallback
   */
  openOemBackgroundSettings(options?: { mode?: 'auto' | 'battery' | 'autostart' }): Promise<{ opened: boolean }>;

  /**
   * Get dynamic OEM guidance tip and battery exemption status for the current device
   */
  getOemGuidance(): Promise<OemGuidance>;
}

const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization');

export default BatteryOptimization;
