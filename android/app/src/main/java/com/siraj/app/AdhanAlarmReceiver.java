package com.siraj.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.PowerManager;
import android.os.Vibrator;
import android.os.VibrationEffect;
import android.util.Log;

/**
 * Receives exact alarm events and starts native adhan playback service.
 * Acquires a WakeLock to prevent the CPU from sleeping before the
 * foreground service has a chance to call startForeground().
 *
 * The started AdhanPlaybackService retrieves authentic localized prayer Hadith quotes
 * (Urdu, English, or Gujarati) via PrayerHadithHelper based on the user's saved preference.
 */
public class AdhanAlarmReceiver extends BroadcastReceiver {
    private static final String TAG = "AdhanAlarmReceiver";

    public static final String ACTION_TRIGGER = "com.siraj.app.ACTION_ADHAN_TRIGGER";
    public static final String ACTION_PRAYER_ALARM = "com.siraj.app.ACTION_PRAYER_ALARM";
    public static final String EXTRA_ALARM_ID = "alarmId";
    public static final String EXTRA_PRAYER_NAME = "prayerName";
    public static final String EXTRA_ADHAN_URL = "adhanUrl";
    public static final String EXTRA_OVERRIDE_SILENT = "overrideSilent";
    public static final String EXTRA_MAX_VOLUME = "maxVolume";

    // Static WakeLock so AdhanPlaybackService can release it
    private static PowerManager.WakeLock sWakeLock;
    private static final Object LOCK = new Object();

    /**
     * Acquire a partial WakeLock that keeps the CPU running until the
     * foreground service is fully started. Times out after 30 seconds
     * as a safety net.
     */
    static void acquireWakeLock(Context context) {
        synchronized (LOCK) {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                return; // Already held
            }
            PowerManager pm = (PowerManager) context.getApplicationContext()
                    .getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                sWakeLock = pm.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK,
                        "noorconnect:adhan_alarm");
                sWakeLock.setReferenceCounted(false);
                sWakeLock.acquire(10_000); // 10-second safety timeout
                Log.d(TAG, "WakeLock acquired");
            }
        }
    }

    /**
     * Release the WakeLock (called by AdhanPlaybackService once
     * startForeground() has been invoked).
     */
    public static void releaseWakeLock() {
        synchronized (LOCK) {
            if (sWakeLock != null && sWakeLock.isHeld()) {
                sWakeLock.release();
                Log.d(TAG, "WakeLock released");
            }
            sWakeLock = null;
        }
    }

    /**
     * Trigger haptic feedback for adhan notification
     * Three gentle pulses to indicate prayer time
     */
    private void triggerHapticFeedback(Context context) {
        try {
            Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    // Three gentle pulses for prayer time
                    long[] pattern = {0, 100, 200, 100, 200, 100};
                    VibrationEffect effect = VibrationEffect.createWaveform(pattern, -1);
                    vibrator.vibrate(effect);
                } else {
                    // Legacy vibration for older devices
                    long[] pattern = {0, 100, 200, 100, 200, 100};
                    vibrator.vibrate(pattern, -1);
                }
                Log.d(TAG, "Haptic feedback triggered for adhan");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to trigger haptic feedback", e);
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) {
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

        // Native 60-Second Dedup Guard: Ignore duplicate broadcasts for the same non-test prayer
        String prayerKey = (prayerName != null) ? prayerName.toLowerCase(java.util.Locale.ROOT) : "unknown";
        boolean isTest = (alarmId == 99999 || alarmId == 9901 || "test".equalsIgnoreCase(prayerKey));
        if (!isTest) {
            android.content.SharedPreferences dedupPrefs = context.getSharedPreferences("prayer_alarm_dedup", Context.MODE_PRIVATE);
            long lastFired = dedupPrefs.getLong("last_fired_" + prayerKey, 0L);
            long now = System.currentTimeMillis();
            if (now - lastFired < 60_000L) {
                Log.d(TAG, "Duplicate broadcast for " + prayerKey + " within 60s ignored (" + (now - lastFired) + "ms ago)");
                return;
            }
            dedupPrefs.edit().putLong("last_fired_" + prayerKey, now).apply();
        }

        // Acquire WakeLock BEFORE starting the service to prevent Doze race condition
        acquireWakeLock(context);

        // Trigger haptic feedback for adhan notification
        triggerHapticFeedback(context);

        if (alarmId > -1) {
            NativeAdhanScheduler.removeAlarm(context, alarmId);
        }

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

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(playbackIntent);
            } else {
                context.startService(playbackIntent);
            }
            Log.d(TAG, "Started adhan playback service for " + prayerName);
        } catch (Exception serviceError) {
            Log.e(TAG, "Failed to start adhan playback service", serviceError);
            releaseWakeLock(); // Release if service failed to start
        }
    }
}
