package com.siraj.app.widgets

import android.appwidget.AppWidgetManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log
import com.siraj.app.widgets.circularclock.NoorCircularClockWidget
import com.siraj.app.widgets.compactstrip.NoorCompactStripWidget
import com.siraj.app.widgets.nextprayer.NextPrayerWidget

/**
 * Receives alarms fired at each prayer time and Makruh boundary.
 *
 * On receive:
 *  1. Synchronously updates all home screen widgets via their providers.
 *  2. Re-reads [WidgetPrefs.getPrayerPayload] and reschedules the next prayer alarm.
 *  3. Also enqueues [WidgetRefreshWorker] as a background safety net.
 *
 * Also listens for ACTION_BOOT_COMPLETED, ACTION_TIME_SET, ACTION_TIMEZONE_CHANGED,
 * ACTION_LOCALE_CHANGED so widgets survive system events.
 */
class WidgetAlarmReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "WidgetAlarmReceiver"
        const val ACTION_REFRESH_ALL = "com.siraj.app.WIDGET_REFRESH"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        Log.d(TAG, "onReceive: $action")

        val pendingResult = goAsync()
        try {
            val appWidgetManager = AppWidgetManager.getInstance(context)

            // 1. Immediately refresh Circular Clock Widget
            val clockComponent = ComponentName(context, NoorCircularClockWidget::class.java)
            val clockIds = appWidgetManager.getAppWidgetIds(clockComponent)
            clockIds.forEach { NoorCircularClockWidget.updateWidget(context, appWidgetManager, it) }

            // 2. Immediately refresh Next Prayer Widget
            val nextComponent = ComponentName(context, NextPrayerWidget::class.java)
            val nextIds = appWidgetManager.getAppWidgetIds(nextComponent)
            nextIds.forEach { NextPrayerWidget.updateWidget(context, appWidgetManager, it) }

            // 3. Immediately refresh Compact Strip Widget
            val stripComponent = ComponentName(context, NoorCompactStripWidget::class.java)
            val stripIds = appWidgetManager.getAppWidgetIds(stripComponent)
            stripIds.forEach { NoorCompactStripWidget.updateWidget(context, appWidgetManager, it) }

            // 4. Reschedule next prayer/makruh alarm if we have prayer data
            val prayerPayload = WidgetPrefs.getPrayerPayload(context)
            if (prayerPayload != null) {
                WidgetAlarmScheduler.scheduleNextPrayerAlarm(context, prayerPayload)
            }

            // 5. Also enqueue an expedited background worker
            WidgetRefreshWorker.enqueueImmediate(context)
        } catch (e: Exception) {
            Log.e(TAG, "Error in onReceive", e)
        } finally {
            pendingResult.finish()
        }
    }
}
