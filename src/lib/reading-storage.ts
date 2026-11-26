// Shared Reading Storage Helpers
// Used by Seerah, Qisas, and Hadith readers for progress, scroll position, bookmarks, and last-read tracking.

export type ReadingFeature = "seerah" | "qisas" | "hadith";

const STORAGE_PREFIX = "noor";

// ─── Reading Progress ──────────────────────────────────────────────────
export function getReadingProgress(
  id: string,
  feature: ReadingFeature
): number {
  const key = `${STORAGE_PREFIX}-${feature}-progress`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    return data[id] || 0;
  } catch {
    return 0;
  }
}

export function setReadingProgress(
  id: string,
  percentage: number,
  feature: ReadingFeature
): void {
  const key = `${STORAGE_PREFIX}-${feature}-progress`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}");
    data[id] = Math.min(100, Math.max(0, percentage));
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to save reading progress for ${feature}:`, err);
    try {
      localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify({ [id]: Math.min(100, Math.max(0, percentage)) }));
    } catch (retryError) {
      console.error(`Failed to save reading progress after cleanup for ${feature}:`, retryError);
    }
  }
}

// ─── Persisted Scroll Position ─────────────────────────────────────────
export function getScrollPosition(
  id: string,
  feature: ReadingFeature
): number {
  if (!id) return 0;
  const key = `${STORAGE_PREFIX}-${feature}-scroll`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, number>;
    const val = Number(data[id] ?? 0);
    return Number.isFinite(val) && val > 0 ? Math.round(val) : 0;
  } catch {
    return 0;
  }
}

export function setScrollPosition(
  id: string,
  scrollY: number,
  feature: ReadingFeature
): void {
  if (!id || !Number.isFinite(scrollY)) return;
  const key = `${STORAGE_PREFIX}-${feature}-scroll`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, number>;
    data[id] = Math.max(0, Math.round(scrollY));
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to save scroll position for ${feature}:`, err);
  }
}

export function clearScrollPosition(
  id: string,
  feature: ReadingFeature
): void {
  if (!id) return;
  const key = `${STORAGE_PREFIX}-${feature}-scroll`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "{}") as Record<string, number>;
    delete data[id];
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`Failed to clear scroll position for ${feature}:`, err);
  }
}

// ─── Bookmarks ───────────────────────────────────────────────────────
export function getBookmarks(feature: ReadingFeature): Set<string> {
  const key = `${STORAGE_PREFIX}-${feature}-bookmarks`;
  try {
    const data = JSON.parse(localStorage.getItem(key) || "[]");
    return new Set(data);
  } catch {
    return new Set();
  }
}

export function toggleBookmark(
  id: string,
  feature: ReadingFeature
): boolean {
  const bookmarks = getBookmarks(feature);
  const isBookmarked = bookmarks.has(id);

  if (isBookmarked) {
    bookmarks.delete(id);
  } else {
    bookmarks.add(id);
  }

  const key = `${STORAGE_PREFIX}-${feature}-bookmarks`;
  try {
    localStorage.setItem(key, JSON.stringify([...bookmarks]));
  } catch (err) {
    console.warn(`Failed to save bookmarks for ${feature}:`, err);
    try {
      localStorage.removeItem(key);
      localStorage.setItem(key, JSON.stringify([...bookmarks]));
    } catch (retryError) {
      console.error(`Failed to save bookmarks after cleanup for ${feature}:`, retryError);
    }
  }
  return !isBookmarked;
}

export function isBookmarked(id: string, feature: ReadingFeature): boolean {
  return getBookmarks(feature).has(id);
}

// ─── Font Size (Legacy compat wrapper) ─────────────────────────────────
export function getFontSize(feature: ReadingFeature): number {
  const key = `${STORAGE_PREFIX}-${feature}-font-size`;
  try {
    const size = localStorage.getItem(key);
    return size ? parseInt(size, 10) : 15;
  } catch {
    return 15;
  }
}

export function setFontSize(size: number, feature: ReadingFeature): void {
  const key = `${STORAGE_PREFIX}-${feature}-font-size`;
  const clamped = Math.min(18, Math.max(13, size));
  localStorage.setItem(key, String(clamped));
}

// ─── Last Read ─────────────────────────────────────────────────────────
export function getLastRead(feature: ReadingFeature): string | null {
  const key = `${STORAGE_PREFIX}-${feature}-last-read`;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLastRead(id: string, feature: ReadingFeature): void {
  const key = `${STORAGE_PREFIX}-${feature}-last-read`;
  try {
    localStorage.setItem(key, id);
  } catch (err) {
    console.warn(`Failed to save last read for ${feature}:`, err);
  }
}

// ─── Clear Feature Data ───────────────────────────────────────────────
export function clearFeatureData(feature: ReadingFeature): void {
  const keys = [
    `${STORAGE_PREFIX}-${feature}-progress`,
    `${STORAGE_PREFIX}-${feature}-scroll`,
    `${STORAGE_PREFIX}-${feature}-bookmarks`,
    `${STORAGE_PREFIX}-${feature}-font-size`,
    `${STORAGE_PREFIX}-${feature}-last-read`,
  ];

  keys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn(`Failed to clear ${key}:`, err);
    }
  });
}
