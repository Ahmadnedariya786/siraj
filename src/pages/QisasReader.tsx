import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUp,
  BookMarked,
  Bookmark,
  ChevronLeft,
  ChevronRight,
  Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTransition } from "@/components/PageTransition";
import { goBackOrFallback } from "@/lib/navigation";
import { useLanguage } from "@/contexts/LanguageContext-new";
import {
  useContentLanguage,
  streamBookTranslation,
  translateIslamicText,
  translateIslamicBatch,
  isPureArabicBlock,
  type ContentLang,
} from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import {
  AaReaderControlsButton,
  BookProseParagraph,
  ReaderStatusBanner,
  FormattedIslamicText,
} from "@/components/BookReaderControls";
import {
  useBookReaderPrefs,
  formatIslamicProse,
  getArabicLineHeight,
} from "@/lib/reader-typography";
import {
  loadProphetList,
  loadProphetStory,
  getCachedProphetStorySync,
  getCachedProphetListSync,
  type ProphetStory,
  type ProphetSummary,
  PROPHET_NAME_TRANSLATIONS,
  PROPHET_SUBTITLE_TRANSLATIONS,
} from "@/lib/qisas";
import {
  getReadingProgress,
  isBookmarked as checkBookmarked,
  setLastRead,
  setReadingProgress,
  toggleBookmark,
} from "@/lib/reading-storage";

type EraKey = ProphetSummary["era"];

const ARABIC_RUN_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s]{11,}/;

function isStandAloneTranslit(text: string): boolean {
  const trimmed = text.trim();
  return (
    /^["'“]?(?:Wa |Inna |Qala |Qul |Rabbi |Allahu |Bismillahi |La |Subhana |Alam |Ayah |Surah )[a-zA-Z'\-,\s()0-9]+["'”]?$/.test(
      trimmed
    ) ||
    /\b(?:jaa'ilun|lil-mala'ikati|khaleefatan|rabbuka|innee|zalimoon|muslimeen|fastak baroo|bighairul haqqi)\b/i.test(
      trimmed
    )
  );
}

/**
 * Normalizes prophet story paragraphs and removes back-to-back duplicated Arabic verse blocks
 * that appear in source data while formatting Allah () / Prophet () honorifics cleanly.
 */
function buildCleanStoryParagraphs(rawStory: string): string[] {
  const formatted = formatIslamicProse(rawStory, "en");
  const rawParas = formatted
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !isStandAloneTranslit(p));

  const deduped: string[] = [];
  let lastArabicFingerprint = "";

  for (const para of rawParas) {
    const match = para.match(ARABIC_RUN_RE);
    if (match) {
      const arabicPart = match[0].trim();
      const nonArabicPart = para.replace(match[0], "").trim();
      const fp = arabicPart.slice(0, 48);

      // If previous block already rendered this exact Arabic ayah and current block is ONLY Arabic, skip dup
      if (fp === lastArabicFingerprint && nonArabicPart.length < 10) {
        continue;
      }
      lastArabicFingerprint = fp;

      if (nonArabicPart.length >= 10) {
        if (fp && deduped[deduped.length - 1] !== arabicPart) {
          deduped.push(arabicPart);
        }
        deduped.push(nonArabicPart);
      } else {
        deduped.push(arabicPart);
      }
    } else {
      lastArabicFingerprint = "";
      deduped.push(para);
    }
  }

  return deduped;
}

