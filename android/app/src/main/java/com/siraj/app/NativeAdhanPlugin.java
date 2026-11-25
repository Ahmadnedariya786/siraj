package com.siraj.app;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Capacitor bridge for native prayer alarm scheduling, kernel diagnostics, and playback controls.
 * Uses 64-bit long epoch timestamps throughout (zero 32-bit int truncation).
 */
@CapacitorPlugin(name = "NativeAdhanPlugin")
public class NativeAdhanPlugin extends Plugin {
    private static final String TAG = "NativeAdhanPlugin";

    @PluginMethod
    public void schedule(PluginCall call) {
        Context context = getContext();
        JSArray alarms = call.getArray("alarms");
        boolean enabled = call.getBoolean("enabled", true);

        if (alarms == null) {
            call.reject("Missing 'alarms' array");
            return;
        }

        List<NativeAdhanScheduler.ScheduledAdhan> parsedList = new ArrayList<>();
        for (int i = 0; i < alarms.length(); i++) {
            try {
                JSONObject alarmObject = alarms.getJSONObject(i);

                int id = alarmObject.optInt("id", -1);
                // Strictly parse epoch milliseconds as 64-bit double -> long (NEVER 32-bit int!)
                long triggerAt = -1L;
                if (alarmObject.has("triggerAt") && !alarmObject.isNull("triggerAt")) {
                    double rawTrigger = alarmObject.optDouble("triggerAt", -1.0);
                    if (!Double.isNaN(rawTrigger) && !Double.isInfinite(rawTrigger) && rawTrigger > 0.0) {
                        triggerAt = Math.round(rawTrigger);
                    }
                }

                String prayerName = alarmObject.optString("prayerName", "Prayer");
                String prayerTime = alarmObject.optString("prayerTime", "");
                String adhanUrl = alarmObject.optString("adhanUrl", "/audio/adhan-makkah.mp3");
                boolean overrideSilent = alarmObject.optBoolean("overrideSilent", false);
                boolean maxVolume = alarmObject.optBoolean("maxVolume", false);
                boolean playAdhanAudio = alarmObject.optBoolean("playAdhanAudio", true);

                if (id < 0 || triggerAt <= 0L) {
                    continue;
                }

                parsedList.add(new NativeAdhanScheduler.ScheduledAdhan(
                        id, triggerAt, prayerName, prayerTime, adhanUrl, overrideSilent, maxVolume, playAdhanAudio));
            } catch (JSONException parseError) {
                Log.w(TAG, "Skipping invalid native adhan alarm item at index " + i, parseError);
            }
        }

        int scheduled = NativeAdhanScheduler.replaceAllAlarms(context, parsedList, enabled);

        JSObject result = new JSObject();
        result.put("scheduled", scheduled);
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        NativeAdhanScheduler.clearAll(getContext());

        JSObject result = new JSObject();
        result.put("status", "cleared");
        call.resolve(result);
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        boolean enabled = call.getBoolean("enabled", true);
        NativeAdhanScheduler.setEnabled(getContext(), enabled);

        JSObject result = new JSObject();
        result.put("enabled", enabled);
        result.put("count", NativeAdhanScheduler.getScheduledCount(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", NativeAdhanScheduler.isEnabled(getContext()));
        result.put("count", NativeAdhanScheduler.getScheduledCount(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void scheduleTest60sAlarm(PluginCall call) {
        String prayerName = call.getString("prayerName", "Fajr");
        String prayerTime = call.getString("prayerTime", "");
        boolean playAudio = call.getBoolean("playAudio", true);

        long triggerAtMs = NativeAdhanScheduler.scheduleTest60sAlarm(getContext(), prayerName, prayerTime, playAudio);
        JSObject result = new JSObject();
        result.put("scheduled", triggerAtMs > 0L);
        result.put("triggerAtMs", triggerAtMs);
        call.resolve(result);
    }

    @PluginMethod
    public void getAlarmKernelDiagnostics(PluginCall call) {
        try {
            JSONObject diag = NativeAdhanScheduler.getAlarmKernelDiagnostics(getContext());
            call.resolve(JSObject.fromJSONObject(diag));
        } catch (Exception e) {
            Log.e(TAG, "Failed reading alarm kernel diagnostics", e);
            call.reject("Failed reading alarm kernel diagnostics: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearTraceLog(PluginCall call) {
        NativeAdhanScheduler.clearTraceLog(getContext());
        call.resolve(new JSObject().put("cleared", true));
    }

    @PluginMethod
    public void canScheduleExactAlarms(PluginCall call) {
        JSObject result = new JSObject();
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            android.app.AlarmManager alarmManager = (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
            boolean canSchedule = NativeAdhanScheduler.canUseExactAlarms(getContext(), alarmManager);
            result.put("canSchedule", canSchedule);
        } else {
            result.put("canSchedule", true);
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        JSObject result = new JSObject();
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            try {
                android.app.AlarmManager alarmManager = (android.app.AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
                if (alarmManager != null && !alarmManager.canScheduleExactAlarms()) {
                    android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                    intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    result.put("opened", true);
                    call.resolve(result);
                    return;
                }
            } catch (Exception e) {
                Log.w(TAG, "Failed to launch ACTION_REQUEST_SCHEDULE_EXACT_ALARM intent", e);
                try {
                    android.content.Intent intent = new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(android.net.Uri.parse("package:" + getContext().getPackageName()));
                    intent.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(intent);
                    result.put("opened", true);
                    call.resolve(result);
                    return;
                } catch (Exception ex) {
                    Log.e(TAG, "Failed to launch app details settings", ex);
                    call.reject("Could not open settings: " + ex.getMessage());
                    return;
                }
            }
        }
        result.put("opened", false);
        result.put("alreadyGranted", true);
        call.resolve(result);
    }
}
