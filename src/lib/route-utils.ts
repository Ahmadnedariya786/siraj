/**
 * Siraj — Application Route & Deep-Link Normalizer
 *
 * Guaranteed to normalize any deep-link, widget intent, or URL into a valid,
 * single-slash relative route compatible with React Router.
 * Eliminates all double-slash errors (e.g. "/siraj://app/dashboard" -> "/").
 */

/**
 * Normalizes an arbitrary deep-link URL or raw path string into a canonical,
 * safe React Router relative path starting with a single '/' and with zero double slashes.
 *
 * Handles:
 * - "siraj://app/dashboard" -> "/"
 * - "/siraj://app/dashboard" -> "/"
 * - "siraj://quran" -> "/quran"
 * - "//settings/about" -> "/settings/about"
 * - "noorconnect://app/hadith" -> "/hadith"
 * - "https://localhost/tasbeeh" -> "/tasbeeh"
 * - "/dashboard" -> "/"
 * - "/prayers" -> "/"
 */
export function normalizeAppRoute(rawInput?: string | null): string {
  if (!rawInput || typeof rawInput !== 'string') return '/';

  let raw = rawInput.trim();
  if (!raw) return '/';

  // 1. Strip scheme + authority if present
  // Matches: "siraj://app", "/siraj://app", "siraj://", "noorconnect://app", "https://localhost", etc.
  raw = raw.replace(/^\/?(?:siraj|noorconnect):\/\/(?:app)?(?:\/)?/i, '/');
  raw = raw.replace(/^https?:\/\/[^/]+(?:\/)?/i, '/');

  // Strip any residual scheme fragment e.g. "/siraj:/", "siraj:", "/noorconnect:"
  raw = raw.replace(/^\/?(?:siraj|noorconnect):(?:\/)?/i, '/');

  // 2. Collapse multiple slashes into a single slash
  raw = raw.replace(/\/{2,}/g, '/');

  // Ensure single leading slash
  if (!raw.startsWith('/')) {
    raw = '/' + raw;
  }

  // 3. Extract path vs search/hash
  const queryIdx = raw.indexOf('?');
  const hashIdx = raw.indexOf('#');
  let splitIdx = -1;
  if (queryIdx !== -1 && hashIdx !== -1) {
    splitIdx = Math.min(queryIdx, hashIdx);
  } else if (queryIdx !== -1) {
    splitIdx = queryIdx;
  } else if (hashIdx !== -1) {
    splitIdx = hashIdx;
  }

  const rawPath = (splitIdx !== -1 ? raw.slice(0, splitIdx) : raw).toLowerCase();
  const searchAndHash = splitIdx !== -1 ? raw.slice(splitIdx) : '';

  // 4. Map known widget aliases and legacy paths
  let canonicalPath = rawPath;

  if (rawPath === '/' || rawPath === '/dashboard' || rawPath === '/prayers' || rawPath === '') {
    canonicalPath = '/';
  } else if (rawPath === '/quran/reading' || rawPath === '/quran-progress') {
    canonicalPath = '/quran-progress';
  } else if (rawPath.startsWith('/hadith')) {
    canonicalPath = '/hadith';
  } else if (rawPath.startsWith('/quran')) {
    canonicalPath = '/quran';
  } else if (rawPath.startsWith('/tasbeeh') || rawPath.startsWith('/tasbih')) {
    canonicalPath = '/tasbeeh';
  } else if (rawPath.startsWith('/qibla')) {
    canonicalPath = '/qibla';
  } else if (rawPath.startsWith('/settings')) {
    canonicalPath = rawPath;
  } else if (rawPath.startsWith('/masjid') || rawPath.startsWith('/mosque')) {
    canonicalPath = '/mosques';
  }

  // Return clean path (if root and no query/hash, return "/")
  if (canonicalPath === '/' && !searchAndHash) {
    return '/';
  }

  return canonicalPath + searchAndHash;
}

/**
 * Builds a canonical, shareable Siraj Masjid Deep-Link with full metadata & Jamaat times.
 */
export function buildMasjidDeepLink(masjid: {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  jamaatTimes?: {
    fajr?: string;
    dhuhr?: string;
    asr?: string;
    maghrib?: string;
    isha?: string;
    jummah?: string;
  } | null;
}): string {
  const params = new URLSearchParams();
  if (masjid.name) params.set('name', masjid.name);
  if (masjid.latitude !== undefined && Number.isFinite(masjid.latitude)) params.set('lat', String(masjid.latitude));
  if (masjid.longitude !== undefined && Number.isFinite(masjid.longitude)) params.set('lon', String(masjid.longitude));
  if (masjid.address) params.set('address', masjid.address);
  if (masjid.jamaatTimes) {
    if (masjid.jamaatTimes.fajr) params.set('fajr', masjid.jamaatTimes.fajr);
    if (masjid.jamaatTimes.dhuhr) params.set('dhuhr', masjid.jamaatTimes.dhuhr);
    if (masjid.jamaatTimes.asr) params.set('asr', masjid.jamaatTimes.asr);
    if (masjid.jamaatTimes.maghrib) params.set('maghrib', masjid.jamaatTimes.maghrib);
    if (masjid.jamaatTimes.isha) params.set('isha', masjid.jamaatTimes.isha);
    if (masjid.jamaatTimes.jummah) params.set('jummah', masjid.jamaatTimes.jummah);
  }
  return `siraj://masjid?${params.toString()}`;
}
