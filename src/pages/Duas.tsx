import { useState, useEffect, memo, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Share2, BookHeart, Search, Volume2, Star, Check, RotateCcw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getFavorites, toggleFavorite } from "@/lib/storage";
import { duasData, duaCategories, type Dua } from "@/data/duas";
import { useContentLanguage, translateIslamicText } from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";

const FONT_LEVELS = [
  { arabic: "18px", translation: "13px" },
  { arabic: "20px", translation: "14px" },
  { arabic: "22px", translation: "15px" },
  { arabic: "25px", translation: "16.5px" },
  { arabic: "28px", translation: "18px" },
];

interface DuasI18n {
  title: string;
  supplications: string;
  searchPlaceholder: string;
  pronunciationShow: string;
  pronunciationHide: string;
  translationShow: string;
  translationHide: string;
  tap: string;
  saved: string;
  duaSingle: string;
  duaPlural: string;
  matching: string;
  noDuasFound: string;
  clearFilters: string;
  categories: Record<string, string>;
}

const DUAS_I18N: Record<string, DuasI18n> = {
  en: {
    title: "Duas",
    supplications: "Supplications",
    searchPlaceholder: "Search duas or references",
    pronunciationShow: "▾ Pronunciation",
    pronunciationHide: "▸ Pronunciation",
    translationShow: "▾ Translation",
    translationHide: "▸ Translation",
    tap: "+ Tap",
    saved: "saved",
    duaSingle: "dua",
    duaPlural: "duas",
    matching: "matching",
    noDuasFound: "No supplications found",
    clearFilters: "Clear filters",
    categories: {
      All: "All",
      Morning: "Morning",
      Evening: "Evening",
      Travel: "Travel",
      Eating: "Eating",
      Sleeping: "Sleeping",
      Illness: "Illness",
      Distress: "Distress",
      Gratitude: "Gratitude",
      Forgiveness: "Forgiveness",
      Protection: "Protection",
      Weather: "Weather",
      "After Prayer": "After Prayer",
      Home: "Home",
      Mosque: "Mosque",
      Daily: "Daily",
      "Special Days": "Special Days",
      Knowledge: "Knowledge",
      Character: "Character",
      Marriage: "Marriage",
      Family: "Family",
      Financial: "Financial",
      Afterlife: "Afterlife",
      Repentance: "Repentance",
      Parents: "Parents",
      Fasting: "Fasting",
      "Hajj & Umrah": "Hajj & Umrah",
      "New Moon": "New Moon",
    },
  },
  ur: {
    title: "دعائیں اور اذکار",
    supplications: "دعائیں",
    searchPlaceholder: "دعائیں یا حوالہ جات تلاش کریں...",
    pronunciationShow: "▾ تلفظ",
    pronunciationHide: "▸ تلفظ",
    translationShow: "▾ ترجمہ",
    translationHide: "▸ ترجمہ",
    tap: "+ ٹیپ",
    saved: "محفوظ شدہ",
    duaSingle: "دعا",
    duaPlural: "دعائیں",
    matching: "بمطابق",
    noDuasFound: "کوئی دعا نہیں ملی",
    clearFilters: "فلٹرز ختم کریں",
    categories: {
      All: "سب",
      Morning: "صبح",
      Evening: "شام",
      Travel: "سفر",
      Eating: "کھانا",
      Sleeping: "نیند",
      Illness: "بیماری",
      Distress: "پریشانی",
      Gratitude: "شکر",
      Forgiveness: "مغفرت",
      Protection: "حفاظت",
      Weather: "موسم",
      "After Prayer": "نماز کے بعد",
      Home: "گھر",
      Mosque: "مسجد",
      Daily: "روزمرہ",
      "Special Days": "خاص ایام",
      Knowledge: "علم",
      Character: "اخلاق",
      Marriage: "نکاح",
      Family: "خاندان",
      Financial: "مالی",
      Afterlife: "آخرت",
      Repentance: "توبہ",
      Parents: "والدین",
      Fasting: "روزہ",
      "Hajj & Umrah": "حج و عمرہ",
      "New Moon": "نیا چاند",
    },
  },
  gu: {
    title: "દુઆઓ અને અઝકાર",
    supplications: "દુઆઓ",
    searchPlaceholder: "દુઆઓ અથવા સંદર્ભો શોધો...",
    pronunciationShow: "▾ ઉચ્ચારણ",
    pronunciationHide: "▸ ઉચ્ચારણ",
    translationShow: "▾ અનુવાદ",
    translationHide: "▸ અનુવાદ",
    tap: "+ ટૅપ",
    saved: "સાચવેલા",
    duaSingle: "દુઆ",
    duaPlural: "દુઆઓ",
    matching: "સાથે મળતા",
    noDuasFound: "કોઈ દુઆ મળી નથી",
    clearFilters: "ફિલ્ટર્સ સાફ કરો",
    categories: {
      All: "બધા",
      Morning: "સવાર",
      Evening: "સાંજ",
      Travel: "મુસાફરી",
      Eating: "ભોજન",
      Sleeping: "ઊંઘ",
      Illness: "બીમારી",
      Distress: "તકલીફ",
      Gratitude: "આભાર",
      Forgiveness: "માફી",
      Protection: "સુરક્ષા",
      Weather: "હવામાન",
      "After Prayer": "નમાઝ પછી",
      Home: "ઘર",
      Mosque: "મસ્જિદ",
      Daily: "દૈનિક",
      "Special Days": "વિશેષ દિવસો",
      Knowledge: "જ્ઞાન",
      Character: "ચરિત્ર",
      Marriage: "નિકાહ",
      Family: "પરિવાર",
      Financial: "નાણાકીય",
      Afterlife: "આખિરત",
      Repentance: "તૌબા",
      Parents: "માતાપિતા",
      Fasting: "રોઝા",
      "Hajj & Umrah": "હજ અને ઉમરાહ",
      "New Moon": "નવો ચાંદ",
    },
  },
  ar: {
    title: "الأدعية والأذكار",
    supplications: "أدعية",
    searchPlaceholder: "ابحث في الأدعية أو المراجع...",
    pronunciationShow: "▾ النطق",
    pronunciationHide: "▸ النطق",
    translationShow: "▾ الترجمة",
    translationHide: "▸ الترجمة",
    tap: "+ عد",
    saved: "محفوظ",
    duaSingle: "دعاء",
    duaPlural: "أدعية",
    matching: "تطابق",
    noDuasFound: "لم يتم العثور على أدعية",
    clearFilters: "مسح عوامل التصفية",
    categories: {
      All: "الكل",
      Morning: "الصباح",
      Evening: "المساء",
      Travel: "السفر",
      Eating: "الطعام",
      Sleeping: "النوم",
      Illness: "المرض",
      Distress: "الكرب",
      Gratitude: "الشكر",
      Forgiveness: "المغفرة",
      Protection: "الحفظ",
      Weather: "الطقس",
      "After Prayer": "أدبار الصلوات",
      Home: "المنزل",
      Mosque: "المسجد",
      Daily: "اليومية",
      "Special Days": "أيام خاصة",
      Knowledge: "العلم",
      Character: "الأخلاق",
      Marriage: "الزواج",
      Family: "الأسرة",
      Financial: "المال",
      Afterlife: "الآخرة",
      Repentance: "التوبة",
      Parents: "الوالدين",
      Fasting: "الصيام",
      "Hajj & Umrah": "الحج والعمرة",
      "New Moon": "رؤية الهلال",
    },
  },
  bn: {
    title: "দোয়া ও যিকির",
    supplications: "দোয়া",
    searchPlaceholder: "দোয়া বা রেফারেন্স খুঁজুন...",
    pronunciationShow: "▾ উচ্চারণ",
    pronunciationHide: "▸ উচ্চারণ",
    translationShow: "▾ অনুবাদ",
    translationHide: "▸ অনুবাদ",
    tap: "+ ট্যাপ",
    saved: "সংরক্ষিত",
    duaSingle: "দোয়া",
    duaPlural: "দোয়া",
    matching: "মিলে যাওয়া",
    noDuasFound: "কোনো দোয়া পাওয়া যায়নি",
    clearFilters: "ফিল্টার মুছুন",
    categories: {
      All: "সব",
      Morning: "সকাল",
      Evening: "সন্ধ্যা",
      Travel: "ভ্রমণ",
      Eating: "খাবার",
      Sleeping: "ঘুম",
      Illness: "অসুস্থতা",
      Distress: "বিপদ",
      Gratitude: "কৃতজ্ঞতা",
      Forgiveness: "ক্ষমা",
      Protection: "সুরক্ষা",
      Weather: "আবহাওয়া",
      "After Prayer": "নামাজের পর",
      Home: "বাড়ি",
      Mosque: "মসজিদ",
      Daily: "দৈনিক",
      "Special Days": "বিশেষ দিন",
      Knowledge: "জ্ঞান",
      Character: "চরিত্র",
      Marriage: "বিবাহ",
      Family: "পরিবার",
      Financial: "আর্থিক",
      Afterlife: "পরকাল",
      Repentance: "তওবা",
      Parents: "বাবা-মা",
      Fasting: "রোজা",
      "Hajj & Umrah": "হজ ও ওমরাহ",
      "New Moon": "নতুন চাঁদ",
    },
  },
  ru: {
    title: "Дуа и поминания",
    supplications: "Дуа",
    searchPlaceholder: "Поиск дуа или источников...",
    pronunciationShow: "▾ Транскрипция",
    pronunciationHide: "▸ Транскрипция",
    translationShow: "▾ Перевод",
    translationHide: "▸ Перевод",
    tap: "+ Счёт",
    saved: "сохранено",
    duaSingle: "дуа",
    duaPlural: "дуа",
    matching: "по запросу",
    noDuasFound: "Мольбы не найдены",
    clearFilters: "Сбросить фильтры",
    categories: {
      All: "Все",
      Morning: "Утро",
      Evening: "Вечер",
      Travel: "Путешествие",
      Eating: "Еда",
      Sleeping: "Сон",
      Illness: "Болезнь",
      Distress: "Трудности",
      Gratitude: "Благодарность",
      Forgiveness: "Прощение",
      Protection: "Защита",
      Weather: "Погода",
      "After Prayer": "После намаза",
      Home: "Дом",
      Mosque: "Мечеть",
      Daily: "Повседневное",
      "Special Days": "Особые дни",
      Knowledge: "Знания",
      Character: "Нрав",
      Marriage: "Брак",
      Family: "Семья",
      Financial: "Финансы",
      Afterlife: "Вечная жизнь",
      Repentance: "Покаяние",
      Parents: "Родители",
      Fasting: "Пост",
      "Hajj & Umrah": "Хадж и умра",
      "New Moon": "Новолуние",
    },
  },
};

