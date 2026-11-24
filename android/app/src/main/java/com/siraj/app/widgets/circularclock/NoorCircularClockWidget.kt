package com.siraj.app.widgets.circularclock

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.Log
import android.util.TypedValue
import android.widget.RemoteViews
import com.siraj.app.R
import com.siraj.app.widgets.PrayerEntry
import com.siraj.app.widgets.PrayerPayload
import com.siraj.app.widgets.WidgetAlarmReceiver
import com.siraj.app.widgets.WidgetAlarmScheduler
import com.siraj.app.widgets.WidgetDeeplink
import com.siraj.app.widgets.WidgetForegroundService
import com.siraj.app.widgets.WidgetPrefs
import com.siraj.app.widgets.WidgetStyleHelper
import java.util.concurrent.TimeUnit

/**
 * NoorCircularClockWidget (2×2 / 3×2 Circular Dial)
 *
 * Kashkol-Inspired dial + Noor Dark Luxury Polish:
 *  - Circular Progress-Arc bitmap rendered via Android Canvas
 *  - Native <TextClock> (zero battery drain, 60s auto-ticks)
 *  - Hijri date header + Next Prayer pill + Countdown / Qaza End Time
 *  - 1-tap ↻ Refresh button & deep-link to /prayers?focus=next
 */
class NoorCircularClockWidget : AppWidgetProvider() {

