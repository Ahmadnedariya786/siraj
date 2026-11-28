import type { ContentLang } from '@/lib/content-translator';

export interface LocalizedNameText {
  meaning: string;
  reflection: string;
}

export interface AsmaNameItem {
  number: number;
  arabic: string;
  transliteration: string;
  en: LocalizedNameText;
  ur: LocalizedNameText;
  gu: LocalizedNameText;
}

export interface NamesUIStrings {
  pageTitle: string;
  badge: string;
  arabicHeader: string;
  heroSub: string;
  searchPlaceholder: string;
  favoritesFilterLabel: string;
  attributeLabel: string;
  meaningLabel: string;
  reflectionLabel: string;
  prev: string;
  next: string;
  copy: string;
  copied: string;
  share: string;
  listen: string;
  stop: string;
  close: string;
  noMatches: string;
  clearFilters: string;
  audioUnsupported: string;
}

export const NAMES_UI_I18N: Record<ContentLang, NamesUIStrings> = {
  en: {
    pageTitle: '99 Names of Allah',
    badge: "Asma'ul Husna",
    arabicHeader: 'أَسْمَاءُ اللهِ الْحُسْنَى',
    heroSub: 'Memorize and reflect upon the beautiful attributes of the Creator.',
    searchPlaceholder: 'Search 99 Names...',
    favoritesFilterLabel: 'Favorites',
    attributeLabel: 'Attribute',
    meaningLabel: 'Meaning',
    reflectionLabel: 'Reflection',
    prev: 'Prev',
    next: 'Next',
    copy: 'Copy',
    copied: 'Copied',
    share: 'Share',
    listen: 'Listen',
    stop: 'Stop',
    close: 'Close',
    noMatches: 'No matches found for your search.',
    clearFilters: 'Clear all filters',
    audioUnsupported: 'Speech playback is unavailable on this device.',
  },
  ur: {
    pageTitle: 'اللہ کے ۹۹ نام',
    badge: 'اسماء الحسنیٰ',
    arabicHeader: 'أَسْمَاءُ اللهِ الْحُسْنَى',
    heroSub: 'خالقِ کائنات کے خوبصورت صفاتی ناموں کو یاد کریں اور ان پر غور و فکر کریں۔',
    searchPlaceholder: '۹۹ ناموں میں تلاش کریں...',
    favoritesFilterLabel: 'پسندیدہ',
    attributeLabel: 'صفت',
    meaningLabel: 'مفہوم',
    reflectionLabel: 'تدبر و غور',
    prev: 'پچھلا',
    next: 'اگلا',
    copy: 'کاپی',
    copied: 'کاپی ہو گیا',
    share: 'شیئر',
    listen: 'سنیں',
    stop: 'بند کریں',
    close: 'بند کریں',
    noMatches: 'آپ کی تلاش کے مطابق کوئی نام نہیں ملا۔',
    clearFilters: 'تمام فلٹرز صاف کریں',
    audioUnsupported: 'اس ڈیوائس پر صوتی تلاوت دستیاب نہیں ہے۔',
  },
  gu: {
    pageTitle: 'અલ્લાહના ૯૯ નામો',
    badge: 'અસ્માઉલ હુસ્ના',
    arabicHeader: 'أَسْمَاءُ اللهِ الْحُسْنَى',
    heroSub: 'સર્જનહારના સુંદર ગુણવાચક નામોને કંઠસ્થ કરો અને તેના પર ચિંતન કરો.',
    searchPlaceholder: '૯૯ નામો શોધો...',
    favoritesFilterLabel: 'મનપસંદ',
    attributeLabel: 'ગુણ',
    meaningLabel: 'અર્થ',
    reflectionLabel: 'ચિંતન',
    prev: 'પાછલું',
    next: 'આગળ',
    copy: 'કોપી',
    copied: 'કોપી થયું',
    share: 'શેર',
    listen: 'સાંભળો',
    stop: 'રોકો',
    close: 'બંધ કરો',
    noMatches: 'તમારી શોધ મુજબ કોઈ નામ મળ્યું નથી.',
    clearFilters: 'બધા ફિલ્ટર સાફ કરો',
    audioUnsupported: 'આ ઉપકરણ પર ઓડિયો પ્લેબેક ઉપલબ્ધ નથી.',
  },
};

