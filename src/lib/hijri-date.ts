/**
 * Single Source of Truth for Hijri Date Conversion, Month Naming, and Hilal Offset.
 * Used identically across Today card, Monthly Calendar grid, Date-Details modal,
 * Date Converter (Gregorian <-> Hijri), and Royal Islamic Date Picker.
 */

export interface CanonicalHijriMonth {
  number: number;
  en: string;
  ar: string;
}

export const CANONICAL_HIJRI_MONTHS: readonly CanonicalHijriMonth[] = [
  { number: 1, en: 'Muharram', ar: 'محرم' },
  { number: 2, en: 'Safar', ar: 'صفر' },
  { number: 3, en: 'Rabīʿ al-Awwal', ar: 'ربيع الأول' },
  { number: 4, en: 'Rabīʿ al-Thānī', ar: 'ربيع الثاني' },
  { number: 5, en: 'Jumādā al-ūlā', ar: 'جمادى الأولى' },
  { number: 6, en: 'Jumādā al-ākhirah', ar: 'جمادى الثانية' },
  { number: 7, en: 'Rajab', ar: 'رجب' },
  { number: 8, en: 'Shaʿbān', ar: 'شعبان' },
  { number: 9, en: 'Ramaḍān', ar: 'رمضان' },
  { number: 10, en: 'Shawwāl', ar: 'شوال' },
  { number: 11, en: 'Dhū al-Qaʿdah', ar: 'ذو القعدة' },
  { number: 12, en: 'Dhū al-Ḥijjah', ar: 'ذو الحجة' },
] as const;

export const HIJRI_WEEKDAYS = [
  { en: 'Al-Ahad', ar: 'الأحد' },
  { en: 'Al-Ithnayn', ar: 'الإثنين' },
  { en: 'Al-Thulatha', ar: 'الثلاثاء' },
  { en: 'Al-Arbaa', ar: 'الأربعاء' },
  { en: 'Al-Khamis', ar: 'الخميس' },
  { en: 'Al-Jumuah', ar: 'الجمعة' },
  { en: 'As-Sabt', ar: 'السبت' },
] as const;

export function getStoredHijriOffset(): number {
  try {
    if (typeof localStorage === 'undefined') return 0;
    const raw = parseInt(localStorage.getItem('hijri-date-offset') || '0', 10);
    if (!Number.isFinite(raw)) return 0;
    return Math.max(-2, Math.min(2, raw));
  } catch {
    return 0;
  }
}

export function normalizeHijriMonth(val: string, monthNumber?: number): string {
  if (typeof monthNumber === 'number' && monthNumber >= 1 && monthNumber <= 12) {
    return CANONICAL_HIJRI_MONTHS[monthNumber - 1].en;
  }
  const clean = (val || '')
    .replace(/[\u014d\u014c\u00f4\u00d4]/g, 'ū')
    .replace(/al-ola/gi, 'al-ūlā')
    .replace(/al-ōlā/gi, 'al-ūlā')
    .replace(/ō/g, 'ū')
    .trim();

  const lower = clean.toLowerCase();
  if (!lower) return CANONICAL_HIJRI_MONTHS[0].en;
  if (lower.includes('muharram') || lower.includes('muḥarram')) return CANONICAL_HIJRI_MONTHS[0].en;
  if (lower.includes('safar') || lower.includes('ṣafar')) return CANONICAL_HIJRI_MONTHS[1].en;
  if (lower.includes('rabi') || lower.includes('rabī')) {
    return (lower.includes('thani') || lower.includes('thānī') || lower.includes('ii') || lower.includes('2'))
      ? CANONICAL_HIJRI_MONTHS[3].en
      : CANONICAL_HIJRI_MONTHS[2].en;
  }
  if (lower.includes('jumad') || lower.includes('jumād')) {
    return (lower.includes('thani') || lower.includes('thānī') || lower.includes('akhir') || lower.includes('ākhir') || lower.includes('ii') || lower.includes('2'))
      ? CANONICAL_HIJRI_MONTHS[5].en
      : CANONICAL_HIJRI_MONTHS[4].en;
  }
  if (lower.includes('rajab')) return CANONICAL_HIJRI_MONTHS[6].en;
  if (lower.includes('sha') && lower.includes('ban')) return CANONICAL_HIJRI_MONTHS[7].en;
  if (lower.includes('ramad') || lower.includes('ramaḍ')) return CANONICAL_HIJRI_MONTHS[8].en;
  if (lower.includes('shaww')) return CANONICAL_HIJRI_MONTHS[9].en;
  if (lower.includes('qa') && lower.includes('da')) return CANONICAL_HIJRI_MONTHS[10].en;
  if (lower.includes('hijj') || lower.includes('ḥijj')) return CANONICAL_HIJRI_MONTHS[11].en;
  return clean;
}

