import { useRef, useCallback, type TouchEvent } from 'react';

interface UseReaderSwipeOptions {
  onPrev?: () => void;
  onNext?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  thresholdPx?: number;
}

/**
 * Horizontal touch swipe gesture handler for long-form readers.
 * Swipe left -> Next chapter/hadith; Swipe right -> Previous chapter/hadith.
 * Safely ignores vertical scroll gestures, text selections, and horizontal carousels.
 */
export function useReaderSwipe({
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  thresholdPx = 68,
}: UseReaderSwipeOptions) {
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const onTouchStart = useCallback((e: TouchEvent<HTMLElement>) => {
    if (e.touches.length !== 1) {
      startRef.current = null;
      return;
    }
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('[data-no-swipe="true"], input, textarea, [role="slider"]')) {
      startRef.current = null;
      return;
    }
    const touch = e.touches[0];
    startRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || e.changedTouches.length !== 1) return;

      // Never navigate away while user is selecting prose text
      if (typeof window !== 'undefined') {
        const sel = window.getSelection?.()?.toString().trim();
        if (sel) return;
      }

      const touch = e.changedTouches[0];
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const elapsed = Date.now() - start.time;

      if (elapsed > 650) return;
      if (Math.abs(dx) < thresholdPx) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.6) return;

      if (dx < 0 && canNext && onNext) {
        onNext();
      } else if (dx > 0 && canPrev && onPrev) {
        onPrev();
      }
    },
    [canNext, canPrev, onNext, onPrev, thresholdPx]
  );

  return { onTouchStart, onTouchEnd };
}
