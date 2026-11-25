package com.siraj.app;

import android.app.AlarmManager;
import android.app.AlarmManager.AlarmClockInfo;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationManagerCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Schedules prayer alarms using AlarmManager.setAlarmClock() across all Android OEMs (API 26-35+).
 *
 * Enforces:
 * - Synchronized mutex lock (SCHEDULE_LOCK) preventing race conditions during concurrent scheduling
 * - 64-bit long epoch millisecond timestamps throughout
 * - Strict future-only guard (> now + 15s, bypassed only for test alarms)
 * - Valid non-null showPendingIntent required by Samsung One UI, ColorOS, HyperOS, FuntouchOS
 * - Native SharedPreferences persistence for 7-day BootReceiver & self-chaining recovery
 * - Ring-buffered native execution trace log for live OS Kernel diagnostics
 */
public final class NativeAdhanScheduler {
    private static final String TAG = "NativeAdhanScheduler";

    public static final long MIN_FUTURE_GUARD_MS = 15_000L;
    public static final int TEST_ALARM_REQUEST_CODE = 4999;

    private static final String PREFS_NAME = "native_adhan_alarms";
    private static final String KEY_IDS = "alarm_ids";
    private static final String KEY_ENABLED = "enabled";
    private static final String KEY_PREFIX_TIME = "time_";
    private static final String KEY_PREFIX_PRAYER = "prayer_";
    private static final String KEY_PREFIX_PTIME = "ptime_";
    private static final String KEY_PREFIX_AUDIO = "audio_";
    private static final String KEY_PREFIX_OVERRIDE = "override_";
    private static final String KEY_PREFIX_MAXVOL = "maxvol_";
    private static final String KEY_PREFIX_PLAY_AUDIO = "play_audio_";
    private static final String KEY_TRACE_LOG = "trace_log";
    private static final String KEY_LAST_TEST_TRIGGER = "last_test_trigger_ms";
    private static final String KEY_LAST_TEST_PRAYER = "last_test_prayer";
    private static final int MAX_TRACE_ENTRIES = 25;

