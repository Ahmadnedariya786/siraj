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
import { ManuscriptDivider } from "@/components/ui/ManuscriptDivider";
import { goBackOrFallback } from "@/lib/navigation";
import { useLanguage } from "@/contexts/LanguageContext-new";
import {
  useContentLanguage,
  streamBookTranslation,
  getBookTranslationFromCacheSync,
  translateIslamicText,
  isPureArabicBlock,
  type ContentLang,
} from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import {
  AaReaderControlsButton,
  BookProseParagraph,
  ChapterOpenerOrnament,
  FormattedIslamicText,
  ReaderArabicBlock,
  ReaderContinueChip,
  ReaderHeading,
  ReaderStatusBanner,
  ReaderTagChips,
} from "@/components/BookReaderControls";
import {
  useBookReaderPrefs,
  formatIslamicProse,
  isInlineArabicHonorific,
  classifyProseParagraph,
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
  getScrollPosition,
  isBookmarked as checkBookmarked,
  setLastRead,
  setReadingProgress,
  setScrollPosition,
  toggleBookmark,
} from "@/lib/reading-storage";
import { useReaderSwipe } from "@/hooks/useReaderSwipe";

type EraKey = ProphetSummary["era"];

const ARABIC_RUN_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF][\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF\s]{14,}/;

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
 * while keeping inline Arabic honorifics intact inside their prose sentences (never producing "Allah ()" or "Lut ()").
 */
