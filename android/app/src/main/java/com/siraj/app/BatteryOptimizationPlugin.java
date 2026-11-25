package com.siraj.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Universal multi-OEM battery optimization & background auto-start helper.
 * Dynamically detects Build.MANUFACTURER across Samsung, Xiaomi/Redmi/POCO,
 * OPPO/Realme/OnePlus, Vivo/iQOO, Huawei/Honor, Asus, Transsion (Infinix/Tecno/Itel),
 * and stock Android (Pixel/Motorola/Nothing), with crash-safe fallback to App Details.
 */
@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    private static final String TAG = "BatteryOptPlugin";

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve(new JSObject().put("isIgnoring", true));
            return;
        }

        try {
            PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            if (powerManager == null) {
                call.reject("PowerManager not available");
                return;
            }

            String packageName = getContext().getPackageName();
            boolean isIgnoring = powerManager.isIgnoringBatteryOptimizations(packageName);

            JSObject result = new JSObject();
            result.put("isIgnoring", isIgnoring);
            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error checking battery optimization status", e);
            call.reject("Error checking battery optimization status: " + e.getMessage());
        }
    }

    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve();
            return;
        }

        try {
            Activity activity = getActivity();
            Context ctx = activity != null ? activity : getContext();
            if (ctx == null) {
                call.reject("Context not available");
                return;
            }

            String packageName = ctx.getPackageName();
            Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
            intent.setData(Uri.parse("package:" + packageName));
            if (activity == null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            }

            if (canResolve(ctx, intent)) {
                ctx.startActivity(intent);
                call.resolve();
            } else {
                openOemBackgroundSettings(ctx, "battery");
                call.resolve();
            }
        } catch (Exception e) {
            Log.e(TAG, "Error requesting battery optimization exemption", e);
            openOemBackgroundSettings(getContext(), "battery");
            call.resolve();
        }
    }

    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        try {
            boolean opened = openOemBackgroundSettings(getContext(), "battery");
            call.resolve(new JSObject().put("opened", opened));
        } catch (Exception e) {
            Log.e(TAG, "Error opening battery settings", e);
            call.reject("Error opening battery settings: " + e.getMessage());
        }
    }

    @PluginMethod
    public void openOemBackgroundSettings(PluginCall call) {
        String mode = call.getString("mode", "auto");
        try {
            boolean opened = openOemBackgroundSettings(getContext(), mode);
            call.resolve(new JSObject().put("opened", opened));
        } catch (Throwable t) {
            Log.e(TAG, "Error opening OEM background settings", t);
            call.resolve(new JSObject().put("opened", false));
        }
    }

    @PluginMethod
    public void getOemGuidance(PluginCall call) {
        try {
            JSONObject obj = getOemGuidanceJson(getContext());
            call.resolve(JSObject.fromJSONObject(obj));
        } catch (Throwable t) {
            Log.e(TAG, "Error building OEM guidance", t);
            call.reject("Error building OEM guidance: " + t.getMessage());
        }
    }

    public static JSONObject getOemGuidanceJson(Context context) {
        JSONObject out = new JSONObject();
        try {
            String rawMfr = Build.MANUFACTURER != null ? Build.MANUFACTURER.trim() : "Android";
            String mfr = rawMfr.toLowerCase(Locale.ROOT);
            String model = Build.MODEL != null ? Build.MODEL.trim() : "";

            boolean batteryUnrestricted = true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && context != null) {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    batteryUnrestricted = pm.isIgnoringBatteryOptimizations(context.getPackageName());
                }
            }

            boolean hasOemAutoStart = context != null && hasResolvableOemComponent(context, mfr);
            String tip = buildDynamicOemTip(mfr);

            out.put("manufacturer", rawMfr);
            out.put("model", model);
            out.put("androidApi", Build.VERSION.SDK_INT);
            out.put("batteryUnrestricted", batteryUnrestricted);
            out.put("hasOemAutoStartPage", hasOemAutoStart);
            out.put("tip", tip);
        } catch (Throwable t) {
            Log.w(TAG, "getOemGuidanceJson failed", t);
        }
        return out;
    }

    private static String buildDynamicOemTip(String mfrLower) {
        if (mfrLower.contains("samsung")) {
            return "Set Battery -> Unrestricted & exclude Siraj from Sleeping Apps.";
        }
        if (mfrLower.contains("xiaomi") || mfrLower.contains("redmi") || mfrLower.contains("poco")) {
            return "Enable Autostart & set Battery Saver -> No restrictions.";
        }
        if (mfrLower.contains("oppo") || mfrLower.contains("realme") || mfrLower.contains("oneplus")) {
            return "Enable Auto-launch / Allow background activity & Battery Unrestricted.";
        }
        if (mfrLower.contains("vivo") || mfrLower.contains("iqoo")) {
            return "Allow High background power usage & Autostart.";
        }
        if (mfrLower.contains("huawei") || mfrLower.contains("honor")) {
            return "Set App Launch -> Manage manually & allow Auto-launch / Run in background.";
        }
        if (mfrLower.contains("infinix") || mfrLower.contains("tecno") || mfrLower.contains("itel")) {
            return "Enable Auto-start & allow Background running in Phone Master.";
        }
        if (mfrLower.contains("asus")) {
            return "Allow Siraj in Auto-start Manager & set Battery -> Unrestricted.";
        }
        return "Set App Battery Usage -> Unrestricted for exact prayer alerts.";
    }

    /**
     * Crash-safe OEM battery & auto-start settings launcher.
     * mode: "auto" (requests battery exemption first if restricted, else OEM page / app details),
     *       "battery" (battery exemption / app details),
     *       "autostart" (OEM autostart / background manager first, then battery / app details).
     */
    public static boolean openOemBackgroundSettings(Context context, String mode) {
        if (context == null) return false;
        String pkg = context.getPackageName();
        String mfr = Build.MANUFACTURER != null ? Build.MANUFACTURER.toLowerCase(Locale.ROOT) : "";
        boolean isAutostartMode = "autostart".equalsIgnoreCase(mode);

        // Step 1: Standard Android battery optimization exemption if not yet ignoring (and not explicitly autostart-only)
        if (!isAutostartMode && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                    Intent reqIntent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    reqIntent.setData(Uri.parse("package:" + pkg));
                    reqIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    if (tryStartActivity(context, reqIntent)) {
                        return true;
                    }
                }
            } catch (Throwable ignored) {}
        }

        // Step 2: OEM Auto-Start / Background Activity Deep-Link
        List<ComponentName> candidates = getOemCandidates(mfr);
        for (ComponentName cn : candidates) {
            Intent oemIntent = new Intent();
            oemIntent.setComponent(cn);
            oemIntent.putExtra("package_name", pkg);
            oemIntent.putExtra("packageName", pkg);
            oemIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (tryStartActivity(context, oemIntent)) {
                return true;
            }
        }

        // Step 3: Universal Safe Fallback — App Details Settings (NEVER crashes on Pixel/Motorola/Nothing/updated ROMs)
        Intent appDetails = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        appDetails.setData(Uri.fromParts("package", pkg, null));
        appDetails.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (tryStartActivity(context, appDetails)) {
            return true;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent battList = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
            battList.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            if (tryStartActivity(context, battList)) {
                return true;
            }
        }

        Intent sysSettings = new Intent(Settings.ACTION_SETTINGS);
        sysSettings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return tryStartActivity(context, sysSettings);
    }

    private static boolean hasResolvableOemComponent(Context context, String mfrLower) {
        List<ComponentName> candidates = getOemCandidates(mfrLower);
        for (ComponentName cn : candidates) {
            Intent intent = new Intent();
            intent.setComponent(cn);
            if (canResolve(context, intent)) {
                return true;
            }
        }
        return false;
    }

    private static List<ComponentName> getOemCandidates(String mfrLower) {
        List<ComponentName> list = new ArrayList<>();
        if (mfrLower.contains("xiaomi") || mfrLower.contains("redmi") || mfrLower.contains("poco")) {
            list.add(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
            list.add(new ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings"));
        } else if (mfrLower.contains("oppo") || mfrLower.contains("realme") || mfrLower.contains("oneplus")) {
            list.add(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"));
            list.add(new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"));
            list.add(new ComponentName("com.oplus.battery", "com.oplus.powermanager.fuelgaue.PowerControlActivity"));
            list.add(new ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity"));
        } else if (mfrLower.contains("vivo") || mfrLower.contains("iqoo")) {
            list.add(new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"));
            list.add(new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager"));
            list.add(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
        } else if (mfrLower.contains("samsung")) {
            list.add(new ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity"));
            list.add(new ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity"));
            list.add(new ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity"));
        } else if (mfrLower.contains("huawei") || mfrLower.contains("honor")) {
            list.add(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
            list.add(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.optimize.process.ProtectActivity"));
            list.add(new ComponentName("com.hihonor.systemmanager", "com.hihonor.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
        } else if (mfrLower.contains("asus")) {
            list.add(new ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"));
        } else if (mfrLower.contains("infinix") || mfrLower.contains("tecno") || mfrLower.contains("itel")) {
            list.add(new ComponentName("com.transsion.phonemaster", "com.transsion.phonemaster.autoStart.AutoStartActivity"));
            list.add(new ComponentName("com.itel.phonemaster", "com.itel.phonemaster.autoStart.AutoStartActivity"));
        }
        return list;
    }

    private static boolean canResolve(Context context, Intent intent) {
        try {
            PackageManager pm = context.getPackageManager();
            return pm != null && intent.resolveActivity(pm) != null;
        } catch (Throwable t) {
            return false;
        }
    }

    private static boolean tryStartActivity(Context context, Intent intent) {
        try {
            if (!canResolve(context, intent)) {
                return false;
            }
            context.startActivity(intent);
            return true;
        } catch (Throwable t) {
            Log.w(TAG, "OEM settings intent failed safely: " + intent.getComponent(), t);
            return false;
        }
    }
}
