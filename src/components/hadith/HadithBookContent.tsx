import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, BookOpen, ChevronRight, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getCollectionByName, HadithBook, HadithCollection, EnhancedHadith } from "@/data/hadith-collections";
import { getHadithBookData, getHadithCollectionMetadata } from "@/lib/hadith";
import {
  getGradeBadgeClass,
  parseHadithBodyAndFootnotes,
  sanitizeHadithBookNumber,
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
  CopyHadithMenuButton,
  HadithFootnotesBlock,
  MixedBidiTitle,
  ReaderArabicBlock,
  ReaderContinueChip,
  ReaderStatusBanner,
} from "@/components/BookReaderControls";
import {
  useBookReaderPrefs,
  formatIslamicProse,
} from "@/lib/reader-typography";
import { getScrollPosition, setScrollPosition } from "@/lib/reading-storage";

const SHOW_ALL_PAGE_SIZE = 300;

interface HadithCardProps {
  hadith: EnhancedHadith;
  index: number;
  collection: string;
  book: string;
  bookmarked: boolean;
  navigate: ReturnType<typeof useNavigate>;
  toast: ReturnType<typeof useToast>["toast"];
  toggleBookmark: (item: { collection: string; bookNumber: string; hadithNumber: string; arabic: string; englishTranslation?: string; bookName?: string }) => void;
}

