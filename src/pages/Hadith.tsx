import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, RefreshCw, Library, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getDailyHadith as getDailyHadithFromCollections } from "@/lib/hadith";
import { PageTransition } from "@/components/PageTransition";
import { useLanguage } from "@/contexts/LanguageContext-new";
import { ManuscriptDivider } from "@/components/ui/ManuscriptDivider";
import {
  useContentLanguage,
  translateHadithContent,
  type ContentLang,
} from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import {
  AaReaderControlsButton,
  BookProseParagraph,
  CopyHadithMenuButton,
  ReaderArabicBlock,
  ReaderStatusBanner,
} from "@/components/BookReaderControls";
import {
  useBookReaderPrefs,
  formatIslamicProse,
} from "@/lib/reader-typography";

interface HadithItem {
  id?: number | string;
  text?: string;
  translation?: string;
  source?: string;
  number?: number | string;
}

interface HadithData {
  hadith: string;
  translation?: string;
  book: string;
  number: string;
  narrator?: string;
}

const REFRESH_SEED_KEY = "hadith-refresh-seed";

function getDailySeed(refreshSeed?: number | null): number {
  if (refreshSeed != null) return refreshSeed;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now.getTime() - start.getTime()) / 86400000);
}

const Hadith = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contentLang } = useContentLanguage();
  const { prefs } = useBookReaderPrefs();
  const [hadith, setHadith] = useState<HadithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hadithDataList, setHadithDataList] = useState<HadithItem[] | null>(null);
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [actualLang, setActualLang] = useState<ContentLang>('en');
  const [fromCache, setFromCache] = useState(false);
  const [offlineFallback, setOfflineFallback] = useState(false);
  const [source, setSource] = useState<'scholar-edition' | 'chunked-api' | 'original'>('original');
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    import('@/data/hadith.json').then(module => {
      setHadithDataList(module.default);
    });
  }, []);

  const fetchHadith = useCallback(async (isRefresh = false) => {
    const today = new Date().toISOString().slice(0, 10);
    const cachedDate = localStorage.getItem("lastHadithDate");
    const cachedData = localStorage.getItem("lastHadithData");

    // Use cache unless refreshing
    if (!isRefresh && cachedDate === today && cachedData) {
      try {
        setHadith(JSON.parse(cachedData));
        setLoading(false);
        return;
      } catch (e) {
        console.error("Error parsing cached hadith:", e);
      }
    }

    setLoading(true);
    
    try {
      // Set or clear refresh seed
      let refreshSeed: number | null = null;
      if (isRefresh) {
        refreshSeed = Math.floor(Math.random() * 100000) + 1;
        localStorage.setItem(REFRESH_SEED_KEY, String(refreshSeed));
      } else {
        const stored = localStorage.getItem(REFRESH_SEED_KEY);
        if (stored) refreshSeed = parseInt(stored, 10);
      }

      const importedHadith = await getDailyHadithFromCollections(getDailySeed(refreshSeed));
      let finalData: HadithData;

      if (importedHadith) {
        finalData = {
          hadith: importedHadith.arabic || importedHadith.arabicPlain || "No hadith text available",
          translation: importedHadith.englishTranslation || "",
          book: importedHadith.collection.replace(/[-_]/g, " "),
          number: String(importedHadith.hadithNumber || importedHadith.id),
          narrator: importedHadith.narrator || "",
        };
      } else {
        if (!hadithDataList) {
          // Fallback if data hasn't loaded yet
          finalData = {
            hadith: "No hadith text available",
            translation: "",
            book: "Unknown",
            number: "1",
            narrator: "",
          };
        } else {
          const randomIdx = Math.floor(Math.random() * hadithDataList.length);
          const item = hadithDataList[randomIdx];
          finalData = {
            hadith: item.text || 'No hadith text available',
            translation: item.translation || '',
            book: item.source || 'Unknown',
            number: String(item.number || randomIdx + 1),
            narrator: '',
          };
        }
      }
      
      setHadith(finalData);
      localStorage.setItem("lastHadithDate", today);
      // JSON.stringify of a ~1KB+ hadith payload is ~38ms on ARM A53 cores
      // (2 frames dropped at 60FPS, 1 frame at 30FPS) when done synchronously.
      // Defer to setTimeout(0) so state commit + user's spinner dismissal are not blocked.
      setTimeout(() => {
        localStorage.setItem("lastHadithData", JSON.stringify(finalData));
      }, 0);
      setLoading(false);
    } catch (e) {
      console.error('Hadith Selection Error:', e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHadith();
  }, [fetchHadith]);

  const runDailyHadithTranslation = useCallback(async (isCancelled: () => boolean) => {
    if (!hadith?.translation) {
      if (!isCancelled()) {
        setTranslatedText('');
        setActualLang('en');
        setFromCache(false);
        setOfflineFallback(false);
        setSource('original');
      }
      return;
    }
    const cleanEn = formatIslamicProse(hadith.translation, 'en');
    if (contentLang === 'en') {
      if (!isCancelled()) {
        setTranslatedText(cleanEn);
        setActualLang('en');
        setFromCache(false);
        setOfflineFallback(false);
        setSource('original');
        setIsTranslating(false);
      }
      return;
    }
    if (!isCancelled()) setIsTranslating(true);
    const res = await translateHadithContent({
      collection: hadith.book.toLowerCase().replace(/\s+/g, '') || 'generic',
      hadithNumber: hadith.number,
      references: `${hadith.book} ${hadith.number}`,
      englishText: cleanEn,
      targetLang: contentLang,
    });
    if (!isCancelled()) {
      setTranslatedText(res.text);
      setActualLang(res.actualLang);
      setFromCache(res.fromCache);
      setOfflineFallback(res.offlineFallback);
      setSource(res.source);
      setIsTranslating(false);
    }
  }, [hadith, contentLang]);

  useEffect(() => {
    let cancelled = false;
    runDailyHadithTranslation(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [runDailyHadithTranslation, retryTick]);

  const narratorLabel = useMemo(() => {
    if (!hadith?.narrator) return null;
    if (actualLang === 'ur') return `راوی: ${hadith.narrator}`;
    if (actualLang === 'gu') return `રાવી: ${hadith.narrator}`;
    return `Narrated by: ${hadith.narrator}`;
  }, [hadith?.narrator, actualLang]);

  const handleShare = async () => {
    if (hadith) {
      const trans = translatedText || hadith.translation;
      const shareText = `"${hadith.hadith}"\n\n${trans ? `"${trans}"\n\n` : ''}Source: ${hadith.book} #${hadith.number}${hadith.narrator ? `\nNarrator: ${hadith.narrator}` : ''}`;
      
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Hadith of the Day",
            text: shareText,
          });
        } catch (error) {
          console.error("Error sharing:", error);
        }
      } else {
        navigator.clipboard.writeText(shareText);
        toast({
          title: "Copied to clipboard",
          description: "Hadith has been copied to your clipboard",
        });
      }
    }
  };

  const handleCopyMode = async (mode: 'arabic' | 'translation' | 'both') => {
    if (!hadith) return;
    const trans = translatedText || formatIslamicProse(hadith.translation || '', 'en');
    const ref = `${hadith.book}${hadith.number ? ` #${hadith.number}` : ''}`;
    const payload =
      mode === 'arabic'
        ? `${hadith.hadith}\n\n— ${ref}`
        : mode === 'translation'
        ? `${trans}\n\n— ${ref}`
        : `${hadith.hadith}\n\n${trans}\n\n— ${ref}`;
    try {
      await navigator.clipboard.writeText(payload);
      toast({
        title: `Copied ${mode === 'both' ? 'Arabic & translation' : mode}`,
      });
    } catch {
      toast({ title: "Could not copy hadith", variant: "destructive" });
    }
  };

  return (
    <PageTransition>
    <div className="min-h-screen bg-transparent pb-4 relative overflow-hidden safe-top z-10" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
      {/* Islamic geometric pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23d4af37' fill-opacity='1'%3E%3Cpath d='M30 30l15-15v30L30 30zm0 0L15 15v30l15-15z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6 relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/hadith/collections")}
            className="rounded-full bg-[var(--surface)] border border-[var(--border)] shadow-sm shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[var(--text-primary)]" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1
              dir="auto"
              style={{ unicodeBidi: 'plaintext', fontSize: '22px' }}
              className="font-bold text-[var(--text-primary)] font-arabic tracking-tight line-clamp-2 leading-tight"
            >
              حديث اليوم
            </h1>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)] mt-0.5 line-clamp-2">
              Daily Hadith
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-nowrap">
            <AaReaderControlsButton />
            {hadith && <CopyHadithMenuButton compact onCopyMode={handleCopyMode} />}
          </div>
        </div>

        {/* 4-Language Selector Bar */}
        <ContentLanguageBar fullWidth />

        {loading ? (
          <Card
            aria-busy="true"
            aria-label="Loading daily hadith"
            className="p-5 sm:p-6 border-[var(--border)] bg-[var(--surface)] shadow-sm space-y-4 animate-pulse"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="h-3.5 w-28 rounded bg-[var(--surface-2)]" />
              <div className="h-3.5 w-20 rounded bg-[var(--surface-2)]" />
            </div>
            <div className="rounded-xl p-3 bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
              <div className="h-5 w-full rounded bg-[var(--accent-soft)]" />
              <div className="h-5 w-11/12 ml-auto rounded bg-[var(--accent-soft)]" />
              <div className="h-5 w-3/4 ml-auto rounded bg-[var(--accent-soft)]" />
            </div>
            <div className="h-px w-full bg-[var(--border)]" />
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-[var(--surface-2)]" />
              <div className="h-4 w-full rounded bg-[var(--surface-2)]" />
              <div className="h-4 w-4/5 rounded bg-[var(--surface-2)]" />
            </div>
            <div className="h-6 w-36 rounded-full bg-[var(--accent-soft)]" />
          </Card>
        ) : hadith ? (
          <div className="space-y-4">
            {/* Main Hadith Card */}
            <Card className="relative overflow-hidden border shadow-xl border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]">
              <div className="relative p-5 sm:p-6 z-10">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.18em] text-[var(--accent-text)] font-bold">
                      Hadith of the Day
                    </span>
                    {hadith.book && (
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {hadith.book} {hadith.number ? `#${hadith.number}` : ''}
                      </span>
                    )}
                  </div>

                  {/* Hadith Arabic text */}
                  {hadith.hadith && hadith.hadith.trim() && hadith.hadith !== "No hadith text available" && (
                    <ReaderArabicBlock text={hadith.hadith} arabicSize={prefs.arabicSize} />
                  )}

                  {/* Narrator (راوی) */}
                  {narratorLabel && (
                    <div className={actualLang === 'ur' ? 'text-right' : 'text-left'}>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent-text)] ${
                          actualLang === 'ur' ? "font-urdu" : ""
                        }`}
                        dir="auto"
                        style={{ unicodeBidi: 'plaintext' }}
                      >
                        {narratorLabel}
                      </span>
                    </div>
                  )}

                  {/* Translation in Selected Language */}
                  {(translatedText || hadith.translation) && (
                    <div
                      key={`${hadith.number}-${contentLang}`}
                      className="reader-prose-measure"
                      dir={actualLang === 'ur' ? 'rtl' : 'ltr'}
                      style={{ textAlign: actualLang === 'ur' ? 'right' : 'left' }}
                    >
                      <ManuscriptDivider />
                      <ReaderStatusBanner
                        targetLang={contentLang}
                        actualLang={actualLang}
                        fromCache={fromCache}
                        source={source}
                        offlineFallback={offlineFallback}
                        isStreaming={isTranslating}
                        onRetry={() => setRetryTick((n) => n + 1)}
                      />
                      <div>
                        <BookProseParagraph
                          text={translatedText || formatIslamicProse(hadith.translation || '', 'en')}
                          actualLang={actualLang}
                          fontSize={prefs.bodySize}
                          lineSpacing={prefs.lineHeightMode}
                          className="text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleShare}
                className="flex-1 bg-card text-foreground hover:bg-muted/50 border border-border/40 shadow-sm font-bold text-xs rounded-xl h-12"
                variant="outline"
              >
                <Share2 className="w-4 h-4 me-2 text-[#C9860A]" />
                Share
              </Button>
              <Button
                onClick={() => navigate("/hadith/collections")}
                className="flex-1 bg-card text-foreground hover:bg-muted/50 border border-border/40 shadow-sm font-bold text-xs rounded-xl h-12"
                variant="outline"
              >
                <Library className="w-4 h-4 me-2 text-[#C9860A]" />
                Browse
              </Button>
              <Button
                onClick={() => navigate("/hadith/bookmarks")}
                className="bg-card text-foreground hover:bg-muted/50 border border-border/40 shadow-sm rounded-xl h-12 w-12"
                variant="outline"
                size="icon"
                title={t("bookmarkedHadith") || "Bookmarked Hadith"}
              >
                <Bookmark className="w-4 h-4 text-[#C9860A]" />
              </Button>
              <Button
                onClick={() => fetchHadith(true)}
                className="bg-card text-foreground hover:bg-muted/50 border border-border/40 shadow-sm rounded-xl h-12 w-12"
                variant="outline"
                size="icon"
              >
                <RefreshCw className="w-4 h-4 text-[#C9860A]" />
              </Button>
            </div>

            {/* Footer message */}
            <Card className="p-5 bg-muted/20 border-border/40 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-center text-muted-foreground">
                May Allah (SWT) help us implement these teachings in our daily lives. Ameen.
              </p>
            </Card>
          </div>
        ) : (
          <Card className="p-8 text-center space-y-4 bg-card border-border/40 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Unable to load hadith. Please try again later.</p>
            <Button onClick={() => { fetchHadith(true); }} variant="outline" className="bg-[#1A1A1A] text-white hover:bg-[#333333] border-border/40 font-bold rounded-xl px-6 h-12">
              Try Again
            </Button>
          </Card>
        )}
      </div>
    </div>
    </PageTransition>
  );
};

export default Hadith;