export function buildCleanStoryParagraphs(rawStory: string, lang: ContentLang = "en"): string[] {
  const formatted = formatIslamicProse(rawStory, lang);
  const rawParas = formatted
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p && !isStandAloneTranslit(p));

  const deduped: string[] = [];
  let lastArabicFingerprint = "";

  for (const para of rawParas) {
    const match = para.match(ARABIC_RUN_RE);
    if (match && !isInlineArabicHonorific(match[0])) {
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
        deduped.push(formatIslamicProse(nonArabicPart, lang));
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
  const [savedScrollY, setSavedScrollY] = useState(0);
  const [continueDismissed, setContinueDismissed] = useState(false);

  const { contentLang } = useContentLanguage();
  const { prefs } = useBookReaderPrefs();
  const [translatedName, setTranslatedName] = useState("");
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedStory, setTranslatedStory] = useState("");
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

      const cleanParas = buildCleanStoryParagraphs(storyObj.story, "en");
      const lockedTotal = cleanParas.length;

      if (lang === "en") {
        setTranslatedName(formatIslamicProse(storyObj.name, "en"));
        setTranslatedTitle(formatIslamicProse(storyObj.title, "en"));
        setTranslatedStory(cleanParas.join("\n\n"));
        setActualLang("en");
        setFromCache(false);
        setOfflineFallback(false);
        setIsTranslating(false);
        setDoneChunks(lockedTotal);
        setTotalChunks(lockedTotal);
        return;
      }

      if (curatedName) setTranslatedName(curatedName);
      if (curatedTitle) setTranslatedTitle(curatedTitle);

      // Synchronous memory cache fast-path (<1ms second open)
      const syncCached = getBookTranslationFromCacheSync(`prophet:${storyObj.id}:${lang}`);
      if (syncCached?.text) {
        setTranslatedStory(
          syncCached.paragraphs?.length ? syncCached.paragraphs.join("\n\n") : syncCached.text
        );
        if (!curatedName && syncCached.title) setTranslatedName(syncCached.title);
        setActualLang(lang);
        setFromCache(true);
        setOfflineFallback(false);
        setIsTranslating(false);
        setDoneChunks(lockedTotal);
        setTotalChunks(lockedTotal);
        return;
      }

      setTranslatedStory(cleanParas.join("\n\n"));
      setActualLang("en");
      setIsTranslating(true);
      setOfflineFallback(false);
      setDoneChunks(0);
      setTotalChunks(lockedTotal);

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
            setTranslatedName(formatIslamicProse(storyObj.name, "en"));
            setTranslatedTitle(formatIslamicProse(storyObj.title, "en"));
          }
        },
      }).catch((err) => {
        console.warn("Prophet streaming translation fallback:", err);
        if (!signal.aborted) {
          setTranslatedName(formatIslamicProse(storyObj.name, "en"));
          setTranslatedTitle(formatIslamicProse(storyObj.title, "en"));
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
      setSavedScrollY(getScrollPosition(prophetId, "qisas"));
      setContinueDismissed(false);
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

  useEffect(() => {
    if (!prophetId) return;
    const mainScrollEl = document.getElementById("main-content");
    const target: EventTarget = mainScrollEl || window;

    const handleScroll = () => {
      const scrollTop = mainScrollEl ? mainScrollEl.scrollTop : window.scrollY;
      const scrollHeight = mainScrollEl
        ? mainScrollEl.scrollHeight - mainScrollEl.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 100;

      setScrollProgress(Math.min(100, Math.max(0, progress)));
      setShowBackToTop(scrollTop > 300);

      if (scrollTop > 60) {
        setReadingProgress(prophetId, progress, "qisas");
        setScrollPosition(prophetId, scrollTop, "qisas");
        setContinueDismissed(true);
      }
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [prophetId, prophet]);

  const handleContinueScroll = () => {
    const mainScrollEl = document.getElementById("main-content");
    if (mainScrollEl) {
      mainScrollEl.scrollTo({ top: savedScrollY, behavior: "smooth" });
    } else {
      window.scrollTo({ top: savedScrollY, behavior: "smooth" });
    }
    setContinueDismissed(true);
  };

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

  const currentIndex = prophet ? allProphets.findIndex((item) => item.id === prophet.id) : -1;

  const goToPrevProphet = useCallback(() => {
    if (currentIndex > 0) {
      navigate(`/qisas/${allProphets[currentIndex - 1].id}`);
    }
  }, [currentIndex, allProphets, navigate]);

  const goToNextProphet = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < allProphets.length - 1) {
      navigate(`/qisas/${allProphets[currentIndex + 1].id}`);
    }
  }, [currentIndex, allProphets, navigate]);

  const swipeHandlers = useReaderSwipe({
    onPrev: goToPrevProphet,
    onNext: goToNextProphet,
    canPrev: currentIndex > 0,
    canNext: currentIndex >= 0 && currentIndex < allProphets.length - 1,
  });

  const handleQuranRefClick = (ref: string) => {
    const [surahPart] = ref.split(":");
    const surahNum = Number.parseInt(surahPart, 10);
    if (!Number.isNaN(surahNum)) {
      navigate(`/mushaf/surah/${surahNum}`);
    }
  };

  const renderContent = (content: string) => {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    return paragraphs.map((trimmed, index) => {
      const quranRefMatch = trimmed.match(/^\d+:\d+(?:-\d+)?$/);
      if (quranRefMatch) {
        return (
          <ReaderArabicBlock
            key={index}
            text={trimmed}
            arabicSize={prefs.arabicSize}
            onClick={() => handleQuranRefClick(trimmed)}
          />
        );
      }

      if (isPureArabicBlock(trimmed) && !isInlineArabicHonorific(trimmed)) {
        return (
          <ReaderArabicBlock
            key={index}
            text={trimmed}
            arabicSize={prefs.arabicSize}
          />
        );
      }

      const headingKind = classifyProseParagraph(trimmed, index);
      if (headingKind === "h2" || headingKind === "h3") {
        return (
          <div key={index}>
            {headingKind === "h2" && index > 0 && <ManuscriptDivider className="my-5" />}
            <ReaderHeading
              level={headingKind}
              text={trimmed}
              actualLang={actualLang}
              clampTwoLines={false}
            />
          </div>
        );
      }

      return (
        <BookProseParagraph
          key={index}
          text={trimmed}
          actualLang={actualLang}
          fontSize={prefs.bodySize}
          lineSpacing={prefs.lineHeightMode}
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

  const visibleMentions = prophet.quranMentions.slice(0, 3);
  const extraMentions = Math.max(0, prophet.quranMentions.length - visibleMentions.length);
  const headerName = formatIslamicProse(translatedName || prophet.name, actualLang);

  return (
    <PageTransition>
      <div className="min-h-screen bg-transparent relative z-10 pb-28" {...swipeHandlers}>
        <div className="fixed top-0 left-0 right-0 h-1 bg-transparent z-50 pointer-events-none">
          <div
            className="h-full bg-gradient-to-r from-[var(--accent)] to-[var(--accent-2)] transition-all duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>

        {/* 2-line Clamped Sticky Top Bar — actions strictly on one row */}
        <header
          className="sticky top-0 z-40 bg-[var(--surface)] border-b border-[var(--border)] safe-top"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="max-w-3xl mx-auto px-3 min-h-[56px] py-1.5 flex items-center justify-between gap-2">
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
                dir="auto"
                style={{ unicodeBidi: "plaintext", textAlign: actualLang === "ur" ? "right" : "left" }}
                className={`text-sm sm:text-base font-bold text-[var(--text-primary)] line-clamp-2 leading-snug ${
                  actualLang === "ur" ? "font-urdu" : ""
                }`}
              >
                <FormattedIslamicText text={headerName} />
              </h2>
            </div>

            <div className="flex items-center gap-1 shrink-0 flex-nowrap">
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

        {/* Scrollable Calligraphy Hero & Metadata */}
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-3 space-y-3 border-b border-[var(--border)]/60">
          <ContentLanguageBar fullWidth />

          <ChapterOpenerOrnament
            badgeText={`${eraLabels[prophet.era]} · ${
              contentLang === "ur" ? "سلسلہ انبیاء" : contentLang === "gu" ? "પયગંબર ક્રમ" : contentLang === "hi" ? "पैग़म्बर क्रम" : t("qisasProphetOf")
            } ${prophet.number} / ${allProphets.length || 24}`}
            arabicSubtitle={prophet.arabicName}
          />

          <div
            className="w-full h-12 rounded-xl border border-[var(--border)] flex items-center justify-center"
            style={{
              backgroundColor: "var(--surface-2)",
              backgroundImage: "radial-gradient(circle at 50% 50%, var(--accent-soft) 0%, transparent 72%)",
            }}
          >
            <span
              className="font-arabic leading-none"
              dir="rtl"
              style={{ color: "var(--accent-text)", fontSize: "20px" }}
            >
              {prophet.arabicName}
            </span>
          </div>

          <ReaderHeading
            level="h1"
            text={headerName}
            actualLang={actualLang}
            clampTwoLines
          />

          <p
            dir="auto"
            style={{ unicodeBidi: "plaintext", textAlign: actualLang === "ur" ? "right" : "left" }}
            className={`text-sm sm:text-base text-[var(--text-secondary)] ${
              actualLang === "ur" ? "font-urdu" : ""
            }`}
          >
            <FormattedIslamicText text={formatIslamicProse(translatedTitle || prophet.title, actualLang)} />
          </p>

          <p className="font-arabic text-base text-[var(--accent-text)] text-right" dir="rtl">
            {prophet.arabicTitle}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border era-chip-${prophet.era} ${
                contentLang === "ur" ? "font-urdu" : ""
              }`}
            >
              {eraLabels[prophet.era]}
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
                <Badge variant="outline" className="text-[11px] text-[var(--text-secondary)]">
                  +{extraMentions} {t("more")}
                </Badge>
              )}
            </div>
          )}

          {prophet.tags.length > 0 && (
            <ReaderTagChips tags={prophet.tags} contentLang={contentLang} />
          )}

          {!continueDismissed && savedScrollY > 120 && (
            <div>
              <ReaderContinueChip
                progressPct={scrollProgress}
                onContinue={handleContinueScroll}
              />
            </div>
          )}
        </div>

        {/* Continuous Story Reading Body (68ch measure cap on wide viewports, strict direction align, instant swap) */}
        <article
          key={`${prophet.id}-${contentLang}`}
          dir={actualLang === "ur" ? "rtl" : "ltr"}
          style={{ textAlign: actualLang === "ur" ? "right" : "left" }}
          className="reader-prose-measure px-4 pt-5 pb-6"
        >
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

          <div>{renderContent(translatedStory || buildCleanStoryParagraphs(prophet.story, "en").join("\n\n"))}</div>
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
