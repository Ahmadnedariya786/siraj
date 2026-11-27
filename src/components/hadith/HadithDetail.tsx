import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, BookOpen, Share2, ChevronLeft, ChevronRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getHadithBookData } from "@/lib/hadith";
import type { EnhancedHadith } from "@/data/hadith-collections";
import { getCollectionByName } from "@/data/hadith-collections";
import {
  getGradeBadgeClass,
  formatCollectionHadithCount,
  formatCompilerLifespan,
  parseHadithBodyAndFootnotes,
  sanitizeHadithBookTitle,
} from "@/lib/hadith-utils";
import { useHadithBookmarks } from "@/hooks/useHadithBookmarks";
import { ManuscriptDivider } from "@/components/ui/ManuscriptDivider";
import {
  useContentLanguage,
  translateHadithContent,
  translateIslamicText,
  type ContentLang,
} from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import {
  AaReaderControlsButton,
  BookProseParagraph,
  ChapterOpenerOrnament,
  CopyHadithMenuButton,
  HadithFootnotesBlock,
  MixedBidiTitle,
  ReaderArabicBlock,
  ReaderContinueChip,
  ReaderHeading,
  ReaderStatusBanner,
  ReaderTagChips,
} from "@/components/BookReaderControls";
import {
  useBookReaderPrefs,
  formatIslamicProse,
} from "@/lib/reader-typography";
import { getScrollPosition, setLastRead, setScrollPosition } from "@/lib/reading-storage";
import { useReaderSwipe } from "@/hooks/useReaderSwipe";

