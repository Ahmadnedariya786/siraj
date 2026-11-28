/**
 * Radio Listening Statistics
 * Tracks listening time per radio station for statistics
 */

import { Preferences } from '@capacitor/preferences';
import { checkAchievements, updateStreak } from './radio-achievements';

export interface StationStats {
  stationId: string;
  stationName: string;
  totalSeconds: number;
  sessionCount: number;
  lastListened: number; // timestamp
}

export interface RadioStatsData {
  stations: Record<string, StationStats>;
  totalListeningTime: number;
}

export interface NormalizedStationStat extends StationStats {
  shareTenths: number;
  sharePct: number;
}

export interface MediaStatsSummary {
  stations: NormalizedStationStat[];
  totalSeconds: number;
  totalSessions: number;
  avgSessionSeconds: number;
  topStation: NormalizedStationStat | null;
}

export const MEDIA_STATS_UPDATED_EVENT = 'siraj:media-stats-updated';

const STATS_KEY = 'radio-listening-stats';

// Default empty stats
const DEFAULT_STATS: RadioStatsData = {
  stations: {},
  totalListeningTime: 0,
};

/**
 * Load stats from storage
 */
export async function loadRadioStats(): Promise<RadioStatsData> {
  try {
    const { value } = await Preferences.get({ key: STATS_KEY });
    if (value) {
      return JSON.parse(value);
    }
  } catch (error) {
    console.error('Failed to load radio stats:', error);
  }
  return DEFAULT_STATS;
}

/**
 * Save stats to storage
 */
export async function saveRadioStats(stats: RadioStatsData): Promise<void> {
  try {
    await Preferences.set({
      key: STATS_KEY,
      value: JSON.stringify(stats),
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(MEDIA_STATS_UPDATED_EVENT));
    }
  } catch (error) {
    console.error('Failed to save radio stats:', error);
  }
}

export function subscribeMediaStats(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(MEDIA_STATS_UPDATED_EVENT, handler);
  return () => window.removeEventListener(MEDIA_STATS_UPDATED_EVENT, handler);
}

/**
 * Record listening time for a station
 * Called when radio is paused or stopped
 */
export async function recordListeningTime(
  stationId: string,
  stationName: string,
  seconds: number
): Promise<void> {
  if (seconds <= 0) return;

  const stats = await loadRadioStats();
  
  if (!stats.stations[stationId]) {
    stats.stations[stationId] = {
      stationId,
      stationName,
      totalSeconds: 0,
      sessionCount: 0,
      lastListened: Date.now(),
    };
  }

  stats.stations[stationId].totalSeconds += seconds;
  stats.stations[stationId].sessionCount += 1;
  stats.stations[stationId].lastListened = Date.now();
  stats.totalListeningTime += seconds;

  await saveRadioStats(stats);

  // Update streak and check achievements
  await updateStreak();

  const totalSessions = Object.values(stats.stations).reduce((sum, s) => sum + s.sessionCount, 0);
  const uniqueStations = Object.keys(stats.stations).length;
  const currentStreak = await (await import('./radio-achievements')).getCurrentStreak();

  await checkAchievements({
    totalSeconds: stats.totalListeningTime,
    totalSessions,
    uniqueStations,
    currentStreak,
  });
}

/**
 * Get all station stats sorted by total listening time
 */
export async function getSortedStationStats(): Promise<StationStats[]> {
  const stats = await loadRadioStats();
  return Object.values(stats.stations).sort(
    (a, b) => b.totalSeconds - a.totalSeconds
  );
}

/**
 * Get total listening time across all stations
 */
export async function getTotalListeningTime(): Promise<number> {
  const stats = await loadRadioStats();
  return stats.totalListeningTime;
}

/**
 * Reset all stats
 */
export async function resetRadioStats(): Promise<void> {
  await saveRadioStats(DEFAULT_STATS);
}

/**
 * Single-source largest-remainder normalization to 1 decimal (1000 tenths = 100.0%).
 * Guarantees non-zero category shares sum strictly to 100.0% and Top Station share
 * matches the exact breakdown percentage derived from the same totalSeconds denominator.
 */
export function computeNormalizedMediaSummary(stations: StationStats[]): MediaStatsSummary {
  const sorted = [...stations]
    .map((station) => ({
      ...station,
      totalSeconds: Math.max(0, Number.isFinite(station.totalSeconds) ? station.totalSeconds : 0),
      sessionCount: Math.max(0, Number.isFinite(station.sessionCount) ? station.sessionCount : 0),
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const totalSeconds = sorted.reduce((sum, s) => sum + s.totalSeconds, 0);
  const totalSessions = sorted.reduce((sum, s) => sum + s.sessionCount, 0);
  const avgSessionSeconds = totalSessions > 0 ? Math.floor(totalSeconds / totalSessions) : 0;

  if (totalSeconds <= 0 || sorted.length === 0) {
    const zeroed: NormalizedStationStat[] = sorted.map((s) => ({
      ...s,
      shareTenths: 0,
      sharePct: 0,
    }));
    return {
      stations: zeroed,
      totalSeconds: 0,
      totalSessions,
      avgSessionSeconds: 0,
      topStation: null,
    };
  }

  const positiveIndices: number[] = [];
  const rawTenths = sorted.map((s, idx) => {
    if (s.totalSeconds <= 0) return 0;
    positiveIndices.push(idx);
    return (s.totalSeconds / totalSeconds) * 1000;
  });

  const tenths = rawTenths.map((v) => Math.floor(v));
  const floorSum = tenths.reduce((sum, v) => sum + v, 0);
  const remainderTenths = Math.max(0, 1000 - floorSum);

  const byFraction = [...positiveIndices].sort((a, b) => {
    const fracDiff = (rawTenths[b] - tenths[b]) - (rawTenths[a] - tenths[a]);
    if (Math.abs(fracDiff) > 1e-12) return fracDiff;
    const secDiff = sorted[b].totalSeconds - sorted[a].totalSeconds;
    if (secDiff !== 0) return secDiff;
    return a - b;
  });

  for (let i = 0; i < remainderTenths && i < byFraction.length; i += 1) {
    tenths[byFraction[i]] += 1;
  }

  const normalizedStations: NormalizedStationStat[] = sorted.map((s, idx) => ({
    ...s,
    shareTenths: tenths[idx],
    sharePct: tenths[idx] / 10,
  }));

  const topStation = normalizedStations[0] && normalizedStations[0].totalSeconds > 0
    ? normalizedStations[0]
    : null;

  return {
    stations: normalizedStations,
    totalSeconds,
    totalSessions,
    avgSessionSeconds,
    topStation,
  };
}

/**
 * Format seconds to human-readable duration
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
