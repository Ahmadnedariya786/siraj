import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

export interface ClockHandAngles {
  hourAngle: number;
  minuteAngle: number;
  secondAngle: number;
}

export const FRAME_GAP_CATCHUP_THRESHOLD_MS = 300;
export const CATCHUP_EASE_DURATION_MS = 220;

/**
 * Pure synchronous angle computation from epoch milliseconds (Date.now()).
 * Never relies on incremental frame counters.
 */
export function computeClockAngles(timestampMs: number, isStaticPreview = false): ClockHandAngles {
  const d = new Date(timestampMs);
  const hours = d.getHours() % 12;
  const minutes = d.getMinutes();
  const seconds = d.getSeconds();
  const ms = isStaticPreview ? 0 : d.getMilliseconds();

  const exactSeconds = seconds + ms / 1000;
  const exactMinutes = minutes + (isStaticPreview ? 0 : exactSeconds / 60);
  const exactHours = hours + exactMinutes / 60;

  return {
    hourAngle: exactHours * 30,
    minuteAngle: exactMinutes * 6,
    secondAngle: exactSeconds * 6,
  };
}

/**
 * Computes shortest signed angular delta in [-180, 180) so catch-up easing
 * never rotates backwards across the 360->0 degree wrap boundary.
 */
export function shortestAngleDelta(fromDeg: number, toDeg: number): number {
  return ((((toDeg - fromDeg) % 360) + 540) % 360) - 180;
}

export interface UseAnalogClockHandsOptions {
  isStaticPreview?: boolean;
  externalNow?: Date;
}

export interface UseAnalogClockHandsResult {
  hourHandRef: RefObject<SVGGElement>;
  minuteHandRef: RefObject<SVGGElement>;
  secondHandRef: RefObject<SVGGElement>;
  initialAngles: ClockHandAngles;
}

/**
 * Drives analog watch hands at 60fps via direct DOM/SVG refs + GPU transforms,
 * causing ZERO per-second React setState re-renders.
 * Always computes angles from Date.now(); eases catch-up over 220ms after gaps > 300ms;
 * pauses cleanly when document.hidden is true.
 */
export function useAnalogClockHands({
  isStaticPreview = false,
  externalNow,
}: UseAnalogClockHandsOptions): UseAnalogClockHandsResult {
  const hourHandRef = useRef<SVGGElement>(null);
  const minuteHandRef = useRef<SVGGElement>(null);
  const secondHandRef = useRef<SVGGElement>(null);

  const initialAngles = useMemo(
    () => computeClockAngles(externalNow ? externalNow.getTime() : Date.now(), isStaticPreview),
    [externalNow, isStaticPreview]
  );

  useEffect(() => {
    const applyAngles = (angles: ClockHandAngles) => {
      if (hourHandRef.current) {
        hourHandRef.current.style.transform = `rotate(${angles.hourAngle.toFixed(3)}deg)`;
      }
      if (minuteHandRef.current) {
        minuteHandRef.current.style.transform = `rotate(${angles.minuteAngle.toFixed(3)}deg)`;
      }
      if (secondHandRef.current) {
        secondHandRef.current.style.transform = `rotate(${angles.secondAngle.toFixed(3)}deg)`;
      }
    };

    if (isStaticPreview || externalNow) {
      applyAngles(initialAngles);
      return;
    }

    let rafId: number | null = null;
    let isCancelled = false;
    let lastFrameWallMs: number | null = null;
    let lastAppliedAngles: ClockHandAngles = initialAngles;
    let catchUpState: { startMs: number; from: ClockHandAngles } | null = null;

    const stopLoop = () => {
      if (rafId !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const tickFrame = () => {
      if (isCancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        rafId = null;
        return;
      }

      const nowMs = Date.now();
      const target = computeClockAngles(nowMs, false);

      if (lastFrameWallMs !== null && nowMs - lastFrameWallMs > FRAME_GAP_CATCHUP_THRESHOLD_MS) {
        catchUpState = {
          startMs: nowMs,
          from: { ...lastAppliedAngles },
        };
      }
      lastFrameWallMs = nowMs;

      let applied = target;
      if (catchUpState) {
        const progress = Math.min(1, Math.max(0, (nowMs - catchUpState.startMs) / CATCHUP_EASE_DURATION_MS));
        if (progress >= 1) {
          catchUpState = null;
        } else {
          // Smooth ease-out cubic catch-up toward live Date.now() angles
          const eased = 1 - Math.pow(1 - progress, 3);
          applied = {
            hourAngle:
              catchUpState.from.hourAngle +
              shortestAngleDelta(catchUpState.from.hourAngle, target.hourAngle) * eased,
            minuteAngle:
              catchUpState.from.minuteAngle +
              shortestAngleDelta(catchUpState.from.minuteAngle, target.minuteAngle) * eased,
            secondAngle:
              catchUpState.from.secondAngle +
              shortestAngleDelta(catchUpState.from.secondAngle, target.secondAngle) * eased,
          };
        }
      }

      lastAppliedAngles = applied;
      applyAngles(applied);

      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(tickFrame);
      }
    };

    const startLoop = () => {
      if (isCancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      stopLoop();
      if (typeof requestAnimationFrame === 'function') {
        rafId = requestAnimationFrame(tickFrame);
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopLoop();
      } else {
        startLoop();
      }
    };

    // Apply live Date.now() immediately on mount and start rAF loop
    applyAngles(computeClockAngles(Date.now(), false));
    lastFrameWallMs = Date.now();
    startLoop();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    let appStateHandle: { remove: () => void } | null = null;
    if (Capacitor.isNativePlatform()) {
      CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          startLoop();
        } else {
          stopLoop();
        }
      })
        .then((handle) => {
          appStateHandle = handle;
        })
        .catch((err) => {
          console.debug('[ClockHands] appStateChange listener skipped:', err);
        });
    }

    return () => {
      isCancelled = true;
      stopLoop();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      if (appStateHandle) {
        try {
          appStateHandle.remove();
        } catch (err) {
          console.debug('[ClockHands] appStateChange cleanup skipped:', err);
        }
      }
    };
  }, [isStaticPreview, externalNow, initialAngles]);

  return {
    hourHandRef,
    minuteHandRef,
    secondHandRef,
    initialAngles,
  };
}
