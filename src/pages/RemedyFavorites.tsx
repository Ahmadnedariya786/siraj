import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, BookOpen, Quote, Play, Copy, Check, Trash2, Search, Filter } from "lucide-react";
import { useGlobalQuran } from "@/lib/global-quran";
import { useToast } from "@/hooks/use-toast";
import { remedyGamification, type FavoriteRemedy } from "@/lib/remedy-gamification";
import { moods, type Mood } from "@/data/mood-data";
import { useContentLanguage } from "@/lib/content-translator";
import { goBackOrFallback } from "@/lib/navigation";

const FAVORITES_I18N: Record<"en" | "ur" | "gu", {
  title: string;
  noFavs: string;
  noFavsDesc: string;
  browse: string;
  searchPlaceholder: string;
  all: string;
  playSurah: string;
  copy: string;
  copied: string;
  remove: string;
  noResults: string;
  noResultsDesc: string;
}> = {
  en: {
    title: "Favorite Remedies",
    noFavs: "No favorites yet",
    noFavsDesc: "Start saving your favorite Islamic remedies to build your personal collection.",
    browse: "Browse Remedies",
    searchPlaceholder: "Search favorites...",
    all: "All",
    playSurah: "Play Surah",
    copy: "Copy",
    copied: "Copied",
    remove: "Remove",
    noResults: "No results found",
    noResultsDesc: "Try adjusting your search or filter criteria.",
  },
  ur: {
    title: "پسندیدہ علاجات",
    noFavs: "ابھی کوئی پسندیدہ علاج نہیں",
    noFavsDesc: "اپنا ذاتی مجموعہ بنانے کے لیے پسندیدہ علاجات محفوظ کریں۔",
    browse: "علاجات دیکھیں",
    searchPlaceholder: "پسندیدہ میں تلاش کریں...",
    all: "سب",
    playSurah: "سورۃ سنیں",
    copy: "کاپی",
    copied: "کاپی ہو گیا",
    remove: "ہٹائیں",
    noResults: "کوئی نتیجہ نہیں ملا",
    noResultsDesc: "اپنی تلاش یا فلٹر تبدیل کر کے دیکھیں۔",
  },
  gu: {
    title: "પસંદીદા ઉપાયો",
    noFavs: "હજુ કોઈ પસંદીદા નથી",
    noFavsDesc: "તમારો સંગ્રહ બનાવવા માટે તમારા મનપસંદ ઉપાયો સાચવવાનું શરૂ કરો.",
    browse: "ઉપાયો જુઓ",
    searchPlaceholder: "પસંદીદા શોધો...",
    all: "બધા",
    playSurah: "સૂરા ચલાવો",
    copy: "કૉપિ",
    copied: "કૉપિ થયું",
    remove: "દૂર કરો",
    noResults: "કોઈ પરિણામ મળ્યું નથી",
    noResultsDesc: "તમારી શોધ અથવા ફિલ્ટર બદલીને પ્રયાસ કરો.",
  },
};