function isTabularHijriLeapYear(year: number): boolean {
  return [2, 5, 7, 10, 13, 16, 18, 21, 24, 26, 29].includes(((year % 30) + 30) % 30);
}

function getTabularMonthLength(month: number, year: number): number {
  if (month % 2 === 1) return 30;
  if (month === 12) return isTabularHijriLeapYear(year) ? 30 : 29;
  return 29;
}

function calculateTabularFallback(date: Date): { day: number; month: number; year: number } {
  const a = Math.floor((14 - (date.getMonth() + 1)) / 12);
  const y = date.getFullYear() + 4800 - a;
  const m = date.getMonth() + 1 + 12 * a - 3;
  const julianDay =
    date.getDate() +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045;

  const hijriEpoch = 1948439.5;
  const daysSinceEpoch = Math.floor(julianDay - hijriEpoch);
  const yearLength = (yr: number) => (isTabularHijriLeapYear(yr) ? 355 : 354);

  let year = 1;
  let accumulatedDays = 0;
  while (accumulatedDays + yearLength(year) <= daysSinceEpoch) {
    accumulatedDays += yearLength(year);
    year++;
  }

  const dayOfYear = daysSinceEpoch - accumulatedDays;
  let month = 1;
  let monthStart = 1;
  for (let mm = 1; mm <= 12; mm++) {
    const ml = getTabularMonthLength(mm, year);
    if (dayOfYear < monthStart + ml - 1) {
      month = mm;
      break;
    }
    monthStart += ml;
  }

  const day = dayOfYear - monthStart + 2;
  return { day, month, year };
}

function computeUmmAlQuraParts(effectiveDate: Date): { day: number; month: number; year: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    });
    const parts = fmt.formatToParts(effectiveDate);
    const day = parseInt(parts.find((p) => p.type === 'day')?.value || '', 10);
    const month = parseInt(parts.find((p) => p.type === 'month')?.value || '', 10);
    const year = parseInt(parts.find((p) => p.type === 'year')?.value || '', 10);
    if (
      Number.isFinite(day) && day >= 1 && day <= 30 &&
      Number.isFinite(month) && month >= 1 && month <= 12 &&
      Number.isFinite(year) && year >= 1
    ) {
      return { day, month, year };
    }
  } catch {
    // Fallback to tabular calculation when Intl islamic-umalqura is unavailable
  }
  return calculateTabularFallback(effectiveDate);
}

export interface UnifiedHijriResult {
  gregorianDate: Date;
  gregorianIso: string;
  formattedGregorian: string;
  weekday: string;
  hijriDay: number;
  hijriMonthNumber: number;
  hijriMonthEn: string;
  hijriMonthAr: string;
  hijriYear: number;
  formattedHijri: string;
  isAyyamAlBeed: boolean;
  isSunnahFastingDay: boolean;
  isRamadan: boolean;
}

function parseGregorianInput(input: Date | string): Date | null {
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 12, 0, 0, 0);
  }
  if (typeof input === 'string') {
    const parts = input.trim().split('-');
    if (parts.length !== 3) return null;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    const d = new Date(year, month, day, 12, 0, 0, 0);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  return null;
}

export function convertGregorianToHijri(
  dateInput: Date | string,
  offset: number = getStoredHijriOffset()
): UnifiedHijriResult | null {
  const d = parseGregorianInput(dateInput);
  if (!d) return null;

  const safeOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;
  const eff = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  if (safeOffset !== 0) {
    eff.setDate(eff.getDate() + safeOffset);
  }

  const { day: hijriDay, month: hijriMonthNumber, year: hijriYear } = computeUmmAlQuraParts(eff);
  const monthInfo = CANONICAL_HIJRI_MONTHS[hijriMonthNumber - 1] || CANONICAL_HIJRI_MONTHS[0];
  const pad = (n: number) => String(n).padStart(2, '0');

  return {
    gregorianDate: d,
    gregorianIso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    formattedGregorian: d.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
    hijriDay,
    hijriMonthNumber,
    hijriMonthEn: monthInfo.en,
    hijriMonthAr: monthInfo.ar,
    hijriYear,
    formattedHijri: `${hijriDay} ${monthInfo.en} ${hijriYear} AH`,
    isAyyamAlBeed: hijriDay >= 13 && hijriDay <= 15,
    isSunnahFastingDay: d.getDay() === 1 || d.getDay() === 4,
    isRamadan: hijriMonthNumber === 9,
  };
}

