import { Capacitor } from '@capacitor/core';
import { showExactAlarmRationale } from '@/components/ExactAlarmPermissionDialog';

export interface NativeAdhanAlarm {
  id: number;
  triggerAt: number;
  prayerName: string;
  prayerTime?: string;
  adhanUrl: string;
  overrideSilent?: boolean;
  maxVolume?: boolean;
  playAdhanAudio?: boolean;
}

export interface AlarmKernelDiagnostics {
  osNextAlarmClock: string;
  osNextAlarmEpochMs: number;
  alarmMethod?: 'setAlarmClock' | 'exactIdle' | 'inexactIdle' | 'none';
  nextScheduledPrayer?: string;
  nextScheduledEpochMs?: number;
  canScheduleExactAlarms: boolean;
  notificationsEnabled: boolean;
  channelImportance: number;
  batteryUnrestricted: boolean;
  deviceManufacturer: string;
  deviceModel: string;
  androidApi: number;
  scheduledCount: number;
  nativeTraceLog: string[];
}

interface NativeAdhanPlugin {
  schedule(options: { alarms: NativeAdhanAlarm[]; enabled?: boolean }): Promise<{ scheduled: number; enabled: boolean }>;
  clear(): Promise<{ status: string }>;
  setEnabled(options: { enabled: boolean }): Promise<{ enabled: boolean; count: number }>;
  getStatus(): Promise<{ enabled: boolean; count: number }>;
  scheduleTest60sAlarm(options: {
    prayerName: string;
    prayerTime?: string;
    playAudio?: boolean;
  }): Promise<{ scheduled: boolean; triggerAtMs: number }>;
  getAlarmKernelDiagnostics(): Promise<AlarmKernelDiagnostics>;
  clearTraceLog(): Promise<{ cleared: boolean }>;
  canScheduleExactAlarms(): Promise<{ canSchedule: boolean }>;
  requestExactAlarmPermission(): Promise<{ opened: boolean; alreadyGranted?: boolean }>;
}

const NativeAdhanPlugin = Capacitor.registerPlugin<NativeAdhanPlugin>('NativeAdhanPlugin');

const EXACT_ALARM_PROMPT_KEY = 'exact-alarm-prompted-session';

class NativeAdhanBridge {
  private isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /**
   * Check if exact alarms can be scheduled (Android 12+ / API 31+)
   */
  async canScheduleExactAlarms(): Promise<boolean> {
    if (!this.isNative()) return true;

    try {
      const res = await NativeAdhanPlugin.canScheduleExactAlarms();
      return res?.canSchedule ?? true;
    } catch (error) {
      console.warn('Failed to check canScheduleExactAlarms:', error);
      return true;
    }
  }

  /**
   * Show the in-app rationale modal, then (if the user taps Allow)
   * fire ACTION_REQUEST_SCHEDULE_EXACT_ALARM intent for Siraj
   * which opens the system "Alarms & reminders" screen with the app focused.
   */
  async requestExactAlarmPermission(): Promise<boolean> {
    if (!this.isNative()) return false;

    const userAllowed = await showExactAlarmRationale();
    if (!userAllowed) return false;

    return this.openExactAlarmSettings();
  }

  /**
   * Directly open the system "Alarms & reminders" settings WITHOUT showing the
   * rationale modal first.
   */
  async openExactAlarmSettings(): Promise<boolean> {
    if (!this.isNative()) return false;

    try {
      const res = await NativeAdhanPlugin.requestExactAlarmPermission();
      return res?.opened ?? false;
    } catch (error) {
      console.warn('Failed to open exact alarm settings:', error);
      return false;
    }
  }

  /**
   * Check and ensure exact alarm permission politely.
   */
  async ensureExactAlarmPermission(forcePrompt: boolean = false): Promise<boolean> {
    if (!this.isNative()) return true;

    const canSchedule = await this.canScheduleExactAlarms();
    if (canSchedule) return true;

    if (forcePrompt) {
      await this.requestExactAlarmPermission();
      return false;
    }

    if (localStorage.getItem('onboarding_perms_v2_done') !== 'true') {
      return false;
    }

    const alreadyPrompted = sessionStorage.getItem(EXACT_ALARM_PROMPT_KEY);
    if (!alreadyPrompted) {
      sessionStorage.setItem(EXACT_ALARM_PROMPT_KEY, 'true');
      await this.requestExactAlarmPermission();
    }

    return false;
  }