export function HadithDetail() {
  const { collection, book, hadithNumber } = useParams<{ collection: string; book: string; hadithNumber: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [hadith, setHadith] = useState<EnhancedHadith | null>(location.state?.hadith ?? null);
  const [allHadith, setAllHadith] = useState<EnhancedHadith[]>([]);
  const [loading, setLoading] = useState(!hadith);
  const [copied, setCopied] = useState(false);
  const { isBookmarked, toggleBookmark } = useHadithBookmarks();

  const { contentLang } = useContentLanguage();
  const { prefs } = useBookReaderPrefs();
  const [translatedText, setTranslatedText] = useState(() =>
    formatIslamicProse(hadith?.englishTranslation || '', 'en')
  );
  const [translatedNarrator, setTranslatedNarrator] = useState(hadith?.narrator || '');
  const [actualLang, setActualLang] = useState<ContentLang>('en');
  const [fromCache, setFromCache] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [source, setSource] = useState<'scholar-edition' | 'chunked-api' | 'original'>('original');
  const [retryTick, setRetryTick] = useState(0);

  const hadithKey = collection && book && hadithNumber ? `${collection}:${book}:${hadithNumber}` : '';
  const [savedScrollY, setSavedScrollY] = useState<number>(() =>
    hadithKey ? getScrollPosition(hadithKey, "hadith") : 0
  );
  const [continueDismissed, setContinueDismissed] = useState(false);

  const runTranslation = useCallback(async (mountedCheck: () => boolean) => {
    if (!hadith) return;
    const parsedEn = parseHadithBodyAndFootnotes({
      englishTranslation: hadith.englishTranslation,
      grade: hadith.grade,
      references: hadith.references,
    });
    const cleanEn = formatIslamicProse(parsedEn.paragraphs.join('\n\n'), 'en');
    if (contentLang === 'en') {
      if (mountedCheck()) {
        setTranslatedText(cleanEn);
        setTranslatedNarrator(hadith.narrator || '');
        setActualLang('en');
        setFromCache(false);
        setOfflineFallback(false);
        setSource('original');
      }
      return;
    }

    // Instant reset to avoid cross-hadith / cross-language ghosting
    if (mountedCheck()) {
      setTranslatedText(cleanEn);
      setTranslatedNarrator(hadith.narrator || '');
      setActualLang('en');
    }

    const [res, tNarr] = await Promise.all([
      cleanEn
        ? translateHadithContent({
            collection: hadith.collection || collection || 'generic',
            hadithNumber: hadith.hadithNumber || hadith.id,
            englishText: cleanEn,
            targetLang: contentLang,
          })
        : Promise.resolve({
            text: '',
            actualLang: 'en' as ContentLang,
            fromCache: false,
            offlineFallback: false,
            source: 'original' as const,
          }),
      hadith.narrator ? translateIslamicText(hadith.narrator, contentLang) : Promise.resolve(''),
    ]);

    if (mountedCheck()) {
      setTranslatedText(res.text);
      setTranslatedNarrator(res.offlineFallback ? (hadith.narrator || '') : tNarr);
      setActualLang(res.actualLang);
      setFromCache(res.fromCache);
      setOfflineFallback(res.offlineFallback);
      setSource(res.source);
    }
  }, [hadith, collection, contentLang]);

  useEffect(() => {
    let isMounted = true;
    runTranslation(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [runTranslation, retryTick]);

  useEffect(() => {
    let active = true;
    async function loadHadith() {
      if (!collection || !book || !hadithNumber) return;
      if (allHadith.length > 0) {
        const inMemory = allHadith.find(
          (h) => String(h.hadithNumber) === hadithNumber || String(h.id) === hadithNumber
        );
        if (inMemory) {
          setHadith(inMemory);
          setLoading(false);
          return;
        }
      }
      setLoading(true);
      try {
        const data = await getHadithBookData(collection, book);
        if (active && Array.isArray(data)) {
          setAllHadith(data);
          const found = data.find(
            (h) => String(h.hadithNumber) === hadithNumber || String(h.id) === hadithNumber
          );
          if (found) setHadith(found);
        }
      } catch (err) {
        console.warn("Failed to load hadith detail:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHadith();
    if (hadithKey) {
      setLastRead(hadithKey, "hadith");
      setSavedScrollY(getScrollPosition(hadithKey, "hadith"));
      setContinueDismissed(false);
    }
    return () => {
      active = false;
    };
  }, [collection, book, hadithNumber, hadithKey]);

  useEffect(() => {
    if (!hadithKey) return;
    const mainScrollEl = document.getElementById("main-content");
    const target: EventTarget = mainScrollEl || window;
    const onScroll = () => {
      const y = mainScrollEl ? mainScrollEl.scrollTop : window.scrollY;
      if (y > 60) {
        setScrollPosition(hadithKey, y, "hadith");
        setContinueDismissed(true);
      }
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [hadithKey]);

  const handleContinueScroll = () => {
    const mainScrollEl = document.getElementById("main-content");
    if (mainScrollEl) {
      mainScrollEl.scrollTo({ top: savedScrollY, behavior: "smooth" });
    } else {
      window.scrollTo({ top: savedScrollY, behavior: "smooth" });
    }
    setContinueDismissed(true);
  };

  const currentIndex = allHadith.findIndex(
    (h) => String(h.hadithNumber) === hadithNumber
  );

  const prevHadith = currentIndex > 0 ? allHadith[currentIndex - 1] : null;
  const nextHadith = currentIndex >= 0 && currentIndex < allHadith.length - 1 ? allHadith[currentIndex + 1] : null;

  const navigateToHadith = useCallback((h: EnhancedHadith) => {
    navigate(`/hadith/collections/${collection}/${book}/${h.hadithNumber}`, { replace: true });
    setHadith(h);
    const mainScrollEl = document.getElementById("main-content");
    if (mainScrollEl) {
      mainScrollEl.scrollTop = 0;
    } else {
      window.scrollTo(0, 0);
    }
  }, [navigate, collection, book]);

  const swipeHandlers = useReaderSwipe({
    onPrev: () => prevHadith && navigateToHadith(prevHadith),
    onNext: () => nextHadith && navigateToHadith(nextHadith),
    canPrev: Boolean(prevHadith),
    canNext: Boolean(nextHadith),
  });

  const handleCopyMode = async (mode: 'arabic' | 'translation' | 'both') => {
    if (!hadith) return;
    const body = translatedText || formatIslamicProse(hadith.englishTranslation || "", 'en');
    const ref = `${hadith.collection ?? collection} (${hadith.hadithNumber})`;
    const text =
      mode === 'arabic'
        ? `${hadith.arabic}\n\n— ${ref}`
        : mode === 'translation'
        ? `${body}\n\n— ${ref}`
        : `${hadith.arabic}\n\n${body}\n\n— ${ref}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: `Copied ${mode === 'both' ? 'Arabic & translation' : mode}` });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    if (!hadith) return;
    const body = translatedText || formatIslamicProse(hadith.englishTranslation || "", 'en');
    const text = `${hadith.arabic}\n\n${body}\n\n— ${hadith.collection ?? collection} (${hadith.hadithNumber})`;
    try {
      await navigator.share({ title: "Hadith", text });
    } catch {
      handleCopyMode('both');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent relative z-10">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4 animate-pulse">
          <div className="h-8 w-40 bg-[var(--surface-2)] rounded-lg" />
          <div className="h-44 bg-[var(--surface-2)] rounded-xl" />
          <div className="h-32 bg-[var(--surface-2)] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!hadith) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Hadith Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested hadith could not be found.</p>
          <Button onClick={() => navigate(`/hadith/collections/${collection}/${book}`)}>Back to Book</Button>
        </div>
      </div>
    );
  }

  const tags = Array.isArray(hadith.tags) ? hadith.tags : [];
  const bookmarked = isBookmarked(collection!, hadith.hadithNumber);
  const baseParsed = parseHadithBodyAndFootnotes({
    englishTranslation: hadith.englishTranslation,
    grade: hadith.grade,
    references: hadith.references,
  });
  const cleanGrade = baseParsed.cleanGrade;
  const collectionMeta = getCollectionByName(hadith.collection ?? collection ?? '');
  const cleanBookTitle = sanitizeHadithBookTitle(hadith.bookNumber ?? book, hadith.bookName, 0);
  const hasArabic = Boolean(hadith.arabic && hadith.arabic.trim());
  const activeTranslationBody =
    translatedText || formatIslamicProse(baseParsed.paragraphs.join('\n\n'), 'en');
  const displayParagraphs = activeTranslationBody
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const lifespanText = collectionMeta
    ? formatCompilerLifespan(collectionMeta.compilerPeriod, collectionMeta.death)
    : '';

  return (
    <div
      className="min-h-screen bg-transparent relative z-10 safe-top"
      {...swipeHandlers}
    >
      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* 2-line clamped header; actions stay strictly on one row */}
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/hadith/collections/${collection}/${book}`)}
              className="rounded-xl shrink-0 mt-0.5"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1
                dir="auto"
                style={{ unicodeBidi: 'plaintext', fontSize: '22px' }}
                className="font-bold text-[var(--text-primary)] line-clamp-2 leading-tight"
              >
                Hadith #{hadith.hadithNumber}
              </h1>
              <p
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
                className="text-xs text-[var(--text-secondary)] line-clamp-2 leading-snug mt-0.5"
              >
                <MixedBidiTitle
                  latin={`${collectionMeta?.title ?? hadith.collection ?? collection} — ${cleanBookTitle}`}
                />
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0 flex-nowrap">
            <AaReaderControlsButton />
            <Button
              variant="ghost"
              size="icon"
              title={bookmarked ? "Remove bookmark" : "Bookmark this hadith"}
              onClick={() => toggleBookmark({
                collection: collection!,
                bookNumber: book!,
                hadithNumber: hadith.hadithNumber,
                arabic: hadith.arabic,
                englishTranslation: hadith.englishTranslation,
                bookName: hadith.bookName,
              })}
              className="rounded-xl h-8 w-8"
            >
              <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary text-primary" : "text-[var(--text-secondary)]"}`} />
            </Button>
            <CopyHadithMenuButton
              compact
              copied={copied}
              onCopyMode={handleCopyMode}
            />
            <Button variant="ghost" size="icon" title="Share hadith" onClick={handleShare} className="rounded-xl h-8 w-8">
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Previous / Next Navigation */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevHadith}
            onClick={() => prevHadith && navigateToHadith(prevHadith)}
            className="flex-1 rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextHadith}
            onClick={() => nextHadith && navigateToHadith(nextHadith)}
            className="flex-1 rounded-xl"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>

        <ChapterOpenerOrnament
          badgeText={`${collectionMeta?.title ?? collection} · #${hadith.hadithNumber}`}
          arabicSubtitle={collectionMeta?.arabicTitle}
        />

        {!continueDismissed && savedScrollY > 120 && (
          <ReaderContinueChip onContinue={handleContinueScroll} />
        )}

        <Card key={`${collection}-${book}-${hadith.hadithNumber}-${contentLang}`} className="border-[var(--border)] bg-[var(--surface)]">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">#{hadith.hadithNumber}</Badge>
              {cleanGrade && (
                <Badge variant="outline" className={`${getGradeBadgeClass(cleanGrade)} max-w-full whitespace-normal text-left leading-snug`}>
                  {cleanGrade}
                </Badge>
              )}
              {bookmarked && (
                <Badge variant="outline" className="ml-auto text-xs bg-[var(--accent-soft)] text-[var(--accent-text)] border-[var(--border)]">
                  Bookmarked
                </Badge>
              )}
            </div>

            {hasArabic && (
              <>
                <ReaderArabicBlock text={hadith.arabic} arabicSize={prefs.arabicSize} />
                <ManuscriptDivider />
              </>
            )}

            <div
              className="space-y-3 reader-prose-measure"
              dir={actualLang === 'ur' ? 'rtl' : 'ltr'}
              style={{ textAlign: actualLang === 'ur' ? 'right' : 'left' }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <ReaderHeading
                  level="h3"
                  text={actualLang === 'ur' ? 'ترجمہ' : actualLang === 'gu' ? 'અનુવાદ' : actualLang === 'hi' ? 'अनुवाद' : 'Translation'}
                  actualLang={actualLang}
                  clampTwoLines={false}
                />
                <ContentLanguageBar compact />
              </div>

              <ReaderStatusBanner
                targetLang={contentLang}
                actualLang={actualLang}
                fromCache={fromCache}
                source={source}
                offlineFallback={offlineFallback}
                isStreaming={false}
                onRetry={() => setRetryTick((n) => n + 1)}
              />

              {displayParagraphs.map((para, pIdx) => (
                <BookProseParagraph
                  key={pIdx}
                  text={para}
                  actualLang={actualLang}
                  fontSize={prefs.bodySize}
                  lineSpacing={prefs.lineHeightMode}
                  className="text-[var(--text-primary)]"
                />
              ))}

              <HadithFootnotesBlock footnotes={baseParsed.footnotes} />
            </div>

            {hadith.narrator && (
              <p
                className={`text-sm font-semibold text-[var(--accent-text)] ${
                  actualLang === 'ur' ? 'font-urdu text-right' : 'text-left'
                }`}
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
              >
                {actualLang === 'en'
                  ? `Narrated by: ${hadith.narrator}`
                  : (actualLang === 'ur'
                    ? `راوی: ${translatedNarrator || hadith.narrator}`
                    : (actualLang === 'gu'
                      ? `રાવી: ${translatedNarrator || hadith.narrator}`
                      : `रावी: ${translatedNarrator || hadith.narrator}`))}
              </p>
            )}

            {tags.length > 0 && (
              <ReaderTagChips tags={tags} contentLang={contentLang} />
            )}

            <div className="pt-4 border-t border-[var(--border)] grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-[var(--text-secondary)]">
              <div>
                <span className="font-medium text-[var(--text-primary)]">Collection:</span>{' '}
                {collectionMeta?.title ?? hadith.collection ?? collection}
              </div>
              {collectionMeta && (
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Count:</span>{' '}
                  {formatCollectionHadithCount(collectionMeta.totalHadith, collectionMeta.totalNarrations)}
                </div>
              )}
              {lifespanText && (
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Compiler:</span>{' '}
                  {lifespanText}
                </div>
              )}
              {hadith.chapterName && <div><span className="font-medium text-[var(--text-primary)]">Chapter:</span> {hadith.chapterName}</div>}
              {cleanBookTitle && <div><span className="font-medium text-[var(--text-primary)]">Book:</span> <MixedBidiTitle latin={cleanBookTitle} /></div>}
              <div><span className="font-medium text-[var(--text-primary)]">Hadith Number:</span> {hadith.hadithNumber}</div>
            </div>
          </CardContent>
        </Card>

        {/* Bottom Previous / Next Navigation */}
        <div className="flex gap-2 pb-8">
          <Button
            variant="outline"
            size="sm"
            disabled={!prevHadith}
            onClick={() => prevHadith && navigateToHadith(prevHadith)}
            className="flex-1 rounded-xl"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!nextHadith}
            onClick={() => nextHadith && navigateToHadith(nextHadith)}
            className="flex-1 rounded-xl"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