export function convertHijriToGregorian(
  hYear: number,
  hMonth: number,
  hDay: number,
  offset: number = getStoredHijriOffset()
): UnifiedHijriResult | null {
  if (!Number.isFinite(hYear) || !Number.isFinite(hMonth) || !Number.isFinite(hDay)) {
    return null;
  }
  const safeMonth = Math.max(1, Math.min(12, Math.trunc(hMonth)));
  const safeDay = Math.max(1, Math.min(30, Math.trunc(hDay)));
  const safeYear = Math.trunc(hYear);
  const safeOffset = Number.isFinite(offset) ? Math.trunc(offset) : 0;

  // Approximate Gregorian date via tabular epoch, then refine cleanly against convertGregorianToHijri
  let days = 0;
  for (let y = 1; y < safeYear; y++) {
    days += isTabularHijriLeapYear(y) ? 355 : 354;
  }
  for (let m = 1; m < safeMonth; m++) {
    days += m % 2 === 1 ? 30 : 29;
  }
  days += safeDay - 1;
  const epoch = 1948439.5;
  const jdn = Math.round(epoch + days);
  const l = jdn + 68569;
  const n = Math.floor((4 * l) / 146097);
  const l2 = l - Math.floor((146097 * n + 3) / 4);
  const i = Math.floor((4000 * (l2 + 1)) / 1461001);
  const l3 = l2 - Math.floor((1461 * i) / 4) + 31;
  const j = Math.floor((80 * l3) / 2447);
  const gDay = l3 - Math.floor((2447 * j) / 80);
  const l4 = Math.floor(j / 11);
  const gMonth = j + 2 - 12 * l4;
  const gYear = 100 * (n - 49) + i + l4;

  const approx = new Date(gYear, gMonth - 1, gDay, 12, 0, 0, 0);
  if (safeOffset !== 0) {
    approx.setDate(approx.getDate() - safeOffset);
  }

  // Exact match scan within +/- 40 days so Umm al-Qura round-trips with 0-day drift
  for (let delta = 0; delta <= 40; delta++) {
    const offsetsToTry = delta === 0 ? [0] : [-delta, delta];
    for (const dShift of offsetsToTry) {
      const candidate = new Date(approx.getFullYear(), approx.getMonth(), approx.getDate() + dShift, 12, 0, 0, 0);
      const converted = convertGregorianToHijri(candidate, safeOffset);
      if (
        converted &&
        converted.hijriYear === safeYear &&
        converted.hijriMonthNumber === safeMonth &&
        converted.hijriDay === safeDay
      ) {
        return converted;
      }
    }
  }

  // Fallback for 30th day of a 29-day Umm al-Qura month: resolve cleanly to day 29
  if (safeDay === 30) {
    const resolvedLastDay = convertHijriToGregorian(safeYear, safeMonth, 29, safeOffset);
    if (resolvedLastDay) return resolvedLastDay;
  }

  const monthInfo = CANONICAL_HIJRI_MONTHS[safeMonth - 1] || CANONICAL_HIJRI_MONTHS[0];
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    gregorianDate: approx,
    gregorianIso: `${approx.getFullYear()}-${pad(approx.getMonth() + 1)}-${pad(approx.getDate())}`,
    formattedGregorian: approx.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    weekday: approx.toLocaleDateString('en-US', { weekday: 'long' }),
    hijriDay: safeDay,
    hijriMonthNumber: safeMonth,
    hijriMonthEn: monthInfo.en,
    hijriMonthAr: monthInfo.ar,
    hijriYear: safeYear,
    formattedHijri: `${safeDay} ${monthInfo.en} ${safeYear} AH`,
    isAyyamAlBeed: safeDay >= 13 && safeDay <= 15,
    isSunnahFastingDay: approx.getDay() === 1 || approx.getDay() === 4,
    isRamadan: safeMonth === 9,
  };
}
