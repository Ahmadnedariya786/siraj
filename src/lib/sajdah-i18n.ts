import type { LanguageCode } from '@/lib/i18n-ui';

export interface SajdahI18nStrings {
  pageTitle: string;
  pageSubtitle: string;
  totalPending: string;
  performedAllTime: string;
  makruhActiveWarning: string; // {end}
  qiblaShortcut: string; // {deg}
  cleanWindowStatus: string;
  pendingQueueTitle: string;
  emptyPendingTitle: string;
  emptyPendingBody: string;
  sourceRead: string;
  sourceListen: string;
  sourceManual: string;
  sourceHeard: string;
  justNow: string;
  minsAgo: string; // {n}
  hoursAgo: string; // {n}
  daysAgo: string; // {n}
  performedMinusOne: string;
  openAyah: string;
  juzLabel: string;
  makruhModalTitle: string;
  makruhModalBody: string; // {name}, {end}
  waitUntilBtn: string; // {end}
  performedEarlierBtn: string;
  khatamTitle: string;
  khatamDesc: string; // {count}
  addAllKhatamBtn: string; // {count}
  khatamModalTitle: string;
  khatamModalBody: string; // {count}, {scope}
  khatamScopeStandard: string;
  khatamScopeShafi: string;
  confirmAddAllBtn: string; // {count}
  cancelBtn: string;
  directoryTitle: string; // {count}
  searchPlaceholder: string;
  filterAll: string;
  filterPendingOnly: string;
  filterShafiOnly: string;
  shafiBadge: string;
  addOnePending: string;
  readBtn: string;
  pendingBadgeCount: string; // {n}
  noDirectoryMatches: string;
  guideTitle: string;
  guideSubtitle: string;
  guideSteps: string[];
  guideDuaTitle: string;
  guideDuaBadge: string;
  guideDuaArabic: string;
  guideDuaTranslit: string;
  guideDuaTranslation: string;
  guideMadhabNote: string;
  historyTitle: string;
  thisMonthSummary: string; // {count}
  methodImmediate: string;
  methodLater: string;
  emptyHistory: string;
  undoBtn: string;
  toastAddedPending: string; // {ref}
  toastKhatamAdded: string; // {count}
  toastMarkedPerformed: string; // {ref}
  toastImmediateLogged: string; // {ref}
  toastUndone: string;
  inReaderSajdahAyah: string;
  inReaderNotTracked: string;
  inReaderPendingCount: string; // {n}
  inReaderPerformed: string;
  inReaderPerformedNow: string;
  inReaderSavePending: string;
  inReaderViewPending: string; // {n}
  tilawahChipPrompt: string;
  tilawahDone: string;
  tilawahTrack: string;
  tilawahNotNow: string;
  entryTitle: string;
  entrySubtitle14: string;
  entrySubtitle15: string;
  entryClear: string; // {count}
  entryPendingCount: string; // {n}
  qazaPillLabel: string;
  homePillText: string; // {n}
  journalPodLabel: string;
  settingsReminderTitle: string;
  settingsReminderDesc: string;
  settingsReminderEnabledToast: string;
  settingsReminderDisabledToast: string;
  settingsReminderActiveHint: string;
  settingsReminderIdleHint: string;
  notifTitle: string;
  notifBody: string; // {n}
}