  async schedule(alarms: NativeAdhanAlarm[], enabled: boolean): Promise<number> {
    if (!this.isNative()) return 0;

    try {
      const result = await NativeAdhanPlugin.schedule({ alarms, enabled });
      return result.scheduled ?? 0;
    } catch (error) {
      console.warn('Failed to schedule native adhan alarms:', error);
      return 0;
    }
  }

  async clear(): Promise<void> {
    if (!this.isNative()) return;

    try {
      await NativeAdhanPlugin.clear();
    } catch (error) {
      console.warn('Failed to clear native adhan alarms:', error);
    }
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (!this.isNative()) return;

    try {
      await NativeAdhanPlugin.setEnabled({ enabled });
    } catch (error) {
      console.warn('Failed to update native adhan enabled state:', error);
    }
  }

  async getStatus(): Promise<{ enabled: boolean; count: number }> {
    if (!this.isNative()) {
      return { enabled: true, count: 0 };
    }

    try {
      return await NativeAdhanPlugin.getStatus();
    } catch (error) {
      console.warn('Failed to fetch native adhan status:', error);
      return { enabled: true, count: 0 };
    }
  }

  /**
   * Schedule a 60-second test alarm using the 100% identical AlarmManager.setAlarmClock() -> PrayerAlarmReceiver path.
   */
  async scheduleTest60sAlarm(
    prayerName: string,
    prayerTime?: string,
    playAudio: boolean = true
  ): Promise<{ scheduled: boolean; triggerAtMs: number }> {
    if (!this.isNative()) {
      return { scheduled: false, triggerAtMs: 0 };
    }

    try {
      return await NativeAdhanPlugin.scheduleTest60sAlarm({ prayerName, prayerTime, playAudio });
    } catch (error) {
      const bridge = typeof window !== 'undefined' ? (window as unknown as { AndroidBridge?: { scheduleTest60sAlarm?: (p: string, t: string) => number } }).AndroidBridge : undefined;
      if (bridge && typeof bridge.scheduleTest60sAlarm === 'function') {
        const triggerAtMs = Number(bridge.scheduleTest60sAlarm(prayerName, prayerTime || '')) || 0;
        return { scheduled: triggerAtMs > 0, triggerAtMs };
      }
      console.warn('Failed to schedule 60s test alarm:', error);
      return { scheduled: false, triggerAtMs: 0 };
    }
  }

  async getAlarmKernelDiagnostics(): Promise<AlarmKernelDiagnostics | null> {
    if (!this.isNative()) return null;

    try {
      return await NativeAdhanPlugin.getAlarmKernelDiagnostics();
    } catch (error) {
      const bridge = typeof window !== 'undefined' ? (window as unknown as { AndroidBridge?: { getAlarmKernelDiagnostics?: () => string } }).AndroidBridge : undefined;
      if (bridge && typeof bridge.getAlarmKernelDiagnostics === 'function') {
        try {
          const parsed = JSON.parse(bridge.getAlarmKernelDiagnostics());
          return parsed as AlarmKernelDiagnostics;
        } catch {
          return null;
        }
      }
      console.warn('Failed to read alarm kernel diagnostics:', error);
      return null;
    }
  }

  async clearTraceLog(): Promise<void> {
    if (!this.isNative()) return;
    try {
      await NativeAdhanPlugin.clearTraceLog();
    } catch (error) {
      console.warn('Failed to clear native trace log:', error);
    }
  }
}

export const nativeAdhan = new NativeAdhanBridge();

export async function checkAndRequestExactAlarms(force: boolean = false): Promise<boolean> {
  return nativeAdhan.ensureExactAlarmPermission(force);
}

export async function isExactAlarmPermissionGranted(): Promise<boolean> {
  return nativeAdhan.canScheduleExactAlarms();
}

export async function openExactAlarmSettings(): Promise<boolean> {
  return nativeAdhan.openExactAlarmSettings();
}
