package com.siraj.app;

/**
 * Legacy receiver component retained for seamless PendingIntent upgrades.
 * Delegates all wake-lock, 20-minute stale cutoff, once-per-day dedup,
 * and background history logging directly to PrayerAlarmReceiver.
 */
public class AdhanAlarmReceiver extends PrayerAlarmReceiver {
}
