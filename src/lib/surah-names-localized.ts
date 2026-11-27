// Siraj — Localized Surah Names Mapping
// Supports full native script localization across English, Urdu & Gujarati (all 114 Surahs)

export interface LocalizedSurahNames {
  en: string;
  ur: string;
  gu: string;
}

export const SURAH_LOCALIZED_NAMES: Record<number, LocalizedSurahNames> = {
  1: { en: "Al-Fatiha", ur: "الفاتحہ", gu: "અલ-ફાતિહા" },
  2: { en: "Al-Baqarah", ur: "البقرہ", gu: "અલ-બકરહ" },
  3: { en: "Ali 'Imran", ur: "آل عمران", gu: "આલે ઇમરાન" },
  4: { en: "An-Nisa", ur: "النساء", gu: "અન-નિસા" },
  5: { en: "Al-Ma'idah", ur: "المائدہ", gu: "અલ-માઇદાહ" },
  6: { en: "Al-An'am", ur: "الانعام", gu: "અલ-અનઆમ" },
  7: { en: "Al-A'raf", ur: "الاعراف", gu: "અલ-અઅરાફ" },
  8: { en: "Al-Anfal", ur: "الانفال", gu: "અલ-અનફાલ" },
  9: { en: "At-Tawbah", ur: "التوبہ", gu: "અત-તૌબાહ" },
  10: { en: "Yunus", ur: "یونس", gu: "યૂનુસ" },
  11: { en: "Hud", ur: "ہود", gu: "હૂદ" },
  12: { en: "Yusuf", ur: "یوسف", gu: "યૂસુફ" },
  13: { en: "Ar-Ra'd", ur: "الرعد", gu: "અર-રઅદ" },
  14: { en: "Ibrahim", ur: "ابراہیم", gu: "ઇબ્રાહીમ" },
  15: { en: "Al-Hijr", ur: "الحجر", gu: "અલ-હિજ્ર" },
  16: { en: "An-Nahl", ur: "النحل", gu: "અન-નહલ" },
  17: { en: "Al-Isra", ur: "الاسراء", gu: "અલ-ઇસરા" },
  18: { en: "Al-Kahf", ur: "الکہف", gu: "અલ-કહફ" },
  19: { en: "Maryam", ur: "مریم", gu: "મરયમ" },
  20: { en: "Ta-Ha", ur: "طٰہٰ", gu: "તા-હા" },
  21: { en: "Al-Anbiya", ur: "الانبیاء", gu: "અલ-અમ્બિયા" },
  22: { en: "Al-Hajj", ur: "الحج", gu: "અલ-હજ" },
  23: { en: "Al-Mu'minun", ur: "المؤمنون", gu: "અલ-મુમિનૂન" },
  24: { en: "An-Nur", ur: "النور", gu: "અન-નૂર" },
  25: { en: "Al-Furqan", ur: "الفرقان", gu: "અલ-ફુરકાન" },
  26: { en: "Ash-Shu'ara", ur: "الشعراء", gu: "અશ-શુઅરા" },
  27: { en: "An-Naml", ur: "النمل", gu: "અન-નમ્લ" },
  28: { en: "Al-Qasas", ur: "القصص", gu: "અલ-કસસ" },
  29: { en: "Al-Ankabut", ur: "العنکبوت", gu: "અલ-અનકબૂત" },
  30: { en: "Ar-Rum", ur: "الروم", gu: "અર-રૂમ" },
  31: { en: "Luqman", ur: "لقمان", gu: "લુકમાન" },
  32: { en: "As-Sajdah", ur: "السجدہ", gu: "અસ-સજદહ" },
  33: { en: "Al-Ahzab", ur: "الاحزاب", gu: "અલ-અહઝાબ" },
  34: { en: "Saba", ur: "سبا", gu: "સબા" },
  35: { en: "Fatir", ur: "فاطر", gu: "ફાતિર" },
  36: { en: "Ya-Sin", ur: "یٰس", gu: "યાસીન" },
  37: { en: "As-Saffat", ur: "الصافات", gu: "અસ-સાફ્ફાત" },
  38: { en: "Sad", ur: "ص", gu: "સાદ" },
  39: { en: "Az-Zumar", ur: "الزمر", gu: "અઝ-ઝુમર" },
  40: { en: "Ghafir", ur: "غافر", gu: "ગાફિર" },
  41: { en: "Fussilat", ur: "فصلت", gu: "ફુસ્સિલત" },
  42: { en: "Ash-Shura", ur: "الشوریٰ", gu: "અશ-શૂરા" },
  43: { en: "Az-Zukhruf", ur: "الزخرف", gu: "અઝ-ઝુખરૂફ" },
  44: { en: "Ad-Dukhan", ur: "الدخان", gu: "અદ-દુખાન" },
  45: { en: "Al-Jathiyah", ur: "الجاثیہ", gu: "અલ-જાસિયાહ" },
  46: { en: "Al-Ahqaf", ur: "الاحقاف", gu: "અલ-અહકાફ" },
  47: { en: "Muhammad", ur: "محمد", gu: "મુહમ્મદ" },
  48: { en: "Al-Fath", ur: "الفتح", gu: "અલ-ફતહ" },
  49: { en: "Al-Hujurat", ur: "الحجرات", gu: "અલ-હુજુરાત" },
  50: { en: "Qaf", ur: "ق", gu: "કાફ" },
  51: { en: "Adh-Dhariyat", ur: "الذاریات", gu: "અઝ-ઝારિયાત" },
  52: { en: "At-Tur", ur: "الطور", gu: "અત-તૂર" },
  53: { en: "An-Najm", ur: "النجم", gu: "અન-નજ્મ" },
  54: { en: "Al-Qamar", ur: "القمر", gu: "અલ-કમર" },
  55: { en: "Ar-Rahman", ur: "الرحمن", gu: "અર-રહમાન" },
  56: { en: "Al-Waqi'ah", ur: "الواقعہ", gu: "અલ-વાકિઅહ" },
  57: { en: "Al-Hadid", ur: "الحدید", gu: "અલ-હદીદ" },
  58: { en: "Al-Mujadilah", ur: "المجادلہ", gu: "અલ-મુજાદિલાહ" },
  59: { en: "Al-Hashr", ur: "الحشر", gu: "અલ-હશ્ર" },
  60: { en: "Al-Mumtahanah", ur: "الممتحنہ", gu: "અલ-મુમ્તહિનાહ" },
  61: { en: "As-Saff", ur: "الصف", gu: "અસ-સફ" },
  62: { en: "Al-Jumu'ah", ur: "الجمعہ", gu: "અલ-જુમુઅહ" },
  63: { en: "Al-Munafiqun", ur: "المنافقون", gu: "અલ-મુનાફિકૂન" },
  64: { en: "At-Taghabun", ur: "التغابن", gu: "અત-તગાબુન" },
  65: { en: "At-Talaq", ur: "الطلاق", gu: "અત-તલાક" },
  66: { en: "At-Tahrim", ur: "التحریم", gu: "અત-તહરીમ" },
  67: { en: "Al-Mulk", ur: "الملک", gu: "અલ-મુલ્ક" },
  68: { en: "Al-Qalam", ur: "القلم", gu: "અલ-કલમ" },
  69: { en: "Al-Haqqah", ur: "الحاقہ", gu: "અલ-હાક્કાહ" },
  70: { en: "Al-Ma'arij", ur: "المعارج", gu: "અલ-મઆરિજ" },
  71: { en: "Nuh", ur: "نوح", gu: "નૂહ" },
  72: { en: "Al-Jinn", ur: "الجن", gu: "અલ-જિન્ન" },
  73: { en: "Al-Muzzammil", ur: "المزمل", gu: "અલ-મુઝ્ઝમ્મિલ" },
  74: { en: "Al-Muddaththir", ur: "المدثر", gu: "અલ-મુદ્દસ્સિર" },
  75: { en: "Al-Qiyamah", ur: "القیامہ", gu: "અલ-કિયામાહ" },
  76: { en: "Al-Insan", ur: "الانسان", gu: "અલ-ઇન્સાન" },
  77: { en: "Al-Mursalat", ur: "المرسلات", gu: "અલ-મુર્સલાત" },
  78: { en: "An-Naba", ur: "النباء", gu: "અન-નબા" },
  79: { en: "An-Nazi'at", ur: "النازعات", gu: "અન-નાઝિઆત" },
  80: { en: "'Abasa", ur: "عبس", gu: "અબસ" },
  81: { en: "At-Takwir", ur: "التکویر", gu: "અત-તકવીર" },
  82: { en: "Al-Infitar", ur: "الانفطار", gu: "અલ-ઇન્ફિતાર" },
  83: { en: "Al-Mutaffifin", ur: "المطففین", gu: "અલ-મુતફ્ફિફીન" },
  84: { en: "Al-Inshiqaq", ur: "الانشقاق", gu: "અલ-ઇન્શિકાક" },
  85: { en: "Al-Buruj", ur: "البروج", gu: "અલ-બુરુજ" },
  86: { en: "At-Tariq", ur: "الطارق", gu: "અત-તારિક" },
  87: { en: "Al-A'la", ur: "الاعلیٰ", gu: "અલ-અઅલા" },
  88: { en: "Al-Ghashiyah", ur: "الغاشیہ", gu: "અલ-ગાશિયાહ" },
  89: { en: "Al-Fajr", ur: "الفجر", gu: "અલ-ફજ્ર" },
  90: { en: "Al-Balad", ur: "البلد", gu: "અલ-બલદ" },
  91: { en: "Ash-Shams", ur: "الشمس", gu: "અશ-શમ્સ" },
  92: { en: "Al-Layl", ur: "اللیل", gu: "અલ-લયલ" },
  93: { en: "Ad-Duha", ur: "الضحیٰ", gu: "અદ-દુહા" },
  94: { en: "Ash-Sharh", ur: "الشرح", gu: "અશ-શર્હ" },
  95: { en: "At-Tin", ur: "التین", gu: "અત-તીન" },
  96: { en: "Al-'Alaq", ur: "العلق", gu: "અલ-અલક" },
  97: { en: "Al-Qadr", ur: "القدر", gu: "અલ-કદર" },
  98: { en: "Al-Bayyinah", ur: "البینہ", gu: "અલ-બય્યિનાહ" },
  99: { en: "Az-Zalzalah", ur: "الزلزلہ", gu: "અઝ-ઝલઝલાહ" },
  100: { en: "Al-'Adiyat", ur: "العادیات", gu: "અલ-આદિયાત" },
  101: { en: "Al-Qari'ah", ur: "القارئہ", gu: "અલ-કારિઅહ" },
  102: { en: "At-Takathur", ur: "التکاثر", gu: "અત-તકાસુર" },
  103: { en: "Al-'Asr", ur: "العصر", gu: "અલ-અસ્ર" },
  104: { en: "Al-Humazah", ur: "الہمزہ", gu: "અલ-હુમઝહ" },
  105: { en: "Al-Fil", ur: "الفیل", gu: "અલ-ફીલ" },
  106: { en: "Quraysh", ur: "قریش", gu: "કુરૈશ" },
  107: { en: "Al-Ma'un", ur: "الماعون", gu: "અલ-માઉન" },
  108: { en: "Al-Kawthar", ur: "الکوثر", gu: "અલ-કૌસર" },
  109: { en: "Al-Kafirun", ur: "الکافرون", gu: "અલ-કાફિરૂન" },
  110: { en: "An-Nasr", ur: "النصر", gu: "અન-નસ્ર" },
  111: { en: "Al-Masad", ur: "المسد", gu: "અલ-મસદ" },
  112: { en: "Al-Ikhlas", ur: "الاخلاص", gu: "અલ-ઇખ્લાસ" },
  113: { en: "Al-Falaq", ur: "الفلق", gu: "અલ-ફલક" },
  114: { en: "An-Nas", ur: "الناس", gu: "અન-નાસ" },
};

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Pre-computed normalized name lookup table to Surah number
const NAME_TO_SURAH_NUMBER: Record<string, number> = {};
Object.entries(SURAH_LOCALIZED_NAMES).forEach(([numStr, info]) => {
  const num = Number(numStr);
  NAME_TO_SURAH_NUMBER[normalizeKey(info.en)] = num;
});