    companion object {
        private const val TAG = "NoorCircularClockWidget"
        const val ACTION_WIDGET_REFRESH = "com.siraj.app.WIDGET_REFRESH"

        private fun getDefaultPrayerPayload(): PrayerPayload {
            val now = System.currentTimeMillis()
            fun makePrayerTime(hour: Int, min: Int): Long {
                val c = java.util.Calendar.getInstance()
                c.set(java.util.Calendar.HOUR_OF_DAY, hour)
                c.set(java.util.Calendar.MINUTE, min)
                c.set(java.util.Calendar.SECOND, 0)
                c.set(java.util.Calendar.MILLISECOND, 0)
                return c.timeInMillis
            }

            val prayers = listOf(
                PrayerEntry("Fajr", makePrayerTime(5, 40), "05:40 AM", makePrayerTime(6, 59), "06:59 AM"),
                PrayerEntry("Sunrise", makePrayerTime(6, 59), "06:59 AM"),
                PrayerEntry("Dhuhr", makePrayerTime(12, 26), "12:26 PM", makePrayerTime(16, 17), "04:17 PM"),
                PrayerEntry("Asr", makePrayerTime(16, 17), "04:17 PM", makePrayerTime(17, 53), "05:53 PM"),
                PrayerEntry("Maghrib", makePrayerTime(17, 56), "05:56 PM", makePrayerTime(19, 12), "07:12 PM"),
                PrayerEntry("Isha", makePrayerTime(19, 12), "07:12 PM", makePrayerTime(29, 40), "05:40 AM")
            )

            var nextIdx = 0
            for (i in prayers.indices) {
                if (prayers[i].time > now) {
                    nextIdx = i
                    break
                }
            }

            return PrayerPayload(
                prayers = prayers,
                nextPrayerIndex = nextIdx,
                hijriDate = WidgetStyleHelper.computeFallbackHijri(),
                gregorianDate = "Fri, 20 Nov",
                locationLabel = "Vadgām, India",
                madhab = "HANAFI",
                calculationMethod = "Karachi",
                currentTime24h = "16:17",
                lastUpdated = now,
                showQazaEndTime = true
            )
        }

        fun updateWidget(context: Context, mgr: AppWidgetManager, appWidgetId: Int) {
            try {
                val views = RemoteViews(context.packageName, R.layout.widget_circular_clock)

                val rawPayload = WidgetPrefs.getPrayerPayload(context)
                val payload = if (rawPayload == null || rawPayload.prayers.isEmpty()) {
                    getDefaultPrayerPayload()
                } else {
                    rawPayload
                }

                val style = WidgetStyleHelper.parseConfig(context)
                val now = System.currentTimeMillis()

                // ─── Resolve Live State from 7-Day Precomputed Schedule ───
                var isSunriseMakruh = false
                var isZawaalMakruh = false
                var isSunsetMakruh = false
                var makruhWindowLabel = ""
                var makruhEndFormatted = ""
                var makruhStartMs = 0L
                var makruhEndMs = 0L

                if (payload.upcomingDays.isNotEmpty()) {
                    for (day in payload.upcomingDays) {
                        if (day.makruhSunriseStartMs > 0L && now in day.makruhSunriseStartMs until day.makruhSunriseEndMs) {
                            isSunriseMakruh = true
                            makruhWindowLabel = "Sunrise"
                            makruhEndFormatted = day.makruhSunriseEndFormatted
                            makruhStartMs = day.makruhSunriseStartMs
                            makruhEndMs = day.makruhSunriseEndMs
                            break
                        }
                        if (day.makruhZawaalStartMs > 0L && now in day.makruhZawaalStartMs until day.makruhZawaalEndMs) {
                            isZawaalMakruh = true
                            makruhWindowLabel = "Zawaal"
                            makruhEndFormatted = day.makruhZawaalEndFormatted
                            makruhStartMs = day.makruhZawaalStartMs
                            makruhEndMs = day.makruhZawaalEndMs
                            break
                        }
                        if (day.makruhSunsetStartMs > 0L && now in day.makruhSunsetStartMs until day.makruhSunsetEndMs) {
                            isSunsetMakruh = true
                            makruhWindowLabel = "Sunset"
                            makruhEndFormatted = day.makruhSunsetEndFormatted
                            makruhStartMs = day.makruhSunsetStartMs
                            makruhEndMs = day.makruhSunsetEndMs
                            break
                        }
                    }
                } else {
                    isSunriseMakruh = payload.makruhSunriseStartMs > 0L && now in payload.makruhSunriseStartMs until payload.makruhSunriseEndMs
                    isZawaalMakruh = payload.makruhZawaalStartMs > 0L && now in payload.makruhZawaalStartMs until payload.makruhZawaalEndMs
                    isSunsetMakruh = payload.makruhSunsetStartMs > 0L && now in payload.makruhSunsetStartMs until payload.makruhSunsetEndMs
                    if (isSunriseMakruh) {
                        makruhWindowLabel = "Sunrise"
                        makruhEndFormatted = payload.makruhSunriseEndFormatted
                        makruhStartMs = payload.makruhSunriseStartMs
                        makruhEndMs = payload.makruhSunriseEndMs
                    } else if (isZawaalMakruh) {
                        makruhWindowLabel = "Zawaal"
                        makruhEndFormatted = payload.makruhZawaalEndFormatted
                        makruhStartMs = payload.makruhZawaalStartMs
                        makruhEndMs = payload.makruhZawaalEndMs
                    } else if (isSunsetMakruh) {
                        makruhWindowLabel = "Sunset"
                        makruhEndFormatted = payload.makruhSunsetEndFormatted
                        makruhStartMs = payload.makruhSunsetStartMs
                        makruhEndMs = payload.makruhSunsetEndMs
                    }
                }

                val isMakruh = isSunriseMakruh || isZawaalMakruh || isSunsetMakruh

                // ─── Next Prayer & Previous Prayer Resolution across Days ───
                val allDayPrayers = mutableListOf<Pair<PrayerEntry, com.siraj.app.widgets.DayPrayerSchedule?>>()
                if (payload.upcomingDays.isNotEmpty()) {
                    for (day in payload.upcomingDays) {
                        for (p in day.prayers) {
                            allDayPrayers.add(Pair(p, day))
                        }
                    }
                } else {
                    for (p in payload.prayers) {
                        allDayPrayers.add(Pair(p, null))
                    }
                }

                val nextPair = allDayPrayers.firstOrNull { it.first.time > now }
                    ?: allDayPrayers.lastOrNull()
                    ?: Pair(payload.prayers[0], null)

                val nextPairIdx = allDayPrayers.indexOf(nextPair)
                val prevPrayer = if (nextPairIdx > 0) allDayPrayers[nextPairIdx - 1].first else null

                val nextPrayer = nextPair.first
                val activeDay = nextPair.second

                // Compute progress arc percentage
                val progressPercent: Float
                val activeAccentHex: String

                if (isMakruh) {
                    // DURING MAKRUH WAQT: Switch Progress Arc to Makruh Crimson Red (#EF4444)
                    activeAccentHex = "#EF4444"
                    val duration = (makruhEndMs - makruhStartMs).toFloat()
                    val elapsed = (now - makruhStartMs).toFloat()
                    progressPercent = if (duration > 0f) (elapsed / duration).coerceIn(0.08f, 1f) else 1f
                } else {
                    // NORMAL WAQT: Revert cleanly to user selected theme accent color
                    activeAccentHex = style.accentHex
                    val prevTime = prevPrayer?.time ?: (nextPrayer.time - (3 * 3600 * 1000L))
                    val totalDuration = (nextPrayer.time - prevTime).toFloat()
                    progressPercent = if (totalDuration > 0) {
                        ((now - prevTime).toFloat() / totalDuration).coerceIn(0.05f, 1f)
                    } else 0.5f
                }

                // 1. Render Circular Progress-Arc Bitmap via Android Canvas
                val dialBitmap = WidgetStyleHelper.renderCircularDialBitmap(
                    surfaceStyle = style.surfaceStyle,
                    themeHex = style.themeHex,
                    opacityPercent = style.opacity,
                    accentHex = activeAccentHex,
                    progressPercent = progressPercent
                )
                views.setImageViewBitmap(R.id.widget_bg_image, dialBitmap)

                // 2. Hijri Date (from activeDay if available, else style/payload fallback)
                val candidateHijri = when {
                    style.hijriDateFormatted.isNotBlank() -> style.hijriDateFormatted
                    activeDay != null && activeDay.hijriDate.isNotBlank() && !activeDay.hijriDate.contains("Siraj", ignoreCase = true) -> activeDay.hijriDate
                    payload.hijriDate.isNotBlank() && !payload.hijriDate.contains("Siraj", ignoreCase = true) -> payload.hijriDate
                    else -> null
                }
                val hijriDisplay = WidgetStyleHelper.formatHijriDate(candidateHijri)
                views.setTextViewText(R.id.widget_hijri_date, hijriDisplay)

                // 3. Center Pill & Subline
                if (isMakruh) {
                    views.setTextViewText(R.id.widget_prayer_pill, "● MAKRUH • $makruhWindowLabel")
                    views.setTextViewText(R.id.widget_subline, "Ends $makruhEndFormatted")
                } else {
                    val prayerPillText = "${nextPrayer.name} • ${nextPrayer.formattedTime}"
                    views.setTextViewText(R.id.widget_prayer_pill, prayerPillText)

                    val remainingMs = nextPrayer.time - now
                    val countdownText = formatCountdown(remainingMs)
                    val qazaEndTime = if (nextPrayer.formattedEndTime.isNotBlank()) {
                        nextPrayer.formattedEndTime
                    } else if (activeDay != null) {
                        when (nextPrayer.name.lowercase()) {
                            "fajr" -> activeDay.fajrEndFormatted
                            "dhuhr", "jumu'ah" -> activeDay.dhuhrEndFormatted
                            "asr" -> activeDay.asrEndFormatted
                            "maghrib" -> activeDay.maghribEndFormatted
                            "isha" -> activeDay.ishaEndFormatted
                            else -> ""
                        }
                    } else when (nextPrayer.name.lowercase()) {
                        "fajr" -> payload.fajrEndFormatted
                        "dhuhr", "jumu'ah" -> payload.dhuhrEndFormatted
                        "asr" -> payload.asrEndFormatted
                        "maghrib" -> payload.maghribEndFormatted
                        "isha" -> payload.ishaEndFormatted
                        else -> ""
                    }

                    val sublineText = if (style.showQazaEndTime && qazaEndTime.isNotBlank()) {
                        "Ends $qazaEndTime"
                    } else {
                        countdownText
                    }
                    views.setTextViewText(R.id.widget_subline, sublineText)
                }

                // 4. Colors & Swatches
                try {
                    val accentCol = Color.parseColor(activeAccentHex)
                    val textCol = Color.parseColor(style.textHex)

                    views.setTextColor(R.id.widget_hijri_date, accentCol)
                    views.setTextColor(R.id.widget_clock, textCol)
                    views.setTextColor(R.id.widget_prayer_pill, if (isMakruh) Color.parseColor("#EF4444") else textCol)
                    views.setTextColor(
                        R.id.widget_subline,
                        if (isMakruh) Color.parseColor("#EF4444")
                        else if (style.showQazaEndTime) accentCol
                        else Color.parseColor("#10B981")
                    )
                    views.setTextColor(R.id.widget_btn_refresh, accentCol)
                } catch (t: Throwable) {
                    Log.w(TAG, "Color parsing error", t)
                }

                // 6. Font Scale
                val scaledClockSp = (28f * style.fontScale / 100f).coerceIn(22f, 36f)
                views.setTextViewTextSize(R.id.widget_clock, TypedValue.COMPLEX_UNIT_SP, scaledClockSp)

                // 7. On-Widget ↻ Refresh PendingIntent (Explicit Broadcast directly to NoorCircularClockWidget)
                val refreshIntent = Intent(context, NoorCircularClockWidget::class.java).apply {
                    action = ACTION_WIDGET_REFRESH
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
                }
                val refreshPi = PendingIntent.getBroadcast(
                    context,
                    3000 + appWidgetId,
                    refreshIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_btn_refresh, refreshPi)

                // 8. Main Dial Tap -> Deep Link
                val deeplink = WidgetDeeplink.buildPrayers(focus = "next")
                val openIntent = WidgetDeeplink.toIntent(context, deeplink)
                val openPi = PendingIntent.getActivity(
                    context,
                    102,
                    openIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(R.id.widget_root, openPi)

                mgr.updateAppWidget(appWidgetId, views)
            } catch (t: Throwable) {
                Log.e(TAG, "Error updating NoorCircularClockWidget $appWidgetId", t)
            }
        }

        private fun formatCountdown(remainingMs: Long): String {
            return when {
                remainingMs <= 0 -> "Now"
                remainingMs > 3_600_000L -> {
                    val hours = TimeUnit.MILLISECONDS.toHours(remainingMs)
                    val minutes = TimeUnit.MILLISECONDS.toMinutes(remainingMs) - hours * 60
                    "In ${hours}h ${minutes}m"
                }
                else -> {
                    val minutes = TimeUnit.MILLISECONDS.toMinutes(remainingMs)
                    if (minutes > 0) "In ${minutes}m" else "In <1m"
                }
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        val action = intent.action ?: return
        if (action == ACTION_WIDGET_REFRESH ||
            action == Intent.ACTION_TIME_CHANGED ||
            action == Intent.ACTION_TIMEZONE_CHANGED ||
            action == Intent.ACTION_DATE_CHANGED) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                updateWidget(context, appWidgetManager, appWidgetId)
            } else {
                val componentName = android.content.ComponentName(context, NoorCircularClockWidget::class.java)
                val ids = appWidgetManager.getAppWidgetIds(componentName)
                ids.forEach { updateWidget(context, appWidgetManager, it) }
            }
            WidgetPrefs.getPrayerPayload(context)?.let {
                WidgetAlarmScheduler.scheduleNextPrayerAlarm(context, it)
            }
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        try {
            appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
        } catch (t: Throwable) {
            Log.e(TAG, "onUpdate error", t)
        }
    }

    override fun onEnabled(context: Context) {
        try {
            WidgetForegroundService.start(context)
            WidgetPrefs.getPrayerPayload(context)?.let {
                WidgetAlarmScheduler.scheduleNextPrayerAlarm(context, it)
            }
        } catch (t: Throwable) {
            Log.e(TAG, "onEnabled error", t)
        }
    }

    override fun onDisabled(context: Context) {
        try {
            if (!WidgetForegroundService.hasActiveWidgets(context)) {
                WidgetAlarmScheduler.cancelAllAlarms(context)
                WidgetForegroundService.stop(context)
            }
        } catch (t: Throwable) {
            Log.e(TAG, "onDisabled error", t)
        }
    }
}
