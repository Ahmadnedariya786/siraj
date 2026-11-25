import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { LanguageCode } from '@/lib/i18n-ui';
import { formatSajdahString, getSajdahI18n } from '@/lib/sajdah-i18n';
import {
  getTotalPendingCount,
  isSajdahReminderEnabled,
  SAJDAH_UPDATED_EVENT,
  setSajdahReminderPreference,
} from '@/lib/sajdah-tracker';

export const SAJDAH_REMINDER_NOTIFICATION_ID = 1099;
export const SAJDAH_REMINDER_CHANNEL_ID = 'siraj_reminders_v3';
const MIN_FUTURE_GUARD_MS = 5_000;

export interface SajdahReminderAdapter {
  isNative: () => boolean;
  hasPermission: () => Promise<boolean>;
  ensureChannel: () => Promise<void>;
  cancelReminder: (id: number) => Promise<void>;
  scheduleReminder: (opts: {
    id: number;
    title: string;
    body: string;
    channelId: string;
    triggerAt: Date;
    extra: { type: 'sajdah_reminder'; route: '/sajdah'; pendingCount: number };
  }) => Promise<void>;
}

const defaultAdapter: SajdahReminderAdapter = {
  isNative: () => Capacitor.isNativePlatform(),
  hasPermission: async () => {
    try {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted';
    } catch (err) {
      console.warn('[sajdah-reminder] permission check failed:', err);
      return false;
    }
  },
  ensureChannel: async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await LocalNotifications.createChannel({
        id: SAJDAH_REMINDER_CHANNEL_ID,
        name: 'Siraj Reminders',
        description: 'Daily worship & Sajdah-e-Tilawat reminders',
        importance: 4,
        visibility: 1,
        sound: 'default',
        vibration: true,
      });
    } catch (err) {
      console.warn('[sajdah-reminder] ensureChannel warning:', err);
    }
  },
  cancelReminder: async (id: number) => {
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (err) {
      console.warn('[sajdah-reminder] cancelReminder warning:', err);
    }
  },
  scheduleReminder: async (opts) => {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: opts.id,
          title: opts.title,
          body: opts.body,
          channelId: opts.channelId,
          schedule: {
            at: opts.triggerAt,
            allowWhileIdle: true,
          },
          extra: opts.extra,
          smallIcon: 'ic_stat_icon_config_sample',
        },
      ],
    });
  },
};

/**
 * Computes the next 20:00 local trigger strictly > nowMs + 5_000ms.
 * Never schedules in the past or inside the 5-second Android alarm safety buffer.
 */
export function computeNextDaily2000Trigger(now: Date = new Date()): Date {
  const nowMs = now.getTime();
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    20,
    0,
    0,
    0,
  );
  if (candidate.getTime() <= nowMs + MIN_FUTURE_GUARD_MS) {
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}

function readActiveLanguage(): LanguageCode {
  try {
    const raw = window.localStorage.getItem('app-language');
    if (raw) return raw as LanguageCode;
  } catch (err) {
    console.warn('[sajdah-reminder] read language warning:', err);
  }
  return 'en';
}

export interface SyncSajdahReminderResult {
  action: 'scheduled' | 'cancelled' | 'skipped-no-permission' | 'skipped-web';
  triggerAtMs?: number;
  pendingCount: number;
}

export async function syncSajdahReminderNotification(options?: {
  now?: Date;
  enabled?: boolean;
  pendingCount?: number;
  language?: LanguageCode;
  adapter?: SajdahReminderAdapter;
}): Promise<SyncSajdahReminderResult> {
  const now = options?.now ?? new Date();
  const enabled = options?.enabled ?? isSajdahReminderEnabled();
  const pendingCount = options?.pendingCount ?? getTotalPendingCount();
  const adapter = options?.adapter ?? defaultAdapter;

  // Always cancel immediately when toggle is OFF or pending queue is empty (0)
  if (!enabled || pendingCount <= 0) {
    if (adapter.isNative()) {
      await adapter.cancelReminder(SAJDAH_REMINDER_NOTIFICATION_ID);
    }
    return { action: 'cancelled', pendingCount };
  }

  if (!adapter.isNative()) {
    return { action: 'skipped-web', pendingCount };
  }

  const permitted = await adapter.hasPermission();
  if (!permitted) {
    return { action: 'skipped-no-permission', pendingCount };
  }

  const triggerAt = computeNextDaily2000Trigger(now);
  const triggerAtMs = triggerAt.getTime();
  // Defensive strict future-only guard (> now + 5_000ms)
  if (triggerAtMs <= now.getTime() + MIN_FUTURE_GUARD_MS) {
    return { action: 'cancelled', pendingCount };
  }

  const strings = getSajdahI18n(options?.language ?? readActiveLanguage());
  const body = formatSajdahString(strings.notifBody, { n: pendingCount });

  await adapter.ensureChannel();
  // Cancel stale instance first so updated count & single slot are guaranteed
  await adapter.cancelReminder(SAJDAH_REMINDER_NOTIFICATION_ID);
  await adapter.scheduleReminder({
    id: SAJDAH_REMINDER_NOTIFICATION_ID,
    title: strings.notifTitle,
    body,
    channelId: SAJDAH_REMINDER_CHANNEL_ID,
    triggerAt,
    extra: {
      type: 'sajdah_reminder',
      route: '/sajdah',
      pendingCount,
    },
  });

  return {
    action: 'scheduled',
    triggerAtMs,
    pendingCount,
  };
}

export async function setSajdahReminderEnabled(
  enabled: boolean,
  language?: LanguageCode,
): Promise<SyncSajdahReminderResult> {
  setSajdahReminderPreference(enabled);
  if (enabled && Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions();
      if (current.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }
    } catch (err) {
      console.warn('[sajdah-reminder] permission request warning:', err);
    }
  }
  return syncSajdahReminderNotification({ enabled, language });
}

let listenerRegistered = false;

export function initSajdahReminderLifecycle(): void {
  if (typeof window === 'undefined' || listenerRegistered) return;
  listenerRegistered = true;

  const triggerSync = () => {
    syncSajdahReminderNotification().catch((err) => {
      console.warn('[sajdah-reminder] lifecycle sync failed:', err);
    });
  };

  window.addEventListener(SAJDAH_UPDATED_EVENT, triggerSync);
  window.addEventListener('storage', (e: StorageEvent) => {
    if (
      !e.key ||
      e.key === 'siraj_sajdah_tracker_v1' ||
      e.key === 'siraj_sajdah_reminder_enabled_v1'
    ) {
      triggerSync();
    }
  });

  triggerSync();
}
