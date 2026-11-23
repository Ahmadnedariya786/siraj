/**
 * Real-Time Makruh (Prohibited) Prayer Time Engine
 * Siraj - Privacy-First Islamic Companion
 *
 * Calculates the three authentic Islamic Makruh Tahrimi windows based on Sahih Muslim 831:
 *  1. Sunrise (Tulu' al-Shams): [Sunrise, Sunrise + 15 min) -> relatedRow: 'Sunrise'
 *  2. Midday / Zawal (Istiwa / Nisf al-Nahar): [Dhuhr - 10 min, Dhuhr) -> relatedRow: 'Dhuhr'
 *  3. Sunset (Ghurub al-Shams): [Maghrib - 15 min, Maghrib) -> relatedRow: 'Maghrib'
 *
 * During these 3 specific windows, Fard/Nafl Salah and Sajdah at-Tilawat are strictly
 * prohibited (Makruh Tahrimi). The alert activates in real time with high-visibility red
 * blinking indicators and instantly auto-dismisses the exact second the window terminates.
 */

import { computeMakruhWindows } from './prayer-times';

export type MakruhWindowId = 'tulu' | 'zawal' | 'ghurub';
export type MakruhRelatedRow = 'Sunrise' | 'Dhuhr' | 'Maghrib';

export interface MakruhWindowInfo {
  id: MakruhWindowId;
  title: string;
  titleUrdu: string;
  arabicTitle: string;
  shortLabel: string;
  hadithRef: string;
  ruling: string;
  rulingUrdu: string;
  start: Date;
  end: Date;
  startSecondsOfDay: number;
  endSecondsOfDay: number;
  startFormatted: string;
  endFormatted: string;
  relatedRow: MakruhRelatedRow;
}

export interface MakruhState {
  isMakruhNow: boolean;
  activeWindow: MakruhWindowInfo | null;
  remainingSeconds: number;
  remainingFormatted: string;
  allWindows: MakruhWindowInfo[];
}

export type MakruhPrayerInput =
  | ({ Sunrise?: string | Date; Dhuhr?: string | Date; Maghrib?: string | Date } & Record<string, unknown>)
  | Array<{ name?: string; originalName?: string; time?: string; date?: Date }>;

/**
 * Bulletproof time-to-seconds-of-day parser.
 * Handles Date objects, 12-hour AM/PM strings ("06:49 AM", "12:30 PM"),
 * 24-hour strings ("06:49", "18:30"), and strings with timezone annotations ("06:49 (PKT)").
 */
export function parseTimeToSeconds(input?: string | Date | null): number | null {
  if (!input) return null;

  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return input.getHours() * 3600 + input.getMinutes() * 60 + input.getSeconds();
  }

  if (typeof input !== 'string') return null;

  // Clean string: remove parens like (PKT), trim whitespace
  const cleaned = input.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (!cleaned) return null;

  const ampmMatch = cleaned.match(/(AM|PM)/i);
  const is12Hour = Boolean(ampmMatch);
  const isPM = is12Hour && ampmMatch![1].toUpperCase() === 'PM';
  const isAM = is12Hour && ampmMatch![1].toUpperCase() === 'AM';

  const numericPart = cleaned.replace(/[^\d:]/g, '');
  const parts = numericPart.split(':').map((p) => parseInt(p, 10));
  if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;

  let hours = parts[0];
  const minutes = parts[1];
  const seconds = parts[2] || 0;

  if (is12Hour) {
    if (isPM && hours < 12) hours += 12;
    if (isAM && hours === 12) hours = 0;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats seconds of day into 12-hour or 24-hour time strings.
 */
export function formatSecondsToTime(seconds: number, format: '12h' | '24h' = '12h'): string {
  const normSec = ((seconds % 86400) + 86400) % 86400;
  const hours = Math.floor(normSec / 3600);
  const minutes = Math.floor((normSec % 3600) / 60);

  if (format === '24h') {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  const h12 = hours % 12 || 12;
  const ampm = hours >= 12 ? 'PM' : 'AM';
  return `${h12.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Formats countdown remaining into "Xm Ys" (e.g. "12m 45s" or "0m 30s").
 */
export function formatCountdownRemaining(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m 00s';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Formats countdown remaining into "MM:SS" (e.g. "12:45").
 */
export function formatCountdownMmSs(totalSeconds: number): string {
  if (totalSeconds <= 0) return '00:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function createDateFromSeconds(baseDate: Date, seconds: number): Date {
  const normSec = ((seconds % 86400) + 86400) % 86400;
  const d = new Date(baseDate.getTime());
  const hours = Math.floor(normSec / 3600);
  const minutes = Math.floor((normSec % 3600) / 60);
  const secs = normSec % 60;
  d.setHours(hours, minutes, secs, 0);
  return d;
}

/**
 * Core Real-Time Evaluator for Makruh Prayer Windows.
 * Consumes the single source of truth pure function `computeMakruhWindows`.
 *
 * @param prayerInput - Daily timings object, FullPrayerSchedule, or PrayerItem array
 * @param nowDate - Current time (defaults to new Date())
 * @param timeFormat - '12h' or '24h' for label formatting
 * @returns MakruhState containing real-time status, active window, and formatted countdown
 */
export function evaluateMakruhState(
  prayerInput: MakruhPrayerInput,
  nowDate: Date = new Date(),
  timeFormat: '12h' | '24h' = '12h'
): MakruhState {
  if (!prayerInput) {
    return {
      isMakruhNow: false,
      activeWindow: null,
      remainingSeconds: 0,
      remainingFormatted: '',
      allWindows: [],
    };
  }

  const is24h = timeFormat === '24h';
  const computed = computeMakruhWindows(prayerInput, {
    is24h,
    baseDate: nowDate,
  });

  if (!computed.windowsList || computed.windowsList.length === 0) {
    return {
      isMakruhNow: false,
      activeWindow: null,
      remainingSeconds: 0,
      remainingFormatted: '',
      allWindows: [],
    };
  }

  const windows: MakruhWindowInfo[] = computed.windowsList.map((w) => ({
    id: w.tuluId,
    title: w.title,
    titleUrdu: w.titleUrdu,
    arabicTitle: w.arabicTitle,
    shortLabel: w.shortLabel,
    hadithRef: w.hadithRef,
    ruling: w.ruling,
    rulingUrdu: w.rulingUrdu,
    start: w.start,
    end: w.end,
    startSecondsOfDay: w.startSecondsOfDay,
    endSecondsOfDay: w.endSecondsOfDay,
    startFormatted: w.startFormatted,
    endFormatted: w.endFormatted,
    relatedRow: w.relatedRow,
  }));

  const nowSec = nowDate.getHours() * 3600 + nowDate.getMinutes() * 60 + nowDate.getSeconds();

  let activeWindow: MakruhWindowInfo | null = null;
  for (const win of windows) {
    if (nowSec >= win.startSecondsOfDay && nowSec < win.endSecondsOfDay) {
      activeWindow = win;
      break;
    }
  }

  const isMakruhNow = Boolean(activeWindow);
  const remainingSeconds = activeWindow ? Math.max(0, activeWindow.endSecondsOfDay - nowSec) : 0;
  const remainingFormatted = formatCountdownRemaining(remainingSeconds);

  return {
    isMakruhNow,
    activeWindow,
    remainingSeconds,
    remainingFormatted,
    allWindows: windows,
  };
}
