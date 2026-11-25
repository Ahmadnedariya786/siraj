package com.siraj.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * PrayerAlarmReceiver — Primary Doze-immune BroadcastReceiver for prayer alarms.
 *
 * Enforces:
 * 1. Brief 10s PowerManager.PARTIAL_WAKE_LOCK ("siraj:prayer_alarm") with strict finally cleanup
 * 2. 20-minute stale alarm cutoff (discards delayed late wakeups silently without posting outdated alerts)
 * 3. Persistent once-per-calendar-day dedup lock ("fired_date_<prayerKey>" = "YYYY-MM-DD")
 * 4. Self-contained native Notification History recording into SharedPreferences
 */
public class PrayerAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "PrayerAlarmReceiver";

    public static final String ACTION_TRIGGER = "com.siraj.app.ACTION_ADHAN_TRIGGER";
    public static final String ACTION_PRAYER_ALARM = "com.siraj.app.ACTION_PRAYER_ALARM";
    public static final String EXTRA_ALARM_ID = "alarmId";
    public static final String EXTRA_PRAYER_NAME = "prayerName";
    public static final String EXTRA_ADHAN_URL = "adhanUrl";
    public static final String EXTRA_OVERRIDE_SILENT = "overrideSilent";
    public static final String EXTRA_MAX_VOLUME = "maxVolume";
    public static final String EXTRA_EXPECTED_TRIGGER_MS = "expectedTriggerMs";

    public static final long STALE_ALARM_CUTOFF_MS = 20L * 60L * 1000L; // 20 minutes
    private static final long WAKE_LOCK_TIMEOUT_MS = 10_000L; // 10 seconds

    public static final String DEDUP_PREFS_NAME = "prayer_alarm_dedup";
    public static final String HISTORY_PREFS_NAME = "siraj_native_notif_history";
    public static final String HISTORY_KEY_ITEMS = "items";

    private static PowerManager.WakeLock sWakeLock;
    private static final Object LOCK = new Object();

    static void acquireWakeLock(Context context) {
        synchronized (LOCK) {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                return;
            }
            PowerManager pm = (PowerManager) context.getApplicationContext()
                    .getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                sWakeLock = pm.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "siraj:prayer_alarm");
                sWakeLock.setReferenceCounted(false);
                sWakeLock.acquire(WAKE_LOCK_TIMEOUT_MS);
                Log.d(TAG, "WakeLock acquired (10s timeout)");
            }
        }
    }

    public static void releaseWakeLock() {
        synchronized (LOCK) {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                try {
                    sWakeLock.release();
                    Log.d(TAG, "WakeLock released");
                } catch (Throwable ignored) {
                    // Already released cleanly
                }
            }
            sWakeLock = null;
        }
    }

    private void triggerHapticFeedback(Context context) {
        try {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = {0, 100, 200, 100, 200, 100};
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to trigger haptic feedback", e);
        }
    }

    private void recordNativeDeliveryHistory(Context context, String prayerName, String prayerTime, long timestampMs) {
        try {
            String safeName = (prayerName != null && !prayerName.trim().isEmpty())
                    ? prayerName.trim()
                    : "Prayer";
            String normalizedName = safeName.substring(0, 1).toUpperCase(Locale.ROOT)
                    + safeName.substring(1).toLowerCase(Locale.ROOT);
            String arabic = AdhanPlaybackService.getPrayerArabicName(normalizedName);
            String displayTime = (prayerTime != null && !prayerTime.trim().isEmpty())
                    ? prayerTime.trim()
                    : new SimpleDateFormat("hh:mm a", Locale.US).format(new Date(timestampMs));
            String hadith = PrayerHadithHelper.getPrayerHadith(context, normalizedName);

            JSONObject entry = new JSONObject();
            entry.put("type", "prayer");
            entry.put("title", "🕌 " + normalizedName + " • " + arabic + " (" + displayTime + ")");
            entry.put("body", hadith);
            entry.put("timestamp", timestampMs);

            SharedPreferences histPrefs = context.getSharedPreferences(HISTORY_PREFS_NAME, Context.MODE_PRIVATE);
            JSONArray existing;
            try {
                existing = new JSONArray(histPrefs.getString(HISTORY_KEY_ITEMS, "[]"));
            } catch (Throwable parseErr) {
                existing = new JSONArray();
            }

            JSONArray updated = new JSONArray();
            updated.put(entry);
            for (int i = 0; i < existing.length() && updated.length() < 50; i++) {
                updated.put(existing.get(i));
            }
            histPrefs.edit().putString(HISTORY_KEY_ITEMS, updated.toString()).apply();
        } catch (Throwable t) {
            Log.w(TAG, "Failed to record native notification history", t);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (!ACTION_TRIGGER.equals(action) && !ACTION_PRAYER_ALARM.equals(action)) {
            return;
        }

        if (!NativeAdhanScheduler.isEnabled(context)) {
            Log.d(TAG, "Native adhan playback disabled; skipping trigger");
            return;
        }

        int alarmId = intent.getIntExtra(EXTRA_ALARM_ID, -1);
        String prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME);
        String prayerTime = intent.getStringExtra("prayerTime");
        String adhanUrl = intent.getStringExtra(EXTRA_ADHAN_URL);
        boolean overrideSilent = intent.getBooleanExtra(EXTRA_OVERRIDE_SILENT, false);
        boolean maxVolume = intent.getBooleanExtra(EXTRA_MAX_VOLUME, false);
        long expectedTriggerMs = intent.getLongExtra(EXTRA_EXPECTED_TRIGGER_MS, -1L);

        String prayerKey = (prayerName != null)
                ? prayerName.trim().toLowerCase(Locale.ROOT)
                : "unknown";
        boolean isTest = (alarmId == 99999 || alarmId == 9901 || "test".equalsIgnoreCase(prayerKey));

        acquireWakeLock(context);
        boolean handedOffToForegroundService = false;

        try {
            long now = System.currentTimeMillis();

            // Always remove this fired alarm entry and verify future schedule
            if (alarmId > -1) {
                NativeAdhanScheduler.removeAlarm(context, alarmId);
            }

            // 1. 20-Minute Stale Alarm Cutoff Guard (never post outdated prayer alerts)
            if (!isTest && expectedTriggerMs > 0L && (now - expectedTriggerMs) > STALE_ALARM_CUTOFF_MS) {
                Log.w(TAG, "Discarding stale prayer alarm for " + prayerKey
                        + " (delayed by " + ((now - expectedTriggerMs) / 60000L) + " min)");
                NativeAdhanScheduler.rescheduleAlarms(context);
                return;
            }

            // 2. Persistent Once-Per-Calendar-Day Dedup Lock ("fired_date_<prayerKey>" = "YYYY-MM-DD")
            if (!isTest) {
                SharedPreferences dedupPrefs = context.getSharedPreferences(DEDUP_PREFS_NAME, Context.MODE_PRIVATE);
                String todayDateKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now));
                String firedDateKey = "fired_date_" + prayerKey;
                String alreadyFiredDate = dedupPrefs.getString(firedDateKey, "");
                if (todayDateKey.equals(alreadyFiredDate)) {
                    Log.d(TAG, "Once-per-day dedup lock blocked duplicate " + prayerKey + " for " + todayDateKey);
                    return;
                }
                dedupPrefs.edit().putString(firedDateKey, todayDateKey).commit();

                // Record background prayer delivery into native Notification History
                recordNativeDeliveryHistory(context, prayerName, prayerTime, now);
            }

            triggerHapticFeedback(context);

            Intent playbackIntent = new Intent(context, AdhanPlaybackService.class);
            playbackIntent.setAction(AdhanPlaybackService.ACTION_PLAY);
            playbackIntent.putExtra(EXTRA_ALARM_ID, alarmId);
            playbackIntent.putExtra(EXTRA_PRAYER_NAME, prayerName);
            if (prayerTime != null && !prayerTime.isEmpty()) {
                playbackIntent.putExtra("prayerTime", prayerTime);
            }
            playbackIntent.putExtra(EXTRA_ADHAN_URL, adhanUrl);
            playbackIntent.putExtra(AdhanPlaybackService.EXTRA_OVERRIDE_SILENT, overrideSilent);
            playbackIntent.putExtra(AdhanPlaybackService.EXTRA_MAX_VOLUME, maxVolume);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(playbackIntent);
            } else {
                context.startService(playbackIntent);
            }
            handedOffToForegroundService = true;
            Log.d(TAG, "Started adhan playback service for " + prayerName);
        } catch (Throwable err) {
            Log.e(TAG, "Failed handling prayer alarm broadcast", err);
        } finally {
            if (!handedOffToForegroundService) {
                releaseWakeLock();
            }
        }
    }
}