const EN_STRINGS: SajdahI18nStrings = {
  pageTitle: 'Sajdah-e-Tilawat',
  pageSubtitle: 'Sacred Prostrations of the Quran',
  totalPending: 'Total Pending',
  performedAllTime: 'Performed All-Time',
  makruhActiveWarning: '⏳ Makruh Waqt active until {end} — wait before performing Sajdah-e-Tilawat',
  qiblaShortcut: 'Qibla {deg}°',
  cleanWindowStatus: 'Safe window • Ready',
  pendingQueueTitle: 'Pending Queue',
  emptyPendingTitle: 'All Caught Up',
  emptyPendingBody: 'You have no pending Sajdah-e-Tilawat prostrations. Recite and reflect in peace.',
  sourceRead: 'Read',
  sourceListen: 'Listened',
  sourceManual: 'Manual',
  sourceHeard: 'Heard',
  justNow: 'Just now',
  minsAgo: '{n}m ago',
  hoursAgo: '{n}h ago',
  daysAgo: '{n}d ago',
  performedMinusOne: '✓ Performed (-1)',
  openAyah: 'Open Ayah',
  juzLabel: 'Juz',
  makruhModalTitle: 'Makruh Waqt Active',
  makruhModalBody: 'Makruh Waqt ({name}) ends at {end}. Performing Sajdah-e-Tilawat during Makruh time is prohibited — did you perform this earlier?',
  waitUntilBtn: 'Wait until {end}',
  performedEarlierBtn: 'Yes, performed earlier',
  khatamTitle: 'Full Quran Khatam',
  khatamDesc: 'Completed a full Quran Khatam or catching up? Queue +1 for all {count} Sajdah ayahs at once.',
  addAllKhatamBtn: '+ Add All {count} (Full Quran Khatam)',
  khatamModalTitle: 'Add Full Quran Khatam Sajdahs?',
  khatamModalBody: 'This will add +1 pending Sajdah-e-Tilawat across all {count} ayahs ({scope}). You will have 10 seconds to undo.',
  khatamScopeStandard: '14 agreed ayahs',
  khatamScopeShafi: '14 agreed + 22:77 Shafi\'i/Hanbali',
  confirmAddAllBtn: 'Add All {count}',
  cancelBtn: 'Cancel',
  directoryTitle: 'Complete {count}-Ayah Directory',
  searchPlaceholder: 'Search surah, ayah, or Juz...',
  filterAll: 'All',
  filterPendingOnly: 'Pending',
  filterShafiOnly: "Shafi'i / Hanbali",
  shafiBadge: "Shafi'i / Hanbali",
  addOnePending: '+1 Pending',
  readBtn: 'Read',
  pendingBadgeCount: '{n} Pending',
  noDirectoryMatches: 'No Sajdah ayahs match your search.',
  guideTitle: 'How to Perform Sajdah-e-Tilawat',
  guideSubtitle: 'Authentic steps, Sunnah Dua & Fiqh rulings',
  guideSteps: [
    'Ensure Wudu (ablution), clean garments/place, and face the Qibla.',
    'Make quiet Niyyah (intention) in your heart for Sajdah-e-Tilawat.',
    'Say Allahu Akbar without raising hands and go directly into one Sajdah.',
    'In Sajdah, recite Subhana Rabbiyal A\'la (3×) and the Sunnah Dua below.',
    'Rise by saying Allahu Akbar. There is NO Tashahhud and NO Salam afterward.',
  ],
  guideDuaTitle: 'Sunnah Dua in Sajdah',
  guideDuaBadge: 'Hasan Sahih • Tirmidhi 580',
  guideDuaArabic: 'سَجَدَ وَجْهِيَ لِلَّذِي خَلَقَهُ وَصَوَّرَهُ وَشَقَّ سَمْعَهُ وَبَصَرَهُ بِحَوْلِهِ وَقُوَّتِهِ فَتَبَارَكَ اللَّهُ أَحْسَنُ الْخَالِقِينَ',
  guideDuaTranslit: "Sajada wajhiya lilladhi khalaqahu wa sawwarahu wa shaqqa sam'ahu wa basarahu bi-hawlihi wa quwwatihi, fatabarakallahu ahsanul-khaliqin.",
  guideDuaTranslation: 'My face prostrates to Him Who created it, fashioned it, and brought forth its hearing and sight by His might and power. Blessed be Allah, the Best of creators.',
  guideMadhabNote: "Fiqh Ruling — Hanafi: Wajib (obligatory upon reciting or hearing any of the 14 ayahs). Shafi'i, Maliki & Hanbali: Sunnah Mu'akkadah (strongly emphasized Sunnah).",
  historyTitle: 'History',
  thisMonthSummary: '{count} this month',
  methodImmediate: 'Immediate',
  methodLater: 'Performed Later',
  emptyHistory: 'Performed Sajdahs will appear here grouped by date.',
  undoBtn: 'Undo',
  toastAddedPending: 'Added +1 pending ({ref})',
  toastKhatamAdded: 'Added +1 for all {count} Khatam Sajdahs',
  toastMarkedPerformed: 'Sajdah performed ({ref})',
  toastImmediateLogged: 'Sajdah logged ({ref})',
  toastUndone: 'Sajdah action undone',
  inReaderSajdahAyah: 'Sajdah-e-Tilawat Ayah',
  inReaderNotTracked: 'Not tracked',
  inReaderPendingCount: 'Pending ×{n}',
  inReaderPerformed: 'Performed',
  inReaderPerformedNow: '✓ Performed Now',
  inReaderSavePending: '+ Save to Pending',
  inReaderViewPending: 'View Pending ({n})',
  tilawahChipPrompt: 'Sajdah ayat',
  tilawahDone: '✓ Done',
  tilawahTrack: 'Track',
  tilawahNotNow: 'Not now',
  entryTitle: 'Sajdah Tracker',
  entrySubtitle14: '14 Quranic sajdahs',
  entrySubtitle15: '15 Quranic sajdahs',
  entryClear: '{count} Ayahs • Clear',
  entryPendingCount: '{n} Pending',
  qazaPillLabel: 'Sajdah-e-Tilawat',
  homePillText: '{n} Sajdah Pending',
  journalPodLabel: 'Sajdah Owed',
  settingsReminderTitle: 'Sajdah-e-Tilawat Reminder',
  settingsReminderDesc: 'Daily 20:00 reminder only when pending Sajdahs exist',
  settingsReminderEnabledToast: 'Sajdah-e-Tilawat Reminder enabled',
  settingsReminderDisabledToast: 'Sajdah-e-Tilawat Reminder disabled',
  settingsReminderActiveHint: 'Scheduled daily at 20:00 while pending queue > 0',
  settingsReminderIdleHint: 'Paused automatically when pending count is 0',
  notifTitle: 'Sajdah-e-Tilawat Pending',
  notifBody: 'You have {n} pending Sajdah-e-Tilawat prostration(s) waiting.',
};