function getTargetCount(dua: Dua): number {
  if (dua.repeatCount && dua.repeatCount > 0) return dua.repeatCount;
  const lower = `${dua.translation} ${dua.transliteration} ${dua.reference || ""}`.toLowerCase();
  if (lower.includes("100 times") || lower.includes("hundred times") || lower.includes("100x")) return 100;
  if (lower.includes("33 times") || lower.includes("thirty-three times") || lower.includes("33x")) return 33;
  if (lower.includes("7 times") || lower.includes("seven times") || lower.includes("7x")) return 7;
  if (lower.includes("3 times") || lower.includes("three times") || lower.includes("3x")) return 3;
  if (dua.id.includes("subhanallah") || dua.id.includes("tasbih")) return 33;
  if (dua.id.includes("istighfar")) return 3;
  return 1;
}

interface DuaCardProps {
  dua: Dua;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onShare: (dua: Dua) => void;
  isDuaOfDay?: boolean;
  fontLevel: number;
}

const DuaCard = memo(function DuaCard({
  dua,
  isFavorite,
  onToggleFavorite,
  onShare,
  isDuaOfDay,
  fontLevel,
}: DuaCardProps) {
  const [counter, setCounter] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showPronunciation, setShowPronunciation] = useState(true);
  const [showTranslation, setShowTranslation] = useState(true);

  const { contentLang, isRtl } = useContentLanguage();
  const strings = useMemo(() => DUAS_I18N[contentLang] || DUAS_I18N.en, [contentLang]);
  const [translatedTranslation, setTranslatedTranslation] = useState(dua.translation);

  useEffect(() => {
    if (contentLang === 'en') {
      setTranslatedTranslation(dua.translation);
      return;
    }
    let isMounted = true;
    translateIslamicText(dua.translation, contentLang).then(t => {
      if (isMounted) setTranslatedTranslation(t);
    });
    return () => { isMounted = false; };
  }, [dua.translation, contentLang]);

  const targetCount = useMemo(() => getTargetCount(dua), [dua]);
  const isComplete = counter >= targetCount;
  const synth = useMemo(() => typeof window !== "undefined" ? window.speechSynthesis : null, []);

  const playAudio = (text: string) => {
    if (!synth) return;
    if (synth.speaking) {
      synth.cancel();
      setIsPlaying(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar";
    utterance.rate = 0.8;
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);
    setIsPlaying(true);
    synth.speak(utterance);
  };

  const handleTap = useCallback(() => {
    setCounter((prev) => {
      const next = Math.min(targetCount, prev + 1);
      if ("vibrate" in navigator) {
        if (next >= targetCount) {
          navigator.vibrate([15, 50, 15]);
        } else {
          navigator.vibrate(8);
        }
      }
      return next;
    });
  }, [targetCount]);

  const handleReset = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setCounter(0);
    if ("vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }, []);

  const currentFont = FONT_LEVELS[fontLevel] || FONT_LEVELS[2];

  const handleCopy = useCallback(async () => {
    const bodyText = `"${dua.arabic}"\n\n${dua.transliteration}\n\n${translatedTranslation || dua.translation}\n— ${dua.reference || "Hisn al-Muslim"}`;
    try {
      await navigator.clipboard.writeText(bodyText);
    } catch (err) {
      console.debug('[Duas] Clipboard copy fallback:', err);
    }
  }, [dua.arabic, dua.transliteration, dua.translation, dua.reference, translatedTranslation]);

  return (
    <div className="w-full min-w-0 active:scale-[0.99] transition-transform duration-100">
      <Card
        className={`w-full min-w-0 p-4 relative overflow-hidden rounded-2xl border transition-all ${
          isDuaOfDay ? "siraj-translucent-subtle" : "siraj-translucent-card"
        } ${isComplete ? "shadow-md ring-1 ring-[var(--accent)]" : "shadow-sm"}`}
        style={{
          borderColor: isComplete ? "var(--accent)" : "var(--border)",
        }}
      >
        <div className="w-full min-w-0 space-y-3">
          {/* Header Row: Star + Category + Repeat Badge on Left; Audio / Favorite / Copy / Share on Right */}
          <div className="flex items-center justify-between flex-wrap gap-2 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              {isDuaOfDay && <Star className="w-3.5 h-3.5 text-[var(--accent)] fill-[var(--accent)] shrink-0" />}
              <span
                className={`px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider rounded-full border max-w-full truncate ${contentLang === 'ur' ? 'font-urdu' : ''}`}
                style={{
                  background: "var(--accent-soft)",
                  borderColor: "var(--accent)",
                  color: "var(--accent-text)",
                }}
              >
                {strings.categories[dua.category] || dua.category}
              </span>
              <span
                className="px-2 py-0.5 text-[11px] font-mono font-bold rounded-full border shrink-0"
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text-secondary)",
                }}
              >
                ×{targetCount}
              </span>
            </div>

            {/* Quick Actions (Audio, Copy, Favorite, Share) */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] shrink-0"
                onClick={() => playAudio(dua.arabic)}
                aria-label="Listen to audio pronunciation"
              >
                <Volume2 className={`w-4 h-4 ${isPlaying ? "text-[var(--accent)] animate-pulse" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] shrink-0"
                onClick={handleCopy}
                aria-label="Copy supplication"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-[var(--text-secondary)] hover:text-red-500 hover:bg-[var(--surface-2)] shrink-0"
                onClick={() => onToggleFavorite(dua.id)}
                aria-label="Save to favorites"
              >
                <Heart className={`w-4 h-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] shrink-0"
                onClick={() => onShare(dua)}
                aria-label="Share supplication"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Arabic Calligraphy Text */}
          <p
            className="w-full min-w-0 font-arabic font-bold text-right break-words select-text"
            dir="rtl"
            style={{
              fontFamily: "'Amiri', 'Traditional Arabic', 'Scheherazade New', serif",
              fontSize: currentFont.arabic,
              lineHeight: 2.0,
              wordSpacing: "2px",
              color: "var(--text-primary)",
              paddingTop: "4px",
              paddingBottom: "4px",
              unicodeBidi: "plaintext",
            }}
          >
            {dua.arabic}
          </p>

          {/* Collapsible Layer Toggles: [ ▸ Pronunciation ] [ ▸ Translation ] */}
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPronunciation((prev) => !prev)}
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all active:scale-95 ${contentLang === 'ur' ? 'font-urdu' : ''}`}
              style={{
                background: showPronunciation ? "var(--accent-soft)" : "var(--surface-2)",
                borderColor: showPronunciation ? "var(--accent)" : "var(--border)",
                color: showPronunciation ? "var(--accent-text)" : "var(--text-secondary)",
              }}
            >
              {showPronunciation ? strings.pronunciationShow : strings.pronunciationHide}
            </button>
            <button
              type="button"
              onClick={() => setShowTranslation((prev) => !prev)}
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-all active:scale-95 ${contentLang === 'ur' ? 'font-urdu' : ''}`}
              style={{
                background: showTranslation ? "var(--accent-soft)" : "var(--surface-2)",
                borderColor: showTranslation ? "var(--accent)" : "var(--border)",
                color: showTranslation ? "var(--accent-text)" : "var(--text-secondary)",
              }}
            >
              {showTranslation ? strings.translationShow : strings.translationHide}
            </button>
          </div>

          {/* Transliteration */}
          {showPronunciation && (
            <p
              dir="ltr"
              className="w-full min-w-0 font-serif italic leading-relaxed pt-1 break-words whitespace-normal text-left"
              style={{
                fontSize: currentFont.translation,
                color: "var(--accent-text)",
                unicodeBidi: "plaintext",
              }}
            >
              {dua.transliteration}
            </p>
          )}

          {/* Translation */}
          {showTranslation && (
            <p
              className={`w-full min-w-0 leading-relaxed font-medium break-words whitespace-normal ${contentLang === 'ur' ? 'font-urdu text-right leading-[2.35]' : 'text-left'}`}
              dir={isRtl ? 'rtl' : 'ltr'}
              style={{
                fontSize: currentFont.translation,
                color: "var(--text-primary)",
                opacity: 0.95,
                unicodeBidi: "plaintext",
              }}
            >
              {translatedTranslation || dua.translation}
            </p>
          )}

          {/* Footer: Tactile Inline Tap Counter + Authentic Source Reference */}
          <div
            className="flex items-center justify-between pt-3 border-t mt-1 gap-2 min-w-0 flex-wrap"
            style={{ borderColor: "var(--border)" }}
          >
            {/* Tactile Repetition Tap Counter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleTap}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-all active:scale-95 shadow-sm whitespace-nowrap"
                style={{
                  background: isComplete ? "var(--accent)" : "var(--surface-2)",
                  borderColor: isComplete ? "var(--accent)" : "var(--border)",
                  color: isComplete ? "var(--on-accent)" : "var(--text-primary)",
                }}
                aria-label={`Tap counter ${counter} of ${targetCount}`}
              >
                <span className="font-mono text-xs">{counter} / {targetCount}</span>
                {isComplete ? (
                  <Check className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <span className={`text-[10px] text-[var(--accent-text)] font-semibold ${contentLang === 'ur' ? 'font-urdu' : ''}`}>{strings.tap}</span>
                )}
              </button>

              {counter > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors"
                  title="Reset counter"
                  aria-label="Reset counter"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Authentic Source Reference */}
            <div
              className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] text-right truncate max-w-[160px] min-w-0"
              title={dua.reference || "Authentic Supplication"}
            >
              {dua.reference || "Hisn al-Muslim"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.dua.id === nextProps.dua.id &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.isDuaOfDay === nextProps.isDuaOfDay &&
    prevProps.fontLevel === nextProps.fontLevel
  );
});

