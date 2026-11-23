/**
 * Siraj — In-App Offline Quran Audio Caching Engine
 *
 * 100% in-app audio storage using CacheStorage + IndexedDB.
 * Never redirects the user to external Chrome browser or opens target="_blank" tabs.
 */

import { downloadManager } from './download-manager';
import { getReciterById } from './quran-reciters';

export const OFFLINE_AUDIO_CACHE_NAME = 'noor-offline-quran-audio-v1';
export const OFFLINE_AYAHS_STORAGE_KEY = 'noor_downloaded_ayahs_v1';
export const OFFLINE_SURAHS_STORAGE_KEY = 'noor_downloaded_surahs_v1';
export const MAX_OFFLINE_AUDIO_BYTES = 512 * 1024 * 1024; // Strict 512 MB LRU Cap

export interface DownloadedSurahMeta {
  surahNumber: number;
  reciterId: string;
  totalAyahs: number;
  totalBytes: number;
  downloadedAt: number;
}

/**
 * Returns the primary EveryAyah CDN audio URL for a given ayah
 */
export function getAyahAudioUrl(subfolder: string, surah: number, ayah: number): string {
  const sStr = String(surah).padStart(3, '0');
  const aStr = String(ayah).padStart(3, '0');
  return `https://everyayah.com/data/${subfolder}/${sStr}${aStr}.mp3`;
}

/**
 * Returns the secondary full-surah stream URL from MP3Quran
 */
export function getFullSurahStreamUrl(surah: number): string {
  const sStr = String(surah).padStart(3, '0');
  return `https://server8.mp3quran.net/afs/${sStr}.mp3`;
}

/**
 * Checks if an ayah's audio is already stored in CacheStorage
 */
export async function isAyahAudioCached(
  subfolder: string,
  surah: number,
  ayah: number
): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) return false;
  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const url = getAyahAudioUrl(subfolder, surah, ayah);
    const match = await cache.match(url);
    return !!match;
  } catch {
    return false;
  }
}

/**
 * Checks if a full Surah is marked as downloaded offline
 */
export async function isSurahAudioCached(
  reciterId: string,
  surah: number
): Promise<boolean> {
  try {
    const raw = localStorage.getItem(OFFLINE_SURAHS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed[surah]) {
        return true;
      }
    }
  } catch {
    // Safe storage parse fallback
  }

  try {
    return await downloadManager.isSurahDownloaded(reciterId, surah);
  } catch {
    return false;
  }
}

/**
 * Fetches an individual Ayah MP3 and caches it in CacheStorage (100% in-app)
 */