const UR_STRINGS: SajdahI18nStrings = {
  pageTitle: 'سجدۂ تلاوت',
  pageSubtitle: 'قرآنِ مجید کے مقدس سجدے',
  totalPending: 'باقی سجدے',
  performedAllTime: 'مجموعی ادا شدہ',
  makruhActiveWarning: '⏳ مکروہ وقت {end} تک جاری ہے — سجدۂ تلاوت سے پہلے انتظار کریں',
  qiblaShortcut: 'قبلہ {deg}°',
  cleanWindowStatus: 'موزوں وقت • تیار',
  pendingQueueTitle: 'باقی سجدوں کی فہرست',
  emptyPendingTitle: 'کوئی سجدہ باقی نہیں',
  emptyPendingBody: 'آپ کے ذمے کوئی سجدۂ تلاوت باقی نہیں ہے۔ سکون کے ساتھ تلاوت جاری رکھیں۔',
  sourceRead: 'تلاوت',
  sourceListen: 'سماعت',
  sourceManual: 'دستی',
  sourceHeard: 'سُنا گیا',
  justNow: 'ابھی',
  minsAgo: '{n} منٹ پہلے',
  hoursAgo: '{n} گھنٹے پہلے',
  daysAgo: '{n} دن پہلے',
  performedMinusOne: '✓ ادا کیا (-1)',
  openAyah: 'آیت کھولیں',
  juzLabel: 'پارہ',
  makruhModalTitle: 'مکروہ وقت جاری ہے',
  makruhModalBody: 'مکروہ وقت ({name}) {end} پر ختم ہوگا۔ مکروہ وقت میں سجدۂ تلاوت ممنوع ہے — کیا آپ نے یہ سجدہ پہلے ادا کر لیا تھا؟',
  waitUntilBtn: '{end} تک انتظار کریں',
  performedEarlierBtn: 'جی ہاں، پہلے ادا کیا',
  khatamTitle: 'مکمل ختمِ قرآن',
  khatamDesc: 'مکمل قرآن ختم کیا یا پرانے سجدے شامل کرنے ہیں؟ تمام {count} سجدوں میں ایک ساتھ +1 شامل کریں۔',
  addAllKhatamBtn: '+ تمام {count} شامل کریں (مکمل ختمِ قرآن)',
  khatamModalTitle: 'مکمل ختمِ قرآن کے سجدے شامل کریں؟',
  khatamModalBody: 'تمام {count} مستند آیات ({scope}) کے لیے +1 باقی سجدہ شامل کیا جائے گا۔ 10 سیکنڈ تک واپسی ممکن ہے۔',
  khatamScopeStandard: '14 متفقہ آیات',
  khatamScopeShafi: '14 متفقہ + 22:77 شافعی/حنبلی',
  confirmAddAllBtn: 'تمام {count} شامل کریں',
  cancelBtn: 'منسوخ کریں',
  directoryTitle: 'مکمل {count} آیاتِ سجدہ ڈائریکٹری',
  searchPlaceholder: 'سورہ، آیت یا پارہ تلاش کریں...',
  filterAll: 'سب',
  filterPendingOnly: 'باقی',
  filterShafiOnly: 'شافعی / حنبلی',
  shafiBadge: 'شافعی / حنبلی',
  addOnePending: '+1 باقی',
  readBtn: 'پڑھیں',
  pendingBadgeCount: '{n} باقی',
  noDirectoryMatches: 'کوئی سجدہ آیت نہیں ملی۔',
  guideTitle: 'سجدۂ تلاوت کا طریقہ',
  guideSubtitle: 'مسنون طریقہ، دعا اور فقہی احکام',
  guideSteps: [
    'باوضو ہوں، جگہ اور لباس پاک ہو اور قبلہ رخ کھڑے یا بیٹھے ہوں۔',
    'دل میں سجدۂ تلاوت کی نیت کریں۔',
    'ہاتھ اٹھائے بغیر اللہ اکبر کہتے ہوئے براہِ راست ایک سجدے میں جائیں۔',
    'سجدے میں تین بار سبحان ربی الاعلیٰ اور نیچے دی گئی مسنون دعا پڑھیں۔',
    'اللہ اکبر کہتے ہوئے سر اٹھائیں؛ اس میں تشہد اور سلام نہیں ہوتا۔',
  ],
  guideDuaTitle: 'سجدے کی مسنون دعا',
  guideDuaBadge: 'حسن صحیح • ترمذی 580',
  guideDuaArabic: EN_STRINGS.guideDuaArabic,
  guideDuaTranslit: EN_STRINGS.guideDuaTranslit,
  guideDuaTranslation: 'میرے چہرے نے اس ذات کو سجدہ کیا جس نے اسے پیدا کیا، اس کی صورت بنائی اور اپنی قوت و طاقت سے اس کے کان اور آنکھ کھولے؛ پس اللہ بہت بابرکت ہے جو سب سے بہترین پیدا فرمانے والا ہے۔',
  guideMadhabNote: 'فقہی حکم — حنفی: تلاوت کرنے یا سننے پر واجب۔ شافعی، مالکی و حنبلی: سنتِ مؤکدہ۔',
  historyTitle: 'ریکارڈ',
  thisMonthSummary: 'اس ماہ {count}',
  methodImmediate: 'فوری ادا',
  methodLater: 'بعد میں ادا',
  emptyHistory: 'ادا کیے گئے سجدے تاریخ کے لحاظ سے یہاں نظر آئیں گے۔',
  undoBtn: 'واپس لیں',
  toastAddedPending: 'باقی میں +1 شامل ({ref})',
  toastKhatamAdded: 'ختمِ قرآن کے تمام {count} سجدے شامل ہو گئے',
  toastMarkedPerformed: 'سجدہ ادا درج ہو گیا ({ref})',
  toastImmediateLogged: 'فوری سجدہ درج ({ref})',
  toastUndone: 'عمل واپس لے لیا گیا',
  inReaderSajdahAyah: 'آیتِ سجدۂ تلاوت',
  inReaderNotTracked: 'درج نہیں',
  inReaderPendingCount: 'باقی ×{n}',
  inReaderPerformed: 'ادا شدہ',
  inReaderPerformedNow: '✓ ابھی ادا کیا',
  inReaderSavePending: '+ باقی میں محفوظ کریں',
  inReaderViewPending: 'باقی دیکھیں ({n})',
  tilawahChipPrompt: 'آیتِ سجدہ',
  tilawahDone: '✓ ادا کیا',
  tilawahTrack: 'محفوظ کریں',
  tilawahNotNow: 'ابھی نہیں',
  entryTitle: 'سجدہ ٹریکر',
  entrySubtitle14: '14 قرآنی سجدے',
  entrySubtitle15: '15 قرآنی سجدے',
  entryClear: '{count} آیات • مکمل',
  entryPendingCount: '{n} باقی',
  qazaPillLabel: 'سجدۂ تلاوت',
  homePillText: '{n} سجدے باقی',
  journalPodLabel: 'باقی سجدے',
  settingsReminderTitle: 'سجدۂ تلاوت یاد دہانی',
  settingsReminderDesc: 'صرف باقی سجدے ہونے پر روزانہ رات 8:00 بجے یاد دہانی',
  settingsReminderEnabledToast: 'سجدۂ تلاوت یاد دہانی فعال ہو گئی',
  settingsReminderDisabledToast: 'سجدۂ تلاوت یاد دہانی بند کر دی گئی',
  settingsReminderActiveHint: 'باقی سجدے > 0 ہونے پر روزانہ 20:00 پر مقرر',
  settingsReminderIdleHint: 'باقی سجدے صفر ہونے پر خودکار طور پر رُکی ہوئی',
  notifTitle: 'سجدۂ تلاوت باقی ہے',
  notifBody: 'آپ کے {n} سجدۂ تلاوت ادا کرنا باقی ہیں۔',
};

