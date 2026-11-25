package com.siraj.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * PrayerAlarmReceiver — Primary Doze-immune BroadcastReceiver for prayer alarms.
 *
 * Enforces:
 * 1. Brief 10s PowerManager.PARTIAL_WAKE_LOCK ("siraj:prayer_alarm") inside try/catch/finally
 * 2. 20-minute stale alarm cutoff (bypassed for test alarms)
 * 3. Persistent once-per-calendar-day dedup lock ("fired_date_YYYY-MM-DD_<prayerKey>", bypassed for test alarms)
 * 4. Channel siraj_prayers_v3 (IMPORTANCE_HIGH, VISIBILITY_PUBLIC) guaranteed before notify(...)
 * 5. Strictly ONE clean styled notification (single Hadith ref, zero duplicate Siraj • Siraj) + Notification History
 * 6. Self-chaining failsafe: immediately re-arms next upcoming prayer in AlarmManager.setAlarmClock()
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
    public static final String EXTRA_PLAY_ADHAN_AUDIO = "playAdhanAudio";

    public static final String CHANNEL_ID = "siraj_prayers_v3";
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

    public static void ensurePrayerChannel(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
            if (existing != null) {
                return;
            }

            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Prayer Notifications",
                    NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription(
                    "Authentic prayer time alerts and daily Hadith guidance for all 5 prayers");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[] { 0, 250, 150, 250 });
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(channel);
        } catch (Throwable t) {
            Log.w(TAG, "Failed ensuring prayer notification channel", t);
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

    private void postStyledPrayerNotification(Context context, int notifId, String prayerName, String prayerTime) {
        ensurePrayerChannel(context);
        NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent openIntent = new Intent(context, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                context,
                notifId,
                openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String safeName = (prayerName != null && !prayerName.trim().isEmpty()) ? prayerName.trim() : "Prayer";
        String normalizedName = safeName.substring(0, 1).toUpperCase(Locale.ROOT)
                + safeName.substring(1).toLowerCase(Locale.ROOT);
        String arabic = AdhanPlaybackService.getPrayerArabicName(normalizedName);
        String displayTime = (prayerTime != null && !prayerTime.trim().isEmpty())
                ? prayerTime.trim()
                : new SimpleDateFormat("hh:mm a", Locale.US).format(new Date());

        String title = "🕌 " + normalizedName + " • " + arabic + " (" + displayTime + ")";
        String subText = "حي على الصلاة • Hayya 'ala-s-Salah";
        String rakah = AdhanPlaybackService.getPrayerRakahSummary(normalizedName);
        String hadith = PrayerHadithHelper.getPrayerHadith(context, normalizedName);
        String bigText = "✨ Hayya 'ala-s-Salah • Hayya 'ala-l-Falah\n"
                + "📿 Rak'aat: " + rakah + "\n"
                + hadith;

        Bitmap largeIconBitmap = AdhanPlaybackService.createPrayerEmblemBitmap(normalizedName);

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_siraj)
                .setLargeIcon(largeIconBitmap)
                .setColor(0xFFD4AF37)
                .setColorized(true)
                .setContentTitle(title)
                .setSubText(subText)
                .setContentText(rakah + " — Tap to log prayer")
                .setStyle(new NotificationCompat.BigTextStyle()
                        .setBigContentTitle(title)
                        .setSummaryText(subText)
                        .bigText(bigText))
                .setContentIntent(contentIntent)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .addAction(R.drawable.ic_stat_siraj, "✓ Log Prayer", contentIntent)
                .build();

        nm.notify(notifId, notification);
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
            Log.d(TAG, "Native prayer alarms disabled; skipping trigger");
            return;
        }

        int alarmId = intent.getIntExtra(EXTRA_ALARM_ID, -1);
        String prayerName = intent.getStringExtra(EXTRA_PRAYER_NAME);
        String prayerTime = intent.getStringExtra("prayerTime");
        String adhanUrl = intent.getStringExtra(EXTRA_ADHAN_URL);
        boolean overrideSilent = intent.getBooleanExtra(EXTRA_OVERRIDE_SILENT, false);
        boolean maxVolume = intent.getBooleanExtra(EXTRA_MAX_VOLUME, false);
        boolean playAdhanAudio = intent.getBooleanExtra(EXTRA_PLAY_ADHAN_AUDIO, true);
        long expectedTriggerMs = intent.getLongExtra(EXTRA_EXPECTED_TRIGGER_MS, -1L);

        String prayerKey = (prayerName != null && !prayerName.trim().isEmpty())
                ? prayerName.trim().toLowerCase(Locale.ROOT)
                : "unknown";
        boolean isTest = NativeAdhanScheduler.isTestAlarmId(alarmId) || "test".equalsIgnoreCase(prayerKey);
        int notifId = isTest ? 9901 : AdhanPlaybackService.getPrayerNotificationId(prayerName);

        acquireWakeLock(context);
        boolean handedOffToForegroundService = false;

        try {
            long now = System.currentTimeMillis();
            NativeAdhanScheduler.logTrace(context,
                    "FIRED " + prayerName + " (id=" + alarmId + ", test=" + isTest + ")");

            if (alarmId > -1 && !isTest) {
                NativeAdhanScheduler.removeAlarm(context, alarmId);
            }

            // 1. 20-Minute Stale Alarm Cutoff Guard (bypassed for test alarms)
            if (!isTest && expectedTriggerMs > 0L && (now - expectedTriggerMs) > STALE_ALARM_CUTOFF_MS) {
                long delayMin = (now - expectedTriggerMs) / 60000L;
                Log.w(TAG, "Discarding stale prayer alarm for " + prayerKey + " (delayed by " + delayMin + " min)");
                NativeAdhanScheduler.logTrace(context, "STALE_SKIP " + prayerName + " (+" + delayMin + "m)");
                NativeAdhanScheduler.rescheduleAlarms(context);
                return;
            }

            // 2. Persistent Once-Per-Calendar-Day Dedup Lock ("fired_date_YYYY-MM-DD_<prayerKey>", bypassed for test)
            if (!isTest) {
                SharedPreferences dedupPrefs = context.getSharedPreferences(DEDUP_PREFS_NAME, Context.MODE_PRIVATE);
                String todayDateKey = new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(now));
                String firedDateKey = "fired_date_" + todayDateKey + "_" + prayerKey;
                if (dedupPrefs.getBoolean(firedDateKey, false)) {
                    Log.d(TAG, "Once-per-day dedup lock blocked duplicate " + firedDateKey);
                    NativeAdhanScheduler.logTrace(context, "DEDUP_SKIP " + firedDateKey);
                    NativeAdhanScheduler.rescheduleAlarms(context);
                    return;
                }
                dedupPrefs.edit().putBoolean(firedDateKey, true).commit();
            }

            // Record delivery into native Notification History
            recordNativeDeliveryHistory(context, prayerName, prayerTime, now);

            // Guarantee channel exists before notification delivery
            ensurePrayerChannel(context);

            triggerHapticFeedback(context);

            if (playAdhanAudio) {
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
                    handedOffToForegroundService = true;
                    NativeAdhanScheduler.logTrace(context, "POSTED_FGS " + prayerName + " (notifId=" + notifId + ")");
                } catch (Throwable fgsError) {
                    // Android 12+ / OEM background FGS restriction fallback: post styled notification directly!
                    Log.w(TAG, "startForegroundService failed, posting direct styled notification", fgsError);
                    postStyledPrayerNotification(context, notifId, prayerName, prayerTime);
                    NativeAdhanScheduler.logTrace(context, "POSTED_DIRECT_FALLBACK " + prayerName + ": " + fgsError.getClass().getSimpleName());
                }
            } else {
                // Audio playback off: post single clean styled OS notification directly
                postStyledPrayerNotification(context, notifId, prayerName, prayerTime);
                NativeAdhanScheduler.logTrace(context, "POSTED_DRAWER " + prayerName + " (notifId=" + notifId + ")");
            }

            // 3. Self-Chaining Failsafe: immediately arm next upcoming prayer from SharedPreferences
            int chained = NativeAdhanScheduler.rescheduleAlarms(context);
            NativeAdhanScheduler.logTrace(context, "SELF_CHAINED remaining=" + chained);
        } catch (Throwable t) {
            Log.e(TAG, "Failed handling prayer alarm broadcast", t);
            NativeAdhanScheduler.logTrace(context, "ERR: " + t.getClass().getSimpleName() + ": " + t.getMessage());
        } finally {
            if (!handedOffToForegroundService) {
                releaseWakeLock();
            }
        }
    }
}
