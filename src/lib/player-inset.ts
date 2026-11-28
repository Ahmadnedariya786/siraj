import { useEffect, useRef } from 'react';

const activeHeights = new Map<string, number>();

function syncPlayerInsetVar(): void {
  if (typeof document === 'undefined') return;
  let maxInset = 0;
  for (const height of activeHeights.values()) {
    if (height > maxInset) {
      maxInset = height;
    }
  }
  document.documentElement.style.setProperty(
    '--player-inset',
    maxInset > 0 ? `${Math.ceil(maxInset) + 8}px` : '0px',
  );
}

export function setPlayerInsetHeight(id: string, heightPx: number): void {
  if (heightPx > 0) {
    activeHeights.set(id, heightPx);
  } else {
    activeHeights.delete(id);
  }
  syncPlayerInsetVar();
}

export function usePlayerInsetRef<T extends HTMLElement = HTMLDivElement>(
  id: string,
  isVisible: boolean,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!isVisible) {
      setPlayerInsetHeight(id, 0);
      return;
    }

    const el = ref.current;
    if (!el) {
      setPlayerInsetHeight(id, 0);
      return;
    }

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const h = Math.ceil(rect.height || el.offsetHeight || 0);
      setPlayerInsetHeight(id, h);
    };

    measure();

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => measure());
      observer.observe(el);
    }

    return () => {
      if (observer) {
        observer.disconnect();
      }
      setPlayerInsetHeight(id, 0);
    };
  }, [id, isVisible]);

  return ref;
}