const GU_STRINGS: SajdahI18nStrings = {
  pageTitle: 'સજદા-એ-તિલાવત',
  pageSubtitle: 'કુરાનના પવિત્ર સજદા',
  totalPending: 'બાકી સજદા',
  performedAllTime: 'કુલ અદા થયેલ',
  makruhActiveWarning: '⏳ મકરૂહ સમય {end} સુધી ચાલુ છે — સજદા-એ-તિલાવત પહેલાં રાહ જુઓ',
  qiblaShortcut: 'કિબ્લા {deg}°',
  cleanWindowStatus: 'યોગ્ય સમય • તૈયાર',
  pendingQueueTitle: 'બાકી સજદા યાદી',
  emptyPendingTitle: 'બધા સજદા પૂર્ણ',
  emptyPendingBody: 'તમારો કોઈ સજદા-એ-તિલાવત બાકી નથી. શાંતિથી તિલાવત ચાલુ રાખો.',
  sourceRead: 'વાંચન',
  sourceListen: 'શ્રવણ',
  sourceManual: 'મેન્યુઅલ',
  sourceHeard: 'સાંભળેલ',
  justNow: 'હમણાં જ',
  minsAgo: '{n} મિ. પહેલાં',
  hoursAgo: '{n} ક. પહેલાં',
  daysAgo: '{n} દિ. પહેલાં',
  performedMinusOne: '✓ અદા કર્યો (-1)',
  openAyah: 'આયત ખોલો',
  juzLabel: 'પારા',
  makruhModalTitle: 'મકરૂહ સમય ચાલુ છે',
  makruhModalBody: 'મકરૂહ સમય ({name}) {end} વાગ્યે પૂર્ણ થશે. મકરૂહ સમયમાં સજદા-એ-તિલાવત પ્રતિબંધિત છે — શું તમે આ સજદો પહેલાં અદા કર્યો હતો?',
  waitUntilBtn: '{end} સુધી રાહ જુઓ',
  performedEarlierBtn: 'હા, પહેલાં અદા કર્યો',
  khatamTitle: 'સંપૂર્ણ કુરાન ખતમ',
  khatamDesc: 'સંપૂર્ણ કુરાન ખતમ કર્યું? એકસાથે તમામ {count} સજદા આયતો માટે +1 ઉમેરો.',
  addAllKhatamBtn: '+ બધા {count} ઉમેરો (સંપૂર્ણ કુરાન ખતમ)',
  khatamModalTitle: 'સંપૂર્ણ ખતમના સજદા ઉમેરવા છે?',
  khatamModalBody: 'તમામ {count} આયતો ({scope}) માટે +1 બાકી સજદો ઉમેરાશે. 10 સેકન્ડમાં પૂર્વવત કરી શકાય છે.',
  khatamScopeStandard: '14 સર્વમાન્ય આયતો',
  khatamScopeShafi: '14 સર્વમાન્ય + 22:77 શાફઈ/હંબલી',
  confirmAddAllBtn: 'બધા {count} ઉમેરો',
  cancelBtn: 'રદ કરો',
  directoryTitle: 'સંપૂર્ણ {count}-આયત ડિરેક્ટરી',
  searchPlaceholder: 'સૂરા, આયત કે પારા શોધો...',
  filterAll: 'બધા',
  filterPendingOnly: 'બાકી',
  filterShafiOnly: 'શાફઈ / હંબલી',
  shafiBadge: 'શાફઈ / હંબલી',
  addOnePending: '+1 બાકી',
  readBtn: 'વાંચો',
  pendingBadgeCount: '{n} બાકી',
  noDirectoryMatches: 'કોઈ સજદા આયત મળી નથી.',
  guideTitle: 'સજદા-એ-તિલાવત કરવાની રીત',
  guideSubtitle: 'સુન્નત રીત, દુઆ અને ફિક્હના નિયમો',
  guideSteps: [
    'વુઝૂ સાથે પાક જગ્યાએ કિબ્લા તરફ મુખ કરીને ઊભા કે બેસો.',
    'દિલમાં સજદા-એ-તિલાવતની નિય્યત કરો.',
    'હાથ ઉઠાવ્યા વિના અલ્લાહુ અકબર કહીને સીધા એક સજદામાં જાઓ.',
    'સજદામાં 3 વખત સુબ્હાન રબ્બિયલ અઅલા અને નીચેની સુન્નત દુઆ પઢો.',
    'અલ્લાહુ અકબર કહીને ઊભા થાઓ; આમાં તશહ્હુદ કે સલામ નથી.',
  ],
  guideDuaTitle: 'સજદાની સુન્નત દુઆ',
  guideDuaBadge: 'હસન સહીહ • તિર્મિઝી 580',
  guideDuaArabic: EN_STRINGS.guideDuaArabic,
  guideDuaTranslit: EN_STRINGS.guideDuaTranslit,
  guideDuaTranslation: 'મારા ચહેરાએ તે અલ્લાહને સજદો કર્યો જેણે તેને પેદા કર્યો, તેનું રૂપ બનાવ્યું અને પોતાની શક્તિથી તેના કાન અને આંખો ખોલ્યા; શ્રેષ્ઠ સર્જનહાર અલ્લાહ અત્યંત બરકતવાળો છે.',
  guideMadhabNote: 'ફિક્હ નિયમ — હનફી: પઢવા કે સાંભળવાથી વાજિબ. શાફઈ, માલિકી અને હંબલી: સુન્નત-એ-મુઅક્કદા.',
  historyTitle: 'ઇતિહાસ',
  thisMonthSummary: 'આ મહિને {count}',
  methodImmediate: 'તરત અદા',
  methodLater: 'પછી અદા',
  emptyHistory: 'અદા કરેલા સજદા તારીખ પ્રમાણે અહીં દેખાશે.',
  undoBtn: 'પાછું લો',
  toastAddedPending: '+1 બાકીમાં ઉમેરાયું ({ref})',
  toastKhatamAdded: 'ખતમના બધા {count} સજદા ઉમેરાયા',
  toastMarkedPerformed: 'સજદો અદા નોંધાયો ({ref})',
  toastImmediateLogged: 'સજદો નોંધાયો ({ref})',
  toastUndone: 'ક્રિયા પૂર્વવત કરાઈ',
  inReaderSajdahAyah: 'સજદા-એ-તિલાવત આયત',
  inReaderNotTracked: 'નોંધાયેલ નથી',
  inReaderPendingCount: 'બાકી ×{n}',
  inReaderPerformed: 'અદા થયેલ',
  inReaderPerformedNow: '✓ હમણાં અદા કર્યો',
  inReaderSavePending: '+ બાકીમાં સાચવો',
  inReaderViewPending: 'બાકી જુઓ ({n})',
  tilawahChipPrompt: 'સજદા આયત',
  tilawahDone: '✓ અદા કર્યો',
  tilawahTrack: 'સાચવો',
  tilawahNotNow: 'હમણાં નહીં',
  entryTitle: 'સજદા ટ્રેકર',
  entrySubtitle14: '14 કુરાની સજદા',
  entrySubtitle15: '15 કુરાની સજદા',
  entryClear: '{count} આયતો • પૂર્ણ',
  entryPendingCount: '{n} બાકી',
  qazaPillLabel: 'સજદા-એ-તિલાવત',
  homePillText: '{n} સજદા બાકી',
  journalPodLabel: 'બાકી સજદા',
  settingsReminderTitle: 'સજદા-એ-તિલાવત રિમાઇન્ડર',
  settingsReminderDesc: 'બાકી સજદા હોય ત્યારે જ દરરોજ રાત્રે 8:00 વાગ્યે યાદ અપાવે',
  settingsReminderEnabledToast: 'સજદા-એ-તિલાવત રિમાઇન્ડર ચાલુ કરાયું',
  settingsReminderDisabledToast: 'સજદા-એ-તિલાવત રિમાઇન્ડર બંધ કરાયું',
  settingsReminderActiveHint: 'બાકી સજદા > 0 હોય ત્યારે દરરોજ 20:00 વાગ્યે સેટ',
  settingsReminderIdleHint: 'બાકી સંખ્યા 0 હોય ત્યારે આપમેળે બંધ રહેશે',
  notifTitle: 'સજદા-એ-તિલાવત બાકી છે',
  notifBody: 'તમારા {n} સજદા-એ-તિલાવત અદા કરવા બાકી છે.',
};

const SAJDAH_I18N: Partial<Record<LanguageCode, SajdahI18nStrings>> = {
  en: EN_STRINGS,
  ur: UR_STRINGS,
  gu: GU_STRINGS,
};

export function getSajdahI18n(language: LanguageCode | string): SajdahI18nStrings {
  return SAJDAH_I18N[language as LanguageCode] ?? EN_STRINGS;
}

export function formatSajdahString(
  template: string,
  params: Record<string, string | number>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}