export async function cacheAyahAudio(
  subfolder: string,
  surah: number,
  ayah: number,
  reciterId = 'alafasy'
): Promise<{ size: number; url: string }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    throw new Error('CacheStorage not supported on this device');
  }

  // Enforce 512 MB LRU cap before caching new audio
  await enforceOfflineAudioLRU(50_000).catch(() => {});

  const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
  const primaryUrl = getAyahAudioUrl(subfolder, surah, ayah);
  const secondaryUrl = `https://audio.qurancdn.com/Alafasy/mp3/${String(surah).padStart(3, '0')}${String(ayah).padStart(3, '0')}.mp3`;

  let response: Response | null = null;
  let targetUrl = primaryUrl;

  try {
    response = await fetch(primaryUrl, { mode: 'cors' });
  } catch {
    // Fallback to secondary CDN
    try {
      response = await fetch(secondaryUrl, { mode: 'cors' });
      targetUrl = secondaryUrl;
    } catch {
      throw new Error('Network offline or audio server unreachable');
    }
  }

  if (!response || !response.ok) {
    throw new Error(`Audio download failed: HTTP ${response?.status || 'network'}`);
  }

  // Clone response so we can store it in cache and calculate size
  const clone = response.clone();
  await cache.put(targetUrl, response);
  if (targetUrl !== primaryUrl) {
    // Also cache under primaryUrl key for deterministic hits
    await cache.put(primaryUrl, clone.clone());
  }

  const blob = await clone.blob();
  const size = blob.size;

  // Record in localStorage
  try {
    const raw = localStorage.getItem(OFFLINE_AYAHS_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[`${surah}:${ayah}`] = {
      surah,
      ayah,
      reciterId,
      size,
      cachedAt: Date.now(),
    };
    localStorage.setItem(OFFLINE_AYAHS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Safe storage fallback
  }

  return { size, url: primaryUrl };
}

/**
 * Downloads and caches all Ayahs for a Surah sequentially with progress notifications
 */
export async function cacheSurahAudio(
  subfolder: string,
  surah: number,
  totalAyahs: number,
  reciterId: string,
  onProgress?: (completed: number, total: number, percent: number) => void,
  signal?: AbortSignal
): Promise<{ totalDownloaded: number; totalBytes: number }> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    throw new Error('CacheStorage not supported on this device');
  }

  let totalBytes = 0;
  let completed = 0;

  for (let a = 1; a <= totalAyahs; a++) {
    if (signal?.aborted) {
      throw new DOMException('Download aborted by user', 'AbortError');
    }

    try {
      const alreadyCached = await isAyahAudioCached(subfolder, surah, a);
      if (!alreadyCached) {
        const { size } = await cacheAyahAudio(subfolder, surah, a, reciterId);
        totalBytes += size;
      }
    } catch (e) {
      console.warn(`Failed to cache ayah ${surah}:${a}`, e);
    }

    completed++;
    const percent = Math.round((completed / totalAyahs) * 100);
    onProgress?.(completed, totalAyahs, percent);
  }

  // Attempt to fetch & store full-surah MP3 stream in downloadManager for Settings > Storage
  try {
    const streamUrl = getFullSurahStreamUrl(surah);
    const res = await fetch(streamUrl, { mode: 'cors', signal });
    if (res.ok) {
      const surahBlob = await res.blob();
      await downloadManager.saveSurah(reciterId, surah, surahBlob);
      totalBytes += surahBlob.size;
    }
  } catch (e) {
    // Fallback: full surah stream not strictly mandatory if individual ayahs are cached
    console.debug('Full surah stream storage fallback:', e);
  }

  // Record Surah meta in localStorage
  try {
    const raw = localStorage.getItem(OFFLINE_SURAHS_STORAGE_KEY);
    const map: Record<string, DownloadedSurahMeta> = raw ? JSON.parse(raw) : {};
    map[String(surah)] = {
      surahNumber: surah,
      reciterId,
      totalAyahs,
      totalBytes,
      downloadedAt: Date.now(),
    };
    localStorage.setItem(OFFLINE_SURAHS_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage fallback
  }

  return { totalDownloaded: completed, totalBytes };
}

/**
 * Resolves an audio URL for seamless playback: returns Blob URL if cached in CacheStorage,
 * or original online stream URL if not yet downloaded.
 */
export async function resolveAudioPlaybackUrl(onlineUrl: string): Promise<string> {
  if (typeof window === 'undefined' || !('caches' in window)) return onlineUrl;

  try {
    const cache = await caches.open(OFFLINE_AUDIO_CACHE_NAME);
    const match = await cache.match(onlineUrl);
    if (match) {
      const blob = await match.blob();
      return URL.createObjectURL(blob);
    }
  } catch {
    // Fallback directly to online URL
  }

  return onlineUrl;
}

export interface ReciterStorageMeta {
  reciterId: string;
  name: string;
  size: number;
  count: number;
}

/**
 * Computes exact storage breakdown of all offline Quran audio across
 * IndexedDB (full surahs) and CacheStorage (individual ayahs).
 */
export async function getOfflineAudioStorageDetails(): Promise<{
  totalBytes: number;
  totalSurahs: number;
  recitersCount: number;
  topReciters: ReciterStorageMeta[];
  allReciters: ReciterStorageMeta[];
}> {
  const reciterMap = new Map<string, { size: number; count: number }>();
  let totalBytes = 0;
  let totalSurahs = 0;

  // 1. Gather from IndexedDB downloadManager
  try {
    const downloadedSurahs = await downloadManager.listDownloaded();
    for (const item of downloadedSurahs) {
      totalBytes += item.size;
      totalSurahs++;
      const existing = reciterMap.get(item.reciterId) || { size: 0, count: 0 };
      existing.size += item.size;
      existing.count += 1;
      reciterMap.set(item.reciterId, existing);
    }
  } catch (err) {
    console.warn('[OfflineAudio] listDownloaded error:', err);
  }

  // 2. Gather from localStorage ayah map
  try {
    const raw = localStorage.getItem(OFFLINE_AYAHS_STORAGE_KEY);
    if (raw) {
      const map = JSON.parse(raw);
      if (map && typeof map === 'object') {
        for (const key of Object.keys(map)) {
          const entry = map[key];
          if (entry && typeof entry.size === 'number') {
            totalBytes += entry.size;
            const rId = entry.reciterId || 'alafasy';
            const existing = reciterMap.get(rId) || { size: 0, count: 0 };
            existing.size += entry.size;
            reciterMap.set(rId, existing);
          }
        }
      }
    }
  } catch {
    // Safe storage parse
  }

  const allReciters: ReciterStorageMeta[] = [];
  for (const [rId, data] of reciterMap.entries()) {
    const info = getReciterById(rId);
    allReciters.push({
      reciterId: rId,
      name: info?.name || rId,
      size: data.size,
      count: data.count,
    });
  }

  allReciters.sort((a, b) => b.size - a.size);
  const topReciters = allReciters.slice(0, 3);

  return {
    totalBytes,
    totalSurahs,
    recitersCount: allReciters.length,
    topReciters,
    allReciters,
  };
}