// Common alternative aliases
const SURAH_ALIASES: Record<string, number> = {
  fatiha: 1,
  fatihah: 1,
  alfatihah: 1,
  baqara: 2,
  albaqara: 2,
  baqarah: 2,
  imran: 3,
  aliimran: 3,
  alimran: 3,
  almaidah: 5,
  talaq: 65,
  attalaq: 65,
  sharh: 94,
  ashsharh: 94,
  inshirah: 94,
  rad: 13,
  arrad: 13,
  dhariyat: 51,
  adhdhariyat: 51,
  yasin: 36,
  yaseen: 36,
  rahman: 55,
  arrahman: 55,
  mulk: 67,
  almulk: 67,
  kahf: 18,
  alkahf: 18,
  ikhlas: 112,
  alikhlas: 112,
  falaq: 113,
  alfalaq: 113,
  nas: 114,
  annas: 114,
  waqiah: 56,
  alwaqiah: 56,
  tawbah: 9,
  attawbah: 9,
  tawba: 9,
};

/**
 * Resolves a localized Surah name across Urdu, Gujarati, or English.
 * Safely accepts either a Surah number (1-114) or any English Surah name string.
 */
export function getLocalizedSurahName(
  surah: number | string | undefined | null,
  lang: 'en' | 'ur' | 'gu' | string
): string {
  if (!surah) return '';

  let surahNum: number | undefined;

  if (typeof surah === 'number' && surah >= 1 && surah <= 114) {
    surahNum = surah;
  } else if (typeof surah === 'string') {
    const parsedNum = parseInt(surah, 10);
    if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 114) {
      surahNum = parsedNum;
    } else {
      const key = normalizeKey(surah);
      surahNum = SURAH_ALIASES[key] ?? NAME_TO_SURAH_NUMBER[key];
    }
  }

  if (surahNum && SURAH_LOCALIZED_NAMES[surahNum]) {
    const info = SURAH_LOCALIZED_NAMES[surahNum];
    if (lang === 'ur') return info.ur;
    if (lang === 'gu') return info.gu;
    return info.en;
  }

  // Graceful fallback to input string
  return typeof surah === 'string' ? surah : String(surah);
}
