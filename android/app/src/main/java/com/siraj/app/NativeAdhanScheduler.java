package com.siraj.app;

import android.app.AlarmManager;
import android.app.AlarmManager.AlarmClockInfo;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Schedules adhan alarms using AlarmManager.setAlarmClock() — the same
 * approach used by Muslim Pro, Athan, and other major Islamic apps.
 *
 * Why setAlarmClock()?
 * - Immune to Doze mode (always fires on time)
 * - Immune to battery optimisation
 * - Shows ⏰ alarm icon in status bar (users expect this)
 * - Paired with USE_EXACT_ALARM on Android 13-15 for zero-delay execution
 * - No persistent foreground service needed
 *
 * Alarms are persisted in SharedPreferences so they can be restored
 * after reboot via BootReceiver.
 */
public final class NativeAdhanScheduler {
    private static final String TAG = "NativeAdhanScheduler";

    public static final long MIN_FUTURE_GUARD_MS = 15_000L;
    private static final String PREFS_NAME = "native_adhan_alarms";
    private static final String KEY_IDS = "alarm_ids";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_PREFIX_TIME = "time_";
    private static final String KEY_PREFIX_PRAYER = "prayer_";
    private static final String KEY_PREFIX_PTIME = "ptime_";
    private static final String KEY_PREFIX_AUDIO = "audio_";
    private static final String KEY_PREFIX_OVERRIDE = "override_";
    private static final String KEY_PREFIX_MAXVOL = "maxvol_";

    private NativeAdhanScheduler() {
    }

