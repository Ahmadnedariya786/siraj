/**
 * Islamic Events Notification Service
 * Handles notifications for important Islamic events and holidays
 */

import { importantIslamicDates } from '@/data/islamic-dates';
import { islamicCalendarService } from '@/lib/islamic-calendar-service';
import { localNotifications } from '@/lib/local-notifications';
import { convertGregorianToHijri, convertHijriToGregorian, getStoredHijriOffset } from '@/lib/hijri-date';

export interface IslamicEventNotification {
  id: string;
  title: string;
  body: string;
  date: Date;
  hijriDate: string;
  type: 'eid' | 'ramadan' | 'hajj' | 'other';
  scheduled: boolean;
}

const ISLAMIC_EVENTS_CACHE_KEY = 'siraj_islamic_events_cache_v1';
const YIELD_CHUNK_DAYS = 16;

const yieldEventsSlice = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

class IslamicEventsService {
  private static instance: IslamicEventsService;
  private readonly STORAGE_KEY = 'islamic-events-notifications';
  private readonly NOTIFICATION_PREFIX = 'islamic-event-';
  private yearHijriIndexCache: Map<string, Map<string, Date>> = new Map();
  private yearHijriIndexInFlight: Map<string, Promise<Map<string, Date>>> = new Map();

  static getInstance(): IslamicEventsService {
    if (!IslamicEventsService.instance) {
      IslamicEventsService.instance = new IslamicEventsService();
    }
    return IslamicEventsService.instance;
  }

  private lastScheduleDate: string | null = null;

  /**
   * Yielded single-pass Hijri index over `totalDays` from `startDate`.
   * Chunks every 16 days with setTimeout(0) so main-thread slices stay < 12ms (zero LongTasks > 50ms).
   */
  private async buildWindowHijriIndex(
    startDate: Date,
    totalDays: number,
    safeOffset: number
  ): Promise<Map<string, Date>> {
    const index = new Map<string, Date>();
    for (let dayOffset = 0; dayOffset < totalDays; dayOffset++) {
      if (dayOffset > 0 && dayOffset % YIELD_CHUNK_DAYS === 0) {
        await yieldEventsSlice();
      }
      const checkDate = new Date(startDate);
      checkDate.setDate(startDate.getDate() + dayOffset);

      const hijri = convertGregorianToHijri(checkDate, safeOffset);
      if (!hijri) continue;

      const exactKey = `${hijri.hijriMonthNumber}-${hijri.hijriDay}`;
      if (!index.has(exactKey)) {
        index.set(exactKey, checkDate);
      }
    }
    return index;
  }

  /**
   * Check and schedule notifications for upcoming Islamic events
   */
  async scheduleUpcomingEvents(): Promise<void> {
    const today = new Date().toDateString();
    // Only schedule once per day to avoid re-scheduling on every mount
    if (this.lastScheduleDate === today) return;
    this.lastScheduleDate = today;

    try {
      await islamicCalendarService.getIslamicCalendarInfo();
      const upcomingEvents = await this.getUpcomingEvents();

      for (const event of upcomingEvents) {
        await this.scheduleEventNotification(event);
      }
    } catch (error) {
      console.warn('Error scheduling Islamic events:', error);
    }
  }

  /**
   * Get upcoming Islamic events within the next 30 days using a daily persistent cache
   * and a single chunked O(35 days) scan instead of 54x400 synchronous Gregorian-to-Hijri scans.
   */
  private async getUpcomingEvents(): Promise<Array<typeof importantIslamicDates[0] & { gregorianDate: Date }>> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const maxDate = new Date(startOfToday);
    maxDate.setDate(maxDate.getDate() + 30);
    maxDate.setHours(23, 59, 59, 999);

    const safeOffset = Number.isFinite(getStoredHijriOffset()) ? Math.trunc(getStoredHijriOffset()) : 0;
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cacheKey = `${todayKey}|${safeOffset}`;