    private static final Object SCHEDULE_LOCK = new Object();

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
        public final boolean playAdhanAudio;

        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String prayerTime, String adhanUrl,
                              boolean overrideSilent, boolean maxVolume, boolean playAdhanAudio) {
            this.id = id;
            this.triggerAtMillis = triggerAtMillis;
            this.prayerName = prayerName;
            this.prayerTime = prayerTime;
            this.adhanUrl = adhanUrl;
            this.overrideSilent = overrideSilent;
            this.maxVolume = maxVolume;
            this.playAdhanAudio = playAdhanAudio;
        }

        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String prayerTime, String adhanUrl,
                              boolean overrideSilent, boolean maxVolume) {
            this(id, triggerAtMillis, prayerName, prayerTime, adhanUrl, overrideSilent, maxVolume, true);
        }

        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String adhanUrl,
                              boolean overrideSilent, boolean maxVolume) {
            this(id, triggerAtMillis, prayerName, null, adhanUrl, overrideSilent, maxVolume, true);
        }

        // Legacy constructor for backward compatibility
        public ScheduledAdhan(int id, long triggerAtMillis, String prayerName, String adhanUrl) {
            this(id, triggerAtMillis, prayerName, null, adhanUrl, false, false, true);
        }
    }

    public static boolean isTestAlarmId(int alarmId) {
        return alarmId == TEST_ALARM_REQUEST_CODE || alarmId == 9901 || alarmId == 99999;
    }

    public static boolean isEnabled(Context context) {
        if (context == null) return true;
        return getPrefs(context).getBoolean(KEY_ENABLED, true);
    }

    public static void setEnabled(Context context, boolean enabled) {
        if (context == null) return;
        synchronized (SCHEDULE_LOCK) {
            getPrefs(context).edit().putBoolean(KEY_ENABLED, enabled).apply();
            if (!enabled) {
                clearAll(context);
            }
        }
    }

    public static int getScheduledCount(Context context) {
        if (context == null) return 0;
        synchronized (SCHEDULE_LOCK) {
            return getStoredIds(context).size();
        }
    }

    public static void logTrace(Context context, String message) {
        if (context == null || message == null) return;
        try {
            synchronized (SCHEDULE_LOCK) {
                SharedPreferences prefs = getPrefs(context);
                JSONArray arr;
                try {
                    arr = new JSONArray(prefs.getString(KEY_TRACE_LOG, "[]"));
                } catch (Throwable ignored) {
                    arr = new JSONArray();
                }

                String ts = new SimpleDateFormat("MM-dd HH:mm:ss", Locale.US).format(new Date());
                String entry = "[" + ts + "] " + message.trim();

                JSONArray updated = new JSONArray();
                updated.put(entry);
                for (int i = 0; i < arr.length() && updated.length() < MAX_TRACE_ENTRIES; i++) {
                    String item = arr.optString(i, "");
                    if (!item.isEmpty()) {
                        updated.put(item);
                    }
                }
                prefs.edit().putString(KEY_TRACE_LOG, updated.toString()).apply();
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to log trace entry", t);
        }
    }

    public static List<String> getTraceLog(Context context, int limit) {
        List<String> list = new ArrayList<>();
        if (context == null) return list;
        try {
            synchronized (SCHEDULE_LOCK) {
                SharedPreferences prefs = getPrefs(context);
                JSONArray arr = new JSONArray(prefs.getString(KEY_TRACE_LOG, "[]"));
                int count = Math.min(limit, arr.length());
                for (int i = 0; i < count; i++) {
                    String item = arr.optString(i, "");
                    if (!item.isEmpty()) {
                        list.add(item);
                    }
                }
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed to read trace log", t);
        }
        return list;
    }

    public static void clearTraceLog(Context context) {
        if (context == null) return;
        synchronized (SCHEDULE_LOCK) {
            getPrefs(context).edit().remove(KEY_TRACE_LOG).apply();
        }
    }

    /**
     * Atomically replace all scheduled alarms under SCHEDULE_LOCK.
     */
    public static int replaceAllAlarms(Context context, List<ScheduledAdhan> alarms, boolean enabled) {
        if (context == null) return 0;
        synchronized (SCHEDULE_LOCK) {
            setEnabled(context, enabled);
            clearAll(context);
            if (!enabled || alarms == null) {
                logTrace(context, "CLEARED all alarms (enabled=" + enabled + ")");
                return 0;
            }
            int scheduled = 0;
            for (ScheduledAdhan alarm : alarms) {
                if (scheduleAlarm(context, alarm, true)) {
                    scheduled++;
                }
            }
            logTrace(context, "BATCH scheduled " + scheduled + "/" + alarms.size() + " alarms");
            return scheduled;
        }
    }

    /**
     * Schedule a single prayer alarm using AlarmManager.setAlarmClock().
     * Returns true if scheduled in the future, false if skipped/failed.
     */
    public static boolean scheduleAlarm(Context context, ScheduledAdhan alarm, boolean persist) {
        if (context == null || alarm == null) return false;
        synchronized (SCHEDULE_LOCK) {
            boolean isTest = isTestAlarmId(alarm.id);
            long now = System.currentTimeMillis();
            long minThreshold = isTest ? (now + 1000L) : (now + MIN_FUTURE_GUARD_MS);

            if (alarm.triggerAtMillis <= minThreshold) {
                Log.d(TAG, "Skipping past/non-future alarm: " + alarm.prayerName
                        + " (trigger=" + alarm.triggerAtMillis + ", minThreshold=" + minThreshold + ")");
                if (persist) {
                    removePersistedAlarm(context, alarm.id);
                }
                return false;
            }

            AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) {
                Log.e(TAG, "AlarmManager unavailable; cannot schedule " + alarm.id);
                logTrace(context, "ERR: AlarmManager null for " + alarm.prayerName);
                return false;
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
                    alarm.maxVolume,
                    alarm.playAdhanAudio
            );

            // Always provide a valid non-null showAppPendingIntent (required on Samsung, ColorOS, HyperOS, FuntouchOS)
            Intent showIntent = new Intent(context, MainActivity.class);
            showIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            int showFlags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
            int showRequestCode = 10000 + Math.abs(alarm.id % 100000);
            PendingIntent showPendingIntent = PendingIntent.getActivity(context, showRequestCode, showIntent, showFlags);

            String methodUsed = "setAlarmClock";
            try {
                AlarmClockInfo alarmClock = new AlarmClockInfo(alarm.triggerAtMillis, showPendingIntent);
                alarmManager.setAlarmClock(alarmClock, pendingIntent);
            } catch (SecurityException alarmClockError) {
                Log.w(TAG, "setAlarmClock rejected, trying fallback", alarmClockError);
                try {
                    if (canUseExactAlarms(context, alarmManager)) {
                        methodUsed = "setExactAndAllowWhileIdle";
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
                        } else {
                            alarmManager.setExact(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
                        }
                    } else {
                        methodUsed = "setAndAllowWhileIdle";
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
                        } else {
                            alarmManager.set(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
                        }
                    }
                } catch (SecurityException exactAlarmError) {
                    methodUsed = "setAndAllowWhileIdle(fallback)";
                    Log.w(TAG, "Exact alarm rejected, falling back to inexact alarm", exactAlarmError);
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
                    } else {
                        alarmManager.set(AlarmManager.RTC_WAKEUP, alarm.triggerAtMillis, pendingIntent);
                    }
                }
            }

            if (persist) {
                persistAlarm(context, alarm);
            } else if (isTest) {
                getPrefs(context).edit()
                        .putLong(KEY_LAST_TEST_TRIGGER, alarm.triggerAtMillis)
                        .putString(KEY_LAST_TEST_PRAYER, alarm.prayerName != null ? alarm.prayerName : "Test")
                        .apply();
            }

            String fireAtStr = new SimpleDateFormat("MM-dd hh:mm:ss a", Locale.US).format(new Date(alarm.triggerAtMillis));
            logTrace(context, "ARMED[" + methodUsed + "] " + alarm.prayerName + " (id=" + alarm.id + ") -> " + fireAtStr);
            Log.d(TAG, "Scheduled " + methodUsed + " for " + alarm.prayerName
                    + " (id=" + alarm.id + ") at " + alarm.triggerAtMillis);
            return true;
        }
    }

    /**
     * Schedule a 60-second test alarm using the 100% IDENTICAL setAlarmClock() -> PrayerAlarmReceiver path.
     */
    public static long scheduleTest60sAlarm(Context context, String prayerName, String prayerTime12h, boolean playAudio) {
        if (context == null) return 0L;
        synchronized (SCHEDULE_LOCK) {
            final String pName = (prayerName != null && !prayerName.trim().isEmpty()) ? prayerName.trim() : "Fajr";
            final long triggerMs = System.currentTimeMillis() + 60_000L;
            final String resolvedTime = (prayerTime12h != null && !prayerTime12h.trim().isEmpty())
                    ? prayerTime12h.trim()
                    : new SimpleDateFormat("hh:mm a", Locale.US).format(new Date(triggerMs));

            setEnabled(context, true);
            removeAlarm(context, TEST_ALARM_REQUEST_CODE);
            removeAlarm(context, 9901);
            removeAlarm(context, 99999);

            try {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(9901);
                    nm.cancel(99999);
                }
            } catch (Throwable ignored) {}

            ScheduledAdhan testAlarm = new ScheduledAdhan(
                    TEST_ALARM_REQUEST_CODE,
                    triggerMs,
                    pName,
                    resolvedTime,
                    "/audio/adhan-makkah.mp3",
                    false,
                    false,
                    playAudio
            );
            scheduleAlarm(context, testAlarm, false);
            return triggerMs;
        }
    }

    public static void clearAll(Context context) {
        if (context == null) return;
        synchronized (SCHEDULE_LOCK) {
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
                    PendingIntent pendingIntent = createPendingIntent(context, id, null, null, -1L, null, false, false, true);
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                }
            }

            clearPersistedAlarms(context);
            Log.d(TAG, "Cleared all native adhan alarms");
        }
    }

    public static void removeAlarm(Context context, int alarmId) {
        if (context == null) return;
        synchronized (SCHEDULE_LOCK) {
            try {
                AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null) {
                    PendingIntent pendingIntent = createPendingIntent(context, alarmId, null, null, -1L, null, false, false, true);
                    alarmManager.cancel(pendingIntent);
                    pendingIntent.cancel();
                }
            } catch (Throwable t) {
                Log.w(TAG, "Failed to cancel AlarmManager pending intent for alarm " + alarmId, t);
            }
            removePersistedAlarm(context, alarmId);
        }
    }

    /**
     * Re-arms all upcoming persisted alarms (and cleans up expired ones) from SharedPreferences.
     * Safe to invoke from BootReceiver or PrayerAlarmReceiver without WebView running.
     */
    public static int rescheduleAlarms(Context context) {
        if (context == null) return 0;
        synchronized (SCHEDULE_LOCK) {
            if (!isEnabled(context)) {
                return 0;
            }
            Set<String> ids = getStoredIds(context);
            if (ids.isEmpty()) {
                return 0;
            }

            SharedPreferences prefs = getPrefs(context);
            long now = System.currentTimeMillis();
            int rearmed = 0;

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
                boolean playAudio = prefs.getBoolean(KEY_PREFIX_PLAY_AUDIO + id, true);

                if (scheduleAlarm(
                        context,
                        new ScheduledAdhan(id, triggerAt, prayerName, prayerTime, adhanUrl, overrideSilent, maxVolume, playAudio),
                        false)) {
                    rearmed++;
                }
            }

            Log.d(TAG, "Rescheduled " + rearmed + " native adhan alarms");
            return rearmed;
        }
    }

    /**
     * Returns live Android OS kernel alarm state, permissions, OEM details & native trace log.
     */
    public static JSONObject getAlarmKernelDiagnostics(Context context) {
        JSONObject out = new JSONObject();
        try {
            AlarmManager am = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);

            String osNextAlarmClock = "NONE";
            long osNextEpochMs = 0L;
            if (am != null) {
                AlarmClockInfo nextInfo = am.getNextAlarmClock();
                if (nextInfo != null && nextInfo.getTriggerTime() > 0L) {
                    osNextEpochMs = nextInfo.getTriggerTime();
                    String matchedPrayer = findPrayerNameForTimestamp(context, osNextEpochMs);
                    String timeFmt = new SimpleDateFormat("hh:mm a", Locale.US).format(new Date(osNextEpochMs));
                    String todayKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
                    String alarmDayKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(osNextEpochMs));
                    String dayPrefix = todayKey.equals(alarmDayKey)
                            ? ""
                            : (new SimpleDateFormat("EEE ", Locale.US).format(new Date(osNextEpochMs)));
                    osNextAlarmClock = matchedPrayer + " • " + dayPrefix + timeFmt;
                }
            }

            boolean canExact = am == null || canUseExactAlarms(context, am);
            boolean notifEnabled = NotificationManagerCompat.from(context).areNotificationsEnabled();

            int channelImportance = -1;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm != null) {
                NotificationChannel ch = nm.getNotificationChannel("siraj_prayers_v3");
                if (ch != null) {
                    channelImportance = ch.getImportance();
                }
            } else if (notifEnabled) {
                channelImportance = 4;
            }

            boolean batteryUnrestricted = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && pm != null) {
                batteryUnrestricted = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }

            List<String> traces = getTraceLog(context, 12);
            JSONArray traceArray = new JSONArray();
            for (String entry : traces) {
                traceArray.put(entry);
            }

            out.put("osNextAlarmClock", osNextAlarmClock);
            out.put("osNextAlarmEpochMs", osNextEpochMs);
            out.put("canScheduleExactAlarms", canExact);
            out.put("notificationsEnabled", notifEnabled);
            out.put("channelImportance", channelImportance);
            out.put("batteryUnrestricted", batteryUnrestricted);
            out.put("deviceManufacturer", Build.MANUFACTURER != null ? Build.MANUFACTURER : "Unknown");
            out.put("deviceModel", Build.MODEL != null ? Build.MODEL : "Unknown");
            out.put("androidApi", Build.VERSION.SDK_INT);
            out.put("scheduledCount", getScheduledCount(context));
            out.put("nativeTraceLog", traceArray);
        } catch (Throwable t) {
            Log.w(TAG, "Error building alarm kernel diagnostics", t);
        }
        return out;
    }

    private static String findPrayerNameForTimestamp(Context context, long triggerMs) {
        synchronized (SCHEDULE_LOCK) {
            SharedPreferences prefs = getPrefs(context);
            long lastTestTrigger = prefs.getLong(KEY_LAST_TEST_TRIGGER, 0L);
            if (lastTestTrigger > 0L && Math.abs(lastTestTrigger - triggerMs) <= 2000L) {
                String testPrayer = prefs.getString(KEY_LAST_TEST_PRAYER, "Test");
                return "Test (" + testPrayer + ")";
            }

            Set<String> ids = getStoredIds(context);
            for (String idStr : ids) {
                long storedTime = prefs.getLong(KEY_PREFIX_TIME + idStr, -1L);
                if (storedTime > 0L && Math.abs(storedTime - triggerMs) <= 2000L) {
                    return prefs.getString(KEY_PREFIX_PRAYER + idStr, "Prayer");
                }
            }
            return "Alarm";
        }
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
            boolean maxVolume,
            boolean playAdhanAudio) {
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
        intent.putExtra(PrayerAlarmReceiver.EXTRA_PLAY_ADHAN_AUDIO, playAdhanAudio);

        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(context, alarmId, intent, flags);
    }

    public static boolean canUseExactAlarms(Context context, AlarmManager alarmManager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        if (alarmManager != null && alarmManager.canScheduleExactAlarms()) {
            return true;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && context != null) {
            try {
                return androidx.core.content.ContextCompat.checkSelfPermission(
                        context, "android.permission.USE_EXACT_ALARM")
                        == android.content.pm.PackageManager.PERMISSION_GRANTED;
            } catch (Throwable ignored) {
                // Fall through
            }
        }
        return false;
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
                .putBoolean(KEY_PREFIX_PLAY_AUDIO + alarm.id, alarm.playAdhanAudio)
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
                .remove(KEY_PREFIX_PLAY_AUDIO + alarmId)
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
            editor.remove(KEY_PREFIX_PLAY_AUDIO + idString);
        }

        editor.remove(KEY_IDS).apply();
    }
}