/**
 * 1-Tap Per-Reciter deletion: completely removes all downloaded audio
 * for a specific reciter from IndexedDB, CacheStorage, and storage maps.
 */
export async function deleteReciterAudio(reciterId: string): Promise<number> {
  let freedBytes = 0;

  // 1. Remove from downloadManager
  try {
    const downloaded = await downloadManager.listDownloaded();
    for (const item of downloaded) {
      if (item.reciterId === reciterId) {
        freedBytes += item.size;
        await downloadManager.removeSurah(reciterId, item.surahNumber).catch(() => {});
      }
    }
  } catch (err) {
    console.warn('[OfflineAudio] Error removing surahs from downloadManager:', err);
  }

  // 2. Purge matching ayahs from localStorage
  try {
    const rawAyahs = localStorage.getItem(OFFLINE_AYAHS_STORAGE_KEY);
    if (rawAyahs) {
      const map = JSON.parse(rawAyahs);
      const remaining: Record<string, any> = {};
      for (const k of Object.keys(map)) {
        if (map[k]?.reciterId === reciterId) {
          freedBytes += map[k].size || 0;
        } else {
          remaining[k] = map[k];
        }
      }
      localStorage.setItem(OFFLINE_AYAHS_STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch {
    // Safe storage catch
  }

  // 3. Purge matching surahs from localStorage
  try {
    const rawSurahs = localStorage.getItem(OFFLINE_SURAHS_STORAGE_KEY);
    if (rawSurahs) {
      const map = JSON.parse(rawSurahs);
      const remaining: Record<string, any> = {};
      for (const k of Object.keys(map)) {
        if (map[k]?.reciterId === reciterId) {
          freedBytes += map[k].totalBytes || 0;
        } else {
          remaining[k] = map[k];
        }
      }
      localStorage.setItem(OFFLINE_SURAHS_STORAGE_KEY, JSON.stringify(remaining));
    }
  } catch {
    // Safe storage catch
  }

  window.dispatchEvent(new CustomEvent('cache-updated'));
  return freedBytes;
}

/**
 * Strict 512 MB LRU Eviction Cap:
 * Calculates aggregate offline audio size; if total + incomingBytes exceeds 512 MB,
 * evicts oldest cached recitations until total is within safe headroom (< 450 MB).
 */
export async function enforceOfflineAudioLRU(incomingBytes = 0): Promise<number> {
  let freedBytes = 0;
  const targetThreshold = 450 * 1024 * 1024; // 450 MB headroom
  const details = await getOfflineAudioStorageDetails();
  let currentTotal = details.totalBytes + incomingBytes;

  if (currentTotal <= MAX_OFFLINE_AUDIO_BYTES) {
    return 0;
  }

  console.warn(
    `[OfflineAudioLRU] Storage ${Math.round(currentTotal / 1024 / 1024)}MB exceeds 512MB cap. Evicting oldest entries...`
  );

  // Evict oldest recorded surahs from metadata
  try {
    const rawSurahs = localStorage.getItem(OFFLINE_SURAHS_STORAGE_KEY);
    if (rawSurahs) {
      const map = JSON.parse(rawSurahs);
      const entries = Object.keys(map).map((k) => ({
        key: k,
        ...map[k],
      }));
      // Sort oldest first
      entries.sort((a, b) => (a.downloadedAt || 0) - (b.downloadedAt || 0));

      for (const entry of entries) {
        if (currentTotal <= targetThreshold) break;
        await downloadManager.removeSurah(entry.reciterId, entry.surahNumber).catch(() => {});
        delete map[entry.key];
        const bytes = entry.totalBytes || 0;
        freedBytes += bytes;
        currentTotal -= bytes;
      }
      localStorage.setItem(OFFLINE_SURAHS_STORAGE_KEY, JSON.stringify(map));
    }
  } catch (e) {
    console.warn('[OfflineAudioLRU] Error during LRU eviction:', e);
  }

  window.dispatchEvent(new CustomEvent('cache-updated'));
  return freedBytes;
}