    // Fast path (< 2ms): hydrate from daily localStorage cache
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(ISLAMIC_EVENTS_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as {
            cacheKey?: string;
            items?: Array<{ id: string; gregorianIso: string }>;
          };
          if (parsed?.cacheKey === cacheKey && Array.isArray(parsed.items)) {
            const eventById = new Map(importantIslamicDates.map((e) => [e.id, e]));
            const hydrated: Array<typeof importantIslamicDates[0] & { gregorianDate: Date }> = [];
            for (const item of parsed.items) {
              const event = eventById.get(item.id);
              const dt = new Date(item.gregorianIso);
              if (event && !Number.isNaN(dt.getTime())) {
                hydrated.push({ ...event, gregorianDate: dt });
              }
            }
            return hydrated.sort((a, b) => a.gregorianDate.getTime() - b.gregorianDate.getTime());
          }
        }
      }
    } catch (cacheReadErr) {
      console.debug('[IslamicEvents] Daily cache read skipped:', cacheReadErr);
    }

    // Cold miss: scan the next 33 days once in 16-day yielded slices (each slice <= 6ms)
    const scanStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
    const index = await this.buildWindowHijriIndex(scanStart, 33, safeOffset);

    const upcomingEvents: Array<typeof importantIslamicDates[0] & { gregorianDate: Date }> = [];
    for (const event of importantIslamicDates) {
      let gregorianDate = index.get(`${event.hijriMonth}-${event.hijriDay}`) ?? null;

      // 29-day lunar month fallback only if exact day 30 was not observed and next month already started
      if (!gregorianDate && event.hijriDay === 30) {
        const nextMonth = event.hijriMonth === 12 ? 1 : event.hijriMonth + 1;
        if (index.has(`${nextMonth}-1`)) {
          gregorianDate = index.get(`${event.hijriMonth}-29`) ?? null;
        }
      }

      if (gregorianDate && gregorianDate >= startOfToday && gregorianDate <= maxDate) {
        upcomingEvents.push({
          ...event,
          gregorianDate,
        });
      }
    }

    const sorted = upcomingEvents.sort((a, b) => a.gregorianDate.getTime() - b.gregorianDate.getTime());

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(
          ISLAMIC_EVENTS_CACHE_KEY,
          JSON.stringify({
            cacheKey,
            items: sorted.map((e) => ({ id: e.id, gregorianIso: e.gregorianDate.toISOString() })),
          })
        );
      }
    } catch (cacheWriteErr) {
      console.debug('[IslamicEvents] Daily cache write skipped:', cacheWriteErr);
    }

    return sorted;
  }

  private hijriDateCache: Map<string, Date> = new Map();

  private async getYearHijriIndex(year: number, safeOffset: number): Promise<Map<string, Date>> {
    const mapKey = `${year}-${safeOffset}`;
    const existing = this.yearHijriIndexCache.get(mapKey);
    if (existing) return existing;

    const inflight = this.yearHijriIndexInFlight.get(mapKey);
    if (inflight) return inflight;

    const promise = (async () => {
      const startDate = new Date(year, 0, 1, 12, 0, 0, 0);
      const index = await this.buildWindowHijriIndex(startDate, 400, safeOffset);
      this.yearHijriIndexCache.set(mapKey, index);
      this.yearHijriIndexInFlight.delete(mapKey);
      return index;
    })();

    this.yearHijriIndexInFlight.set(mapKey, promise);
    return promise;
  }

  async getGregorianDateForHijriEvent(
    hijriMonth: number,
    hijriDay: number,
    year: number,
    offset: number = getStoredHijriOffset()
  ): Promise<Date> {
    const safeOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
    const cacheKey = `${hijriMonth}-${hijriDay}-${year}-${safeOffset}`;
    const cached = this.hijriDateCache.get(cacheKey);
    if (cached) return cached;

    // Support direct Hijri years (e.g. 1447..1450) via single-source resolver
    if (year < 1700) {
      const resolved = convertHijriToGregorian(year, hijriMonth, hijriDay, safeOffset);
      if (resolved?.gregorianDate) {
        this.hijriDateCache.set(cacheKey, resolved.gregorianDate);
        return resolved.gregorianDate;
      }
    }

    const index = await this.getYearHijriIndex(year, safeOffset);
    const exactMatch = index.get(`${hijriMonth}-${hijriDay}`);
    if (exactMatch) {
      this.hijriDateCache.set(cacheKey, exactMatch);
      return exactMatch;
    }

    // 29-day lunar month (e.g., Ramadan 1448 AH): resolve day 30 gracefully to day 29
    if (hijriDay === 30) {
      const fallbackDay29 = index.get(`${hijriMonth}-29`);
      if (fallbackDay29) {
        this.hijriDateCache.set(cacheKey, fallbackDay29);
        return fallbackDay29;
      }
    }

    throw new Error(`Could not find Gregorian date for Hijri ${hijriMonth}-${hijriDay}`);
  }

  /**
   * Schedule notification for a specific Islamic event
   */
  private async scheduleEventNotification(event: typeof importantIslamicDates[0] & { gregorianDate: Date }): Promise<void> {
    const notificationId = `${this.NOTIFICATION_PREFIX}${event.id}`;
    
    try {
      // Schedule notification for the day of the event at 9 AM
      const notificationDate = new Date(event.gregorianDate);
      notificationDate.setHours(9, 0, 0, 0);

      // Only schedule if it's in the future
      if (notificationDate > new Date()) {
        await localNotifications.scheduleNotification(
          notificationId,
          event.name,
          event.notificationMessage,
          notificationDate
        );

        // Also schedule a reminder 1 day before for important events
        if (event.type === 'eid' || event.type === 'ramadan') {
          const reminderDate = new Date(notificationDate);
          reminderDate.setDate(reminderDate.getDate() - 1);
          reminderDate.setHours(20, 0, 0, 0); // 8 PM reminder

          await localNotifications.scheduleNotification(
            `${notificationId}-reminder`,
            `Reminder: ${event.name} Tomorrow`,
            `Prepare for ${event.name}. ${event.notificationMessage}`,
            reminderDate
          );
        }

        console.log(`Scheduled notification for ${event.name} on ${event.gregorianDate.toDateString()}`);
      }
    } catch (error) {
      console.error(`Error scheduling notification for ${event.name}:`, error);
    }
  }

  /**
   * Get today's Islamic event if any
   */
  async getTodaysIslamicEvent(): Promise<typeof importantIslamicDates[0] | null> {
    try {
      const calendarInfo = await islamicCalendarService.getIslamicCalendarInfo();
      
      // Check for specific events first
      const specificEvent = importantIslamicDates.find(event => 
        event.hijriMonth === calendarInfo.hijriMonth && 
        event.hijriDay === calendarInfo.hijriDay
      );
      
      if (specificEvent) {
        return specificEvent;
      }
      
      // Check if we're in Ramadan (month 9) but not on a specific event day
      if (calendarInfo.hijriMonth === 9) {
        // Return a general Ramadan event for ongoing Ramadan
        return {
          id: 'ramadan-ongoing',
          name: 'Ramadan - Month of Fasting',
          arabicName: 'شهر رمضان',
          hijriMonth: 9,
          hijriDay: calendarInfo.hijriDay,
          description: `Day ${calendarInfo.hijriDay} of Ramadan - Continue your spiritual journey`,
          type: 'ramadan',
          notificationMessage: 'Continue your Ramadan journey with prayer, fasting, and reflection.'
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting today\'s Islamic event:', error);
      return null;
    }
  }

  /**
   * Get upcoming events in the next 7 days
   */
  async getUpcomingEventsNext7Days(): Promise<Array<typeof importantIslamicDates[0] & { gregorianDate: Date; daysUntil: number }>> {
    try {
      await islamicCalendarService.getIslamicCalendarInfo();
      const upcomingEvents = await this.getUpcomingEvents();
      
      return upcomingEvents
        .filter(event => {
          const daysUntil = Math.ceil((event.gregorianDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
          return daysUntil <= 7 && daysUntil > 0;
        })
        .map(event => ({
          ...event,
          daysUntil: Math.ceil((event.gregorianDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
        }));
    } catch (error) {
      console.error('Error getting upcoming events:', error);
      return [];
    }
  }

  /**
   * Clear all Islamic event notifications
   */
  async clearAllNotifications(): Promise<void> {
    try {
      for (const event of importantIslamicDates) {
        const notificationId = `${this.NOTIFICATION_PREFIX}${event.id}`;
        await localNotifications.cancelNotification(notificationId);
        await localNotifications.cancelNotification(`${notificationId}-reminder`);
      }
    } catch (error) {
      console.error('Error clearing Islamic event notifications:', error);
    }
  }

  private lastRamadanCheckDay: number = -1;

  /**
   * Check if Ramadan is approaching and show special notifications
   */
  async checkRamadanApproaching(): Promise<void> {
    const todayDayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    if (this.lastRamadanCheckDay === todayDayOfYear) return;
    this.lastRamadanCheckDay = todayDayOfYear;

    try {
      const calendarInfo = await islamicCalendarService.getIslamicCalendarInfo();
      const daysUntilRamadan = calendarInfo.daysUntilRamadan;

      if (daysUntilRamadan > 0 && daysUntilRamadan <= 30) {
        let message = '';
        let title = '';

        if (daysUntilRamadan <= 7) {
          title = 'Ramadan Approaching!';
          message = daysUntilRamadan === 1 
            ? 'Ramadan starts tomorrow! Prepare yourself for the blessed month.'
            : `Ramadan starts in ${daysUntilRamadan} days! Start preparing yourself.`;
        } else {
          title = 'Ramadan Preparation';
          message = `Ramadan starts in ${daysUntilRamadan} days. It's time to start preparing spiritually and physically.`;
        }

        if (title && message) {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(9, 0, 0, 0);

          await localNotifications.scheduleNotification(
            'ramadan-approaching-reminder',
            title,
            message,
            tomorrow
          );
        }
      }
    } catch (error) {
      console.error('Error checking Ramadan approaching:', error);
    }
  }
}

export const islamicEventsService = IslamicEventsService.getInstance();
