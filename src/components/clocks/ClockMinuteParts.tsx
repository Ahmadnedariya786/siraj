import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { getPrayerDisplayName } from '@/lib/prayer-utils';
import { getLocalizedPrayerName, formatLocalizedCountdown } from '@/lib/home-prayer-i18n';
import { cn } from '@/lib/utils';

function getMinuteBucket(ms: number): number {
  return Math.floor(ms / 60000) * 60000;
}

/**
 * Minute-resolution timestamp hook: aligns a single timeout to the next exact minute boundary,
 * pauses cleanly when document.hidden, and triggers ZERO per-second React re-renders.
 */
export function useClockMinuteTick(isStaticPreview = false, externalNow?: Date): number {
  const [minuteTs, setMinuteTs] = useState<number>(() =>
    getMinuteBucket(externalNow ? externalNow.getTime() : Date.now())
  );

  useEffect(() => {
    if (isStaticPreview) return;
    if (externalNow) {
      setMinuteTs(getMinuteBucket(externalNow.getTime()));
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const scheduleNext = () => {
      if (isCancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const nowMs = Date.now();
      setMinuteTs(getMinuteBucket(nowMs));
      const delay = Math.max(250, 60000 - (nowMs % 60000) + 50);
      timerId = setTimeout(scheduleNext, delay);
    };

    const stopTimer = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopTimer();
      } else {
        stopTimer();
        scheduleNext();
      }
    };

    scheduleNext();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    let appStateHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          stopTimer();
          scheduleNext();
        } else {
          stopTimer();
        }
      })
        .then((handle) => {
          appStateHandle = handle;
        })
        .catch((err) => {
          console.debug('[ClockMinuteTick] appStateChange listener skipped:', err);
        });
    }

    return () => {
      isCancelled = true;
      stopTimer();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
      if (appStateHandle) {
        try {
          appStateHandle.remove();
        } catch (err) {
          console.debug('[ClockMinuteTick] appStateChange cleanup skipped:', err);
        }
      }
    };
  }, [isStaticPreview, externalNow]);

  return externalNow ? getMinuteBucket(externalNow.getTime()) : minuteTs;
}

/**
 * Direct DOM ref hook for digital second readouts (:02 / 02).
 * Updates textContent directly at each second boundary without triggering React re-renders.
 */
export function useDirectSecondTextRef(
  isStaticPreview = false,
  externalNow?: Date,
  prefix = ''
): { secondRef: React.RefObject<HTMLSpanElement>; initialText: string } {
  const secondRef = useRef<HTMLSpanElement>(null);
  const initialDate = externalNow || new Date();
  const initialText = `${prefix}${String(initialDate.getSeconds()).padStart(2, '0')}`;

  useEffect(() => {
    const updateDom = (sec: number) => {
      if (secondRef.current) {
        secondRef.current.textContent = `${prefix}${String(sec).padStart(2, '0')}`;
      }
    };

    if (isStaticPreview || externalNow) {
      updateDom((externalNow || new Date()).getSeconds());
      return;
    }

    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const tick = () => {
      if (isCancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      const nowMs = Date.now();
      updateDom(new Date(nowMs).getSeconds());
      const delay = Math.max(50, 1000 - (nowMs % 1000) + 10);
      timerId = setTimeout(tick, delay);
    };

    const stop = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        timerId = null;
      }
    };

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stop();
      } else {
        stop();
        tick();
      }
    };

    tick();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      isCancelled = true;
      stop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [isStaticPreview, externalNow, prefix]);

  return { secondRef, initialText };
}

interface PrayerArcCountdownPillProps {
  nextPrayerName: string;
  targetTime?: Date | null;
  isStaticPreview: boolean;
  externalNow?: Date;
}

/**
 * Isolated minute-level memoized countdown pill for PrayerArcClock (`In 1h 15m`).
 */
export const PrayerArcCountdownPill = memo(function PrayerArcCountdownPill({
  nextPrayerName,
  targetTime,
  isStaticPreview,
  externalNow,
}: PrayerArcCountdownPillProps) {
  const minuteTimestamp = useClockMinuteTick(isStaticPreview, externalNow);

  const countdownText = useMemo(() => {
    if (isStaticPreview) return 'In 1h 45m';
    if (!targetTime) return 'Approaching';
    const diff = targetTime.getTime() - minuteTimestamp;
    if (diff <= 0) return 'Due now';
    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return h > 0 ? `In ${h}h ${m}m` : `In ${m}m`;
  }, [minuteTimestamp, targetTime, isStaticPreview]);

  const prayerDisplayName = useMemo(() => {
    return getPrayerDisplayName(nextPrayerName, targetTime || new Date(minuteTimestamp)) || 'Next';
  }, [nextPrayerName, targetTime, minuteTimestamp]);

  return (
    <div
      className="inline-flex items-center justify-center font-semibold shrink-0 select-none border"
      style={{
        gap: isStaticPreview ? '4px' : '6px',
        padding: isStaticPreview ? '2px 8px' : '3px 12px',
        borderRadius: '999px',
        background: 'var(--surface-2)',
        borderColor: 'var(--border)',
        color: 'var(--accent-text)',
        fontSize: isStaticPreview ? '0.62rem' : '0.76rem',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      }}
    >
      <span
        className="rounded-full inline-block shrink-0"
        style={{
          width: '6px',
          height: '6px',
          background: 'var(--accent)',
        }}
      />
      <span className="font-bold tracking-wider">{prayerDisplayName.toUpperCase()}</span>
      {countdownText && (
        <span className="font-mono text-[var(--text-secondary)] font-normal ml-0.5">
          • {countdownText}
        </span>
      )}
    </div>
  );
});