export const NAMES_OF_ALLAH: AsmaNameItem[] = [
  {
    number: 1, arabic: 'الرَّحْمَنُ', transliteration: 'Ar-Rahman',
    en: { meaning: 'The Most Gracious', reflection: 'The One whose all-encompassing mercy reaches every creation in this world.' },
    ur: { meaning: 'بے حد رحم کرنے والا', reflection: 'وہ ذات جس کی وسیع رحمت دنیا میں ہر مخلوق تک پہنچتی ہے۔' },
    gu: { meaning: 'અત્યંત કૃપાળુ', reflection: 'જેમની વિશાળ રહેમત આ દુનિયામાં દરેક સર્જન સુધી પહોંચે છે.' },
  },
  {
    number: 2, arabic: 'الرَّحِيمُ', transliteration: 'Ar-Raheem',
    en: { meaning: 'The Most Merciful', reflection: 'The One who bestows special, eternal mercy upon the believers.' },
    ur: { meaning: 'نہایت مہربان', reflection: 'وہ جو ایمان والوں پر خاص اور دائمی رحمت فرمانے والا ہے۔' },
    gu: { meaning: 'અત્યંત દયાળુ', reflection: 'જે ઈમાનવાળાઓ પર ખાસ અને શાશ્વત દયા વરસાવે છે.' },
  },
  {
    number: 3, arabic: 'الْمَلِكُ', transliteration: 'Al-Malik',
    en: { meaning: 'The Sovereign King', reflection: 'The absolute Owner and Ruler whose authority governs the entire universe.' },
    ur: { meaning: 'حقیقی بادشاہ', reflection: 'تمام کائنات کا مطلق مالک اور فرمانروا جس کے اختیار میں ہر شے ہے۔' },
    gu: { meaning: 'સાચો બાદશાહ', reflection: 'સમગ્ર બ્રહ્માંડના સંપૂર્ણ માલિક અને શાસક જેમની સત્તા દરેક વસ્તુ પર છે.' },
  },
  {
    number: 4, arabic: 'الْقُدُّوسُ', transliteration: 'Al-Quddus',
    en: { meaning: 'The Most Holy', reflection: 'The One completely free from every flaw, limitation, or imperfection.' },
    ur: { meaning: 'نہایت پاک ذات', reflection: 'وہ جو ہر عیب، نقص اور کمزوری سے مکمل طور پر پاک ہے۔' },
    gu: { meaning: 'અત્યંત પવિત્ર', reflection: 'જે દરેક ખામી, ઉણપ અને નબળાઈથી સંપૂર્ણપણે પાક અને પવિત્ર છે.' },
  },
  {
    number: 5, arabic: 'السَّلاَمُ', transliteration: 'As-Salam',
    en: { meaning: 'The Source of Peace', reflection: 'The Giver of peace and safety, free from all defect.' },
    ur: { meaning: 'سلامتی دینے والا', reflection: 'امن و سلامتی عطا فرمانے والا جو ہر نقص سے منزہ ہے۔' },
    gu: { meaning: 'શાંતિનો સ્ત્રોત', reflection: 'શાંતિ અને સુરક્ષા આપનાર, જે દરેક દોષથી મુક્ત છે.' },
  },
  {
    number: 6, arabic: 'الْمُؤْمِنُ', transliteration: "Al-Mu'min",
    en: { meaning: 'The Granter of Security', reflection: 'The One who grants faith, safety, and reassurance to trembling hearts.' },
    ur: { meaning: 'امان بخشنے والا', reflection: 'دلوں کو ایمان، سکون اور خوف سے امان عطا فرمانے والا۔' },
    gu: { meaning: 'અભય અને ઈમાન આપનાર', reflection: 'જે હૃદયને ઈમાન, શાંતિ અને સુરક્ષાનો વિશ્વાસ આપે છે.' },
  },
  {
    number: 7, arabic: 'الْمُهَيْمِنُ', transliteration: 'Al-Muhaymin',
    en: { meaning: 'The Supreme Guardian', reflection: 'The watchful Protector who oversees and preserves all deeds and creation.' },
    ur: { meaning: 'نگہبان و محافظ', reflection: 'ہر مخلوق اور ہر عمل کی نگرانی اور حفاظت فرمانے والا۔' },
    gu: { meaning: 'સર્વોચ્ચ રક્ષક', reflection: 'જે દરેક સર્જન અને દરેક કર્મનું નિરીક્ષણ અને રક્ષણ કરે છે.' },
  },
  {
    number: 8, arabic: 'الْعَزِيزُ', transliteration: 'Al-Aziz',
    en: { meaning: 'The Almighty', reflection: 'The Mighty One who is never defeated and grants true honor.' },
    ur: { meaning: 'سب پر غالب', reflection: 'وہ عزت و غلبے والا جسے کوئی مغلوب نہیں کر سکتا۔' },
    gu: { meaning: 'સર્વશક્તિમાન અને વિજેતા', reflection: 'જે કદી પરાજિત થતા નથી અને સાચી ઇજ્જત આપનાર છે.' },
  },
  {
    number: 9, arabic: 'الْجَبَّارُ', transliteration: 'Al-Jabbar',
    en: { meaning: 'The Compeller & Mender', reflection: 'The One whose will always prevails and who heals broken hearts.' },
    ur: { meaning: 'زبردست، ٹوٹے دل جوڑنے والا', reflection: 'جس کا حکم نافذ ہو کر رہتا ہے اور جو شکستہ دلوں کو جوڑتا ہے۔' },
    gu: { meaning: 'સર્વોપરી અને તૂટેલા દિલ જોડનાર', reflection: 'જેમની ઇચ્છા હંમેશા પૂર્ણ થાય છે અને જે તૂટેલા હૃદયને સાજા કરે છે.' },
  },
  {
    number: 10, arabic: 'الْمُتَكَبِّرُ', transliteration: 'Al-Mutakabbir',
    en: { meaning: 'The Supreme in Greatness', reflection: 'The One above all creation, to whom alone true majesty belongs.' },
    ur: { meaning: 'عظمت و کبریائی والا', reflection: 'تمام مخلوقات سے بلند تر جسے حقیقی بڑائی اور عظمت سزاوار ہے۔' },
    gu: { meaning: 'મહાનતા અને ગૌરવવાળો', reflection: 'દરેક સર્જનથી સર્વોચ્ચ, જેમને એકમાત્ર સાચી મહાનતા શોભે છે.' },
  },
  {
    number: 11, arabic: 'الْخَالِقُ', transliteration: 'Al-Khaliq',
    en: { meaning: 'The Creator', reflection: 'The One who brings every being from nothingness into existence.' },
    ur: { meaning: 'پیدا کرنے والا', reflection: 'عدم سے ہر چیز کو وجود بخشنے والا حقیقی خالق۔' },
    gu: { meaning: 'સર્જનહાર', reflection: 'શૂન્યમાંથી દરેક અસ્તિત્વને પેદા કરનાર સાચો સર્જક.' },
  },
  {
    number: 12, arabic: 'الْبَارِئُ', transliteration: 'Al-Bari',
    en: { meaning: 'The Originator', reflection: 'The Maker who creates in perfect proportion without any prior model.' },
    ur: { meaning: 'بے مثال پیدا کرنے والا', reflection: 'بغیر کسی نمونے کے ہر شے کو متوازن اور کامل انداز میں بنانے والا۔' },
    gu: { meaning: 'અનોખો નિર્માતા', reflection: 'કોઈ પણ પૂર્વ નમૂના વગર દરેક વસ્તુને સંપૂર્ણ સંતુલનમાં ઘડનાર.' },
  },
  {
    number: 13, arabic: 'الْمُصَوِّرُ', transliteration: 'Al-Musawwir',
    en: { meaning: 'The Fashioner', reflection: 'The One who shapes every creature with unique form and beauty.' },
    ur: { meaning: 'صورت گری کرنے والا', reflection: 'ہر مخلوق کو منفرد شکل و صورت اور حسن عطا فرمانے والا۔' },
    gu: { meaning: 'રૂપ આપનાર', reflection: 'દરેક જીવને અનોખું સ્વરૂપ અને સુંદરતા પ્રદાન કરનાર.' },
  },
  {
    number: 14, arabic: 'الْغَفَّارُ', transliteration: 'Al-Ghaffar',
    en: { meaning: 'The Perpetual Forgiver', reflection: 'The One who repeatedly forgives and conceals the faults of His servants.' },
    ur: { meaning: 'بہت بخشنے والا', reflection: 'بندوں کے گناہوں کو بار بار معاف کرنے اور عیبوں پر پردہ ڈالنے والا۔' },
    gu: { meaning: 'વારંવાર માફ કરનાર', reflection: 'જે પોતાના બંદાઓની ભૂલોને વારંવાર માફ કરે છે અને ઢાંકે છે.' },
  },
  {
    number: 15, arabic: 'الْقَهَّارُ', transliteration: 'Al-Qahhar',
    en: { meaning: 'The All-Prevailing', reflection: 'The Dominant One before whose power every force submits.' },
    ur: { meaning: 'سب کو قابو میں رکھنے والا', reflection: 'وہ قہار جس کی قدرت کے سامنے ہر طاقت جھک جاتی ہے۔' },
    gu: { meaning: 'સર્વ પર કાબૂ રાખનાર', reflection: 'જેમની શક્તિ સામે દરેક તાકાત નતમસ્તક થઈ જાય છે.' },
  },
  {
    number: 16, arabic: 'الْوَهَّابُ', transliteration: 'Al-Wahhab',
    en: { meaning: 'The Supreme Bestower', reflection: 'The One who gives freely and abundantly without expecting anything in return.' },
    ur: { meaning: 'بے حساب عطا کرنے والا', reflection: 'بغیر کسی غرض کے بے شمار نعمتیں عطا فرمانے والا۔' },
    gu: { meaning: 'અપાર દાતા', reflection: 'કોઈ પણ અપેક્ષા વગર અગણિત નેમતો મફત આપનાર.' },
  },
  {
    number: 17, arabic: 'الرَّزَّاقُ', transliteration: 'Ar-Razzaq',
    en: { meaning: 'The Provider', reflection: 'The Sustainer who provides nourishment for every living soul.' },
    ur: { meaning: 'رزق دینے والا', reflection: 'ہر جاندار کو اس کے حصے کا رزق پہنچانے والا۔' },
    gu: { meaning: 'રોજી આપનાર', reflection: 'દરેક જીવને તેનું ભરણપોષણ અને રિઝ્ક પહોંચાડનાર.' },
  },
  {
    number: 18, arabic: 'الْفَتَّاحُ', transliteration: 'Al-Fattah',
    en: { meaning: 'The Opener', reflection: 'The One who opens closed doors of mercy, guidance, and relief.' },
    ur: { meaning: 'مشکلیں کھولنے والا', reflection: 'رحمت، ہدایت اور آسانی کے بند دروازے کھول دینے والا۔' },
    gu: { meaning: 'દ્વાર ખોલનાર', reflection: 'રહેમત, હિદાયત અને રાહતના બંધ દરવાજા ખોલી આપનાર.' },
  },
  {
    number: 19, arabic: 'اَلْعَلِيْمُ', transliteration: 'Al-Alim',
    en: { meaning: 'The All-Knowing', reflection: 'The One whose knowledge encompasses every hidden and manifest truth.' },
    ur: { meaning: 'سب کچھ جاننے والا', reflection: 'جس کا علم ہر ظاہر اور پوشیدہ حقیقت کو محیط ہے۔' },
    gu: { meaning: 'સર્વજ્ઞ', reflection: 'જેમનું જ્ઞાન દરેક પ્રગટ અને છુપી હકીકતને આવરી લે છે.' },
  },
  {
    number: 20, arabic: 'الْقَابِضُ', transliteration: 'Al-Qabid',
    en: { meaning: 'The Withholder', reflection: 'The One who withholds provision with wisdom to test and purify hearts.' },
    ur: { meaning: 'رزق تنگ کرنے والا', reflection: 'حکمت کے تحت رزق اور حالات میں تنگی فرمانے والا۔' },
    gu: { meaning: 'સંકોચનાર (રોકનાર)', reflection: 'પોતાની હિકમતથી રિઝ્ક અને સંજોગોને નિયંત્રિત રાખનાર.' },
  },
  {
    number: 21, arabic: 'الْبَاسِطُ', transliteration: 'Al-Basit',
    en: { meaning: 'The Expander', reflection: 'The One who expands sustenance, relief, and spiritual joy.' },
    ur: { meaning: 'کشادگی دینے والا', reflection: 'رزق، دلوں اور رحمتوں میں فراوانی اور کشادگی بخشنے والا۔' },
    gu: { meaning: 'વિસ્તાર કરનાર', reflection: 'રિઝ્ક, રાહત અને હૃદયની ખુશીઓમાં વિશાળતા આપનાર.' },
  },
  {
    number: 22, arabic: 'الْخَافِضُ', transliteration: 'Al-Khafid',
    en: { meaning: 'The Abaser', reflection: 'The One who humbles arrogance and lowers whoever opposes truth.' },
    ur: { meaning: 'پست کرنے والا', reflection: 'تکبر کا سر جھکانے اور باطل کو پست کرنے والا۔' },
    gu: { meaning: 'નીચે લાવનાર', reflection: 'ઘમંડને તોડનાર અને સત્યના વિરોધીઓને નમાવનાર.' },
  },
  {
    number: 23, arabic: 'الرَّافِعُ', transliteration: "Ar-Rafi'",
    en: { meaning: 'The Exalter', reflection: 'The One who elevates believers in rank, honor, and nearness to Him.' },
    ur: { meaning: 'بلند کرنے والا', reflection: 'ایمان اور تقویٰ کی بنا پر بندوں کے درجات بلند کرنے والا۔' },
    gu: { meaning: 'ઊંચે ઉઠાવનાર', reflection: 'ઈમાન અને નેકી દ્વારા બંદાઓનો દરજ્જો ઊંચો કરનાર.' },
  },
  {
    number: 24, arabic: 'الْمُعِزُّ', transliteration: "Al-Mu'izz",
    en: { meaning: 'The Honourer', reflection: 'The One who bestows dignity and honor upon whom He wills.' },
    ur: { meaning: 'عزت دینے والا', reflection: 'جسے چاہے عزت، وقار اور سربلندی عطا فرمانے والا۔' },
    gu: { meaning: 'ઇજ્જત આપનાર', reflection: 'જેમને ચાહે તેમને સન્માન, ગૌરવ અને પ્રતિષ્ઠા આપનાર.' },
  },
  {
    number: 25, arabic: 'المُذِلُّ', transliteration: 'Al-Mudhill',
    en: { meaning: 'The Humiliator', reflection: 'The One who strips away false pride and humbles tyranny.' },
    ur: { meaning: 'ذلت دینے والا', reflection: 'ظلم و سرکشی پر ذلت و رسوائی مسلط کرنے والا۔' },
    gu: { meaning: 'અપમાનિત કરનાર', reflection: 'ઝુલ્મ અને અહંકારને પરાસ્ત કરી નીચું જોવડાવનાર.' },
  },
  {
    number: 26, arabic: 'السَّمِيعُ', transliteration: "As-Sami'",
    en: { meaning: 'The All-Hearing', reflection: 'The One who hears every whispered prayer and silent sigh.' },
    ur: { meaning: 'سب کچھ سننے والا', reflection: 'ہر سرگوشی، دعا اور دل کی پکار کو سننے والا۔' },
    gu: { meaning: 'સર્વ સાંભળનાર', reflection: 'દરેક ધીમી પ્રાર્થના અને હૃદયની પોકારને સાંભળનાર.' },
  },
  {
    number: 27, arabic: 'الْبَصِيرُ', transliteration: 'Al-Basir',
    en: { meaning: 'The All-Seeing', reflection: 'The One who sees every detail in the deepest darkness and light.' },
    ur: { meaning: 'سب کچھ دیکھنے والا', reflection: 'تاریکی اور روشنی میں ہر چھوٹی بڑی شے کو دیکھنے والا۔' },
    gu: { meaning: 'સર્વ જોનાર', reflection: 'અંધકાર અને પ્રકાશમાં રહેલી દરેક સૂક્ષ્મ વસ્તુને જોનાર.' },
  },
  {
    number: 28, arabic: 'الْحَكَمُ', transliteration: 'Al-Hakam',
    en: { meaning: 'The Impartial Judge', reflection: 'The Supreme Arbiter whose decree is pure wisdom and finality.' },
    ur: { meaning: 'حقیقی حاکم و فیصلہ کن', reflection: 'وہ منصف جس کا ہر فیصلہ حکمت اور عدل پر مبنی ہے۔' },
    gu: { meaning: 'સર્વોચ્ચ ન્યાયાધીશ', reflection: 'જેમનો દરેક ચુકાદો સંપૂર્ણ હિકમત અને ન્યાય પર આધારિત છે.' },
  },
  {
    number: 29, arabic: 'الْعَدْلُ', transliteration: 'Al-Adl',
    en: { meaning: 'The Utterly Just', reflection: 'The One who is completely fair and never wrongs a single soul.' },
    ur: { meaning: 'سراپا عدل', reflection: 'وہ جو کسی پر ذرہ برابر بھی ظلم نہیں کرتا۔' },
    gu: { meaning: 'સંપૂર્ણ ન્યાયી', reflection: 'જે કોઈ પણ આત્મા પર કણભાર પણ અન્યાય કરતા નથી.' },
  },
  {
    number: 30, arabic: 'اللَّطِيفُ', transliteration: 'Al-Latif',
    en: { meaning: 'The Subtle & Kind', reflection: 'The One who arranges gentle kindness through unseen ways.' },
    ur: { meaning: 'نہایت باریک بین و مہربان', reflection: 'پوشیدہ اسباب کے ذریعے بندوں پر لطف و کرم فرمانے والا۔' },
    gu: { meaning: 'સૂક્ષ્મ અને કૃપાળુ', reflection: 'અદ્રશ્ય માધ્યમોથી બંદાઓ પર નમ્રતા અને દયા વરસાવનાર.' },
  },
  {
    number: 31, arabic: 'الْخَبِيرُ', transliteration: 'Al-Khabir',
    en: { meaning: 'The All-Aware', reflection: 'The One aware of the innermost realities of every heart and event.' },
    ur: { meaning: 'ہر بات سے باخبر', reflection: 'دلوں کے بھیدوں اور ہر واقعے کی اصل حقیقت سے باخبر۔' },
    gu: { meaning: 'સર્વ જાણકાર', reflection: 'દરેક હૃદયની આંતરિક સ્થિતિ અને ઘટનાની હકીકતથી વાકેફ.' },
  },
  {
    number: 32, arabic: 'الْحَلِيمُ', transliteration: 'Al-Halim',
    en: { meaning: 'The Most Forbearing', reflection: 'The One who grants respite and does not hasten punishment.' },
    ur: { meaning: 'بردبار و حلیم', reflection: 'سزا دینے میں جلدی نہ کرنے والا اور توبہ کی مہلت دینے والا۔' },
    gu: { meaning: 'અત્યંત સહનશીલ', reflection: 'જે સજા કરવામાં ઉતાવળ કરતા નથી અને તૌબાની તક આપે છે.' },
  },
  {
    number: 33, arabic: 'الْعَظِيمُ', transliteration: 'Al-Azim',
    en: { meaning: 'The Magnificent', reflection: 'The One whose greatness is beyond all human comprehension.' },
    ur: { meaning: 'بڑی عظمت والا', reflection: 'جس کی عظمت و جلال انسانی فہم و ادراک سے بالاتر ہے۔' },
    gu: { meaning: 'અત્યંત મહાન', reflection: 'જેમની મહાનતા માનવ સમજની સીમાઓથી પર છે.' },
  },
  {
    number: 34, arabic: 'الْغَفُورُ', transliteration: 'Al-Ghafoor',
    en: { meaning: 'The Exceedingly Forgiving', reflection: 'The One whose forgiveness outshines mountains of sins upon repentance.' },
    ur: { meaning: 'بے انتہا بخشنے والا', reflection: 'سچی توبہ پر پہاڑوں جیسے گناہ بھی معاف فرما دینے والا۔' },
    gu: { meaning: 'અપાર ક્ષમાશીલ', reflection: 'સાચી તૌબા પર પહાડો જેટલા ગુનાહો પણ માફ કરી દેનાર.' },
  },
  {
    number: 35, arabic: 'الشَّكُورُ', transliteration: 'Ash-Shakoor',
    en: { meaning: 'The Most Appreciative', reflection: 'The One who multiplies reward greatly for even a small sincere deed.' },
    ur: { meaning: 'قدردان', reflection: 'تھوڑے سے خالص عمل پر بے شمار اجر و ثواب عطا فرمانے والا۔' },
    gu: { meaning: 'ખૂબ કદર કરનાર', reflection: 'નાના નિષ્ઠાવાન કાર્યના બદલામાં અપાર પુણ્ય અને બદલો આપનાર.' },
  },
  {
    number: 36, arabic: 'الْعَلِيُّ', transliteration: 'Al-Aliyy',
    en: { meaning: 'The Most High', reflection: 'The Exalted One above every place, limit, and comparison.' },
    ur: { meaning: 'سب سے بلند و بالا', reflection: 'ہر مقام، حد اور مثال سے بلند و برتر ذات۔' },
    gu: { meaning: 'સર્વોચ્ચ', reflection: 'દરેક સ્થાન, મર્યાદા અને સરખામણીથી સૌથી ઊંચા.' },
  },
  {
    number: 37, arabic: 'الْكَبِيرُ', transliteration: 'Al-Kabir',
    en: { meaning: 'The Greatest', reflection: 'The One greater than anything the mind can ever imagine.' },
    ur: { meaning: 'سب سے بڑا', reflection: 'ہر تصور اور ہر مخلوق سے بدرجہا بڑا اور برتر۔' },
    gu: { meaning: 'સૌથી મહાન', reflection: 'મનની કોઈ પણ કલ્પના કરતાં અનેકગણા મહાન.' },
  },
  {
    number: 38, arabic: 'الْحَفِيظُ', transliteration: 'Al-Hafiz',
    en: { meaning: 'The Preserver', reflection: 'The One who guards the heavens, the earth, and every believer.' },
    ur: { meaning: 'حفاظت کرنے والا', reflection: 'زمین و آسمان اور ہر بندے کی حفاظت فرمانے والا۔' },
    gu: { meaning: 'સંરક્ષક', reflection: 'આકાશ, ધરતી અને દરેક ઈમાનદારની રક્ષા કરનાર.' },
  },
  {
    number: 39, arabic: 'المُقيِت', transliteration: 'Al-Muqit',
    en: { meaning: 'The Sustainer', reflection: 'The One who nourishes both the body and the soul in exact measure.' },
    ur: { meaning: 'قوت و غذا دینے والا', reflection: 'جسم اور روح کو مناسب مقدار میں قوت و غذا فراہم کرنے والا۔' },
    gu: { meaning: 'પોષણ અને શક્તિ આપનાર', reflection: 'શરીર અને આત્માને યોગ્ય માત્રામાં પોષણ પૂરું પાડનાર.' },
  },
  {
    number: 40, arabic: 'اﻟْحَسِيبُ', transliteration: 'Al-Hasib',
    en: { meaning: 'The Reckoner', reflection: 'The One sufficient for His servants and who takes full account of all deeds.' },
    ur: { meaning: 'کفایت کرنے اور حساب لینے والا', reflection: 'بندوں کے لیے کافی ہو جانے والا اور ہر عمل کا حساب لینے والا۔' },
    gu: { meaning: 'પર્યાપ્ત અને હિસાબ લેનાર', reflection: 'પોતાના બંદાઓ માટે પૂરતા અને દરેક કર્મનો હિસાબ લેનાર.' },
  },
  {
    number: 41, arabic: 'الْجَلِيلُ', transliteration: 'Al-Jalil',
    en: { meaning: 'The Majestic', reflection: 'The One endowed with awe-inspiring majesty and perfection.' },
    ur: { meaning: 'جلال و شان والا', reflection: 'عظیم الشان جلال اور کامل صفات کا مالک۔' },
    gu: { meaning: 'પ્રતાપી અને ભવ્ય', reflection: 'અદભુત પ્રતાપ, ભવ્યતા અને સંપૂર્ણ ગુણોના સ્વામી.' },
  },
  {
    number: 42, arabic: 'الْكَرِيمُ', transliteration: 'Al-Karim',
    en: { meaning: 'The Most Generous', reflection: 'The One whose generosity flows even before a servant asks.' },
    ur: { meaning: 'بے انتہا کرم فرمانے والا', reflection: 'مانگنے سے پہلے ہی کرم اور بخشش فرمانے والا۔' },
    gu: { meaning: 'અત્યંત ઉદાર', reflection: 'માંગ્યા પહેલાં જ જેમની ઉદારતા અને કૃપા વરસી પડે છે.' },
  },
  {
    number: 43, arabic: 'الرَّقِيبُ', transliteration: 'Ar-Raqib',
    en: { meaning: 'The Ever-Watchful', reflection: 'The Observer from whose sight nothing is ever hidden.' },
    ur: { meaning: 'ہمیشہ نگران', reflection: 'جس کی نگاہ سے کوئی لمحہ اور کوئی عمل پوشیدہ نہیں۔' },
    gu: { meaning: 'સતત નિરીક્ષક', reflection: 'જેમની નજરથી ક્યારેય કોઈ બાબત છુપી રહેતી નથી.' },
  },
  {
    number: 44, arabic: 'الْمُجِيبُ', transliteration: 'Al-Mujib',
    en: { meaning: 'The Responsive', reflection: 'The One near to those who call upon Him, answering sincere supplications.' },
    ur: { meaning: 'دعائیں قبول کرنے والا', reflection: 'پکارنے والوں کے قریب اور خالص دعاؤں کو قبول فرمانے والا۔' },
    gu: { meaning: 'પ્રાર્થના સ્વીકારનાર', reflection: 'પુકારનારની નજીક રહીને નિષ્ઠાવાન દુઆઓને કબૂલ કરનાર.' },
  },
  {
    number: 45, arabic: 'الْوَاسِعُ', transliteration: "Al-Wasi'",
    en: { meaning: 'The All-Encompassing', reflection: 'The One boundless in mercy, knowledge, and generosity.' },
    ur: { meaning: 'وسعت والا', reflection: 'جس کی رحمت، علم اور بخشش کی کوئی حد نہیں۔' },
    gu: { meaning: 'સર્વવ્યાપી', reflection: 'જેમની રહેમત, જ્ઞાન અને ઉદારતા અસીમ છે.' },
  },
  {
    number: 46, arabic: 'الْحَكِيمُ', transliteration: 'Al-Hakim',
    en: { meaning: 'The All-Wise', reflection: 'The One who places every decree in its most perfect time and purpose.' },
    ur: { meaning: 'کامل حکمت والا', reflection: 'ہر کام کو بہترین موقع اور کامل مصلحت کے ساتھ انجام دینے والا۔' },
    gu: { meaning: 'સર્વોત્તમ હિકમતવાળો', reflection: 'દરેક કાર્યને શ્રેષ્ઠ સમય અને સંપૂર્ણ હેતુસર મૂકનાર.' },
  },
  {
    number: 47, arabic: 'الْوَدُودُ', transliteration: 'Al-Wadud',
    en: { meaning: 'The Most Loving', reflection: 'The One who loves the righteous and fills believers’ hearts with pure love.' },
    ur: { meaning: 'بے پناہ محبت کرنے والا', reflection: 'نیک بندوں سے محبت رکھنے اور دلوں میں محبت پیدا کرنے والا۔' },
    gu: { meaning: 'અત્યંત પ્રેમાળ', reflection: 'નેક બંદાઓને પ્રેમ કરનાર અને દિલોમાં પવિત્ર પ્રેમ ભરનાર.' },
  },
  {
    number: 48, arabic: 'الْمَجِيدُ', transliteration: 'Al-Majid',
    en: { meaning: 'The All-Glorious', reflection: 'The One supreme in glory, nobility, and abundant goodness.' },
    ur: { meaning: 'بڑی شان و بزرگی والا', reflection: 'بلند مرتبے، بزرگی اور بے شمار بھلائیوں کا سرچشمہ۔' },
    gu: { meaning: 'અત્યંત ગૌરવશાળી', reflection: 'સર્વોચ્ચ ગૌરવ, શ્રેષ્ઠતા અને અપાર ભલાઈઓના માલિક.' },
  },
  {
    number: 49, arabic: 'الْبَاعِثُ', transliteration: "Al-Ba'ith",
    en: { meaning: 'The Resurrector', reflection: 'The One who sends messengers and raises all souls on the Day of Judgment.' },
    ur: { meaning: 'اٹھانے والا', reflection: 'پیغمبروں کو مبعوث کرنے اور قیامت کے دن سب کو زندہ اٹھانے والا۔' },
    gu: { meaning: 'પુનર્જીવિત કરનાર', reflection: 'પયગંબરોને મોકલનાર અને કયામતના દિવસે સૌને જીવિત ઉઠાવનાર.' },
  },
  {
    number: 50, arabic: 'الشَّهِيدُ', transliteration: 'Ash-Shahid',
    en: { meaning: 'The Ultimate Witness', reflection: 'The Witness present over all actions, intentions, and truths.' },
    ur: { meaning: 'حاضر و گواہ', reflection: 'ہر عمل، نیت اور سچائی پر ہر وقت گواہ و شاہد۔' },
    gu: { meaning: 'સર્વ સાક્ષી', reflection: 'દરેક કર્મ, નિયત અને સત્ય પર હંમેશા સાક્ષી.' },
  },
  {
    number: 51, arabic: 'الْحَقُّ', transliteration: 'Al-Haqq',
    en: { meaning: 'The Absolute Truth', reflection: 'The Eternal Reality whose promise and word are always true.' },
    ur: { meaning: 'سراسر حق', reflection: 'وہ ازلی سچائی جس کا وعدہ اور کلام ہمیشہ سچا ہے۔' },
    gu: { meaning: 'પરમ સત્ય', reflection: 'એ શાશ્વત સત્ય જેમના વચન અને વાણી હંમેશા સાચા છે.' },
  },
  {
    number: 52, arabic: 'الْوَكِيلُ', transliteration: 'Al-Wakil',
    en: { meaning: 'The Disposer of Affairs', reflection: 'The Trustworthy Guardian upon whom believers place complete reliance.' },
    ur: { meaning: 'بہترین کارساز', reflection: 'وہ قابلِ اعتماد وکیل جس پر توکل کرنے والا کبھی مایوس نہیں ہوتا۔' },
    gu: { meaning: 'શ્રેષ્ઠ રખેવાળ (કાર્યસાધક)', reflection: 'જેમના પર સંપૂર્ણ ભરોસો કરનાર કદી નિરાશ થતો નથી.' },
  },
  {
    number: 53, arabic: 'الْقَوِيُّ', transliteration: 'Al-Qawiyy',
    en: { meaning: 'The All-Strong', reflection: 'The One of inexhaustible strength who never experiences fatigue.' },
    ur: { meaning: 'سب سے زیادہ طاقتور', reflection: 'لازوال قوت کا مالک جسے کبھی تھکن یا کمزوری لاحق نہیں ہوتی۔' },
    gu: { meaning: 'અત્યંત બળવાન', reflection: 'અખૂટ શક્તિના સ્વામી જેમને કદી થાક લાગતો નથી.' },
  },
  {
    number: 54, arabic: 'الْمَتِينُ', transliteration: 'Al-Matin',
    en: { meaning: 'The Firm & Steadfast', reflection: 'The One of unshakable power and absolute constancy.' },
    ur: { meaning: 'نہایت مضبوط و مستحکم', reflection: 'ایسی پائیدار قدرت والا جس میں ذرہ برابر بھی تغیر نہیں۔' },
    gu: { meaning: 'અત્યંત દૃઢ અને મજબૂત', reflection: 'અવિચળ શક્તિ અને સંપૂર્ણ સ્થિરતાના સ્વામી.' },
  },
  {
    number: 55, arabic: 'الْوَلِيُّ', transliteration: 'Al-Waliyy',
    en: { meaning: 'The Protecting Friend', reflection: 'The Loving Ally who guides and supports the faithful out of darkness.' },
    ur: { meaning: 'مددگار و دوست', reflection: 'مؤمنوں کو اندھیروں سے نکال کر نور کی طرف لانے والا سرپرست۔' },
    gu: { meaning: 'રક્ષક મિત્ર', reflection: 'ઈમાનવાળાઓને અંધકારમાંથી પ્રકાશ તરફ દોરનાર સહાયક.' },
  },
  {
    number: 56, arabic: 'الْحَمِيدُ', transliteration: 'Al-Hamid',
    en: { meaning: 'The Praiseworthy', reflection: 'The One worthy of all praise in times of ease and hardship alike.' },
    ur: { meaning: 'ہر تعریف کے لائق', reflection: 'آسانی اور آزمائش، ہر حال میں تمام تعریفوں کا مستحق۔' },
    gu: { meaning: 'સર્વ પ્રશંસાને લાયક', reflection: 'સુખ અને કસોટી, દરેક પરિસ્થિતિમાં સર્વ વખાણને યોગ્ય.' },
  },
  {
    number: 57, arabic: 'الْمُحْصِي', transliteration: 'Al-Muhsi',
    en: { meaning: 'The All-Enumerating', reflection: 'The One who knows the exact count and measure of everything.' },
    ur: { meaning: 'ہر چیز شمار رکھنے والا', reflection: 'کائنات کے ہر ذرے اور ہر عمل کی صحیح گنتی جاننے والا۔' },
    gu: { meaning: 'દરેક વસ્તુની ગણતરી રાખનાર', reflection: 'બ્રહ્માંડની દરેક વસ્તુની ચોક્કસ સંખ્યા અને માપ જાણનાર.' },
  },
  {
    number: 58, arabic: 'الْمُبْدِئُ', transliteration: "Al-Mubdi'",
    en: { meaning: 'The Originator', reflection: 'The One who initiates creation at the very beginning.' },
    ur: { meaning: 'پہلی بار پیدا کرنے والا', reflection: 'ہر مخلوق کی تخلیق کی ابتدا فرمانے والا۔' },
    gu: { meaning: 'પ્રથમ સર્જન કરનાર', reflection: 'સૌ પ્રથમ દરેક સર્જનની શરૂઆત કરનાર.' },
  },
  {
    number: 59, arabic: 'الْمُعِيدُ', transliteration: "Al-Mu'id",
    en: { meaning: 'The Restorer', reflection: 'The One who brings creation back to life after death.' },
    ur: { meaning: 'دوبارہ لوٹانے والا', reflection: 'موت کے بعد تمام مخلوقات کو دوبارہ زندگی بخشنے والا۔' },
    gu: { meaning: 'પુનઃ અસ્તિત્વ આપનાર', reflection: 'મૃત્યુ પછી સમગ્ર સર્જનને ફરીથી જીવિત કરનાર.' },
  },
  {
    number: 60, arabic: 'الْمُحْيِي', transliteration: 'Al-Muhyi',
    en: { meaning: 'The Giver of Life', reflection: 'The One who breathes life into bodies and revives dead hearts with faith.' },
    ur: { meaning: 'زندگی بخشنے والا', reflection: 'جسموں میں جان اور مردہ دلوں میں ایمان کی زندگی ڈالنے والا۔' },
    gu: { meaning: 'જીવન આપનાર', reflection: 'શરીરમાં પ્રાણ અને નિર્જીવ હૃદયમાં ઈમાનનું જીવન ફૂંકનાર.' },
  },
  {
    number: 61, arabic: 'اَلْمُمِيتُ', transliteration: 'Al-Mumit',
    en: { meaning: 'The Creator of Death', reflection: 'The One who decrees the end of earthly life as a doorway to eternity.' },
    ur: { meaning: 'موت دینے والا', reflection: 'دنیاوی زندگی کو مقررہ وقت پر ختم کر کے آخرت کا دروازہ کھولنے والا۔' },
    gu: { meaning: 'મૃત્યુ આપનાર', reflection: 'નિયત સમયે સાંસારિક જીવન પૂર્ણ કરી પરલોકનું દ્વાર ખોલનાર.' },
  },
  {
    number: 62, arabic: 'الْحَيُّ', transliteration: 'Al-Hayy',
    en: { meaning: 'The Ever-Living', reflection: 'The One with eternal, self-sufficient life without beginning or end.' },
    ur: { meaning: 'ہمیشہ زندہ رہنے والا', reflection: 'وہ ازلی و ابدی حیات والا جسے کبھی فنا نہیں۔' },
    gu: { meaning: 'સદા જીવંત', reflection: 'આદિ અને અંત વગરનું શાશ્વત જીવન ધરાવનાર.' },
  },
  {
    number: 63, arabic: 'الْقَيُّومُ', transliteration: 'Al-Qayyum',
    en: { meaning: 'The Self-Subsisting', reflection: 'The One who sustains all existence while needing nothing Himself.' },
    ur: { meaning: 'سب کو قائم رکھنے والا', reflection: 'ساری کائنات کو سنبھالنے والا اور خود ہر چیز سے بے نیاز۔' },
    gu: { meaning: 'સ્વયં અસ્તિત્વ ધરાવનાર', reflection: 'સમગ્ર સૃષ્ટિને ટકાવી રાખનાર અને સ્વયં કોઈના પર નિર્ભર નથી.' },
  },
  {
    number: 64, arabic: 'الْوَاجِدُ', transliteration: 'Al-Wajid',
    en: { meaning: 'The Finder', reflection: 'The Rich and Self-Sufficient One who lacks nothing whatsoever.' },
    ur: { meaning: 'ہر چیز پانے اور رکھنے والا', reflection: 'وہ غنی ذات جس کے پاس ہر کمال موجود ہے اور کوئی کمی نہیں۔' },
    gu: { meaning: 'સંપન્ન અને પ્રાપ્ત કરનાર', reflection: 'જેમને કોઈ પણ વસ્તુની કમી નથી અને દરેક ખૂબીના માલિક છે.' },
  },
  {
    number: 65, arabic: 'الْمَاجِدُ', transliteration: 'Al-Majid',
    en: { meaning: 'The Noble & Illustrious', reflection: 'The One of boundless nobility, honor, and generosity.' },
    ur: { meaning: 'بڑی بزرگی والا', reflection: 'نہایت بلند شان، شرافت اور فیاضی کا مالک۔' },
    gu: { meaning: 'મહાન અને શ્રેષ્ઠ', reflection: 'અસીમ ઉદારતા, શ્રેષ્ઠતા અને સન્માનના માલિક.' },
  },
  {
    number: 66, arabic: 'الْوَاحِدُ', transliteration: 'Al-Wahid',
    en: { meaning: 'The One', reflection: 'The Single Creator who has no partner, equal, or rival.' },
    ur: { meaning: 'یکتا و تنہا', reflection: 'وہ واحد معبود جس کا کوئی شریک، ہم سر یا ثانی نہیں۔' },
    gu: { meaning: 'એકમાત્ર', reflection: 'અદ્વિતીય સર્જક જેમનો કોઈ ભાગીદાર કે સમાન નથી.' },
  },
  {
    number: 67, arabic: 'اَلاَحَدُ', transliteration: 'Al-Ahad',
    en: { meaning: 'The Indivisible Unique', reflection: 'The Unique One absolute in Oneness and perfection.' },
    ur: { meaning: 'بے مثل و واحد', reflection: 'اپنی ذات و صفات میں بالکل منفرد اور یکتا۔' },
    gu: { meaning: 'અદ્વિતીય', reflection: 'પોતાના અસ્તિત્વ અને ગુણોમાં સંપૂર્ણપણે અજોડ અને એક.' },
  },
  {
    number: 68, arabic: 'الصَّمَدُ', transliteration: 'As-Samad',
    en: { meaning: 'The Eternal Refuge', reflection: 'The Absolute Master whom all creation turns to in every need.' },
    ur: { meaning: 'بے نیاز، سب کا سہارا', reflection: 'وہ مرکزِ امید جس کی طرف ہر مخلوق اپنی حاجت میں رجوع کرتی ہے۔' },
    gu: { meaning: 'નિરપેક્ષ અને સૌનો આધાર', reflection: 'જેમની તરફ સમગ્ર સૃષ્ટિ પોતાની દરેક જરૂરિયાતમાં વળે છે.' },
  },
  {
    number: 69, arabic: 'الْقَادِرُ', transliteration: 'Al-Qadir',
    en: { meaning: 'The All-Capable', reflection: 'The One capable of accomplishing whatever He wills with ease.' },
    ur: { meaning: 'پوری قدرت والا', reflection: 'جو کچھ چاہے بغیر کسی مشقت کے کر گزرنے پر قادر۔' },
    gu: { meaning: 'સર્વસમર્થ', reflection: 'જે ચાહે તે સહજતાથી કરવાની સંપૂર્ણ શક્તિ ધરાવનાર.' },
  },
  {
    number: 70, arabic: 'الْمُقْتَدِرُ', transliteration: 'Al-Muqtadir',
    en: { meaning: 'The All-Powerful', reflection: 'The One who exercises supreme power over all causes and outcomes.' },
    ur: { meaning: 'بڑی قدرت و اقتدار والا', reflection: 'تمام اسباب و نتائج پر مکمل اختیار رکھنے والا مقتدر۔' },
    gu: { meaning: 'સર્વોચ્ચ શક્તિશાળી', reflection: 'દરેક કારણ અને પરિણામ પર સંપૂર્ણ સત્તા ધરાવનાર.' },
  },
  {
    number: 71, arabic: 'الْمُقَدِّمُ', transliteration: 'Al-Muqaddim',
    en: { meaning: 'The Expediter', reflection: 'The One who brings forward whomever and whatever He wills in wisdom.' },
    ur: { meaning: 'آگے بڑھانے والا', reflection: 'حکمت کے مطابق جسے چاہے مقدم اور آگے کرنے والا۔' },
    gu: { meaning: 'આગળ લાવનાર', reflection: 'પોતાની હિકમતથી જેને ચાહે તેને આગળ વધારનાર.' },
  },
  {
    number: 72, arabic: 'الْمُؤَخِّرُ', transliteration: "Al-Mu'akhkhir",
    en: { meaning: 'The Delayer', reflection: 'The One who delays things until their exact, divinely appointed moment.' },
    ur: { meaning: 'پیچھے رکھنے والا', reflection: 'ہر کام کو اس کے صحیح اور مقررہ وقت تک مؤخر فرمانے والا۔' },
    gu: { meaning: 'પાછળ રાખનાર', reflection: 'દરેક બાબતને તેના નિર્ધારિત અને યોગ્ય સમય સુધી મુલતવી રાખનાર.' },
  },
  {
    number: 73, arabic: 'الأوَّلُ', transliteration: 'Al-Awwal',
    en: { meaning: 'The First', reflection: 'The One who existed before all things, without any beginning.' },
    ur: { meaning: 'سب سے پہلا', reflection: 'ہر شے سے پہلے موجود، جس کی کوئی ابتدا نہیں۔' },
    gu: { meaning: 'સૌથી પ્રથમ', reflection: 'દરેક વસ્તુ પહેલાં અસ્તિત્વ ધરાવનાર, જેમનો કોઈ આરંભ નથી.' },
  },
  {
    number: 74, arabic: 'الآخِرُ', transliteration: 'Al-Akhir',
    en: { meaning: 'The Last', reflection: 'The One who remains eternally after everything else passes away.' },
    ur: { meaning: 'سب سے آخری', reflection: 'ہر چیز کے فنا ہونے کے بعد ہمیشہ باقی رہنے والا۔' },
    gu: { meaning: 'સૌથી અંતિમ', reflection: 'દરેક વસ્તુ નાશ પામ્યા પછી પણ સદાય કાયમ રહેનાર.' },
  },
  {
    number: 75, arabic: 'الظَّاهِرُ', transliteration: 'Az-Zahir',
    en: { meaning: 'The Manifest', reflection: 'The One whose signs are unmistakable across all of creation.' },
    ur: { meaning: 'ظاہر و عیاں', reflection: 'جس کی قدرت کی نشانیاں پوری کائنات میں روشن اور نمایاں ہیں۔' },
    gu: { meaning: 'પ્રગટ', reflection: 'જેમની શક્તિના પુરાવા સમગ્ર સૃષ્ટિમાં સ્પષ્ટ દેખાય છે.' },
  },
  {
    number: 76, arabic: 'الْبَاطِنُ', transliteration: 'Al-Batin',
    en: { meaning: 'The Hidden', reflection: 'The One veiled from physical sight yet closer than our own jugular vein.' },
    ur: { meaning: 'پوشیدہ و باطن', reflection: 'ظاہری آنکھوں سے پوشیدہ مگر دلوں اور شہ رگ سے بھی زیادہ قریب۔' },
    gu: { meaning: 'ગુપ્ત (છુપાયેલો)', reflection: 'ભૌતિક નજરોથી અદ્રશ્ય છતાં હૃદય અને રગો કરતાં પણ વધુ નજીક.' },
  },
  {
    number: 77, arabic: 'الْوَالِي', transliteration: 'Al-Wali',
    en: { meaning: 'The Sole Governor', reflection: 'The One who manages, directs, and cares for all creation alone.' },
    ur: { meaning: 'واحد کارفرما و حاکم', reflection: 'اکیلے تمام کائنات کا انتظام اور تدبیر فرمانے والا۔' },
    gu: { meaning: 'એકમાત્ર શાસક અને સંચાલક', reflection: 'એકલા હાથે સમગ્ર વિશ્વનું સંચાલન અને દેખરેખ રાખનાર.' },
  },
  {
    number: 78, arabic: 'الْمُتَعَالِي', transliteration: "Al-Muta'ali",
    en: { meaning: 'The Most Exalted', reflection: 'The One infinitely above all imperfections and human likeness.' },
    ur: { meaning: 'نہایت بلند و برتر', reflection: 'مخلوق کے ہر وصف اور نقص سے انتہائی بلند و پاک۔' },
    gu: { meaning: 'સૌથી ઉચ્ચ અને મહાન', reflection: 'સર્જનની દરેક મર્યાદા અને ખામીથી અત્યંત ઊંચા.' },
  },
  {
    number: 79, arabic: 'الْبَرُّ', transliteration: 'Al-Barr',
    en: { meaning: 'The Source of Goodness', reflection: 'The Gentle Benefactor whose kindness overflows to His creation.' },
    ur: { meaning: 'سراپا نیکی و احسان', reflection: 'بندوں پر مسلسل فضل و احسان اور بھلائی فرمانے والا۔' },
    gu: { meaning: 'ભલાઈનો સ્ત્રોત', reflection: 'જેમની અપાર ભલાઈ અને ઉપકાર સતત સર્જન પર વરસે છે.' },
  },
  {
    number: 80, arabic: 'التَّوَّابُ', transliteration: 'At-Tawwab',
    en: { meaning: 'The Acceptor of Repentance', reflection: 'The One who inspires repentance and warmly welcomes every turning back.' },
    ur: { meaning: 'توبہ قبول کرنے والا', reflection: 'توبہ کی توفیق دینے والا اور پلٹ کر آنے والوں کو معاف فرمانے والا۔' },
    gu: { meaning: 'તૌબા કબૂલ કરનાર', reflection: 'પસ્તાવાની પ્રેરણા આપનાર અને પાછા ફરનારને પ્રેમથી માફ કરનાર.' },
  },
  {
    number: 81, arabic: 'الْمُنْتَقِمُ', transliteration: 'Al-Muntaqim',
    en: { meaning: 'The Avenger of Justice', reflection: 'The One who delivers righteous retribution against unrepentant oppression.' },
    ur: { meaning: 'انصاف کا بدلہ لینے والا', reflection: 'سرکش ظالموں سے مظلوموں کا عادلانہ بدلہ لینے والا۔' },
    gu: { meaning: 'ન્યાયી બદલો લેનાર', reflection: 'અન્યાયી અને ઘમંડી જુલમગારો પાસેથી ન્યાયનો બદલો લેનાર.' },
  },
  {
    number: 82, arabic: 'العَفُوُّ', transliteration: "Al-'Afuww",
    en: { meaning: 'The Pardoner', reflection: 'The One who completely erases sins as though they never occurred.' },
    ur: { meaning: 'درگزر کرنے والا', reflection: 'گناہوں کا نام و نشان مٹا کر مکمل درگزر فرمانے والا۔' },
    gu: { meaning: 'માફ કરી ભૂંસી નાખનાર', reflection: 'પાપોને એવી રીતે ભૂંસી નાખનાર જાણે તે ક્યારેય થયા જ ન હોય.' },
  },
  {
    number: 83, arabic: 'الرَّؤُوفُ', transliteration: "Ar-Ra'uf",
    en: { meaning: 'The Most Compassionate', reflection: 'The One overflowing with tender pity and gentle care for His servants.' },
    ur: { meaning: 'نہایت شفیق و مہربان', reflection: 'بندوں پر ماں باپ سے بھی زیادہ شفقت و نرمی فرمانے والا۔' },
    gu: { meaning: 'અત્યંત કરુણામય', reflection: 'પોતાના બંદાઓ પ્રત્યે અત્યંત કોમળ દયા અને મમતા રાખનાર.' },
  },
  {
    number: 84, arabic: 'مَالِكُ الْمُلْكِ', transliteration: 'Malik-ul-Mulk',
    en: { meaning: 'Owner of All Sovereignty', reflection: 'The Eternal Sovereign who grants and withdraws earthly dominion as He wills.' },
    ur: { meaning: 'تمام بادشاہت کا مالک', reflection: 'جسے چاہے سلطنت عطا کرے اور جس سے چاہے واپس لے لے۔' },
    gu: { meaning: 'સમગ્ર સત્તાનો માલિક', reflection: 'જેમને ચાહે સત્તા આપે અને જેમનાથી ચાહે પાછી ખેંચી લે.' },
  },
  {
    number: 85, arabic: 'ذُوالْجَلاَلِ وَالإكْرَامِ', transliteration: 'Dhul-Jalal wal-Ikram',
    en: { meaning: 'Lord of Majesty and Bounty', reflection: 'The One combining awe-inspiring majesty with boundless generosity.' },
    ur: { meaning: 'جلال اور اکرام والا', reflection: 'عظیم ہیبت و جلال کے ساتھ بے پناہ کرم و عطا فرمانے والا۔' },
    gu: { meaning: 'મહિમા અને ઉદારતાનો સ્વામી', reflection: 'અપાર ભવ્યતા અને અસીમ ઉદારતા બંનેનો સમન્વય ધરાવનાર.' },
  },
  {
    number: 86, arabic: 'الْمُقْسِطُ', transliteration: 'Al-Muqsit',
    en: { meaning: 'The Equitable', reflection: 'The One who establishes perfect balance and fairness among all creation.' },
    ur: { meaning: 'انصاف قائم کرنے والا', reflection: 'ہر مخلوق کے درمیان کامل توازن اور عدل قائم فرمانے والا۔' },
    gu: { meaning: 'ન્યાય અને સંતુલન સ્થાપનાર', reflection: 'સમગ્ર સર્જન વચ્ચે સંપૂર્ણ ન્યાય અને સમાનતા રાખનાર.' },
  },
  {
    number: 87, arabic: 'الْجَامِعُ', transliteration: "Al-Jami'",
    en: { meaning: 'The Gatherer', reflection: 'The One who unites scattered hearts and gathers all humanity on Judgment Day.' },
    ur: { meaning: 'جمع کرنے والا', reflection: 'بکھرے دلوں کو جوڑنے اور قیامت کے دن سب کو جمع فرمانے والا۔' },
    gu: { meaning: 'એકત્ર કરનાર', reflection: 'વિખરાયેલા હૃદયોને જોડનાર અને કયામતના દિવસે સૌને એકઠા કરનાર.' },
  },
  {
    number: 88, arabic: 'الْغَنِيُّ', transliteration: 'Al-Ghaniyy',
    en: { meaning: 'The Self-Sufficient', reflection: 'The Completely Rich One who has zero need of any creature.' },
    ur: { meaning: 'بے نیاز و غنی', reflection: 'وہ غنی ذات جو تمام مخلوقات کی عبادت و خدمت سے بے نیاز ہے۔' },
    gu: { meaning: 'સંપૂર્ણ નિર્ભરમુક્ત (ધનવાન)', reflection: 'જેમને કોઈ પણ સર્જનની જરા પણ જરૂર નથી.' },
  },
  {
    number: 89, arabic: 'الْمُغْنِي', transliteration: 'Al-Mughni',
    en: { meaning: 'The Enricher', reflection: 'The One who enriches hearts with contentment and relieves poverty.' },
    ur: { meaning: 'غنی کرنے والا', reflection: 'بندوں کے دلوں کو قناعت اور ہاتھوں کو رزق سے غنی فرمانے والا۔' },
    gu: { meaning: 'સમૃદ્ધ કરનાર', reflection: 'હૃદયને સંતોષથી અને જીવનને સમૃદ્ધિથી ભરી દેનાર.' },
  },
  {
    number: 90, arabic: 'اَلْمَانِعُ', transliteration: "Al-Mani'",
    en: { meaning: 'The Preventer of Harm', reflection: 'The One who withholds to protect His servants from unseen harm.' },
    ur: { meaning: 'روکنے اور بچانے والا', reflection: 'بندوں کو پوشیدہ نقصان سے بچانے کے لیے روک دینے والا۔' },
    gu: { meaning: 'અટકાવનાર અને રક્ષક', reflection: 'પોતાના બંદાઓને અદ્રશ્ય નુકસાનથી બચાવવા માટે રોકી લેનાર.' },
  },
  {
    number: 91, arabic: 'الضَّارَّ', transliteration: 'Ad-Darr',
    en: { meaning: 'The Creator of Trials', reflection: 'The One by whose permission alone any hardship or test occurs.' },
    ur: { meaning: 'آزمائش و تکلیف کا خالق', reflection: 'جس کے اذن کے بغیر کوئی تکلیف یا آزمائش کسی تک نہیں پہنچ سکتی۔' },
    gu: { meaning: 'કસોટી અને દુઃખનો સર્જક', reflection: 'જેમની મંજૂરી વગર કોઈ પણ કષ્ટ કે પરીક્ષા આવી શકતી નથી.' },
  },
  {
    number: 92, arabic: 'النَّافِعُ', transliteration: "An-Nafi'",
    en: { meaning: 'The Benefactor', reflection: 'The True Source of every benefit, healing, and blessing.' },
    ur: { meaning: 'نفع پہنچانے والا', reflection: 'ہر فائدے، شفا اور برکت کا حقیقی سرچشمہ۔' },
    gu: { meaning: 'લાભ અને કલ્યાણ આપનાર', reflection: 'દરેક ફાયદા, શફા અને બરકતનો સાચો સ્ત્રોત.' },
  },
  {
    number: 93, arabic: 'النُّورُ', transliteration: 'An-Nur',
    en: { meaning: 'The Light', reflection: 'The Light of the heavens and earth who illuminates hearts with guidance.' },
    ur: { meaning: 'نورِ کائنات', reflection: 'آسمانوں اور زمین کا نور جو دلوں کو ہدایت کی روشنی بخشتا ہے۔' },
    gu: { meaning: 'સર્વોચ્ચ પ્રકાશ (નૂર)', reflection: 'આકાશો અને ધરતીનો પ્રકાશ જે હૃદયને હિદાયતથી રોશન કરે છે.' },
  },
  {
    number: 94, arabic: 'الْهَادِي', transliteration: 'Al-Hadi',
    en: { meaning: 'The Guide', reflection: 'The One who gently guides every seeker onto the Straight Path.' },
    ur: { meaning: 'ہدایت دینے والا', reflection: 'ہر طالبِ حق کو صراطِ مستقیم کی طرف رہنمائی فرمانے والا۔' },
    gu: { meaning: 'માર્ગદર્શક', reflection: 'દરેક સત્ય શોધનારને સીધા માર્ગ તરફ દોરી જનાર.' },
  },
  {
    number: 95, arabic: 'الْبَدِيعُ', transliteration: "Al-Badi'",
    en: { meaning: 'The Incomparable Originator', reflection: 'The Creator of breathtaking wonders with no preceding pattern.' },
    ur: { meaning: 'بے مثال موجد', reflection: 'بغیر کسی سابقہ نمونے کے حیرت انگیز کائنات پیدا کرنے والا۔' },
    gu: { meaning: 'અનુપમ સર્જક', reflection: 'કોઈ પણ પૂર્વ ઉદાહરણ વગર અદભુત સૃષ્ટિની રચના કરનાર.' },
  },
  {
    number: 96, arabic: 'اَلْبَاقِي', transliteration: 'Al-Baqi',
    en: { meaning: 'The Everlasting', reflection: 'The Eternal One who never fades, changes, or ceases to exist.' },
    ur: { meaning: 'ہمیشہ باقی رہنے والا', reflection: 'وہ ابدی ذات جسے کبھی زوال یا فنا نہیں۔' },
    gu: { meaning: 'સદાય અવિનાશી', reflection: 'શાશ્વત અસ્તિત્વ જેમનો કદી અંત કે નાશ થતો નથી.' },
  },
  {
    number: 97, arabic: 'الْوَارِثُ', transliteration: 'Al-Warith',
    en: { meaning: 'The Supreme Inheritor', reflection: 'The Ultimate Heir to whom all creation and possessions return.' },
    ur: { meaning: 'حقیقی وارث', reflection: 'سب کے فانی ہونے کے بعد تمام کائنات کا تنہا وارث۔' },
    gu: { meaning: 'સર્વોચ્ચ વારસદાર', reflection: 'સૌ નાશ પામ્યા પછી સમગ્ર સૃષ્ટિના અંતિમ વારસદાર.' },
  },
  {
    number: 98, arabic: 'الرَّشِيدُ', transliteration: 'Ar-Rashid',
    en: { meaning: 'The Guide to Rectitude', reflection: 'The Infallible Director of all affairs toward wisdom and righteousness.' },
    ur: { meaning: 'نیک راہ دکھانے والا', reflection: 'تمام امور کو حکمت اور بھلائی کی صحیح سمت چلانے والا۔' },
    gu: { meaning: 'સત્ય માર્ગ બતાવનાર', reflection: 'દરેક કાર્યને હિકમત અને ભલાઈની યોગ્ય દિશામાં દોરનાર.' },
  },
  {
    number: 99, arabic: 'الصَّبُورُ', transliteration: 'As-Sabur',
    en: { meaning: 'The Most Patient', reflection: 'The One who delays reckoning out of wisdom and invites hearts to return.' },
    ur: { meaning: 'نہایت صبر و تحمل والا', reflection: 'اپنی حکمت سے مہلت دینے اور بندوں کو واپسی کا موقع دینے والا۔' },
    gu: { meaning: 'અત્યંત ધૈર્યવાન', reflection: 'પોતાની હિકમતથી ઢીલ આપનાર અને બંદાઓને પાછા ફરવાની તક આપનાર.' },
  },
];
