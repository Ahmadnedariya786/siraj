import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { PageTransition } from "@/components/PageTransition";
import { ManuscriptDivider } from "@/components/ui/ManuscriptDivider";
import { goBackOrFallback } from "@/lib/navigation";
import { useLanguage } from "@/contexts/LanguageContext-new";
import {
  useContentLanguage,
  streamBookTranslation,
  getBookTranslationFromCacheSync,
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
  classifyProseParagraph,
} from "@/lib/reader-typography";
import {
  loadSeerahChapter,
  loadSeerahChapterList,
  type SeerahChapter,
  type SeerahChapterSummary,
} from "@/lib/seerah";
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

type PeriodKey = SeerahChapterSummary["period"];

export default function SeerahReader() {
  const { chapterId } = useParams<{ chapterId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToast();
  const [chapter, setChapter] = useState<SeerahChapter | null>(null);
  const [allChapters, setAllChapters] = useState<SeerahChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [savedScrollY, setSavedScrollY] = useState(0);
  const [continueDismissed, setContinueDismissed] = useState(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);

  const { contentLang } = useContentLanguage();
  const { prefs } = useBookReaderPrefs();
  const [translatedTitle, setTranslatedTitle] = useState("");
  const [translatedContent, setTranslatedContent] = useState("");
  const [actualLang, setActualLang] = useState<ContentLang>("en");
  const [fromCache, setFromCache] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [doneChunks, setDoneChunks] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  const startTranslation = useCallback(
    (chap: SeerahChapter, lang: ContentLang, signal: { aborted: boolean }) => {
      const cleanParagraphs = formatIslamicProse(chap.content, "en")
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean);
      const lockedTotal = cleanParagraphs.length;

      if (lang === "en") {
        setTranslatedTitle(formatIslamicProse(chap.title, "en"));
        setTranslatedContent(cleanParagraphs.join("\n\n"));
        setActualLang("en");
        setFromCache(false);
        setOfflineFallback(false);
        setIsTranslating(false);
        setDoneChunks(lockedTotal);
        setTotalChunks(lockedTotal);
        return;
      }

      // Synchronous memory cache fast-path (<1ms on second open)
      const syncCached = getBookTranslationFromCacheSync(`seerah:${chap.id}:${lang}`);
      if (syncCached?.text) {
        setTranslatedTitle(syncCached.title || formatIslamicProse(chap.title, "en"));
        setTranslatedContent(
          syncCached.paragraphs?.length ? syncCached.paragraphs.join("\n\n") : syncCached.text
        );
        setActualLang(lang);
        setFromCache(true);
        setOfflineFallback(false);
        setIsTranslating(false);
        setDoneChunks(lockedTotal);
        setTotalChunks(lockedTotal);
        return;
      }

      setTranslatedTitle(formatIslamicProse(chap.title, "en"));
      setTranslatedContent(cleanParagraphs.join("\n\n"));
      setActualLang("en");
      setIsTranslating(true);
      setOfflineFallback(false);
      setDoneChunks(0);
      setTotalChunks(lockedTotal);

      streamBookTranslation({
        module: "seerah",
        itemId: chap.id,
        title: chap.title,
        englishParagraphs: cleanParagraphs,
        targetLang: lang,
        signal,
        onUpdate: (upd) => {
          if (signal.aborted) return;
          if (upd.title) setTranslatedTitle(upd.title);
          setTranslatedContent(upd.text);
          setActualLang(upd.actualLang);
          setFromCache(upd.fromCache);
          setOfflineFallback(upd.offlineFallback);
          setDoneChunks(upd.doneChunks);
          setTotalChunks(upd.totalChunks);
          setIsTranslating(!upd.isComplete);
        },
      }).catch((err) => {
        console.warn("Seerah streaming translation fallback:", err);
        if (!signal.aborted) {
          setTranslatedTitle(formatIslamicProse(chap.title, "en"));
          setTranslatedContent(cleanParagraphs.join("\n\n"));
          setActualLang("en");
          setOfflineFallback(true);
          setIsTranslating(false);
        }
      });
    },
    []
  );

  useEffect(() => {
    if (!chapter) return;
    const signal = { aborted: false };
    startTranslation(chapter, contentLang, signal);
    return () => {
      signal.aborted = true;
    };
  }, [chapter, contentLang, retryTick, startTranslation]);

  const periodLabels: Record<PeriodKey, string> = useMemo(() => {
    if (contentLang === "ur") {
      return {
        "pre-prophethood": "قبل از نبوت",
        makkan: "مکی دور",
        madinan: "مدنی دور",
        "final-days": "آخری ایام",
      };
    }
    if (contentLang === "gu") {
      return {
        "pre-prophethood": "નબુવ્વત પહેલાં",
        makkan: "મક્કી દોર",
        madinan: "મદની દોર",
        "final-days": "આખરી દિવસો",
      };
    }
    if (contentLang === "hi") {
      return {
        "pre-prophethood": "नुबुव्वत से पहले",
        makkan: "मक्की दौर",
        madinan: "मदनी दौर",
        "final-days": "अंतिम दिन",
      };
    }
    return {
      "pre-prophethood": t("seerahPeriodPreProphethood"),
      makkan: t("seerahPeriodMakkan"),
      madinan: t("seerahPeriodMadinan"),
      "final-days": t("seerahPeriodFinalDays"),
    };
  }, [contentLang, t]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (!chapterId) return;
      if (!chapter) setLoading(true);
      try {
        const [chapterData, chapterList] = await Promise.all([
          loadSeerahChapter(chapterId),
          loadSeerahChapterList(),
        ]);
        if (!active) return;
        setChapter(chapterData);
        setAllChapters(chapterList);
        setLastRead(chapterId, "seerah");
        setIsBookmarked(checkBookmarked(chapterId, "seerah"));
        setScrollProgress(getReadingProgress(chapterId, "seerah"));
        setSavedScrollY(getScrollPosition(chapterId, "seerah"));
        setContinueDismissed(false);
      } catch (error) {
        console.error("Failed to load chapter:", error);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadData();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId]);

  // Unified document scroll tracking (#main-content inside LayoutManager or window fallback)
  useEffect(() => {
    if (!chapterId) return;
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
        setReadingProgress(chapterId, progress, "seerah");
        setScrollPosition(chapterId, scrollTop, "seerah");
        setContinueDismissed(true);
      }
    };

    target.addEventListener("scroll", handleScroll, { passive: true });
    return () => target.removeEventListener("scroll", handleScroll);
  }, [chapterId, chapter]);

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
    const title = translatedTitle || chapter?.title || "";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied to clipboard" });
      }
    } catch {
      toast({ title: "Could not share chapter link" });
    }
  };

  const handleBookmarkToggle = () => {
    if (!chapterId) return;
    const bookmarked = toggleBookmark(chapterId, "seerah");
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

  const currentIndex = chapter ? allChapters.findIndex((item) => item.id === chapter.id) : -1;

  const goToPrevChapter = useCallback(() => {
    if (currentIndex > 0) {
      navigate(`/seerah/${allChapters[currentIndex - 1].id}`);
    }
  }, [currentIndex, allChapters, navigate]);

  const goToNextChapter = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < allChapters.length - 1) {
      navigate(`/seerah/${allChapters[currentIndex + 1].id}`);
    }
  }, [currentIndex, allChapters, navigate]);

  const swipeHandlers = useReaderSwipe({
    onPrev: goToPrevChapter,
    onNext: goToNextChapter,
    canPrev: currentIndex > 0,
    canNext: currentIndex >= 0 && currentIndex < allChapters.length - 1,
  });

  const renderContent = (content: string) => {
    const paragraphs = content
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    return paragraphs.map((paragraph, index) => {
      const quranRefMatch = paragraph.match(/^\d+:\d+(?:-\d+)?$/);
      if (quranRefMatch || isPureArabicBlock(paragraph)) {
        return (
          <ReaderArabicBlock
            key={index}
            text={paragraph}
            arabicSize={prefs.arabicSize}
          />
        );
      }

      const headingKind = classifyProseParagraph(paragraph, index);
      if (headingKind === "h2" || headingKind === "h3") {
        return (
          <div key={index}>
            {headingKind === "h2" && index > 0 && <ManuscriptDivider className="my-5" />}
            <ReaderHeading
              level={headingKind}
              text={paragraph}
              actualLang={actualLang}
              clampTwoLines={false}
            />
          </div>
        );
      }

      return (
        <BookProseParagraph
          key={index}
          text={paragraph}
          actualLang={actualLang}
          fontSize={prefs.bodySize}
          lineSpacing={prefs.lineHeightMode}
          className="text-[var(--text-primary)]"
        />
      );
    });
  };

  if (loading && !chapter) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="text-muted-foreground">{t("notFound")}</div>
      </div>
    );
  }

  const displayTitle = formatIslamicProse(translatedTitle || chapter.title, actualLang);

  return (
    <PageTransition>
      <div
        ref={pageContainerRef}
        className="min-h-screen bg-transparent relative z-10 pb-28"
        {...swipeHandlers}
      >
        {/* Reading Progress Bar */}
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
              onClick={() => goBackOrFallback(navigate, "/seerah")}
              className="rounded-xl h-8 w-8 shrink-0"
              aria-label="Back to Seerah"
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
                <FormattedIslamicText text={displayTitle} />
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

        {/* Scrollable Chapter Intro */}
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-3 space-y-3 border-b border-[var(--border)]/60">
          <ContentLanguageBar fullWidth />

          <ChapterOpenerOrnament
            badgeText={`${periodLabels[chapter.period]} · ${
              contentLang === "ur" ? "باب" : contentLang === "gu" ? "પ્રકરણ" : contentLang === "hi" ? "अध्याय" : t("chapter")
            } ${chapter.number} / ${allChapters.length}`}
            arabicSubtitle={chapter.arabicTitle}
          />

          <ReaderHeading
            level="h1"
            text={displayTitle}
            actualLang={actualLang}
            clampTwoLines
          />

          {chapter.tags.length > 0 && (
            <ReaderTagChips tags={chapter.tags} contentLang={contentLang} />
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

        {/* Continuous Book Reading Body (68ch measure cap on wide viewports, strict direction align, instant swap) */}
        <article
          key={`${chapter.id}-${contentLang}`}
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

          <div>{renderContent(translatedContent || formatIslamicProse(chapter.content, "en"))}</div>
        </article>

        {/* Scroll-To-Top FAB positioned ABOVE Next/Prev pagination + BottomNav */}
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

        {/* Chapter Pagination Bar */}
        <div className="max-w-3xl mx-auto px-4 py-5 flex items-center justify-between border-t border-[var(--border)]">
          <Button
            variant="outline"
            onClick={goToPrevChapter}
            disabled={currentIndex <= 0}
            className="rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-1.5" />
            {t("previous")}
          </Button>
          <span className="text-xs font-mono text-[var(--text-secondary)]">
            {currentIndex + 1} / {allChapters.length}
          </span>
          <Button
            variant="outline"
            onClick={goToNextChapter}
            disabled={currentIndex === allChapters.length - 1}
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