    public static final class ScheduledAdhan {
        public final int id;
        public final long triggerAtMillis;
        public final String prayerName;
        public final String prayerTime;
        public final String adhanUrl;
        public final boolean overrideSilent;
        public final boolean maxVolume;

        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String prayerTime, String adhanUrl,
                              boolean overrideSilent, boolean maxVolume) {
            this.id = id;
            this.triggerAtMillis = triggerAtMillis;
            this.prayerName = prayerName;
            this.prayerTime = prayerTime;
            this.adhanUrl = adhanUrl;
            this.overrideSilent = overrideSilent;
            this.maxVolume = maxVolume;
        }

        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String adhanUrl,
                              boolean overrideSilent, boolean maxVolume) {
            this(id, triggerAtMillis, prayerName, null, adhanUrl, overrideSilent, maxVolume);
        }

        // Legacy constructor for backward compatibility
        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String adhanUrl) {
            this(id, triggerAtMillis, prayerName, null, adhanUrl, false, false);
        }
    }

    public static boolean isEnabled(Context context) {
        return getPrefs(context).getBoolean(KEY_ENABLED, true);
    }

    public static void setEnabled(Context context, boolean enabled) {
        getPrefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
        if (!enabled) {
            clearAll(context);
        }
    }

    public static int getScheduledCount(Context context) {
        return getStoredIds(context).size();
    }

    /**
     * Schedule a single adhan alarm using setAlarmClock().
     *
     * setAlarmClock() is the gold standard for prayer apps because Android
     * treats it as a user-visible alarm clock — it is exempt from ALL
     * power-saving restrictions including Doze and App Standby.
     */
    public static void scheduleAlarm(Context context, ScheduledAdhan alarm, boolean persist) {
        // Strict Future-Only Guard (MANDATORY): triggerAtMs > now + 15000ms (1000ms only for 5s test alarm)
        boolean isTest = (alarm.id == 9901 || alarm.id == 99999);
        long minThreshold = isTest
                ? System.currentTimeMillis() + 1000L
                : System.currentTimeMillis() + MIN_FUTURE_GUARD_MS;
        if (alarm.triggerAtMillis <= minThreshold) {
            Log.d(TAG, "Skipping past/non-future alarm: " + alarm.prayerName + " (trigger=" + alarm.triggerAtMillis + ", minThreshold=" + minThreshold + ")");
            removePersistedAlarm(context, alarm.id);
            return;
        }

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) {
            Log.e(TAG, "AlarmManager unavailable; cannot schedule adhan " + alarm.id);
            return;
        }

        String resolvedPrayerTime = (alarm.prayerTime != null && !alarm.prayerTime.trim().isEmpty())
                ? alarm.prayerTime.trim()
                : new SimpleDateFormat("hh:mm a", Locale.US).format(new Date(alarm.triggerAtMillis));

        PendingIntent pendingIntent = createPendingIntent(
                context,
                alarm.id,
                alarm.prayerName,
                resolvedPrayerTime,
                alarm.triggerAtMillis,
                alarm.adhanUrl,
                alarm.overrideSilent,
                alarm.maxVolume);

        // Create a PendingIntent that opens the app when user taps the alarm icon
        Intent showIntent = new Intent(context, MainActivity.class);
        showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int showFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent showPendingIntent = PendingIntent.getActivity(
                context, 1000000000 + alarm.id, showIntent, showFlags);

        try {
            // PRIMARY: setAlarmClock() — immune to Doze, shows ⏰ in status bar
            AlarmClockInfo alarmClock = new AlarmClockInfo(
                    alarm.triggerAtMillis,
                    showPendingIntent // Shown when user taps the ⏰ icon
            );
            alarmManager.setAlarmClock(alarmClock, pendingIntent);
            Log.d(TAG, "Scheduled AlarmClock for " + alarm.prayerName
                    + " (id=" + alarm.id + ") at " + alarm.triggerAtMillis);
        } catch (SecurityException alarmClockError) {
            // Fallback chain: setExactAndAllowWhileIdle -> setAndAllowWhileIdle -> set
            Log.w(TAG, "setAlarmClock rejected, trying exact alarm", alarmClockError);
            try {
                if (canUseExactAlarms(alarmManager)) {
                    alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            alarm.triggerAtMillis,
                            pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            alarm.triggerAtMillis,
                            pendingIntent);
                }
            } catch (SecurityException exactAlarmError) {
                Log.w(TAG, "Exact alarm rejected, falling back to inexact alarm", exactAlarmError);
                alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
            }
        }

        if (persist) {
            persistAlarm(context, alarm);
        }
    }

    public static void clearAll(Context context) {
        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        Set<String> ids = getStoredIds(context);

        for (String idString : ids) {
            int id;
            try {
                id = Integer.parseInt(idString);
            } catch (NumberFormatException e) {
                continue;
            }

            if (alarmManager != null) {
                PendingIntent pendingIntent = createPendingIntent(context, id, null, null, -1L, null, false, false);
                alarmManager.cancel(pendingIntent);
            }
        }

        clearPersistedAlarms(context);
        Log.d(TAG, "Cleared all native adhan alarms");
    }

    public static void removeAlarm(Context context, int alarmId) {
        try {
            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager != null) {
                PendingIntent pendingIntent = createPendingIntent(context, alarmId, null, null, -1L, null, false, false);
                alarmManager.cancel(pendingIntent);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to cancel AlarmManager pending intent for alarm " + alarmId, t);
        }
        removePersistedAlarm(context, alarmId);
    }

    public static void rescheduleAlarms(Context context) {
        Set<String> ids = getStoredIds(context);
        if (ids.isEmpty()) {
            return;
        }

        SharedPreferences prefs = getPrefs(context);
        long now = System.currentTimeMillis();

        for (String idString : ids) {
            int id;
            try {
                id = Integer.parseInt(idString);
            } catch (NumberFormatException e) {
                continue;
            }

            long triggerAt = prefs.getLong(KEY_PREFIX_TIME + id, -1L);
            if (triggerAt <= now + MIN_FUTURE_GUARD_MS) {
                removePersistedAlarm(context, id);
                continue;
            }

            String prayerName = prefs.getString(KEY_PREFIX_PRAYER + id, "Prayer");
            String prayerTime = prefs.getString(KEY_PREFIX_PTIME + id, null);
            String adhanUrl = prefs.getString(KEY_PREFIX_AUDIO + id, "/audio/adhan-makkah.mp3");
            boolean overrideSilent = prefs.getBoolean(KEY_PREFIX_OVERRIDE + id, false);
            boolean maxVolume = prefs.getBoolean(KEY_PREFIX_MAXVOL + id, false);

            scheduleAlarm(
                    context,
                    new ScheduledAdhan(id, triggerAt, prayerName, prayerTime, adhanUrl, overrideSilent, maxVolume),
                    false);
        }

        Log.d(TAG, "Rescheduled native adhan alarms after reboot/time change");
    }

    private static SharedPreferences getPrefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    private static PendingIntent createPendingIntent(
            Context context,
            int alarmId,
            String prayerName,
            String prayerTime,
            long expectedTriggerMs,
            String adhanUrl,
            boolean overrideSilent,
            boolean maxVolume) {
        Intent intent = new Intent(context, PrayerAlarmReceiver.class);
        intent.setAction(PrayerAlarmReceiver.ACTION_TRIGGER);
        intent.putExtra(PrayerAlarmReceiver.EXTRA_ALARM_ID, alarmId);
        if (prayerName != null) {
            intent.putExtra(PrayerAlarmReceiver.EXTRA_PRAYER_NAME, prayerName);
        }
        if (prayerTime != null) {
            intent.putExtra("prayerTime", prayerTime);
        }
        if (expectedTriggerMs > 0L) {
            intent.putExtra(PrayerAlarmReceiver.EXTRA_EXPECTED_TRIGGER_MS, expectedTriggerMs);
        }
        if (adhanUrl != null) {
            intent.putExtra(PrayerAlarmReceiver.EXTRA_ADHAN_URL, adhanUrl);
        }
        intent.putExtra(PrayerAlarmReceiver.EXTRA_OVERRIDE_SILENT, overrideSilent);
        intent.putExtra(PrayerAlarmReceiver.EXTRA_MAX_VOLUME, maxVolume);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;

        return PendingIntent.getBroadcast(context, alarmId, intent, flags);
    }

    private static boolean canUseExactAlarms(AlarmManager alarmManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        return alarmManager.canScheduleExactAlarms();
    }

    private static void persistAlarm(Context context, ScheduledAdhan alarm) {
        SharedPreferences prefs = getPrefs(context);
        Set<String> ids = getStoredIds(context);
        ids.add(String.valueOf(alarm.id));

        prefs.edit()
                .putStringSet(KEY_IDS, ids)
                .putLong(KEY_PREFIX_TIME + alarm.id, alarm.triggerAtMillis)
                .putString(KEY_PREFIX_PRAYER + alarm.id, alarm.prayerName)
                .putString(KEY_PREFIX_PTIME + alarm.id, alarm.prayerTime != null ? alarm.prayerTime : "")
                .putString(KEY_PREFIX_AUDIO + alarm.id, alarm.adhanUrl)
                .putBoolean(KEY_PREFIX_OVERRIDE + alarm.id, alarm.overrideSilent)
                .putBoolean(KEY_PREFIX_MAXVOL + alarm.id, alarm.maxVolume)
                .apply();
    }

    private static Set<String> getStoredIds(Context context) {
        SharedPreferences prefs = getPrefs(context);
        Set<String> ids = prefs.getStringSet(KEY_IDS, new HashSet<>());
        return new HashSet<>(ids);
    }

    private static void removePersistedAlarm(Context context, int alarmId) {
        SharedPreferences prefs = getPrefs(context);
        Set<String> ids = getStoredIds(context);
        ids.remove(String.valueOf(alarmId));

        prefs.edit()
                .putStringSet(KEY_IDS, ids)
                .remove(KEY_PREFIX_TIME + alarmId)
                .remove(KEY_PREFIX_PRAYER + alarmId)
                .remove(KEY_PREFIX_PTIME + alarmId)
                .remove(KEY_PREFIX_AUDIO + alarmId)
                .remove(KEY_PREFIX_OVERRIDE + alarmId)
                .remove(KEY_PREFIX_MAXVOL + alarmId)
                .apply();
    }

    private static void clearPersistedAlarms(Context context) {
        SharedPreferences prefs = getPrefs(context);
        Set<String> ids = getStoredIds(context);

        SharedPreferences.Editor editor = prefs.edit();
        for (String idString : ids) {
            editor.remove(KEY_PREFIX_TIME + idString);
            editor.remove(KEY_PREFIX_PRAYER + idString);
            editor.remove(KEY_PREFIX_PTIME + idString);
            editor.remove(KEY_PREFIX_AUDIO + idString);
            editor.remove(KEY_PREFIX_OVERRIDE + idString);
            editor.remove(KEY_PREFIX_MAXVOL + idString);
        }

        editor.remove(KEY_IDS).apply();
    }
}
