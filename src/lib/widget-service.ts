/**
 * widget-service.ts
 *
 * Single source of truth widget synchronization bridge between Siraj
 * (TypeScript) and native Android widgets.
 *
 * Computes exact prayer times and Qaza boundaries from `computeFullPrayerSchedule`,
 * ensuring 100% minute-for-minute sync between the in-app dashboard, widget preview,
 * and Android home screen widgets.
 */

import {
  syncPrayerData,
  syncDailyContent,
} from './widgetBridge';
import { computeFullPrayerSchedule, getCalculationMethod } from './prayer-times';
import { evaluateMakruhState } from './makruh-times';
import { getMadhab, get24HourTime } from './storage';
import { isNativePlatform } from './capacitor-utils';
import { getDailyHadith } from './daily-content';
import { loadWidgetStyleConfig, ACCENT_PRESETS, getActiveThemeHex } from './widget-customizer';
import i18n from './i18n-new';
import type {
  PrayerPayload,
  PrayerEntry,
  DayPrayerSchedule,
  DailyContentPayload,
  AyahContent,
  HadithContent,
} from './widget-types';

// ─────────────────────────────────────────────────────────
// Date & Time Helpers
// ─────────────────────────────────────────────────────────

function getHijriDateString(forDate?: Date): string {
  try {
    if (!forDate) {
      const stored = localStorage.getItem('noor_cached_hijri_date');
      if (stored && stored.trim() && !stored.includes('Siraj')) {
        return stored
          .replace(/[\u014d\u014c\u00f4\u00d4]/g, 'ū')
          .replace(/Jum[aā]d[aā]\s*(al-)?(ula|ūlā|ōlā|ola|1|i)\b/gi, 'Jumādā I')
          .replace(/Jum[aā]d[aā]\s*(al-)?(akhirah|ākhirah|akhira|thani|thānī|2|ii)\b/gi, 'Jumādā II')
          .replace(/Rab[iī]ʿ?\s*(al-)?(awwal|1|i)\b/gi, 'Rabīʿ I')
          .replace(/Rab[iī]ʿ?\s*(al-)?(thani|thānī|akhir|ākhir|2|ii)\b/gi, 'Rabīʿ II')
          .replace(/\s+(AH|هـ)\.?$/i, '')
          .replace(/\bBC\b/g, '')
          .replace(/\bBCE\b/g, '')
          .trim();
      }
    }
    const locale = i18n.language || 'en';
    const fmt = new Intl.DateTimeFormat(locale + '-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const formatted = fmt.format(forDate || new Date());
    return formatted
      .replace(/[\u014d\u014c\u00f4\u00d4]/g, 'ū')
      .replace(/Jum[aā]d[aā]\s*(al-)?(ula|ūlā|ōlā|ola|1|i)\b/gi, 'Jumādā I')
      .replace(/Jum[aā]d[aā]\s*(al-)?(akhirah|ākhirah|akhira|thani|thānī|2|ii)\b/gi, 'Jumādā II')
      .replace(/Rab[iī]ʿ?\s*(al-)?(awwal|1|i)\b/gi, 'Rabīʿ I')
      .replace(/Rab[iī]ʿ?\s*(al-)?(thani|thānī|akhir|ākhir|2|ii)\b/gi, 'Rabīʿ II')
      .replace(/\s+(AH|هـ)\.?$/i, '')
      .replace(/\bBC\b/g, '')
      .replace(/\bBCE\b/g, '')
      .trim();
  } catch {
    return '9 Jumādā II 1448';
  }
}

function getGregorianDateString(): string {
  try {
    const locale = i18n.language || 'en';
    return new Date().toLocaleDateString(locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return 'Fri, 20 Nov';
  }
}

function getCurrentTimeString(): string {
  const is24h = get24HourTime();
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: !is24h,
  });
}

function getCurrentLocale(): string {
  const stored = i18n.language || localStorage.getItem('i18nextLng');
  if (stored) return stored.split('-')[0];
  return (typeof navigator !== 'undefined'
    ? (navigator.language || 'en')
    : 'en').split('-')[0];
}

