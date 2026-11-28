import { useMemo, useState, useEffect, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Heart,
  HeartHandshake,
  Play,
  Quote,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { moods, type Mood, type MoodContent } from "@/data/mood-data";
import { useGlobalQuran } from "@/lib/global-quran";
import { useToast } from "@/hooks/use-toast";
import { pickNonRepeatingIndex } from "@/lib/non-repeating-picker";
import { remedyGamification } from "@/lib/remedy-gamification";
import { translateIslamicText, useContentLanguage } from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import { goBackOrFallback } from "@/lib/navigation";

const storageKeyForMood = (moodId: string) => `dashboard-mood-remedy-${moodId}`;

const pickMoodIndex = (mood: Mood, exclude: number[] = []) =>
  pickNonRepeatingIndex({
    storageKey: storageKeyForMood(mood.id),
    length: mood.content.length,
    maxRecent: 3,
    exclude,
  });

const toCopyText = (item: MoodContent) =>
  `${item.arabic ? `${item.arabic}\n\n` : ""}${item.text}\n${item.reference}`;

const formatTagTitleCase = (tag: string): string => {
  const corrected = tag.trim().replace(/redeemption/gi, "redemption");
  return corrected
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

const getTypeIcon = (type: string): ReactNode => {
  switch (type) {
    case "surah":
      return <BookOpen className="h-3.5 w-3.5 shrink-0" />;
    case "ayah":
      return <Quote className="h-3.5 w-3.5 shrink-0" />;
    case "dua":
      return <Heart className="h-3.5 w-3.5 shrink-0" />;
    case "hadith":
      return <Sparkles className="h-3.5 w-3.5 shrink-0" />;
    case "dhikr":
      return <Target className="h-3.5 w-3.5 shrink-0" />;
    default:
      return <Quote className="h-3.5 w-3.5 shrink-0" />;
  }
};

interface RemediesI18n {
  title: string;
  howFeeling: string;
  selectMoodDesc: string;
  searchPlaceholder: string;
  allTab: string;
  surahTab: string;
  ayahTab: string;
  duaTab: string;
  hadithTab: string;
  dhikrTab: string;
  playSurah: string;
  copy: string;
  copied: string;
  next: string;
  chooseDifferentMood: string;
  todaysRemedy: string;
  remedyCompleteToast: string;
  copiedToast: string;
  savedFavoriteToast: string;
  removedFavoriteToast: string;
  saved: string;
  noMoodsMatch: string;
  moods: Record<string, string>;
  moodDescs: Record<string, string>;
}

const REMEDIES_I18N: Record<"en" | "ur" | "gu", RemediesI18n> = {
  en: {
    title: "Islamic Wellness & Remedies",
    howFeeling: "How are you feeling?",
    selectMoodDesc: "Select your mood to receive guidance from the Quran and Sunnah.",
    searchPlaceholder: "Search moods or remedies...",
    allTab: "All",
    surahTab: "Surah",
    ayahTab: "Ayah",
    duaTab: "Dua",
    hadithTab: "Hadith",
    dhikrTab: "Dhikr",
    playSurah: "Play Surah",
    copy: "Copy",
    copied: "Copied!",
    next: "Next",
    chooseDifferentMood: "Choose a different mood",
    todaysRemedy: "Today's Remedy",
    remedyCompleteToast: "Daily remedy complete! +25 XP",
    copiedToast: "Copied to clipboard",
    savedFavoriteToast: "Saved to favorites",
    removedFavoriteToast: "Removed from favorites",
    saved: "Saved",
    noMoodsMatch: "No moods match your search. Try a different term.",
    moods: {
      anxious: "Anxious",
      sad: "Sad",
      happy: "Happy",
      lost: "Lost",
      grateful: "Grateful",
      tired: "Tired",
      stressed: "Stressed",
      angry: "Angry",
      confused: "Confused",
      lonely: "Lonely",
      sick: "Sick",
      motivated: "Motivated",
    },
    moodDescs: {
      anxious: "Peace and tranquility",
      sad: "Comfort and hope",
      happy: "Gratitude and joy",
      lost: "Guidance and direction",
      grateful: "Cultivate thankfulness",
      tired: "Strength and energy",
      stressed: "Relief from stress",
      angry: "Calm and forgiveness",
      confused: "Clarity and wisdom",
      lonely: "Nearness and comfort",
      sick: "Healing and recovery",
      motivated: "Inspiration and drive",
    },
  },
  ur: {
    title: "اسلامی سکون و علاج",
    howFeeling: "آپ کیسا محسوس کر رہے ہیں؟",
    selectMoodDesc: "قرآن و سنت سے رہنمائی حاصل کرنے کے لیے اپنا موڈ منتخب کریں۔",
    searchPlaceholder: "موڈ یا علاج تلاش کریں...",
    allTab: "سب",
    surahTab: "سورۃ",
    ayahTab: "آیت",
    duaTab: "دعا",
    hadithTab: "حدیث",
    dhikrTab: "ذکر",
    playSurah: "سورۃ سنیں",
    copy: "کاپی",
    copied: "کاپی ہو گیا!",
    next: "اگلا",
    chooseDifferentMood: "مختلف موڈ منتخب کریں",
    todaysRemedy: "آج کا علاج",
    remedyCompleteToast: "آج کا علاج مکمل! +25 XP",
    copiedToast: "کلپ بورڈ پر کاپی ہو گیا",
    savedFavoriteToast: "پسندیدہ میں محفوظ کر لیا گیا",
    removedFavoriteToast: "پسندیدہ سے ہٹا دیا گیا",
    saved: "محفوظ شدہ",
    noMoodsMatch: "آپ کی تلاش کے مطابق کوئی موڈ نہیں ملا۔",
    moods: {
      anxious: "بے چین",
      sad: "اداس",
      happy: "خوش",
      lost: "راہ گم",
      grateful: "شکر گزار",
      tired: "تھکا ہوا",
      stressed: "پریشان",
      angry: "غصے میں",
      confused: "الجھن زدہ",
      lonely: "تنہا",
      sick: "بیمار",
      motivated: "پرعزم",
    },
    moodDescs: {
      anxious: "دل کا اطمینان اور سکون",
      sad: "تسلی اور امید کی کرن",
      happy: "خوشی اور شکرگزاری",
      lost: "ہدایت اور صحیح راستہ",
      grateful: "شکر گزاری کی نعمت",
      tired: "تازہ دم اور قوت",
      stressed: "ذہنی دباؤ سے نجات",
      angry: "بردباری اور درگزر",
      confused: "بصیرت اور حکمت",
      lonely: "قربِ الٰہی کا احساس",
      sick: "شفا اور تندرستی",
      motivated: "حوصلہ اور استقامت",
    },
  },
  gu: {
    title: "ઇસ્લામિક ઉપચાર અને સુખાકારી",
    howFeeling: "તમે કેવું અનુભવી રહ્યા છો?",
    selectMoodDesc: "કુરાન અને સુન્નતમાંથી માર્ગદર્શન મેળવવા માટે તમારો મૂડ પસંદ કરો.",
    searchPlaceholder: "મૂડ અથવા ઉપાયો શોધો...",
    allTab: "બધા",
    surahTab: "સૂરા",
    ayahTab: "આયત",
    duaTab: "દુઆ",
    hadithTab: "હદીસ",
    dhikrTab: "ઝિક્ર",
    playSurah: "સૂરા ચલાવો",
    copy: "કૉપિ",
    copied: "કૉપિ થઈ ગયું!",
    next: "આગળ",
    chooseDifferentMood: "બીજો મૂડ પસંદ કરો",
    todaysRemedy: "આજનો ઉપાય",
    remedyCompleteToast: "દૈનિક ઉપાય પૂર્ણ! +25 XP",
    copiedToast: "ક્લિપબોર્ડ પર કૉપિ થઈ ગયું",
    savedFavoriteToast: "મનપસંદમાં સાચવ્યું",
    removedFavoriteToast: "મનપસંદમાંથી હટાવ્યું",
    saved: "સાચવેલા",
    noMoodsMatch: "તમારી શોધ સાથે કોઈ મૂડ મેળ ખાતો નથી.",
    moods: {
      anxious: "ચિંતિત",
      sad: "ઉદાસ",
      happy: "ખુશ",
      lost: "દિશાહીન",
      grateful: "આભારી",
      tired: "થાકેલું",
      stressed: "તણાવગ્રસ્ત",
      angry: "ગુસ્સામાં",
      confused: "મૂંઝવણમાં",
      lonely: "એકલવાયું",
      sick: "બીમાર",
      motivated: "પ્રેરિત",
    },
    moodDescs: {
      anxious: "શાંતિ અને દિલાસો",
      sad: "આશ્વાસન અને આશા",
      happy: "આભાર અને આનંદ",
      lost: "માર્ગદર્શન અને દિશા",
      grateful: "કૃતજ્ઞતાનો ભાવ",
      tired: "શક્તિ અને ઊર્જા",
      stressed: "તણાવમાંથી રાહત",
      angry: "ધૈર્ય અને માફી",
      confused: "સ્પષ્ટતા અને સમજણ",
      lonely: "નિકટતા અને સાથ",
      sick: "શિફા અને આરોગ્ય",
      motivated: "પ્રેરણા અને ઉત્સાહ",
    },
  },
};

export default function IslamicRemedies() {
  const navigate = useNavigate();
  const { contentLang, isRtl } = useContentLanguage();
  const langKey: "en" | "ur" | "gu" =
    contentLang === "ur" || contentLang === "gu" ? contentLang : "en";
  const isUrdu = langKey === "ur";
  const strings = REMEDIES_I18N[langKey];

  const [phase, setPhase] = useState<"prompt" | "viewing">("prompt");
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [activeIndexes, setActiveIndexes] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dailyRemedy, setDailyRemedy] = useState(() => remedyGamification.getDailyRemedy());
  const [favorites, setFavorites] = useState(() => remedyGamification.getFavorites());

  const { playSurah, reciter } = useGlobalQuran();
  const { toast } = useToast();

  const currentIndex = selectedMood ? activeIndexes[selectedMood.id] ?? 0 : 0;
  const currentItem = selectedMood
    ? selectedMood.content[currentIndex] ?? selectedMood.content[0]
    : null;
  const remedyId = selectedMood ? `${selectedMood.id}-${currentIndex}` : "";
  const isFav =
    currentItem && selectedMood ? remedyGamification.isFavorite(remedyId) : false;

  const [translatedRemedyText, setTranslatedRemedyText] = useState("");
  const [isTranslatingRemedy, setIsTranslatingRemedy] = useState(false);

  useEffect(() => {
    if (!currentItem?.text) return;
    if (langKey === "en") {
      setTranslatedRemedyText(currentItem.text);
      setIsTranslatingRemedy(false);
      return;
    }
    let isMounted = true;
    setIsTranslatingRemedy(true);
    translateIslamicText(currentItem.text, langKey)
      .then((t) => {
        if (isMounted) {
          setTranslatedRemedyText(t);
          setIsTranslatingRemedy(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setTranslatedRemedyText(currentItem.text);
          setIsTranslatingRemedy(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [currentItem?.text, langKey]);

  const typeLabelMap: Record<string, string> = {
    surah: strings.surahTab,
    ayah: strings.ayahTab,
    dua: strings.duaTab,
    hadith: strings.hadithTab,
    dhikr: strings.dhikrTab,
  };

  const filteredMoods = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && typeFilter === "all") return moods;
    return moods.filter((m) => {
      const localizedMood = strings.moods[m.id] || m.label;
      const localizedDesc = strings.moodDescs[m.id] || m.description || "";
      const matchesSearch =
        !q ||
        m.label.toLowerCase().includes(q) ||
        localizedMood.toLowerCase().includes(q) ||
        localizedDesc.toLowerCase().includes(q) ||
        m.content.some(
          (c) =>
            c.text.toLowerCase().includes(q) ||
            c.reference.toLowerCase().includes(q)
        );
      const matchesType =
        typeFilter === "all" || m.content.some((c) => c.type === typeFilter);
      return matchesSearch && matchesType;
    });
  }, [searchQuery, typeFilter, strings.moods, strings.moodDescs]);

  const handleMoodClick = (mood: Mood) => {
    setSelectedMood(mood);
    setTranslatedRemedyText("");
    setIsTranslatingRemedy(langKey !== "en");
    setActiveIndexes((prev) => {
      if (typeof prev[mood.id] === "number") return prev;
      return { ...prev, [mood.id]: pickMoodIndex(mood) };
    });
    setPhase("viewing");
  };

  const handleNext = () => {
    if (!selectedMood) return;
    setTranslatedRemedyText("");
    setIsTranslatingRemedy(langKey !== "en");
    const nextIndex = pickMoodIndex(selectedMood, [currentIndex]);
    setActiveIndexes((prev) => ({ ...prev, [selectedMood.id]: nextIndex }));
    if (currentItem) {
      remedyGamification.updateStats(selectedMood.id, currentItem.type);
    }
  };

  const handlePlaySurah = () => {
    if (!selectedMood || !currentItem?.surahNumber) return;
    if (!reciter) {
      toast({
        title: "Reciter loading",
        description: "Please wait for the Quran player to initialize.",
        variant: "destructive",
      });
      return;
    }
    playSurah(currentItem.surahNumber, currentItem.reference, reciter);
    toast({
      title: strings.playSurah,
      description: `Now playing ${currentItem.reference}.`,
    });
  };

  const handleCopy = async () => {
    if (!currentItem) return;
    try {
      await navigator.clipboard.writeText(toCopyText(currentItem));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: strings.copiedToast });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is not available on this device.",
        variant: "destructive",
      });
    }
  };

  const handleToggleFavorite = () => {
    if (!currentItem || !selectedMood) return;
    if (isFav) {
      remedyGamification.removeFromFavorites(remedyId);
      setFavorites(remedyGamification.getFavorites());
      toast({ title: strings.removedFavoriteToast });
    } else {
      remedyGamification.addToFavorites({
        id: remedyId,
        moodId: selectedMood.id,
        text: currentItem.text,
        arabic: currentItem.arabic,
        reference: currentItem.reference,
        type: currentItem.type,
      });
      setFavorites(remedyGamification.getFavorites());
      toast({ title: strings.savedFavoriteToast });
    }
  };

  const handleCloseViewer = () => {
    setPhase("prompt");
    setSelectedMood(null);
  };

  const scopedStyles = (
    <style>{`
      .siraj-remedy-card {
        background: var(--surface);
        background: color-mix(in srgb, var(--surface) 86%, transparent);
        border: 1px solid var(--border);
      }
      .siraj-remedy-chip {
        background: var(--surface-2);
        background: color-mix(in srgb, var(--surface-2) 86%, transparent);
        border: 1px solid var(--border);
      }
      .siraj-remedy-type-chip {
        background: var(--surface-2);
        background: color-mix(in srgb, var(--accent) 18%, transparent);
        border: 1px solid var(--border);
        color: var(--accent-text);
      }
    `}</style>
  );

  if (phase === "viewing" && selectedMood && currentItem) {
    const moodTitle = strings.moods[selectedMood.id] || selectedMood.label;
    const MoodIcon = selectedMood.icon;
    const tagLabel = currentItem.category ? formatTagTitleCase(currentItem.category) : "";

    return (
      <div
        className={`w-full max-w-full min-h-screen overflow-x-hidden bg-transparent flex flex-col relative z-10 ${
          isUrdu ? "font-urdu" : ""
        }`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {scopedStyles}

        {/* Sticky Safe-Area Padded Top Header */}
        <header
          data-testid="remedy-detail-header"
          className="sticky top-0 z-30 w-full border-b border-[var(--border)]"
          style={{
            paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
            background: "var(--bg-base)",
          }}
        >
          <div className="max-w-lg mx-auto w-full px-4 pb-3 flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={handleCloseViewer}
              aria-label="Close remedy"
              className="siraj-remedy-chip w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-primary)] shrink-0 active:scale-95 transition-transform"
            >
              <X className="w-5 h-5" />
            </button>
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[var(--border)]"
              style={{ backgroundColor: "var(--accent-soft)" }}
            >
              <MoodIcon className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold text-[var(--text-primary)] truncate ${isUrdu ? "font-urdu" : ""}`}>
                {moodTitle}
              </p>
              <p className="text-xs text-[var(--text-secondary)] truncate" dir="ltr">
                {currentItem.reference}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={isFav ? "Remove favorite" : "Save favorite"}
              className="siraj-remedy-chip w-10 h-10 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              style={
                isFav
                  ? {
                      borderColor: "var(--accent)",
                      color: "var(--accent)",
                    }
                  : { color: "var(--text-secondary)" }
              }
            >
              <Heart className={`w-5 h-5 ${isFav ? "fill-current" : ""}`} />
            </button>
          </div>
        </header>

        {/* Tight Natural Flex Flow */}
        <div
          className="w-full max-w-lg mx-auto px-4 pt-3 space-y-4 overflow-x-hidden box-border"
          style={{ paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}
        >
          <ContentLanguageBar fullWidth />

          {currentItem.arabic ? (
            <div className="siraj-remedy-card rounded-2xl p-5">
              <p
                className="text-right font-arabic text-2xl sm:text-3xl leading-[2.1] text-[var(--text-primary)]"
                dir="rtl"
              >
                {currentItem.arabic}
              </p>
            </div>
          ) : null}

          <div className="siraj-remedy-card rounded-2xl p-5 space-y-3.5">
            {isTranslatingRemedy && langKey !== "en" ? (
              <div className="space-y-2.5 py-1 animate-pulse">
                <div className="h-4 rounded w-3/4 mx-auto bg-[var(--surface-2)]" />
                <div className="h-4 rounded w-5/6 mx-auto bg-[var(--surface-2)]" />
                <div className="h-4 rounded w-1/2 mx-auto bg-[var(--surface-2)]" />
              </div>
            ) : (
              <p
                className={`text-base leading-relaxed text-[var(--text-primary)] ${
                  isUrdu ? "font-urdu text-right leading-[2.35]" : "text-left"
                }`}
                dir={isRtl ? "rtl" : "ltr"}
              >
                {translatedRemedyText || currentItem.text}
              </p>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="siraj-remedy-type-chip rounded-full px-3 py-1 text-xs font-bold inline-flex items-center gap-1.5">
                {getTypeIcon(currentItem.type)}
                <span>{typeLabelMap[currentItem.type] || formatTagTitleCase(currentItem.type)}</span>
              </span>
              {tagLabel ? (
                <span className="siraj-remedy-chip rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)]">
                  {tagLabel}
                </span>
              ) : null}
              <span className="text-xs text-[var(--text-secondary)] ms-auto" dir="ltr">
                {currentItem.reference}
              </span>
            </div>
          </div>

          {/* Bottom Action Row with --player-inset clearance */}
          <div
            data-testid="remedy-detail-actions"
            className="flex flex-wrap items-center gap-2.5 pt-1"
            style={{ marginBottom: "var(--player-inset, 0px)" }}
          >
            {currentItem.type === "surah" && currentItem.surahNumber ? (
              <button
                type="button"
                onClick={handlePlaySurah}
                className="flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold active:scale-95 transition-transform"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--on-accent)",
                }}
              >
                <Play className="w-3.5 h-3.5 shrink-0" />
                <span>{strings.playSurah}</span>
              </button>
            ) : null}

            <button
              type="button"
              onClick={handleCopy}
              className="siraj-remedy-card flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[var(--success)] shrink-0" />
              ) : (
                <Copy className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{copied ? strings.copied : strings.copy}</span>
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold ms-auto active:scale-95 transition-transform"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--on-accent)",
              }}
            >
              <span>{strings.next}</span>
              <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${isRtl ? "rotate-180" : ""}`} />
            </button>
          </div>

          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleCloseViewer}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] underline underline-offset-4"
            >
              {strings.chooseDifferentMood}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="remedies-list-root"
      className={`w-full max-w-full min-h-screen overflow-x-hidden bg-transparent relative z-10 ${
        isUrdu ? "font-urdu" : ""
      }`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {scopedStyles}

      {/* Locked 360px Safe Header */}
      <header
        className="sticky top-0 z-30 w-full border-b border-[var(--border)]"
        style={{
          paddingTop: "calc(12px + env(safe-area-inset-top, 0px))",
          background: "var(--bg-base)",
        }}
      >
        <div className="max-w-lg mx-auto w-full px-4 pb-3 flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => goBackOrFallback(navigate, "/dashboard")}
            aria-label="Back"
            className="siraj-remedy-chip w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-primary)] shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
          </button>
          <h1
            className={`flex-1 min-w-0 text-base font-bold text-[var(--text-primary)] leading-snug break-words ${
              isUrdu ? "font-urdu" : "font-serif italic"
            }`}
          >
            {strings.title}
          </h1>
          <button
            type="button"
            onClick={() => navigate("/remedy-favorites")}
            aria-label={strings.saved}
            className="siraj-remedy-chip relative w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-primary)] shrink-0 active:scale-95 transition-transform"
          >
            <Heart className="w-4 h-4" />
            {favorites.length > 0 ? (
              <span
                className="absolute -top-1 -end-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  backgroundColor: "var(--accent)",
                  color: "var(--on-accent)",
                }}
              >
                <span dir="ltr">{favorites.length > 9 ? "9+" : favorites.length}</span>
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <div
        className="w-full max-w-lg mx-auto px-4 pt-3 space-y-4 overflow-x-hidden box-border"
        style={{
          paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px) + var(--player-inset, 0px))",
        }}
      >
        {/* 3-Column Equal Language Selector Bar (EN / اردو / ગુજરાતી) */}
        <ContentLanguageBar fullWidth />

        {/* Today's Remedy Card */}
        {dailyRemedy && !dailyRemedy.completed ? (
          <div className="siraj-remedy-card rounded-2xl p-3.5 flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[var(--border)]"
              style={{ backgroundColor: "var(--accent-soft)" }}
            >
              <Sparkles className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-text)] mb-0.5">
                {strings.todaysRemedy}
              </p>
              <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2 break-words">
                {dailyRemedy.content}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate" dir="ltr">
                {dailyRemedy.reference}
              </p>
            </div>
            <button
              type="button"
              aria-label="Complete daily remedy"
              onClick={() => {
                remedyGamification.completeDailyRemedy();
                setDailyRemedy(remedyGamification.getDailyRemedy());
                toast({ title: strings.remedyCompleteToast });
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 active:scale-95 transition-transform"
              style={{
                backgroundColor: "var(--accent)",
                color: "var(--on-accent)",
              }}
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {/* Hero Heading */}
        <div className="text-center py-2 px-1">
          <div
            className="w-12 h-12 mx-auto rounded-2xl flex items-center justify-center mb-2.5 border border-[var(--border)]"
            style={{ backgroundColor: "var(--accent-soft)" }}
          >
            <HeartHandshake className="w-6 h-6 text-[var(--accent)]" />
          </div>
          <h2 className="text-xl font-black text-[var(--text-primary)] tracking-tight break-words">
            {strings.howFeeling}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-[300px] mx-auto leading-relaxed break-words">
            {strings.selectMoodDesc}
          </p>
        </div>

        {/* Isolated Horizontal Filter Strip + Theme-Token Search Input */}
        <div className="space-y-2.5 w-full min-w-0">
          <div
            data-testid="remedies-filter-strip"
            className="w-full max-w-full overflow-x-auto no-scrollbar py-0.5"
          >
            <div className="flex flex-nowrap items-center gap-2 w-max">
              {[
                { id: "all", label: `${strings.allTab} (${moods.length})` },
                { id: "surah", label: strings.surahTab },
                { id: "ayah", label: strings.ayahTab },
                { id: "dua", label: strings.duaTab },
                { id: "hadith", label: strings.hadithTab },
                { id: "dhikr", label: strings.dhikrTab },
              ].map(({ id, label }) => {
                const isActive = typeFilter === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTypeFilter(id)}
                    className="shrink-0 whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors active:scale-95"
                    style={{
                      backgroundColor: isActive ? "var(--accent)" : "var(--surface-2)",
                      color: isActive ? "var(--accent-fg, var(--on-accent))" : "var(--text-secondary)",
                      borderColor: isActive ? "var(--accent)" : "var(--border)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="relative w-full min-w-0">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)] pointer-events-none" />
            <input
              type="text"
              placeholder={strings.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-w-0 ps-9 pe-4 py-2.5 rounded-2xl text-sm focus:outline-none transition-colors"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        {/* 12-Card 2-Column Mood Grid (Zero Blank Cells) */}
        <div
          data-testid="remedies-mood-grid"
          className="grid grid-cols-2 gap-2.5 w-full min-w-0"
        >
          {filteredMoods.map((mood) => {
            const Icon = mood.icon;
            const moodLabel = strings.moods[mood.id] || mood.label;
            const moodSubtitle = strings.moodDescs[mood.id] || mood.description || "";
            return (
              <button
                key={mood.id}
                type="button"
                data-testid="remedy-mood-card"
                onClick={() => handleMoodClick(mood)}
                className="siraj-remedy-card w-full min-w-0 min-h-[96px] rounded-2xl p-3 flex flex-col justify-between text-start active:scale-[0.98] transition-transform"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[var(--border)]"
                  style={{ backgroundColor: "var(--accent-soft)" }}
                >
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <div className="min-w-0 w-full mt-2 space-y-0.5">
                  <p
                    className={`text-xs font-bold text-[var(--text-primary)] leading-tight break-words ${
                      isUrdu ? "font-urdu text-sm" : ""
                    }`}
                  >
                    {moodLabel}
                  </p>
                  <p
                    className={`text-[11px] text-[var(--text-secondary)] leading-snug line-clamp-2 ${
                      isUrdu ? "font-urdu text-xs" : ""
                    }`}
                  >
                    {moodSubtitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {filteredMoods.length === 0 ? (
          <div className="text-center py-6 text-sm text-[var(--text-secondary)]">
            {strings.noMoodsMatch}
          </div>
        ) : null}

        {/* Saved Favorites Footer Link */}
        <div className="flex justify-center pt-1">
          <button
            type="button"
            onClick={() => navigate("/remedy-favorites")}
            className="siraj-remedy-chip rounded-full px-4 py-2 text-xs font-semibold text-[var(--text-primary)] inline-flex items-center gap-2 active:scale-95 transition-transform"
          >
            <Heart className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>
              {strings.saved} (<span dir="ltr">{favorites.length}</span>)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
