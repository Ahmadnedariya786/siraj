
/**
 * Islamic Calendar Hook (Maghrib-aware)
 * 
 * Islamic dates change at Maghrib (sunset), NOT at midnight.
 * This hook uses the Aladhan monthly calendar data, which contains both
 * Maghrib times and Hijri dates, to determine the correct Islamic date:
 * 
 * - Before Maghrib: show TODAY's Hijri date from the API
 * - After Maghrib: show TOMORROW's Hijri date from the API
 *   (because the new Islamic day begins at Maghrib)
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AladhanAPI, AladhanDayData } from '@/lib/aladhan-api';
import { useLocationState } from '@/lib/location-state';
import { globalTimerManager } from '@/lib/timer-manager';
import { islamicCalendarService } from '@/lib/islamic-calendar-service';
import {
  CANONICAL_HIJRI_MONTHS,
  HIJRI_WEEKDAYS,
  convertGregorianToHijri,
  getStoredHijriOffset,
  normalizeHijriMonth,
} from '@/lib/hijri-date';

export interface UseIslamicCalendarReturn {
  islamicInfo: {
    currentDate: {
      hijri: {
        day: string;
        month: { number: number; en: string; ar: string };
        year: string;
        weekday: { en: string; ar: string };
        holidays: string[];
      };
    };
    isRamadan: boolean;
    ramadanDay: number;
    daysUntilRamadan: number;
    isEidAlFitr: boolean;
    isEidAlAdha: boolean;
    hijriMonth: number;
    hijriDay: number;
    hijriYear: number;
  } | null;
  isLoading: boolean;
  error: string | null;
  isRamadan: boolean;
  ramadanDay: number;
  daysUntilRamadan: number;
  isEidAlFitr: boolean;
  isEidAlAdha: boolean;
  hijriDate: string;
  refresh: () => Promise<void>;
}


export function useIslamicCalendar(): UseIslamicCalendarReturn {
  const location = useLocationState();
  const [hijriDay, setHijriDay] = useState('');
  const [hijriMonthNum, setHijriMonthNum] = useState(0);
  const [hijriMonthEn, setHijriMonthEn] = useState('');
  const [hijriMonthAr, setHijriMonthAr] = useState('');
  const [hijriYear, setHijriYear] = useState('');
  const [hijriWeekday, setHijriWeekday] = useState({ en: '', ar: '' });
  const [hijriHolidays, setHijriHolidays] = useState<string[]>([]);
  const [daysUntilRamadan, setDaysUntilRamadan] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastUpdateKey = useRef<string>('');

  const computeIslamicDate = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const now = new Date();
      const today = now;
      const offset = getStoredHijriOffset();
      const unified = convertGregorianToHijri(today, offset);

      let holidays: string[] = [];
      if (location.latitude && location.longitude) {
        const effectiveDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 12, 0, 0);
        let offsetData: AladhanDayData | null = AladhanAPI.getPrayerTimesForDate(
          effectiveDate,
          location.latitude,
          location.longitude
        );

        if (!offsetData) {
          try {
            await AladhanAPI.fetchMonthlyCalendar(
              location.latitude,
              location.longitude,
              effectiveDate.getFullYear(),
              effectiveDate.getMonth() + 1,
              1
            );
            offsetData = AladhanAPI.getPrayerTimesForDate(
              effectiveDate,
              location.latitude,
              location.longitude
            );
          } catch (fetchErr) {
            console.warn('[useIslamicCalendar] Failed to fetch monthly data:', fetchErr);
          }
        }

        if (offsetData?.date?.hijri?.holidays) {
          holidays = offsetData.date.hijri.holidays;
        }
      }

      if (unified) {
        const monthInfo = CANONICAL_HIJRI_MONTHS[unified.hijriMonthNumber - 1] || CANONICAL_HIJRI_MONTHS[0];
        setHijriDay(String(unified.hijriDay));
        setHijriMonthNum(unified.hijriMonthNumber);
        setHijriMonthEn(normalizeHijriMonth(monthInfo.en, unified.hijriMonthNumber));
        setHijriMonthAr(monthInfo.ar);
        setHijriYear(String(unified.hijriYear));
        setHijriWeekday(HIJRI_WEEKDAYS[today.getDay()]);
        setHijriHolidays(holidays);
      } else {
        const info = await islamicCalendarService.getIslamicCalendarInfo(now);
        const h = info.currentDate.hijri;
        setHijriDay(h.day);
        setHijriMonthNum(h.month.number);
        setHijriMonthEn(normalizeHijriMonth(h.month.en, h.month.number));
        setHijriMonthAr(h.month.ar || '');
        setHijriYear(h.year);
        setHijriWeekday(h.weekday);
        setHijriHolidays(h.holidays || []);
      }
    } catch (err) {
      console.error('[useIslamicCalendar] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load Islamic calendar');
    } finally {
      setIsLoading(false);
    }
  }, [location.latitude, location.longitude]);

  // Initial computation + recompute when location changes
  useEffect(() => {
    computeIslamicDate();
  }, [computeIslamicDate]);

  // Compute daysUntilRamadan whenever Hijri data changes
  useEffect(() => {
    if (hijriMonthNum) {
      const day = parseInt(hijriDay) || 0;
      const year = parseInt(hijriYear) || 0;
      setDaysUntilRamadan(islamicCalendarService.calculateDaysUntilRamadanFromHijri(hijriMonthNum, day, year));
    }
  }, [hijriMonthNum, hijriDay, hijriYear]);

  // Listen for manual Hijri offset changes
  useEffect(() => {
    const handleOffsetChange = () => computeIslamicDate();
    window.addEventListener('hijri-date-offset-changed', handleOffsetChange);
    return () => window.removeEventListener('hijri-date-offset-changed', handleOffsetChange);
  }, [computeIslamicDate]);

  // Refresh if the Gregorian date rolls over while the app stays open.
  useEffect(() => {
    lastUpdateKey.current = `${new Date().getFullYear()}-${new Date().getMonth()}-${new Date().getDate()}`;
    const timerId = globalTimerManager.addCallback(() => {
      const now = new Date();
      const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
      if (key !== lastUpdateKey.current) {
        lastUpdateKey.current = key;
        computeIslamicDate();
      }
    }, 60000, 'islamic-calendar');

    return () => globalTimerManager.removeCallback(timerId);
  }, [computeIslamicDate]);

  // Derived values
  const hijriMonthNumber = hijriMonthNum;
  const hijriDayNumber = parseInt(hijriDay) || 0;

  const isRamadan = hijriMonthNumber === 9;
  const ramadanDay = isRamadan ? hijriDayNumber : 0;
  const isEidAlFitr = hijriMonthNumber === 10 && (hijriDayNumber >= 1 && hijriDayNumber <= 3);
  const isEidAlAdha = hijriMonthNumber === 12 && (hijriDayNumber >= 10 && hijriDayNumber <= 13);

  const hijriDate = hijriDay
    ? `${hijriDay} ${hijriMonthEn} ${hijriYear}`
        .replace(/[\u014d\u014c\u00f4\u00d4]/g, 'ū')
        .replace(/al-ola/gi, 'al-ūlā')
        .replace(/al-ōlā/gi, 'al-ūlā')
        .replace(/ō/g, 'ū')
    : '';

  const islamicInfo = useMemo(() => {
    if (!hijriDay) return null;
    return {
      currentDate: {
        hijri: {
          day: hijriDay,
          month: { number: hijriMonthNumber, en: hijriMonthEn, ar: hijriMonthAr },
          year: hijriYear,
          weekday: hijriWeekday,
          holidays: hijriHolidays,
        },
      },
      isRamadan,
      ramadanDay,
      daysUntilRamadan,
      isEidAlFitr,
      isEidAlAdha,
      hijriMonth: hijriMonthNumber,
      hijriDay: hijriDayNumber,
      hijriYear: parseInt(hijriYear) || 0,
    };
  }, [
    hijriDay,
    hijriMonthNumber,
    hijriMonthEn,
    hijriMonthAr,
    hijriYear,
    hijriWeekday,
    hijriHolidays,
    isRamadan,
    ramadanDay,
    daysUntilRamadan,
    isEidAlFitr,
    isEidAlAdha,
    hijriDayNumber,
  ]);

  return useMemo(() => ({
    islamicInfo,
    isLoading,
    error,
    isRamadan,
    ramadanDay,
    daysUntilRamadan,
    isEidAlFitr,
    isEidAlAdha,
    hijriDate,
    refresh: computeIslamicDate,
  }), [islamicInfo, isLoading, error, isRamadan, ramadanDay, daysUntilRamadan, isEidAlFitr, isEidAlAdha, hijriDate, computeIslamicDate]);
}