export default function QisasReader() {
  const { prophetId } = useParams<{ prophetId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();

  // Initialize synchronously from memory/fallback cache so zero jarring "Loading..." flash occurs
  const [prophet, setProphet] = useState<ProphetStory | null>(() =>
    prophetId ? getCachedProphetStorySync(prophetId) : null
  );
  const [allProphets, setAllProphets] = useState<ProphetSummary[]>(() =>
    getCachedProphetListSync()
  );
  const [loading, setLoading] = useState<boolean>(() =>
    prophetId ? !getCachedProphetStorySync(prophetId) : true
  );
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  const { contentLang } = useContentLanguage();
  const { prefs } = useBookReaderPrefs();
  const [translatedName, setTranslatedName] = useState("");
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedStory, setTranslatedStory] = useState("");
  const [translatedTags, setTranslatedTags] = useState<string[]>([]);
  const [actualLang, setActualLang] = useState<ContentLang>("en");
  const [fromCache, setFromCache] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [doneChunks, setDoneChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  const startTranslation = useCallback(
    (storyObj: ProphetStory, lang: ContentLang, signal: { aborted: boolean }) => {
      const curatedName =
        lang === "ur" || lang === "gu" || lang === "hi"
          ? PROPHET_NAME_TRANSLATIONS[storyObj.id]?.[lang]
          : null;
      const curatedTitle =
        lang === "ur" || lang === "gu" || lang === "hi"
          ? PROPHET_SUBTITLE_TRANSLATIONS[storyObj.id]?.[lang]
          : null;

      const cleanParas = buildCleanStoryParagraphs(storyObj.story);

      if (lang === "en") {
        setTranslatedName(storyObj.name);
        setTranslatedTitle(storyObj.title);
        setTranslatedStory(cleanParas.join("\n\n"));
        setTranslatedTags(storyObj.tags || []);
        setActualLang("en");
        setFromCache(false);
        setOfflineFallback(false);
        setIsTranslating(false);
        setDoneChunks(cleanParas.length);
        setTotalChunks(cleanParas.length);
        return;
      }

      if (curatedName) setTranslatedName(curatedName);
      if (curatedTitle) setTranslatedTitle(curatedTitle);
      setIsTranslating(true);
      setOfflineFallback(false);
      setDoneChunks(0);
      setTotalChunks(cleanParas.length);

      streamBookTranslation({
        module: "prophet",
        itemId: storyObj.id,
        title: curatedName || storyObj.name,
        englishParagraphs: cleanParas,
        targetLang: lang,
        signal,
        onUpdate: (upd) => {
          if (signal.aborted) return;
          setTranslatedStory(upd.text);
          setActualLang(upd.actualLang);
          setFromCache(upd.fromCache);
          setOfflineFallback(upd.offlineFallback);
          setDoneChunks(upd.doneChunks);
          setTotalChunks(upd.totalChunks);
          setIsTranslating(!upd.isComplete);
          if (!curatedName && upd.title) setTranslatedName(upd.title);
          if (upd.offlineFallback) {
            setTranslatedName(storyObj.name);
            setTranslatedTitle(storyObj.title);
          }
        },
      }).catch((err) => {
        console.warn("Prophet streaming translation fallback:", err);
        if (!signal.aborted) {
          setTranslatedName(storyObj.name);
          setTranslatedTitle(storyObj.title);
          setTranslatedStory(cleanParas.join("\n\n"));
          setActualLang("en");
          setOfflineFallback(true);
          setIsTranslating(false);
        }
      });

      if (!curatedName) {
        translateIslamicText(storyObj.name, lang)
          .then((n) => !signal.aborted && setTranslatedName(n))
          .catch((err) => console.debug("Prophet name translation skipped:", err));
      }
      if (!curatedTitle) {
        translateIslamicText(storyObj.title, lang)
          .then((tl) => !signal.aborted && setTranslatedTitle(tl))
          .catch((err) => console.debug("Prophet title translation skipped:", err));
      }
      if (storyObj.tags?.length) {
        translateIslamicBatch(storyObj.tags, lang)
          .then((tags) => !signal.aborted && setTranslatedTags(tags))
          .catch((err) => console.debug("Prophet tag translation skipped:", err));
      } else {
        setTranslatedTags([]);
      }
    },
    []
  );

  useEffect(() => {
    if (!prophet) return;
    const signal = { aborted: false };
    startTranslation(prophet, contentLang, signal);
    return () => {
      signal.aborted = true;
    };
  }, [prophet, contentLang, retryTick, startTranslation]);

  const eraLabels: Record<EraKey, string> = useMemo(() => {
    if (contentLang === "ur") {
      return {
        "beginning-of-creation": "ابتدائے آفرینش",
        "pre-flood": "طوفانِ نوح سے قبل",
        patriarchal: "دورِ ابراہیمی",
        israelite: "بنی اسرائیل کا دور",
        "post-israelite": "مابعد بنی اسرائیل",
      };
    }
    if (contentLang === "gu") {
      return {
        "beginning-of-creation": "શરૂઆતનો સમય",
        "pre-flood": "નૂહ પૂર પહેલાં",
        patriarchal: "ઇબ્રાહીમ દોર",
        israelite: "ઇઝરાયલી દોર",
        "post-israelite": "અન્ય પયગંબરો",
      };
    }
    if (contentLang === "hi") {
      return {
        "beginning-of-creation": "सृष्टि का आरंभ",
        "pre-flood": "तूफ़ान-ए-नूह से पूर्व",
        patriarchal: "इब्राहीमी दौर",
        israelite: "बनी इस्राईल का दौर",
        "post-israelite": "अन्य नबी",
      };
    }
    return {
      "beginning-of-creation": t("qisasEraBeginning"),
      "pre-flood": t("qisasEraPreFlood"),
      patriarchal: t("qisasEraPatriarchal"),
      israelite: t("qisasEraIsraelite"),
      "post-israelite": t("qisasEraPostIsraelite"),
    };
  }, [contentLang, t]);

  useEffect(() => {
    let active = true;
    if (prophetId) {
      const syncMatch = getCachedProphetStorySync(prophetId);
      if (syncMatch) {
        setProphet(syncMatch);
        setLoading(false);
      }
      setLastRead(prophetId, "qisas");
      setIsBookmarked(checkBookmarked(prophetId, "qisas"));
      setScrollProgress(getReadingProgress(prophetId, "qisas"));
    }

    async function loadData() {
      if (!prophetId) return;
      try {
        const [prophetData, list] = await Promise.all([
          loadProphetStory(prophetId),
          loadProphetList(),
        ]);
        if (!active) return;
        if (prophetData) setProphet(prophetData);
        if (list.length > 0) setAllProphets(list);
      } catch (error) {
        console.error("Failed to load prophet story:", error);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [prophetId]);

  // Unified document scroll tracking (#main-content or window fallback)
  useEffect(() => {
    const mainScrollEl = document.getElementById("main-content");
    const target: EventTarget = mainScrollEl || window;

    const handleScroll = () => {
      const scrollTop = mainScrollEl ? mainScrollEl.scrollTop : window.scrollY;
      const scrollHeight = mainScrollEl
        ? mainScrollEl.scrollHeight - mainScrollEl.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 100;

      setScrollProgress(Math.min(100, Math.max(0, progress)));
      setReadingProgress(prophetId || "", progress, "qisas");
      setShowBackToTop(scrollTop > 300);
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => target.removeEventListener("scroll", handleScroll);
  }, [prophetId, prophet]);

  const handleShare = async () => {
    const url = window.location.href;
    const title = translatedName || prophet?.name || "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied to clipboard" });
      }
    } catch {
      toast({ title: "Could not share prophet story link" });
    }
  };

  const handleBookmarkToggle = () => {
    if (!prophetId) return;
    const bookmarked = toggleBookmark(prophetId, "qisas");
    setIsBookmarked(bookmarked);
    toast({ title: bookmarked ? "Bookmarked" : "Bookmark removed" });
  };

  const scrollToTop = () => {
    const mainScrollEl = document.getElementById("main-content");
    if (mainScrollEl) {
      mainScrollEl.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToPrevProphet = () => {
    if (!prophet) return;
    const currentIndex = allProphets.findIndex((item) => item.id === prophet.id);
    if (currentIndex > 0) {
      navigate(`/qisas/${allProphets[currentIndex - 1].id}`);
    }
  };

  const goToNextProphet = () => {
    if (!prophet) return;
    const currentIndex = allProphets.findIndex((item) => item.id === prophet.id);
    if (currentIndex < allProphets.length - 1) {
      navigate(`/qisas/${allProphets[currentIndex + 1].id}`);
    }
  };

  const handleQuranRefClick = (ref: string) => {
    const [surahPart] = ref.split(":");
    const surahNum = Number.parseInt(surahPart, 10);
    if (!Number.isNaN(surahNum)) {
      navigate(`/mushaf/surah/${surahNum}`);
    }
  };

  const renderContent = (content: string) => {
    return content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((trimmed, index) => {
        const quranRefMatch = trimmed.match(/^\d+:\d+(?:-\d+)?$/);
        if (quranRefMatch) {
          return (
            <div
              key={index}
              className="my-3.5 p-3.5 bg-[var(--surface-2)] border-l-[3px] border-[var(--accent)] rounded-r-xl border border-[var(--border)] cursor-pointer hover:border-[var(--accent)] transition-colors"
              onClick={() => handleQuranRefClick(trimmed)}
            >
              <p
                className="font-arabic text-right text-[var(--accent-text)]"
                dir="rtl"
                style={{ fontSize: `${prefs.arabicFontSize}px` }}
              >
                {trimmed}
              </p>
            </div>
          );
        }

        if (isPureArabicBlock(trimmed)) {
          return (
            <div
              key={index}
              className="my-4 p-3.5 rounded-xl bg-[var(--surface-2)] border-r-[3px] border-[var(--accent)] border border-[var(--border)]"
            >
              <p
                className="font-arabic text-right text-[var(--accent-text)] break-words"
                dir="rtl"
                style={{
                  fontSize: `${prefs.arabicFontSize}px`,
                  lineHeight: getArabicLineHeight(prefs.lineSpacing),
                }}
              >
                {trimmed}
              </p>
            </div>
          );
        }

        return (
          <BookProseParagraph
            key={index}
            text={trimmed}
            actualLang={actualLang}
            fontSize={prefs.bodyFontSize}
            lineSpacing={prefs.lineSpacing}
            className="text-[var(--text-primary)]"
          />
        );
      });
  };

  if (loading && !prophet) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!prophet) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="text-muted-foreground">{t("notFound")}</div>
      </div>
    );
  }

  const currentIndex = allProphets.findIndex((item) => item.id === prophet.id);
  const visibleMentions = prophet.quranMentions.slice(0, 3);
  const extraMentions = Math.max(0, prophet.quranMentions.length - visibleMentions.length);
  const headerName = translatedName || prophet.name;
  const headerDir = actualLang === "ur" ? "rtl" : "ltr";

  return (
    <PageTransition>
      <div className="min-h-screen bg-transparent relative z-10 pb-28">
        <div className="fixed top-0 left-0 right-0 h-1 bg-transparent z-50 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-all duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        {/* Slim 52px Sticky Top Bar ONLY */}
        <header
          className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] safe-top"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="max-w-3xl mx-auto px-3 h-[52px] flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goBackOrFallback(navigate, "/qisas")}
              className="rounded-xl h-8 w-8 shrink-0"
              aria-label="Back to Prophets"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>

            <div className="min-w-0 flex-1">
              <h2
                dir={headerDir}
                className={`text-sm sm:text-base font-bold text-[var(--text-primary)] truncate ${
                  headerDir === "rtl" ? "font-urdu text-right" : "text-left"
                }`}
              >
                <FormattedIslamicText text={headerName} />
              </h2>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <AaReaderControlsButton />
              <Button
                variant="ghost"
                size="icon"
                onClick={handleShare}
                className="rounded-xl h-8 w-8"
                title="Share"
              >
                <Share2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBookmarkToggle}
                className="rounded-xl h-8 w-8"
                title="Bookmark"
              >
                {isBookmarked ? (
                  <BookMarked className="w-4 h-4 text-[var(--accent)]" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Natural Scrolling Hero & Metadata (scrolls smoothly away for 85%+ reading surface) */}
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-3 space-y-3 border-b border-[var(--border)]/60">
          <ContentLanguageBar fullWidth />

          <div className="w-full h-16 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center">
            <span className="font-arabic text-2xl text-[var(--accent)]" dir="rtl">
              {prophet.arabicName}
            </span>
          </div>

          <h1
            dir={headerDir}
            className={`text-xl sm:text-2xl font-bold text-[var(--text-primary)] ${
              headerDir === "rtl" ? "font-urdu text-right leading-[2.0]" : "text-left"
            }`}
          >
            <FormattedIslamicText text={headerName} />
          </h1>

          <p
            dir={headerDir}
            className={`text-sm sm:text-base text-[var(--text-secondary)] ${
              headerDir === "rtl" ? "font-urdu text-right leading-[2.0]" : "text-left"
            }`}
          >
            {translatedTitle || prophet.title}
          </p>

          <p className="font-arabic text-lg text-[var(--accent-text)] text-right" dir="rtl">
            {prophet.arabicTitle}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium text-[var(--accent-text)] bg-[var(--accent-soft)] border border-[var(--border)] ${
                contentLang === "ur" ? "font-urdu" : ""
              }`}
            >
              {eraLabels[prophet.era]}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {contentLang === "ur" ? "سلسلہ انبیاء کرام" : contentLang === "gu" ? "પયગંબર ક્રમ" : contentLang === "hi" ? "पैग़म्बर क्रम" : t("qisasProphetOf")}{" "}
              {prophet.number} / {allProphets.length || 24}
            </span>
          </div>

          {prophet.quranMentions.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[var(--text-secondary)] mr-1">
                {contentLang === "ur" ? "قرآن میں ذکر:" : contentLang === "gu" ? "કુરાનમાં ઉલ્લેખ:" : contentLang === "hi" ? "क़ुरआन में ज़िक्र:" : t("qisasQuranMentions")}
              </span>
              {visibleMentions.map((mention) => (
                <Badge
                  key={mention}
                  variant="outline"
                  className="border-[var(--accent)]/40 text-[var(--accent-text)] cursor-pointer hover:bg-[var(--accent-soft)] text-[11px]"
                  onClick={() => handleQuranRefClick(mention)}
                >
                  {mention}
                </Badge>
              ))}
              {extraMentions > 0 && (
                <Badge variant="outline" className="text-[11px] text-muted-foreground">
                  +{extraMentions} {t("more")}
                </Badge>
              )}
            </div>
          )}

          {(translatedTags.length ? translatedTags : prophet.tags).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(translatedTags.length ? translatedTags : prophet.tags).map((tag) => (
                <Badge key={tag} variant="outline" className={`text-[11px] ${actualLang === "ur" ? "font-urdu" : ""}`}>
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Full-Width Story Reading Body */}
        <article className="max-w-3xl mx-auto px-4 pt-5 pb-6">
          <ReaderStatusBanner
            targetLang={contentLang}
            actualLang={actualLang}
            fromCache={fromCache}
            offlineFallback={offlineFallback}
            isStreaming={isTranslating}
            doneChunks={doneChunks}
            totalChunks={totalChunks}
            onRetry={() => setRetryTick((n) => n + 1)}
          />

          <div>{renderContent(translatedStory || buildCleanStoryParagraphs(prophet.story).join("\n\n"))}</div>
        </article>

        {/* Scroll-To-Top FAB cleanly positioned ABOVE Next/Prev pagination + BottomNav */}
        {showBackToTop && (
          <div
            className="fixed right-4 z-50"
            style={{ bottom: "calc(148px + env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              size="icon"
              onClick={scrollToTop}
              aria-label="Scroll to top"
              className="rounded-full shadow-lg bg-[var(--accent)] text-[var(--on-accent)] hover:opacity-90 h-10 w-10"
            >
              <ArrowUp className="w-5 h-5" />
            </Button>
          </div>
        )}

        {/* Prophet Pagination Bar */}
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between border-t border-[var(--border)]">
          <Button
            variant="outline"
            onClick={goToPrevProphet}
            disabled={currentIndex <= 0}
            className="rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-1.5" />
            {t("previous")}
          </Button>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {currentIndex + 1} / {allProphets.length || 24}
          </span>
          <Button
            variant="outline"
            onClick={goToNextProphet}
            disabled={currentIndex === allProphets.length - 1}
            className="rounded-xl"
          >
            {t("next")}
            <ChevronRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