// ─────────────────────────────────────────────────────────
// Single Source of Truth Prayer Payload Builder
// ─────────────────────────────────────────────────────────

export function buildPrayerPayload(
  latitude: number,
  longitude: number,
  locationLabel: string,
): PrayerPayload | null {
  try {
    const now = new Date();
    const is24h = get24HourTime();
    const activeMadhab = getMadhab();
    const methodName = getCalculationMethod();

    // Compute complete schedule snapshot from authoritative engine
    const schedule = computeFullPrayerSchedule(now, latitude, longitude, {
      method: methodName,
      madhab: activeMadhab,
      is24h,
    });

    const isFriday = now.getDay() === 5;
    const fard = schedule.fardPrayers;

    const fajrItem = fard.find((p) => p.id === 'fajr');
    const dhuhrItem = fard.find((p) => p.id === 'dhuhr');
    const asrItem = fard.find((p) => p.id === 'asr');
    const maghribItem = fard.find((p) => p.id === 'maghrib');
    const ishaItem = fard.find((p) => p.id === 'isha');

    const sunriseTime = schedule.sunrise.getTime();
    const sunriseFormatted = schedule.sunriseFormatted;
    const sunsetFormatted = schedule.sunnahTimes.sunsetFormatted;

    const entries: PrayerEntry[] = [
      {
        name: 'Fajr',
        time: fajrItem?.startTime.getTime() || now.getTime(),
        formattedTime: fajrItem?.startTimeFormatted || '--:--',
        endTime: fajrItem?.endTime?.getTime() || sunriseTime,
        formattedEndTime: fajrItem?.endTimeFormatted || sunriseFormatted,
      },
      {
        name: 'Sunrise',
        time: sunriseTime,
        formattedTime: sunriseFormatted,
      },
      {
        name: isFriday ? "Jumu'ah" : 'Dhuhr',
        time: dhuhrItem?.startTime.getTime() || now.getTime(),
        formattedTime: dhuhrItem?.startTimeFormatted || '--:--',
        endTime: dhuhrItem?.endTime?.getTime(),
        formattedEndTime: dhuhrItem?.endTimeFormatted,
      },
      {
        name: 'Asr',
        time: asrItem?.startTime.getTime() || now.getTime(),
        formattedTime: asrItem?.startTimeFormatted || '--:--',
        endTime: asrItem?.endTime?.getTime(),
        formattedEndTime: asrItem?.endTimeFormatted,
      },
      {
        name: 'Maghrib',
        time: maghribItem?.startTime.getTime() || now.getTime(),
        formattedTime: maghribItem?.startTimeFormatted || '--:--',
        endTime: maghribItem?.endTime?.getTime(),
        formattedEndTime: maghribItem?.endTimeFormatted,
      },
      {
        name: 'Isha',
        time: ishaItem?.startTime.getTime() || now.getTime(),
        formattedTime: ishaItem?.startTimeFormatted || '--:--',
        endTime: ishaItem?.endTime?.getTime(),
        formattedEndTime: ishaItem?.endTimeFormatted,
      },
    ];

    // Find next upcoming prayer
    const nowMs = now.getTime();
    let nextPrayerIndex = 0;
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].time > nowMs) {
        nextPrayerIndex = i;
        break;
      }
    }
    // Loop completed without finding a future prayer -> all passed for today
    if (entries[nextPrayerIndex].time <= nowMs) {
      nextPrayerIndex = 0;
      const oneDayMs = 24 * 60 * 60 * 1000;
      for (const entry of entries) {
        entry.time += oneDayMs;
      }
    }

    // Load widget customizer style config
    const styleConfig = loadWidgetStyleConfig();
    const activePreset = ACCENT_PRESETS[styleConfig.accentPreset] || ACCENT_PRESETS.ivory;
    const themeHex = getActiveThemeHex();

        // Real-Time Makruh Windows Evaluation (Single Source of Truth via schedule)
    const makruhState = evaluateMakruhState(
      schedule,
      now,
      is24h ? '24h' : '12h'
    );
    const tuluWin = makruhState.allWindows.find((w) => w.id === 'tulu');
    const zawalWin = makruhState.allWindows.find((w) => w.id === 'zawal');
    const ghurubWin = makruhState.allWindows.find((w) => w.id === 'ghurub');

    const makruhSunriseStartMs = tuluWin?.start.getTime() || sunriseTime;
    const makruhSunriseEndMs = tuluWin?.end.getTime() || (sunriseTime + 20 * 60 * 1000);
    const makruhSunriseEndFormatted = tuluWin?.endFormatted || schedule.sunriseFormatted;

    const makruhZawaalStartMs = zawalWin?.start.getTime() || ((dhuhrItem?.startTime.getTime() || nowMs) - 5 * 60 * 1000);
    const makruhZawaalEndMs = zawalWin?.end.getTime() || (dhuhrItem?.startTime.getTime() || nowMs);
    const makruhZawaalEndFormatted = zawalWin?.endFormatted || dhuhrItem?.startTimeFormatted || '';

    const sunsetTimeMs = schedule.sunnahTimes.sunset.getTime();
    const makruhSunsetStartMs = ghurubWin?.start.getTime() || (sunsetTimeMs - 15 * 60 * 1000);
    const makruhSunsetEndMs = ghurubWin?.end.getTime() || sunsetTimeMs;
    const makruhSunsetEndFormatted = ghurubWin?.endFormatted || sunsetFormatted;

    // Precompute 7-Day Schedule (Today + Next 6 Days) for 100% Autonomous Native Refresh
    const upcomingDays: DayPrayerSchedule[] = [];
    const locale = i18n.language || 'en';

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const dayDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const daySchedule = computeFullPrayerSchedule(dayDate, latitude, longitude, {
        method: methodName,
        madhab: activeMadhab,
        is24h,
      });

      const dayIsFriday = dayDate.getDay() === 5;
      const dayFard = daySchedule.fardPrayers;
      const dayFajr = dayFard.find((p) => p.id === 'fajr');
      const dayDhuhr = dayFard.find((p) => p.id === 'dhuhr');
      const dayAsr = dayFard.find((p) => p.id === 'asr');
      const dayMaghrib = dayFard.find((p) => p.id === 'maghrib');
      const dayIsha = dayFard.find((p) => p.id === 'isha');
      const daySunriseTime = daySchedule.sunrise.getTime();
      const daySunriseFormatted = daySchedule.sunriseFormatted;
      const daySunsetFormatted = daySchedule.sunnahTimes.sunsetFormatted;

      const dayEntries: PrayerEntry[] = [
        {
          name: 'Fajr',
          time: dayFajr?.startTime.getTime() || dayDate.getTime(),
          formattedTime: dayFajr?.startTimeFormatted || '--:--',
          endTime: dayFajr?.endTime?.getTime() || daySunriseTime,
          formattedEndTime: dayFajr?.endTimeFormatted || daySunriseFormatted,
        },
        {
          name: 'Sunrise',
          time: daySunriseTime,
          formattedTime: daySunriseFormatted,
        },
        {
          name: dayIsFriday ? "Jumu'ah" : 'Dhuhr',
          time: dayDhuhr?.startTime.getTime() || dayDate.getTime(),
          formattedTime: dayDhuhr?.startTimeFormatted || '--:--',
          endTime: dayDhuhr?.endTime?.getTime(),
          formattedEndTime: dayDhuhr?.endTimeFormatted,
        },
        {
          name: 'Asr',
          time: dayAsr?.startTime.getTime() || dayDate.getTime(),
          formattedTime: dayAsr?.startTimeFormatted || '--:--',
          endTime: dayAsr?.endTime?.getTime(),
          formattedEndTime: dayAsr?.endTimeFormatted,
        },
        {
          name: 'Maghrib',
          time: dayMaghrib?.startTime.getTime() || dayDate.getTime(),
          formattedTime: dayMaghrib?.startTimeFormatted || '--:--',
          endTime: dayMaghrib?.endTime?.getTime(),
          formattedEndTime: dayMaghrib?.endTimeFormatted,
        },
        {
          name: 'Isha',
          time: dayIsha?.startTime.getTime() || dayDate.getTime(),
          formattedTime: dayIsha?.startTimeFormatted || '--:--',
          endTime: dayIsha?.endTime?.getTime(),
          formattedEndTime: dayIsha?.endTimeFormatted,
        },
      ];

      const dayMakruhState = evaluateMakruhState(
        daySchedule,
        dayDate,
        is24h ? '24h' : '12h'
      );
      const dayTulu = dayMakruhState.allWindows.find((w) => w.id === 'tulu');
      const dayZawal = dayMakruhState.allWindows.find((w) => w.id === 'zawal');
      const dayGhurub = dayMakruhState.allWindows.find((w) => w.id === 'ghurub');

      const daySunsetMs = daySchedule.sunnahTimes.sunset.getTime();

      const year = dayDate.getFullYear();
      const month = String(dayDate.getMonth() + 1).padStart(2, '0');
      const dayNum = String(dayDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${dayNum}`;

      upcomingDays.push({
        dateKey,
        hijriDate: dayOffset === 0 ? getHijriDateString() : getHijriDateString(dayDate),
        gregorianDate: dayDate.toLocaleDateString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        prayers: dayEntries,
        fajrEndFormatted: dayFajr?.endTimeFormatted || daySunriseFormatted,
        dhuhrEndFormatted: dayDhuhr?.endTimeFormatted || dayAsr?.startTimeFormatted,
        asrEndFormatted: dayAsr?.endTimeFormatted || daySunsetFormatted,
        maghribEndFormatted: dayMaghrib?.endTimeFormatted || dayIsha?.startTimeFormatted,
        ishaEndFormatted: dayIsha?.endTimeFormatted,
        makruhSunriseStartMs: dayTulu?.start.getTime() || daySunriseTime,
        makruhSunriseEndMs: dayTulu?.end.getTime() || (daySunriseTime + 20 * 60 * 1000),
        makruhSunriseEndFormatted: dayTulu?.endFormatted || daySunriseFormatted,
        makruhZawaalStartMs: dayZawal?.start.getTime() || ((dayDhuhr?.startTime.getTime() || dayDate.getTime()) - 5 * 60 * 1000),
        makruhZawaalEndMs: dayZawal?.end.getTime() || (dayDhuhr?.startTime.getTime() || dayDate.getTime()),
        makruhZawaalEndFormatted: dayZawal?.endFormatted || dayDhuhr?.startTimeFormatted || '',
        makruhSunsetStartMs: dayGhurub?.start.getTime() || (daySunsetMs - 15 * 60 * 1000),
        makruhSunsetEndMs: dayGhurub?.end.getTime() || daySunsetMs,
        makruhSunsetEndFormatted: dayGhurub?.endFormatted || daySunsetFormatted,
      });
    }

    return {
      prayers: entries,
      nextPrayerIndex,
      hijriDate: getHijriDateString(),
      gregorianDate: getGregorianDateString(),
      locationLabel: locationLabel || 'Vadgām, India',
      madhab: activeMadhab === 'shafi' ? 'SHAFI' : 'HANAFI',
      calculationMethod: methodName,
      currentTime24h: getCurrentTimeString(),
      lastUpdated: nowMs,

      // Qaza End Time boundaries
      fajrEndFormatted: fajrItem?.endTimeFormatted || sunriseFormatted,
      dhuhrEndFormatted: dhuhrItem?.endTimeFormatted || asrItem?.startTimeFormatted,
      asrEndFormatted: asrItem?.endTimeFormatted || sunsetFormatted,
      maghribEndFormatted: maghribItem?.endTimeFormatted || ishaItem?.startTimeFormatted,
      ishaEndFormatted: ishaItem?.endTimeFormatted,
      showQazaEndTime: styleConfig.showQazaEndTime ?? true,

      // Makruh (Prohibited) Windows Sync
      makruhSunriseStartMs,
      makruhSunriseEndMs,
      makruhSunriseEndFormatted,
      makruhZawaalStartMs,
      makruhZawaalEndMs,
      makruhZawaalEndFormatted,
      makruhSunsetStartMs,
      makruhSunsetEndMs,
      makruhSunsetEndFormatted,

      // 7-Day Precomputed Schedule for Autonomous Native Refresh
      upcomingDays,

      // Visual styling sync
      surfaceStyle: styleConfig.surfaceStyle,
      opacity: styleConfig.opacity,
      accentColorHex: activePreset.accentHex,
      bgColorHex: themeHex,
      fontScale: styleConfig.fontScale,
      showCity: styleConfig.showCity,
      showCountdown: styleConfig.showCountdown,
      showStrip: styleConfig.showFullStrip,
    };
  } catch (err) {
    console.warn('[WidgetService] buildPrayerPayload error:', err);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// Daily Content (Ayah & Hadith) Serializer
// ─────────────────────────────────────────────────────────

function getStoredQuranVerse(): AyahContent {
  try {
    const raw = localStorage.getItem('daily-ayah-cache') || localStorage.getItem('enhanced-daily-ayah');
    if (raw) {
      const parsed = JSON.parse(raw);
      const arabic = (parsed.arabic || parsed.text_arabic || parsed.textArabic || '').trim();
      const translation = (parsed.translation || parsed.englishTranslation || parsed.english || '').trim();
      const transliteration = (parsed.translit || parsed.transliteration || '').trim();
      let reference = (parsed.reference || parsed.ref || '').trim();
      if (!reference || reference === '-' || reference === '—') {
        const surah = parsed.surahName || (parsed.surahNumber ? `Surah ${parsed.surahNumber}` : 'Al-Baqarah');
        reference = `${surah} • ${parsed.surahNumber || 2}:${parsed.ayahNumber || 286}`;
      }
      const surahNumber = parsed.surahNumber || parsed.surah_number || 2;
      const ayahNumber = parsed.ayahNumber || parsed.ayah_number || 286;
      if (arabic && translation) {
        return {
          arabic,
          translation,
          transliteration,
          reference,
          surahNumber,
          ayahNumber,
          lastUpdated: parsed.lastUpdated || Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn('[WidgetService] getStoredQuranVerse parse error:', err);
  }

  // Hardcoded authentic fallback — NEVER blank or '-'!
  return {
    arabic: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا • إِنَّ مَعَ الْعُسْرِ يُسْرًا',
    translation: 'For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.',
    transliteration: "Fa inna ma'al 'usri yusra",
    reference: 'Al-Inshirah • 94:5-6',
    surahNumber: 94,
    ayahNumber: 5,
    lastUpdated: Date.now(),
  };
}

function getStoredHadith(): HadithContent {
  try {
    const raw = localStorage.getItem('daily-hadith-cache') || localStorage.getItem('enhanced-daily-hadith');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.arabic || parsed.translation || parsed.englishTranslation || parsed.english) {
        return {
          arabic: parsed.arabic ?? '',
          translation: parsed.englishTranslation || parsed.translation || parsed.english || '',
          narrator: parsed.narrator ?? '',
          source: parsed.source ?? parsed.reference ?? 'Sahih al-Bukhari',
          grade: parsed.grade || 'Sahih',
          collection: parsed.collection ?? 'bukhari',
          bookNumber: Number(parsed.bookNumber ?? 0),
          hadithNumber: Number(parsed.hadithNumber ?? 0),
          lastUpdated: parsed.lastUpdated || Date.now(),
        };
      }
    }
  } catch (err) {
    console.warn('[WidgetService] getStoredHadith parse error:', err);
  }

  const fallback = getDailyHadith();
  return {
    arabic: fallback.arabic,
    translation: fallback.translation,
    narrator: (fallback as any).narrator || '',
    source: fallback.reference || 'Sahih al-Bukhari',
    grade: 'Sahih',
    collection: 'bukhari',
    bookNumber: 1,
    hadithNumber: 1,
    lastUpdated: Date.now(),
  };
}

function buildDailyContentPayload(): DailyContentPayload {
  const ayah = getStoredQuranVerse();
  const hadith = getStoredHadith();
  return { ayah, hadith, locale: getCurrentLocale(), lastUpdated: Date.now() };
}

// ─────────────────────────────────────────────────────────
// Shared Widget Sync Scheduler (Battery-Safe 800ms Coalescing)
// ─────────────────────────────────────────────────────────

export class WidgetSyncScheduler {
  private static instance: WidgetSyncScheduler;
  private timer: NodeJS.Timeout | null = null;
  private pendingUpdateFn: (() => Promise<void>) | null = null;
  private readonly DEBOUNCE_MS = 800;
  private coalescedCallCount = 0;
  private lastExecutedAt = 0;

  static getInstance(): WidgetSyncScheduler {
    if (!WidgetSyncScheduler.instance) {
      WidgetSyncScheduler.instance = new WidgetSyncScheduler();
    }
    return WidgetSyncScheduler.instance;
  }

  schedule(updateFn: () => Promise<void>): void {
    this.coalescedCallCount++;
    this.pendingUpdateFn = updateFn;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(async () => {
      this.timer = null;
      const fn = this.pendingUpdateFn;
      this.pendingUpdateFn = null;
      if (fn) {
        try {
          await fn();
          this.lastExecutedAt = Date.now();
        } catch {
          // Handled silent fallback
        }
      }
    }, this.DEBOUNCE_MS);
  }

  isPending(): boolean {
    return this.timer !== null;
  }

  getStats() {
    return {
      debounceMs: this.DEBOUNCE_MS,
      coalescedCallCount: this.coalescedCallCount,
      lastExecutedAt: this.lastExecutedAt,
      isPending: this.isPending(),
    };
  }
}

export const widgetSyncScheduler = WidgetSyncScheduler.getInstance();

// ─────────────────────────────────────────────────────────
// Public WidgetService API
// ─────────────────────────────────────────────────────────

export class WidgetService {
  /**
   * Battery-safe coalesced widget sync (~800ms debounce).
   * Rapid calls from sliders/pickers are collapsed into a single native bridge update.
   */
  static coalesceSyncWidgets(
    latitude?: number,
    longitude?: number,
    locationName?: string
  ): void {
    widgetSyncScheduler.schedule(async () => {
      if (latitude !== undefined && longitude !== undefined) {
        await WidgetService.updateWidget(latitude, longitude, locationName);
      } else {
        await WidgetService.syncAllWidgets();
      }
    });
  }
  /**
   * Authoritative widget update — pushes single-source-of-truth prayer
   * + daily content to all native widgets.
   */
  static async updateWidget(
    latitude: number,
    longitude: number,
    locationName?: string,
  ): Promise<void> {
    if (!isNativePlatform()) return;
    try {
      const locationLabel = locationName || 'Vadgām, India';

      // 1. Push prayer data snapshot
      const prayerPayload = buildPrayerPayload(latitude, longitude, locationLabel);
      if (prayerPayload) {
        await syncPrayerData(prayerPayload);
      }

      // 2. Push daily content (ayah + hadith)
      const dailyPayload = buildDailyContentPayload();
      if (dailyPayload) {
        await syncDailyContent(dailyPayload);
      }
    } catch (err) {
      console.warn('[WidgetService] updateWidget error:', err);
    }
  }

  /**
   * Sync all widgets immediately from stored location and preferences.
   */
  static async syncAllWidgets(): Promise<void> {
    try {
      const storedLoc = localStorage.getItem('user_location');
      let lat = 24.034072;
      let lon = 72.401621;
      let name = 'Vadgām, India';
      if (storedLoc) {
        const p = JSON.parse(storedLoc);
        if (p.latitude && p.longitude) {
          lat = p.latitude;
          lon = p.longitude;
          name = p.locationName || name;
        }
      }
      await WidgetService.updateWidget(lat, lon, name);
    } catch (err) {
      console.warn('[WidgetService] syncAllWidgets error:', err);
    }
  }

  /**
   * Start 30-minute auto-update background interval.
   */
  static startAutoUpdate(
    latitude: number,
    longitude: number,
    locationName?: string,
  ): ReturnType<typeof setInterval> {
    WidgetService.updateWidget(latitude, longitude, locationName).catch(() => {});
    return setInterval(
      () => WidgetService.updateWidget(latitude, longitude, locationName).catch(() => {}),
      30 * 60 * 1000,
    );
  }
}
