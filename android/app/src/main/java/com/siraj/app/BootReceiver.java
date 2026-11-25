package com.siraj.app;

import android.app.AlarmManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

/**
 * Universal self-healing system recovery receiver across all Android OEMs.
 *
 * Re-arms upcoming prayer alarms directly from native SharedPreferences
 * (zero WebView required) on:
 * - BOOT_COMPLETED / LOCKED_BOOT_COMPLETED
 * - QUICKBOOT_POWERON / com.htc.intent.action.QUICKBOOT_POWERON (Xiaomi/Vivo/HTC/MediaTek fast boot)
 * - TIME_SET / TIMEZONE_CHANGED
 * - MY_PACKAGE_REPLACED (OTA updates)
 * - SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED (Android 12-15 permission grant)
 */
public class BootReceiver extends BroadcastReceiver {
    private static final String TAG = "BootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        boolean isAlarmPermissionChange = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            isAlarmPermissionChange = AlarmManager.ACTION_SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED.equals(action);
        }

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_LOCKED_BOOT_COMPLETED.equals(action)
                || "android.intent.action.QUICKBOOT_POWERON".equals(action)
                || "com.htc.intent.action.QUICKBOOT_POWERON".equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)
                || isAlarmPermissionChange) {

            PowerManager.WakeLock wakeLock = null;
            try {
                PowerManager pm = (PowerManager) context.getApplicationContext()
                        .getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "siraj:boot_recovery");
                    wakeLock.setReferenceCounted(false);
                    wakeLock.acquire(10_000L);
                }

                PrayerAlarmReceiver.ensurePrayerChannel(context);
                int count = NativeAdhanScheduler.rescheduleAlarms(context);
                NativeAdhanScheduler.logTrace(context, "RECOVERY[" + action + "] rearmed=" + count);
                Log.d(TAG, "System event (" + action + ") recovered " + count + " prayer alarms");
            } catch (Throwable t) {
                Log.e(TAG, "Failed recovering alarms on " + action, t);
                NativeAdhanScheduler.logTrace(context, "RECOVERY_ERR[" + action + "]: " + t.getMessage());
            } finally {
                if (wakeLock != null && wakeLock.isHeld()) {
                    try {
                        wakeLock.release();
                    } catch (Throwable ignored) {}
                }
            }
        }
    }
}