interface DigitalBoldCountdownPillProps {
  nextPrayerName?: string;
  targetTime?: Date | null;
  language: string;
  isStaticPreview: boolean;
  externalNow?: Date;
}

/**
 * Isolated minute-level memoized countdown pill for DigitalBoldClock.
 */
export const DigitalBoldCountdownPill = memo(function DigitalBoldCountdownPill({
  nextPrayerName,
  targetTime,
  language,
  isStaticPreview,
  externalNow,
}: DigitalBoldCountdownPillProps) {
  const minuteTimestamp = useClockMinuteTick(isStaticPreview, externalNow);

  const countdownText = useMemo(() => {
    if (isStaticPreview) return formatLocalizedCountdown(2 * 3600 * 1000 + 22 * 60 * 1000, language);
    if (!targetTime) return '';
    const diff = targetTime.getTime() - minuteTimestamp;
    return formatLocalizedCountdown(diff, language);
  }, [minuteTimestamp, targetTime, isStaticPreview, language]);

  const prayerName = useMemo(() => {
    const raw = getPrayerDisplayName(nextPrayerName, targetTime || new Date(minuteTimestamp)) || 'Next';
    return getLocalizedPrayerName(raw, language);
  }, [nextPrayerName, targetTime, minuteTimestamp, language]);

  return (
    <div
      className="inline-flex items-center justify-center font-semibold shrink-0 select-none border"
      style={{
        gap: isStaticPreview ? '4px' : '6px',
        padding: isStaticPreview ? '2px 8px' : '4px 12px',
        borderRadius: '999px',
        background: 'var(--surface-2)',
        borderColor: 'var(--border)',
        color: 'var(--accent-text)',
        fontSize: isStaticPreview ? '0.65rem' : '0.78rem',
        whiteSpace: 'nowrap',
        lineHeight: 1.2,
      }}
    >
      <span
        className="rounded-full inline-block shrink-0"
        style={{
          width: isStaticPreview ? '5px' : '6px',
          height: isStaticPreview ? '5px' : '6px',
          background: 'var(--accent)',
        }}
      />
      <span className={cn(isStaticPreview ? 'whitespace-nowrap' : 'line-clamp-2 leading-tight break-words')}>
        {prayerName}
      </span>
      {countdownText && (
        <span className="font-mono text-[var(--text-secondary)] font-normal ml-0.5">
          • {countdownText}
        </span>
      )}
    </div>
  );
});

interface MosqueLedCountdownRowProps {
  nextPrayerName?: string;
  targetTime?: Date | null;
  isStaticPreview: boolean;
  externalNow?: Date;
}

/**
 * Isolated minute-level memoized bottom bar for MosqueLedClock.
 */
export const MosqueLedCountdownRow = memo(function MosqueLedCountdownRow({
  nextPrayerName,
  targetTime,
  isStaticPreview,
  externalNow,
}: MosqueLedCountdownRowProps) {
  const minuteTimestamp = useClockMinuteTick(isStaticPreview, externalNow);

  const countdownText = useMemo(() => {
    if (isStaticPreview) return 'IN 2h 15m';
    if (!targetTime) return 'APPROACHING';

    const diff = targetTime.getTime() - minuteTimestamp;
    if (diff <= 0) return 'DUE NOW';

    const h = Math.floor(diff / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (h > 0) {
      return `IN ${h}h ${m}m`;
    }
    return `IN ${m}m`;
  }, [minuteTimestamp, targetTime, isStaticPreview]);

  const prayerName = useMemo(() => {
    return (getPrayerDisplayName(nextPrayerName, targetTime || new Date(minuteTimestamp)) || 'PRAYER').toUpperCase();
  }, [nextPrayerName, targetTime, minuteTimestamp]);

  return (
    <div
      className={cn(
        'relative z-10 w-full flex items-center justify-between font-mono font-bold',
        isStaticPreview
          ? 'text-[0.55rem] mt-1 pt-1 tracking-tight px-0.5'
          : 'text-[10px] sm:text-xs mt-2 pt-2 tracking-wider'
      )}
      style={{ borderTop: '1px solid var(--border)' }}
    >
      <div
        className={cn(
          'uppercase flex items-center shrink-0',
          isStaticPreview ? 'gap-0.5 text-[0.55rem]' : 'gap-1.5 truncate max-w-[55%]'
        )}
        style={{ color: 'var(--text-secondary)' }}
      >
        <span
          className={cn(
            'rounded-full inline-block shrink-0',
            isStaticPreview ? 'w-1 h-1' : 'w-1.5 h-1.5'
          )}
          style={{
            background: 'var(--accent)',
            boxShadow: '0 0 6px var(--accent-glow)',
          }}
        />
        <span className={cn(isStaticPreview ? 'whitespace-nowrap' : 'line-clamp-2 leading-tight break-words')}>
          {prayerName}
        </span>
      </div>

      <span
        className={cn(
          'font-black shrink-0 text-right whitespace-nowrap',
          isStaticPreview ? 'text-[0.55rem] ml-0.5' : 'ml-2'
        )}
        style={{
          color: 'var(--accent-text)',
          textShadow: isStaticPreview ? undefined : '0 0 8px var(--accent-glow)',
        }}
      >
        {countdownText}
      </span>
    </div>
  );
});
