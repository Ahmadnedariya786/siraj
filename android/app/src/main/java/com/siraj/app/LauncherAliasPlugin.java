package com.siraj.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LauncherAlias")
public class LauncherAliasPlugin extends Plugin {
    private static final String TAG = "LauncherAliasPlugin";

    public static final String[] ALIAS_NAMES = {
        "com.siraj.app.LauncherAliasRoyalMihrab",
        "com.siraj.app.LauncherAliasKaabaOrbit",
        "com.siraj.app.LauncherAliasHaramainCrest",
        "com.siraj.app.LauncherAliasMamlukStar",
        "com.siraj.app.LauncherAliasSirajStar"
    };

    public static final String[] ALIAS_KEYS = {
        "royal-mihrab",
        "kaaba-orbit",
        "haramain-crest",
        "mamluk-star",
        "siraj-star"
    };

    @PluginMethod
    public void setLauncherIcon(PluginCall call) {
        try {
            Context context = getContext();
            if (context == null) {
                call.reject("Context is null");
                return;
            }

            int targetIndex = 0;
            if (call.hasOption("edition")) {
                targetIndex = call.getInt("edition", 0);
            } else if (call.hasOption("alias")) {
                String alias = call.getString("alias", "royal-mihrab").toLowerCase().trim();
                for (int i = 0; i < ALIAS_KEYS.length; i++) {
                    if (alias.contains(ALIAS_KEYS[i]) || alias.contains(String.valueOf(i))) {
                        targetIndex = i;
                        break;
                    }
                }
            }

            final int safeIndex = (targetIndex >= 0 && targetIndex < ALIAS_NAMES.length) ? targetIndex : 0;
            PackageManager pm = context.getPackageManager();
            String pkg = context.getPackageName();

            for (int i = 0; i < ALIAS_NAMES.length; i++) {
                ComponentName cn = new ComponentName(pkg, ALIAS_NAMES[i]);
                int newState = (i == safeIndex)
                    ? PackageManager.COMPONENT_ENABLED_STATE_ENABLED
                    : PackageManager.COMPONENT_ENABLED_STATE_DISABLED;
                pm.setComponentEnabledSetting(cn, newState, PackageManager.DONT_KILL_APP);
            }

            // Persist to SharedPreferences
            SharedPreferences prefs = context.getSharedPreferences("noor_connect_prefs", Context.MODE_PRIVATE);
            prefs.edit().putInt("selected_logo_edition", safeIndex).apply();

            Log.i(TAG, "Switched launcher icon to alias: " + ALIAS_NAMES[safeIndex] + " (Edition " + safeIndex + ")");

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("activeAlias", ALIAS_NAMES[safeIndex]);
            ret.put("edition", safeIndex);
            call.resolve(ret);
        } catch (Throwable t) {
            Log.e(TAG, "Failed to switch launcher icon alias", t);
            call.reject("Failed to switch launcher icon: " + t.getMessage());
        }
    }

    @PluginMethod
    public void getActiveLauncherIcon(PluginCall call) {
        try {
            Context context = getContext();
            if (context == null) {
                call.reject("Context is null");
                return;
            }

            SharedPreferences prefs = context.getSharedPreferences("noor_connect_prefs", Context.MODE_PRIVATE);
            int current = prefs.getInt("selected_logo_edition", 0);
            if (current < 0 || current >= ALIAS_NAMES.length) current = 0;

            JSObject ret = new JSObject();
            ret.put("activeAlias", ALIAS_NAMES[current]);
            ret.put("aliasKey", ALIAS_KEYS[current]);
            ret.put("edition", current);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Failed to get active launcher icon: " + t.getMessage());
        }
    }
}