export default function RemedyFavorites() {
  const navigate = useNavigate();
  const { contentLang, isRtl } = useContentLanguage();
  const langKey: "en" | "ur" | "gu" =
    contentLang === "ur" || contentLang === "gu" ? contentLang : "en";
  const isUrdu = langKey === "ur";
  const strings = FAVORITES_I18N[langKey];

  const [favorites, setFavorites] = useState<FavoriteRemedy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [copied, setCopied] = useState<string | null>(null);
  const { playSurah, reciter } = useGlobalQuran();
  const { toast } = useToast();

  useEffect(() => {
    setFavorites(remedyGamification.getFavorites());
  }, []);

  const filteredFavorites = favorites.filter((favorite) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      favorite.content.toLowerCase().includes(q) ||
      favorite.reference.toLowerCase().includes(q);
    const matchesFilter = filterType === "all" || favorite.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const getMoodInfo = (moodId: string): Mood | undefined =>
    moods.find((m) => m.id === moodId);

  const handlePlaySurah = (favorite: FavoriteRemedy) => {
    const surahMatch = favorite.reference.match(/Surah (\d+)/);
    if (surahMatch && reciter) {
      const surahNumber = parseInt(surahMatch[1], 10);
      playSurah(surahNumber, favorite.reference, reciter);
      toast({
        title: strings.playSurah,
        description: `Now playing ${favorite.reference}.`,
      });
    } else if (!reciter) {
      toast({
        title: "Reciter loading",
        description: "Please wait for the Quran player to initialize.",
        variant: "destructive",
      });
    }
  };

  const handleCopy = async (favorite: FavoriteRemedy) => {
    const text = `${favorite.arabic ? `${favorite.arabic}\n\n` : ""}${favorite.content}\n${favorite.reference}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(favorite.id);
      setTimeout(() => setCopied(null), 1800);
      toast({ title: "Remedy copied" });
    } catch {
      toast({
        title: "Copy failed",
        description: "Clipboard is not available on this device.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = (favoriteId: string) => {
    remedyGamification.removeFromFavorites(favoriteId);
    setFavorites(remedyGamification.getFavorites());
    toast({ title: "Removed from favorites" });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "surah":
        return <BookOpen className="h-3 w-3" />;
      case "ayah":
        return <Quote className="h-3 w-3" />;
      case "dua":
        return <Heart className="h-3 w-3" />;
      case "hadith":
        return <Search className="h-3 w-3" />;
      case "dhikr":
        return <Filter className="h-3 w-3" />;
      default:
        return <Quote className="h-3 w-3" />;
    }
  };

  const uniqueTypes = Array.from(new Set(favorites.map((f) => f.type)));

  const scopedStyles = (
    <style>{`
      .siraj-fav-card {
        background: var(--surface);
        background: color-mix(in srgb, var(--surface) 86%, transparent);
        border: 1px solid var(--border);
      }
      .siraj-fav-chip {
        background: var(--surface-2);
        background: color-mix(in srgb, var(--surface-2) 86%, transparent);
        border: 1px solid var(--border);
      }
      .siraj-fav-type-chip {
        background: var(--surface-2);
        background: color-mix(in srgb, var(--accent) 18%, transparent);
        border: 1px solid var(--border);
        color: var(--accent-text);
      }
    `}</style>
  );

  const headerEl = (
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
          onClick={() => goBackOrFallback(navigate, "/islamic-remedies")}
          aria-label="Back"
          className="siraj-fav-chip w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-primary)] shrink-0 active:scale-95 transition-transform"
        >
          <ArrowLeft className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
        </button>
        <h1 className={`flex-1 min-w-0 text-base font-bold text-[var(--text-primary)] truncate ${isUrdu ? "font-urdu" : "font-serif italic"}`}>
          {strings.title}
        </h1>
      </div>
    </header>
  );

  if (favorites.length === 0) {
    return (
      <div
        className={`w-full max-w-full min-h-screen overflow-x-hidden bg-transparent relative z-10 ${isUrdu ? "font-urdu" : ""}`}
        dir={isRtl ? "rtl" : "ltr"}
      >
        {scopedStyles}
        {headerEl}
        <div
          className="max-w-lg mx-auto px-4 pt-5"
          style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px) + var(--player-inset, 0px))" }}
        >
          <div className="siraj-fav-card rounded-2xl p-7 text-center space-y-3">
            <Heart className="h-10 w-10 mx-auto text-[var(--accent)]" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">{strings.noFavs}</h3>
            <p className="text-xs text-[var(--text-secondary)]">{strings.noFavsDesc}</p>
            <button
              type="button"
              onClick={() => navigate("/islamic-remedies", { replace: true })}
              className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold active:scale-95 transition-transform"
              style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
            >
              {strings.browse}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-full min-h-screen overflow-x-hidden bg-transparent relative z-10 ${isUrdu ? "font-urdu" : ""}`}
      dir={isRtl ? "rtl" : "ltr"}
    >
      {scopedStyles}
      {headerEl}

      <div
        className="w-full max-w-lg mx-auto px-4 pt-4 space-y-4 overflow-x-hidden box-border"
        style={{ paddingBottom: "calc(28px + env(safe-area-inset-bottom, 0px) + var(--player-inset, 0px))" }}
      >
        {/* Search & Filter */}
        <div className="siraj-fav-card rounded-2xl p-3.5 space-y-3">
          <div className="relative w-full min-w-0">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-secondary)] pointer-events-none" />
            <input
              type="text"
              placeholder={strings.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-w-0 ps-9 pe-4 py-2 rounded-xl text-sm focus:outline-none"
              style={{
                backgroundColor: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            />
          </div>

          <div className="w-full max-w-full overflow-x-auto no-scrollbar">
            <div className="flex flex-nowrap items-center gap-2 w-max">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors"
                style={{
                  backgroundColor: filterType === "all" ? "var(--accent)" : "var(--surface-2)",
                  color: filterType === "all" ? "var(--accent-fg, var(--on-accent))" : "var(--text-secondary)",
                  borderColor: filterType === "all" ? "var(--accent)" : "var(--border)",
                }}
              >
                {strings.all} ({favorites.length})
              </button>
              {uniqueTypes.map((type) => {
                const active = filterType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border capitalize transition-colors"
                    style={{
                      backgroundColor: active ? "var(--accent)" : "var(--surface-2)",
                      color: active ? "var(--accent-fg, var(--on-accent))" : "var(--text-secondary)",
                      borderColor: active ? "var(--accent)" : "var(--border)",
                    }}
                  >
                    {type} ({favorites.filter((f) => f.type === type).length})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Favorites List */}
        <div className="space-y-3">
          {filteredFavorites.map((favorite) => {
            const moodInfo = getMoodInfo(favorite.moodId);
            const Icon = moodInfo?.icon;
            return (
              <div key={favorite.id} className="siraj-fav-card rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {Icon ? (
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border border-[var(--border)]"
                        style={{ backgroundColor: "var(--accent-soft)" }}
                      >
                        <Icon className="h-4 w-4 text-[var(--accent)]" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[var(--text-primary)] truncate">
                        {moodInfo?.label || "Mood"} Remedy
                      </p>
                      <p className="text-xs text-[var(--text-secondary)] truncate" dir="ltr">
                        {favorite.reference}
                      </p>
                    </div>
                  </div>
                  <span className="siraj-fav-type-chip rounded-full px-2.5 py-1 text-[11px] font-bold inline-flex items-center gap-1 capitalize shrink-0">
                    {getTypeIcon(favorite.type)}
                    <span>{favorite.type}</span>
                  </span>
                </div>

                {favorite.arabic ? (
                  <p className="siraj-fav-chip rounded-xl p-3 text-right font-arabic text-xl leading-[1.9] text-[var(--text-primary)]" dir="rtl">
                    {favorite.arabic}
                  </p>
                ) : null}

                <p className="siraj-fav-chip rounded-xl p-3 text-sm leading-relaxed text-[var(--text-primary)]">
                  {favorite.content}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {favorite.type === "surah" ? (
                    <button
                      type="button"
                      onClick={() => handlePlaySurah(favorite)}
                      className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold active:scale-95 transition-transform"
                      style={{ backgroundColor: "var(--accent)", color: "var(--on-accent)" }}
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>{strings.playSurah}</span>
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => handleCopy(favorite)}
                    className="siraj-fav-chip inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--text-primary)] active:scale-95 transition-transform"
                  >
                    {copied === favorite.id ? <Check className="h-3.5 w-3.5 text-[var(--success)]" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copied === favorite.id ? strings.copied : strings.copy}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(favorite.id)}
                    className="siraj-fav-chip inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-[var(--danger)] ms-auto active:scale-95 transition-transform"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{strings.remove}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filteredFavorites.length === 0 && searchTerm ? (
          <div className="siraj-fav-card rounded-2xl p-6 text-center space-y-2">
            <Search className="h-9 w-9 mx-auto text-[var(--text-secondary)]" />
            <h3 className="text-base font-semibold text-[var(--text-primary)]">{strings.noResults}</h3>
            <p className="text-xs text-[var(--text-secondary)]">{strings.noResultsDesc}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