const HadithCard = memo(function HadithCard({ hadith, collection, book, bookmarked, navigate, toast, toggleBookmark }: HadithCardProps) {
  const { contentLang } = useContentLanguage();
  const { prefs } = useBookReaderPrefs();
  const baseParsed = useMemo(
    () =>
      parseHadithBodyAndFootnotes({
        englishTranslation: hadith.englishTranslation,
        grade: hadith.grade,
        references: hadith.references,
      }),
    [hadith.englishTranslation, hadith.grade, hadith.references]
  );
  const baseEnglishText = useMemo(
    () => formatIslamicProse(baseParsed.paragraphs.join('\n\n'), 'en'),
    [baseParsed.paragraphs]
  );
  const [translatedText, setTranslatedText] = useState(baseEnglishText);
  const [translatedNarrator, setTranslatedNarrator] = useState(hadith.narrator || '');
  const [actualLang, setActualLang] = useState<ContentLang>('en');
  const [fromCache, setFromCache] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [source, setSource] = useState<'scholar-edition' | 'chunked-api' | 'original'>('original');
  const [retryTick, setRetryTick] = useState(0);

  const runTranslation = useCallback(async (mountedCheck: () => boolean) => {
    const cleanEn = baseEnglishText;
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

    // Instant reset to avoid cross-language ghosting while translation resolves
    if (mountedCheck()) {
      setTranslatedText(cleanEn);
      setTranslatedNarrator(hadith.narrator || '');
      setActualLang('en');
    }

    const [res, tNarr] = await Promise.all([
      cleanEn
        ? translateHadithContent({
            collection,
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
  }, [baseEnglishText, hadith.narrator, hadith.hadithNumber, hadith.id, collection, contentLang]);

  useEffect(() => {
    let isMounted = true;
    runTranslation(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [runTranslation, retryTick]);

  const cleanGrade = baseParsed.cleanGrade;
  const hasArabic = Boolean(hadith.arabic && hadith.arabic.trim());
  const displayParagraphs = useMemo(() => {
    const active = translatedText || baseEnglishText;
    if (!active) return [];
    return active.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  }, [translatedText, baseEnglishText]);

  return (
    <Card
      key={`${hadith.id}-${contentLang}`}
      className="group cursor-pointer border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/40"
      onClick={() => navigate(`/hadith/collections/${collection}/${book}/${hadith.hadithNumber}`)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Badge variant="outline" className="text-xs shrink-0">
                #{hadith.hadithNumber}
              </Badge>
              {cleanGrade && (
                <Badge variant="outline" className={`text-xs ${getGradeBadgeClass(cleanGrade)} max-w-full whitespace-normal text-left leading-snug`}>
                  {cleanGrade}
                </Badge>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 ml-auto rounded-lg hover:bg-primary/10 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark({
                    collection,
                    bookNumber: book,
                    hadithNumber: hadith.hadithNumber,
                    arabic: hadith.arabic,
                    englishTranslation: baseEnglishText || hadith.englishTranslation,
                    bookName: hadith.bookName,
                  });
                }}
              >
                <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </Button>
            </div>

            {/* Arabic Text — guarded against empty strings, 12px padding on surface-2, right-aligned */}
            {hasArabic && (
              <>
                <ReaderArabicBlock text={hadith.arabic} arabicSize={prefs.arabicSize} className="mb-3" />
                <ManuscriptDivider />
              </>
            )}

            <div className={hasArabic ? "mt-2.5" : ""} onClick={(e) => e.stopPropagation()}>
              <ReaderStatusBanner
                targetLang={contentLang}
                actualLang={actualLang}
                fromCache={fromCache}
                source={source}
                offlineFallback={offlineFallback}
                isStreaming={false}
                onRetry={() => setRetryTick((n) => n + 1)}
              />
            </div>

            {/* Translation Body & Footnotes */}
            {displayParagraphs.length > 0 && (
              <div
                className="reader-prose-measure"
                dir={actualLang === 'ur' ? 'rtl' : 'ltr'}
                style={{ textAlign: actualLang === 'ur' ? 'right' : 'left' }}
              >
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
            )}

            {/* Narrator */}
            {(translatedNarrator || hadith.narrator) && (
              <p
                dir="auto"
                style={{
                  unicodeBidi: 'plaintext',
                  textAlign: actualLang === 'ur' ? 'right' : 'left',
                }}
                className={`text-sm font-semibold text-[var(--accent-text)] mt-2 ${
                  actualLang === 'ur' ? 'font-urdu' : ''
                }`}
              >
                {actualLang === 'ur' ? 'راوی:' : actualLang === 'gu' ? 'વર્ણનકર્તા:' : actualLang === 'hi' ? 'वर्णनकर्ता:' : 'Narrated by:'}{' '}
                {translatedNarrator || hadith.narrator}
              </p>
            )}

            {/* Copy (Arabic / Translation / Both) */}
            <div className="flex items-center gap-2 mt-2.5">
              <CopyHadithMenuButton
                onCopyMode={(mode) => {
                  const body = translatedText || baseEnglishText;
                  const ref = `${collection} (${hadith.hadithNumber})`;
                  const payload =
                    mode === 'arabic'
                      ? `${hadith.arabic}\n\n— ${ref}`
                      : mode === 'translation'
                      ? `${body}\n\n— ${ref}`
                      : `${hadith.arabic ? `${hadith.arabic}\n\n` : ''}${body}\n\n— ${ref}`;
                  navigator.clipboard.writeText(payload).then(() => {
                    toast({ title: `Copied ${mode === 'both' ? 'Arabic & translation' : mode}` });
                  });
                }}
              />
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary mt-1 shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
});

function normalizeBookNumber(bookNumber: string): string {
  const parsed = Number.parseInt(bookNumber, 10);
  return Number.isNaN(parsed) ? bookNumber : String(parsed);
}

export function HadithBookContent() {
  const { collection, book } = useParams<{ collection: string; book: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contentLang, isRtl } = useContentLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [hadithData, setHadithData] = useState<EnhancedHadith[]>([]);
  const [remoteCollectionData, setRemoteCollectionData] = useState<HadithCollection | null>(null);
  const [translatedBookName, setTranslatedBookName] = useState("");
  const [translatedBookDesc, setTranslatedBookDesc] = useState("");

  const staticCollectionData = useMemo(() => {
    return collection ? getCollectionByName(collection) : null;
  }, [collection]);

  const collectionData = remoteCollectionData ?? staticCollectionData;

  useEffect(() => {
    let isMounted = true;

    async function loadCollectionMetadata() {
      if (!collection) {
        setRemoteCollectionData(null);
        return;
      }

      try {
        const metadata = await getHadithCollectionMetadata(collection);
        if (isMounted) {
          setRemoteCollectionData(metadata);
        }
      } catch (error) {
        console.warn('Failed to load metadata for %s:', collection, error);
        if (isMounted) {
          setRemoteCollectionData(null);
        }
      }
    }

    loadCollectionMetadata();

    return () => {
      isMounted = false;
    };
  }, [collection]);

  useEffect(() => {
    let isMounted = true;

    async function loadBookHadith() {
      if (!collection || !book) {
        setHadithData([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await getHadithBookData(collection, book);
        if (isMounted) {
          setHadithData(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.warn('Failed to load hadith for %s/%s:', collection, book, error);
        if (isMounted) {
          setHadithData([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadBookHadith();

    return () => {
      isMounted = false;
    };
  }, [collection, book]);

  const bookInfo = useMemo<HadithBook | null>(() => {
    if (!book) {
      return null;
    }

    const normalizedBook = normalizeBookNumber(sanitizeHadithBookNumber(book, 0));
    const fromMetadata = collectionData?.books.find(
      (entry, idx) => normalizeBookNumber(sanitizeHadithBookNumber(entry.number, idx)) === normalizedBook
    );
    if (fromMetadata) {
      return {
        ...fromMetadata,
        number: sanitizeHadithBookNumber(fromMetadata.number, 0),
        name: sanitizeHadithBookTitle(fromMetadata.number, fromMetadata.name, 0),
      };
    }

    const firstHadith = hadithData[0];
    if (!firstHadith) {
      return null;
    }

    return {
      number: sanitizeHadithBookNumber(firstHadith.bookNumber ?? book, 0),
      name: sanitizeHadithBookTitle(firstHadith.bookNumber ?? book, firstHadith.bookName, 0),
      arabicName: "",
      hadithCount: hadithData.length,
      description: undefined,
    };
  }, [book, collectionData, hadithData]);

  useEffect(() => {
    if (!bookInfo) return;
    if (contentLang === 'en') {
      setTranslatedBookName(bookInfo.name);
      setTranslatedBookDesc(bookInfo.description || "");
      return;
    }
    let isMounted = true;
    Promise.all([
      bookInfo.name ? translateIslamicText(bookInfo.name, contentLang) : Promise.resolve(""),
      bookInfo.description ? translateIslamicText(bookInfo.description, contentLang) : Promise.resolve(""),
    ]).then(([tName, tDesc]) => {
      if (isMounted) {
        setTranslatedBookName(tName);
        setTranslatedBookDesc(tDesc);
      }
    });
    return () => { isMounted = false; };
  }, [bookInfo, contentLang]);

  const filteredHadith = useMemo(() => {
    if (!searchTerm) return hadithData;

    const term = searchTerm.toLowerCase();
    return hadithData.filter((hadith) => {
      const tags = Array.isArray(hadith.tags) ? hadith.tags : [];
      return (
        hadith.arabic?.toLowerCase().includes(term) ||
        hadith.englishTranslation?.toLowerCase().includes(term) ||
        hadith.narrator?.toLowerCase().includes(term) ||
        hadith.bookName?.toLowerCase().includes(term) ||
        hadith.chapterName?.toLowerCase().includes(term) ||
        tags.some((tag) => tag.toLowerCase().includes(term))
      );
    });
  }, [hadithData, searchTerm]);

  const { bookmarks, toggleBookmark } = useHadithBookmarks();

  const bookmarkSet = useMemo(
    () => new Set(bookmarks.map(b => `${b.collection}:${b.hadithNumber}`)),
    [bookmarks]
  );

  const isBookmarked = useCallback(
    (hadithNumber: string) => bookmarkSet.has(`${collection}:${hadithNumber}`),
    [bookmarkSet, collection]
  );

  const [displayCount, setDisplayCount] = useState(50);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const bookScrollKey = collection && book ? `book:${collection}:${book}` : '';
  const [savedBookScrollY, setSavedBookScrollY] = useState<number>(() =>
    bookScrollKey ? getScrollPosition(bookScrollKey, "hadith") : 0
  );
  const [continueDismissed, setContinueDismissed] = useState(false);

  useEffect(() => {
    setDisplayCount(50);
    if (bookScrollKey) {
      setSavedBookScrollY(getScrollPosition(bookScrollKey, "hadith"));
      setContinueDismissed(false);
    }
  }, [searchTerm, book, collection, bookScrollKey]);

  useEffect(() => {
    if (!bookScrollKey) return;
    const mainScrollEl = document.getElementById("main-content");
    const target: EventTarget = mainScrollEl || window;
    const onScroll = () => {
      const y = mainScrollEl ? mainScrollEl.scrollTop : window.scrollY;
      if (y > 60) {
        setScrollPosition(bookScrollKey, y, "hadith");
        setContinueDismissed(true);
      }
    };
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [bookScrollKey]);

  const handleContinueBookScroll = () => {
    const mainScrollEl = document.getElementById("main-content");
    if (mainScrollEl) {
      mainScrollEl.scrollTo({ top: savedBookScrollY, behavior: "smooth" });
    } else {
      window.scrollTo({ top: savedBookScrollY, behavior: "smooth" });
    }
    setContinueDismissed(true);
  };

  // Auto-load more hadith when the sentinel at the end of the list becomes visible
  useEffect(() => {
    if (displayCount >= filteredHadith.length || filteredHadith.length === 0) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          setDisplayCount(prev => Math.min(prev + SHOW_ALL_PAGE_SIZE, filteredHadith.length));
        }
      },
      { rootMargin: "1200px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayCount, filteredHadith.length]);

  const displayedHadith = useMemo(() => {
    return filteredHadith.slice(0, displayCount);
  }, [filteredHadith, displayCount]);

  const loadMore = () => {
    setDisplayCount(prev => prev + 50);
  };

  const defaultBookDesc = contentLang === 'ur'
    ? 'احادیث مبارکہ کا مستند اور بابرکت باب جس میں نبی کریم ﷺ کے فرامین محفوظ ہیں۔'
    : contentLang === 'gu'
    ? 'આ પુસ્તકમાં રસૂલુલ્લાહ ﷺ ની પ્રમાણભૂત હદીસો સંગ્રહિત છે.'
    : contentLang === 'hi'
    ? 'इस अध्याय में अल्लाह के रसूल ﷺ की प्रामाणिक हदीसों का संग्रह है।'
    : 'Authentic traditions of the Prophet Muhammad ﷺ recorded in this chapter.';

  const remainingCount = filteredHadith.length - displayCount;
  const showingHadithText = contentLang === 'ur'
    ? `${filteredHadith.length} میں سے ${displayCount} احادیث دکھائی جا رہی ہیں`
    : contentLang === 'gu'
    ? `${filteredHadith.length} માંથી ${displayCount} હદીસ દર્શાવી રહ્યા છીએ`
    : contentLang === 'hi'
    ? `${filteredHadith.length} में से ${displayCount} हदीस दिखाई जा रही हैं`
    : `Showing ${displayCount} of ${filteredHadith.length} hadith`;

  const loadMoreText = contentLang === 'ur'
    ? `مزید لوڈ کریں (${remainingCount} باقی)`
    : contentLang === 'gu'
    ? `વધુ લોડ કરો (${remainingCount} બાકી)`
    : contentLang === 'hi'
    ? `और लोड करें (${remainingCount} शेष)`
    : `Load More (${remainingCount} remaining)`;

  const showAllText = contentLang === 'ur'
    ? 'تمام دیکھیں'
    : contentLang === 'gu'
    ? 'બધા જુઓ'
    : contentLang === 'hi'
    ? 'सभी देखें'
    : 'Show All';

  const noHadithFoundTitle = hadithData.length === 0
    ? (contentLang === 'ur' ? 'ابھی تک کوئی حدیث امپورٹ نہیں ہوئی' : contentLang === 'gu' ? 'હજુ સુધી કોઈ હદીસ ઇમ્પોર્ટ નથી થઈ' : contentLang === 'hi' ? 'अभी तक कोई हदीस इम्पोर्ट नहीं हुई' : 'No Hadith Imported Yet')
    : (contentLang === 'ur' ? 'کوئی حدیث نہیں ملی' : contentLang === 'gu' ? 'કોઈ હદીસ મળી નથી' : contentLang === 'hi' ? 'कोई हदीस नहीं मिली' : 'No Hadith Found');

  const noHadithFoundDesc = hadithData.length === 0
    ? (contentLang === 'ur' ? 'یہ کتاب تشکیل شدہ ہے لیکن ابھی تک کوئی لوکل ڈیٹا فائل موجود نہیں ہے۔' : contentLang === 'gu' ? 'આ પુસ્તક સેટઅપ થયેલ છે પરંતુ હજુ કોઈ લોકલ ડેટા ફાઇલ નથી.' : contentLang === 'hi' ? 'यह किताब सेटअप है लेकिन अभी तक कोई लोकल डेटा फ़ाइल उपलब्ध नहीं है।' : 'This book is configured but has no local hadith data files yet.')
    : (contentLang === 'ur' ? 'اپنی تلاش کو تبدیل کر کے دوبارہ کوشش کریں۔' : contentLang === 'gu' ? 'તમારા શોધ શબ્દો બદલીને ફરી પ્રયાસ કરો.' : contentLang === 'hi' ? 'खोज शब्दों को बदलकर पुनः प्रयास करें।' : "Try adjusting your search terms to find what you're looking for.");

  if (!collectionData) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Collection Not Found
          </h2>
          <p className="text-muted-foreground">
            The requested Hadith collection could not be found.
          </p>
          <Button
            onClick={() => navigate("/hadith/collections")}
            className="mt-4"
          >
            Browse Collections
          </Button>
        </div>
      </div>
    );
  }

  if (!bookInfo && !loading) {
    return (
      <div className="min-h-screen bg-transparent relative z-10 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Book Not Found
          </h2>
          <p className="text-muted-foreground">
            The requested Hadith book could not be found.
          </p>
          <Button
            onClick={() => navigate(`/hadith/collections/${collection}`)}
            className="mt-4"
          >
            Back to Collection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent relative z-10 safe-top">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Header with Row 1 (Back + Title + Aa + Badge) and Row 2 (Full-Width Language Bar) */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/hadith/collections/${collection}`)}
                className="rounded-xl shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1
                  dir="auto"
                  style={{ unicodeBidi: 'plaintext', fontSize: '22px' }}
                  className={`font-bold text-[var(--text-primary)] line-clamp-2 leading-snug ${contentLang === 'ur' ? 'font-urdu' : ''}`}
                >
                  <MixedBidiTitle latin={translatedBookName || (bookInfo?.name ?? sanitizeHadithBookTitle(book, undefined, 0))} />
                </h1>
                {bookInfo?.arabicName && (
                  <p className="text-[var(--text-secondary)] font-arabic truncate" dir="rtl" style={{ unicodeBidi: 'isolate' }}>
                    <bdi dir="rtl">{bookInfo.arabicName}</bdi>
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
              <AaReaderControlsButton />
              <Badge variant="secondary" className="text-xs shrink-0">
                {loading && hadithData.length === 0
                  ? (contentLang === 'ur' ? 'لوڈ...' : contentLang === 'gu' ? 'લોડ...' : contentLang === 'hi' ? 'लोड...' : 'Loading...')
                  : `${hadithData.length > 0 ? hadithData.length : (bookInfo?.hadithCount || 0)}`}
              </Badge>
            </div>
          </div>
          <ContentLanguageBar fullWidth />
          {!continueDismissed && savedBookScrollY > 120 && (
            <div>
              <ReaderContinueChip onContinue={handleContinueBookScroll} />
            </div>
          )}
        </div>

        {/* Book Info */}
        <Card className="border-border/50">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {contentLang === 'ur' ? 'کتاب کی معلومات' : contentLang === 'gu' ? 'પુસ્તકની માહિતી' : contentLang === 'hi' ? 'किताब की जानकारी' : 'Book Information'}
                </h3>
                <div className="space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">{contentLang === 'ur' ? 'مجموعہ:' : contentLang === 'gu' ? 'સંગ્રહ:' : contentLang === 'hi' ? 'संग्रह:' : 'Collection:'}</span> {collectionData.title}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">{contentLang === 'ur' ? 'کتاب نمبر:' : contentLang === 'gu' ? 'પુસ્તક ક્રમાંક:' : contentLang === 'hi' ? 'किताब क्रमांक:' : 'Book Number:'}</span> {bookInfo?.number ?? book}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">{contentLang === 'ur' ? 'کل احادیث:' : contentLang === 'gu' ? 'કુલ હદીસ:' : contentLang === 'hi' ? 'कुल हदीस:' : 'Total Hadith:'}</span> {hadithData.length > 0 ? hadithData.length : (bookInfo?.hadithCount || 0)}
                  </p>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-2">
                  {contentLang === 'ur' ? 'تفصیل و تعارف' : contentLang === 'gu' ? 'વર્ણન' : contentLang === 'hi' ? 'विवरण' : 'Description'}
                </h3>
                <p
                  className={`text-sm text-[var(--text-secondary)] leading-relaxed ${contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'}`}
                  dir="auto"
                  style={{ unicodeBidi: 'plaintext' }}
                >
                  {translatedBookDesc || bookInfo?.description || defaultBookDesc}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search Bar */}
        <div className="relative max-w-md mx-auto mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={contentLang === 'ur' ? 'اس کتاب میں حدیث تلاش کریں...' : contentLang === 'gu' ? 'આ પુસ્તકમાં હદીસ શોધો...' : contentLang === 'hi' ? 'इस किताब में हदीस खोजें...' : 'Search hadith in this book...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 rounded-xl border-border/50 focus:border-primary/50"
          />
        </div>

        {loading && (
          <div className="space-y-4">
            {[1,2,3,4,5].map(i => (
              <Card key={i} className="border-border/50">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-12 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded animate-pulse" />
                  </div>
                  <div className="h-24 bg-muted/50 rounded-xl animate-pulse" />
                  <div className="h-12 bg-muted/50 rounded-lg animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Hadith List */}
        {!loading && (
          <div className="space-y-4">
            {displayedHadith.map((hadith, index) => (
              <HadithCard
                key={`${hadith.id}-${hadith.bookNumber}-${hadith.hadithNumber}-${index}`}
                hadith={hadith}
                index={index}
                collection={collection!}
                book={book!}
                bookmarked={isBookmarked(hadith.hadithNumber)}
                navigate={navigate}
                toast={toast}
                toggleBookmark={toggleBookmark}
              />
            ))}

            {displayCount < filteredHadith.length && (
              <div ref={sentinelRef} aria-hidden="true" />
            )}

            {/* Load More / Show All */}
            {filteredHadith.length > displayCount && (
              <div className="pt-4 pb-8 flex flex-col items-center gap-3">
                <p className={`text-sm text-muted-foreground ${contentLang === 'ur' ? 'font-urdu' : ''}`}>
                  {showingHadithText}
                </p>
                <div className="flex gap-2 w-full max-w-sm">
                  <Button
                    onClick={loadMore}
                    variant="outline"
                    className={`flex-1 rounded-xl border-primary/20 hover:bg-primary/5 ${contentLang === 'ur' ? 'font-urdu text-sm' : ''}`}
                  >
                    {loadMoreText}
                  </Button>
                  <Button
                    onClick={() => setDisplayCount(Math.min(filteredHadith.length, SHOW_ALL_PAGE_SIZE))}
                    variant="outline"
                    className={`flex-1 rounded-xl border-primary/20 hover:bg-primary/5 ${contentLang === 'ur' ? 'font-urdu text-sm' : ''}`}
                  >
                    {showAllText}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* No Results */}
        {!loading && filteredHadith.length === 0 && (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className={`text-lg font-semibold text-foreground mb-2 ${contentLang === 'ur' ? 'font-urdu' : ''}`}>
                {noHadithFoundTitle}
              </h3>
              <p className={`text-muted-foreground ${contentLang === 'ur' ? 'font-urdu leading-[2.35]' : ''}`}>
                {noHadithFoundDesc}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