const Duas = memo(function Duas() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contentLang, isRtl } = useContentLanguage();
  const strings = useMemo(() => DUAS_I18N[contentLang] || DUAS_I18N.en, [contentLang]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [fontLevel, setFontLevel] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("duas_font_level");
      return saved ? Math.max(0, Math.min(4, parseInt(saved, 10))) : 2;
    } catch {
      return 2;
    }
  });

  const handleFontChange = (newLevel: number) => {
    const clamped = Math.max(0, Math.min(4, newLevel));
    setFontLevel(clamped);
    try {
      localStorage.setItem("duas_font_level", clamped.toString());
    } catch {
      // Storage fallback
    }
  };

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  const duaOfDay = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return duasData[dayOfYear % duasData.length];
  }, []);

  const filteredDuas = useMemo(() => {
    return duasData.filter((dua) => {
      if (selectedCategory !== "All" && dua.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          dua.translation.toLowerCase().includes(q) ||
          dua.transliteration.toLowerCase().includes(q) ||
          dua.arabic.includes(q) ||
          (dua.reference && dua.reference.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [selectedCategory, searchQuery]);

  const handleToggleFavorite = (duaId: string) => {
    const isFavorite = toggleFavorite(duaId);
    setFavorites(getFavorites());
    toast({
      title: isFavorite ? "Added to favorites" : "Removed from favorites",
    });
  };

  const shareDua = async (dua: Dua) => {
    const shareText = `"${dua.arabic}"\n\n${dua.transliteration}\n\nTranslation: ${dua.translation}\n— Source: ${dua.reference || "Hisn al-Muslim"}\nShared via Siraj`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: `Dua - ${dua.category}`, text: shareText });
      } catch {
        // Share dismiss guard
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast({ title: "Copied to clipboard" });
    }
  };

  return (
    <div
      data-testid="duas-page-root"
      className={`min-h-screen w-full max-w-full overflow-x-hidden bg-transparent pb-4 relative z-10 safe-top ${contentLang === 'ur' ? 'font-urdu' : ''}`}
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}
    >
      <div className="w-full max-w-lg mx-auto px-4 py-5 space-y-3.5 overflow-x-hidden box-border">
        {/* Header with Row 1 (Back + Title + Font Sizer) and Row 2 (3-Language Bar) */}
        <div className="w-full min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
                className="rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-2)] shrink-0"
                aria-label="Back to Home"
              >
                <ArrowLeft className="w-5 h-5 rtl:rotate-180" />
              </Button>
              <div className="min-w-0 flex-1">
                <h1 className={`text-xl font-bold text-[var(--text-primary)] tracking-tight truncate leading-tight ${contentLang === 'ur' ? 'font-urdu' : 'font-serif italic'}`}>
                  {strings.title}
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)] mt-0.5 truncate">
                  {duasData.length} {strings.supplications}
                </p>
              </div>
            </div>

            {/* Compact [ - ] A [ + ] Font Sizer */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full border shadow-sm shrink-0"
              style={{
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
              title="Adjust Arabic & translation font size"
            >
              <button
                type="button"
                disabled={fontLevel <= 0}
                onClick={() => handleFontChange(fontLevel - 1)}
                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs disabled:opacity-30 active:scale-95 text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                aria-label="Decrease supplication font size"
              >
                -
              </button>
              <span className="text-xs font-bold px-1 text-[var(--accent-text)]">A</span>
              <button
                type="button"
                disabled={fontLevel >= 4}
                onClick={() => handleFontChange(fontLevel + 1)}
                className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs disabled:opacity-30 active:scale-95 text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
                aria-label="Increase supplication font size"
              >
                +
              </button>
            </div>
          </div>

          <ContentLanguageBar fullWidth />
        </div>

        {/* Search */}
        <div className="relative w-full min-w-0">
          <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
          <Input
            placeholder={strings.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-w-0 pl-10 rtl:pl-4 rtl:pr-10 h-11 rounded-xl border shadow-sm focus-visible:ring-[var(--accent)]"
            style={{
              background: "var(--surface)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </div>

        {/* Categories Strip: strictly self-contained horizontal scroller (never widens page) */}
        <div
          data-testid="duas-category-scroller"
          className="w-full max-w-full overflow-x-auto no-scrollbar py-0.5"
        >
          <div className="flex flex-nowrap items-center gap-2 min-w-max">
            {duaCategories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 whitespace-nowrap text-xs px-3.5 py-1.5 rounded-full font-bold shadow-sm transition-all border active:scale-95 ${contentLang === 'ur' ? 'font-urdu' : ''}`}
                  style={{
                    background: isSelected ? "var(--accent)" : "var(--surface)",
                    borderColor: isSelected ? "var(--accent)" : "var(--border)",
                    color: isSelected ? "var(--on-accent)" : "var(--text-secondary)",
                  }}
                >
                  {strings.categories[cat] || cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Results count & Filter toggle */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--text-secondary)] truncate min-w-0">
            {filteredDuas.length} {filteredDuas.length === 1 ? strings.duaSingle : strings.duaPlural}
            {searchQuery && ` ${strings.matching} "${searchQuery}"`}
          </p>
          {favorites.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 shrink-0 text-[var(--text-secondary)] hover:text-red-500"
              onClick={() => setSelectedCategory("All")}
            >
              <Heart className="w-3 h-3 fill-red-500 text-red-500" />
              <span>{favorites.length} {strings.saved}</span>
            </Button>
          )}
        </div>

        {/* Dua of the Day */}
        {selectedCategory === "All" && !searchQuery && (
          <DuaCard
            dua={duaOfDay}
            isFavorite={favorites.includes(duaOfDay.id)}
            onToggleFavorite={handleToggleFavorite}
            onShare={shareDua}
            isDuaOfDay
            fontLevel={fontLevel}
          />
        )}

        {/* Duas List */}
        <div
          className="w-full min-w-0 space-y-3.5"
          style={{ paddingBottom: 'calc(80px + var(--player-inset, 0px))' }}
        >
          {filteredDuas.length === 0 ? (
            <Card
              className="w-full p-8 text-center rounded-2xl border shadow-sm siraj-translucent-card"
              style={{
                borderColor: "var(--border)",
              }}
            >
              <BookHeart className="w-12 h-12 mx-auto text-[var(--text-secondary)] opacity-40 mb-3" />
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mb-4">
                {strings.noDuasFound}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="font-bold rounded-xl"
                style={{
                  background: "var(--surface-2)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                onClick={() => {
                  setSearchQuery("");
                  setSelectedCategory("All");
                }}
              >
                {strings.clearFilters}
              </Button>
            </Card>
          ) : (
            <div className="w-full min-w-0 flex flex-col gap-3.5">
              {filteredDuas.map((dua) => (
                <div key={dua.id} className="w-full min-w-0" style={{ contentVisibility: "auto", containIntrinsicSize: "auto 260px" }}>
                  <DuaCard
                    dua={dua}
                    isFavorite={favorites.includes(dua.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onShare={shareDua}
                    fontLevel={fontLevel}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default Duas;
