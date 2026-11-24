import React from 'react';

/**
 * PRAYER REMINDER BANNER (IN-APP POPUP)
 *
 * NOTE: The in-app prayer reminder popup banner has been completely removed
 * per P0 specification to eliminate UI friction, popups, and modal overlap.
 * Real Android OS notification drawer alerts are handled via Capacitor LocalNotifications
 * and native PrayerAlarmReceiver on channel "siraj_prayers_v3".
 *
 * Exports are retained as zero-overhead no-ops for backward compatibility.
 */

export const PRAYER_BANNER_ALERT_EVENT = 'noor-in-app-prayer-alert';

export interface PrayerAlertDetail {
  prayerName: string;
  prayerTime12h?: string;
}

export function triggerInAppPrayerAlert(_prayerName: string, _time12h?: string): void {
  // Completely disabled — real Android OS notification drawer alerts handle prayer notifications.
}

export const PrayerReminderBanner: React.FC = () => null;

export default PrayerReminderBanner;
