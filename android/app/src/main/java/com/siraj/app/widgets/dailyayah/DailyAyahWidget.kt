package com.siraj.app.widgets.dailyayah

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.util.Log
import android.util.TypedValue
import android.view.View
import android.widget.RemoteViews
import com.siraj.app.R
import com.siraj.app.widgets.WidgetDeeplink
import com.siraj.app.widgets.WidgetForegroundService
import com.siraj.app.widgets.WidgetPrefs
import com.siraj.app.widgets.WidgetRefreshWorker
import com.siraj.app.widgets.WidgetStyleHelper

/**
 * Daily Ayah Widget (4×2)
 *
 * Shows:
 *  - Reference chip ("Al-Baqarah 2:255")
 *  - Arabic verse (RTL, Scheherazade New / Amiri font)
 *  - Arabesque divider
 *  - Translation
 *
 * Tap → deep-link to /quran?surah=N&ayah=N
 */
class DailyAyahWidget : AppWidgetProvider() {

    companion object {
        private const val TAG = "DailyAyahWidget"
        const val ACTION_CYCLE_AYAH = "com.siraj.app.widgets.CYCLE_AYAH"

        private val CURATED_AYAHS = listOf(
            com.siraj.app.widgets.AyahContent(
                arabic = "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا • إِنَّ مَعَ الْعُسْرِ يُسْرًا",
                translation = "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.",
                transliteration = "",
                reference = "Al-Inshirah 94:5-6",
                surahNumber = 94,
                ayahNumber = 5
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا",
                translation = "Allah does not burden a soul beyond that it can bear.",
                transliteration = "",
                reference = "Al-Baqarah 2:286",
                surahNumber = 2,
                ayahNumber = 286
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "فَاذْكُرُونِي أَذْكُرْكُمْ وَاشْكُرُوا لِي وَلَا تَكْفُرُونِ",
                translation = "So remember Me; I will remember you. And be grateful to Me and do not deny Me.",
                transliteration = "",
                reference = "Al-Baqarah 2:152",
                surahNumber = 2,
                ayahNumber = 152
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ",
                translation = "Say, O My servants who have transgressed against themselves, do not despair of the mercy of Allah.",
                transliteration = "",
                reference = "Az-Zumar 39:53",
                surahNumber = 39,
                ayahNumber = 53
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
                translation = "And whoever relies upon Allah - then He is sufficient for him.",
                transliteration = "",
                reference = "At-Talaq 65:3",
                surahNumber = 65,
                ayahNumber = 3
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ",
                translation = "And when My servants ask you concerning Me, indeed I am near.",
                transliteration = "",
                reference = "Al-Baqarah 2:186",
                surahNumber = 2,
                ayahNumber = 186
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ",
                translation = "Unquestionably, by the remembrance of Allah hearts are assured.",
                transliteration = "",
                reference = "Ar-Ra'd 13:28",
                surahNumber = 13,
                ayahNumber = 28
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "لَّا إِلَٰهَ إِلَّا أَنتَ سُبْحَانَكَ إِنِّي كُنتُ مِنَ الظَّالِمِينَ",
                translation = "There is no deity except You; exalted are You. Indeed, I have been of the wrongdoers.",
                transliteration = "",
                reference = "Al-Anbiya 21:87",
                surahNumber = 21,
                ayahNumber = 87
            ),
            com.siraj.app.widgets.AyahContent(
                arabic = "لَئِن شَكَرْتُمْ لَأَزِيدَنَّكُمْ",
                translation = "If you are grateful, I will surely increase you [in favor].",
                transliteration = "",
                reference = "Ibrahim 14:7",
                surahNumber = 14,
                ayahNumber = 7
            )
        )

        fun cycleNextAyah(context: Context) {
            try {
                val currentIdx = WidgetPrefs.getAyahIndex(context)
                val baseIdx = if (currentIdx >= 0) currentIdx else (java.util.Calendar.getInstance().get(java.util.Calendar.DAY_OF_YEAR) % CURATED_AYAHS.size)
                val nextIdx = (baseIdx + 1) % CURATED_AYAHS.size
                WidgetPrefs.saveAyahIndex(context, nextIdx)

                val nextAyah = CURATED_AYAHS[nextIdx]
                val oldPayload = WidgetPrefs.getDailyContent(context)
                val newPayload = if (oldPayload != null) {
                    oldPayload.copy(ayah = nextAyah)
                } else {
                    com.siraj.app.widgets.DailyContentPayload(
                        ayah = nextAyah,
                        hadith = com.siraj.app.widgets.dailyhadith.HadithBundle.getFallbackHadith(context),
                        locale = "en"
                    )
                }
                WidgetPrefs.saveDailyContent(context, newPayload)

                val mgr = AppWidgetManager.getInstance(context)
                val ids = mgr.getAppWidgetIds(android.content.ComponentName(context, DailyAyahWidget::class.java))
                ids.forEach { updateWidget(context, mgr, it) }
            } catch (t: Throwable) {
                Log.e(TAG, "cycleNextAyah error", t)
            }
        }

        fun updateWidget(context: Context, mgr: AppWidgetManager, appWidgetId: Int) {
            try {
                val views = RemoteViews(context.packageName, R.layout.widget_daily_ayah)

                // ─── 1. Customizer Styles (Background & Colors) ───
                val style = WidgetStyleHelper.parseConfig(context)
                val bgBitmap = WidgetStyleHelper.renderBackgroundBitmap(
                    surfaceStyle = style.surfaceStyle,
                    themeHex = style.themeHex,
                    opacityPercent = style.opacity,
                    accentHex = style.accentHex
                )
                views.setImageViewBitmap(R.id.widget_bg_image, bgBitmap)

                // ─── 2. Data Content ───
                val payload = WidgetPrefs.getDailyContent(context)

                val defaultRef = "Al-Inshirah 94:5-6"
                val defaultArabic = "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا • إِنَّ مَعَ الْعُسْرِ يُسْرًا"
                val defaultTrans = "For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease."

                if (payload == null) {
                    views.setTextViewText(R.id.widget_quran_ref, defaultRef)
                    views.setTextViewText(R.id.widget_quran_arabic, defaultArabic)
                    views.setTextViewText(R.id.widget_quran_translation, defaultTrans)
                } else {
                    val ayah = payload.ayah
                    val cleanRef = when {
                        ayah.reference.isBlank() || ayah.reference == "-" || ayah.reference == "—" -> defaultRef
                        else -> ayah.reference
                    }
                    views.setTextViewText(R.id.widget_quran_ref, cleanRef)
                    views.setTextViewText(R.id.widget_quran_arabic, ayah.arabic.ifEmpty { defaultArabic })
                    views.setTextViewText(R.id.widget_quran_translation, ayah.translation.ifEmpty { defaultTrans })
                }

                // ─── 3. Swatches & Colors ───
                try {
                    val accentCol = Color.parseColor(style.accentHex)
                    val textCol = Color.parseColor(style.textHex)
                    val subCol = Color.parseColor(style.subHex)

                    views.setTextColor(R.id.widget_quran_ref, accentCol)
                    views.setTextColor(R.id.widget_quran_arabic, textCol)
                    views.setTextColor(R.id.widget_quran_translation, subCol)
                    views.setTextColor(R.id.widget_btn_refresh, accentCol)
                } catch (_: Throwable) {}

                // ─── 4. Font Scaling ───
                val scaledArabic = (21f * style.fontScale / 100f).coerceIn(16f, 28f)
                views.setTextViewTextSize(R.id.widget_quran_arabic, TypedValue.COMPLEX_UNIT_SP, scaledArabic)

                val scaledTrans = (12f * style.fontScale / 100f).coerceIn(10f, 16f)
                views.setTextViewTextSize(R.id.widget_quran_translation, TypedValue.COMPLEX_UNIT_SP, scaledTrans)

                // ─── 5. Stale data badge (permanently gone) ───
                views.setViewVisibility(R.id.widget_stale_badge, View.GONE)

                // ─── 6. Accessibility ───
                val contentDesc = if (payload != null) {
                    context.getString(R.string.widget_a11y_daily_ayah, payload.ayah.reference)
                } else {
                    context.getString(R.string.widget_a11y_daily_ayah_default)
                }
                views.setContentDescription(R.id.widget_root, contentDesc)

                // ─── 7. Tap → deep-link /quran?surah=X&ayah=Y ───
                val (surah, ayahNum) = if (payload != null) {
                    Pair(payload.ayah.surahNumber, payload.ayah.ayahNumber)
                } else {
                    Pair(94, 5)
                }
                val deeplink = WidgetDeeplink.buildQuran(surah, ayahNum)
                val intent = WidgetDeeplink.toIntent(context, deeplink)
                val pi = PendingIntent.getActivity(
                    context,
                    104,
                    intent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(R.id.widget_root, pi)

                // ─── 8. 1-Tap ↻ Refresh Intent ───
                val cycleIntent = Intent(context, DailyAyahWidget::class.java).apply {
                    action = ACTION_CYCLE_AYAH
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(appWidgetId))
                }
                val cyclePi = PendingIntent.getBroadcast(
                    context,
                    appWidgetId * 10 + 5,
                    cycleIntent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                views.setOnClickPendingIntent(R.id.widget_btn_refresh, cyclePi)

                mgr.updateAppWidget(appWidgetId, views)
            } catch (t: Throwable) {
                Log.e(TAG, "Critical error updating DailyAyahWidget $appWidgetId", t)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_CYCLE_AYAH) {
            cycleNextAyah(context)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        try {
            appWidgetIds.forEach { updateWidget(context, appWidgetManager, it) }
        } catch (t: Throwable) {
            Log.e(TAG, "onUpdate fatal error", t)
        }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        try {
            val minWidth = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0)
            val minHeight = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0)
            val maxWidth = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, 0)
            val maxHeight = newOptions.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0)

            Log.d(TAG, "Widget resized: min=${minWidth}x${minHeight}, max=${maxWidth}x${maxHeight}")
            updateWidget(context, appWidgetManager, appWidgetId)
        } catch (t: Throwable) {
            Log.e(TAG, "onAppWidgetOptionsChanged error", t)
        }
    }

    override fun onEnabled(context: Context) {
        try {
            WidgetForegroundService.start(context)
            WidgetRefreshWorker.enqueuePeriodic(context)
            Log.d(TAG, "Widget enabled")
        } catch (t: Throwable) {
            Log.e(TAG, "onEnabled error", t)
        }
    }

    override fun onDisabled(context: Context) {
        try {
            if (!WidgetForegroundService.hasActiveWidgets(context)) {
                WidgetForegroundService.stop(context)
            }
            Log.d(TAG, "Widget disabled")
        } catch (t: Throwable) {
            Log.e(TAG, "onDisabled error", t)
        }
    }
}
