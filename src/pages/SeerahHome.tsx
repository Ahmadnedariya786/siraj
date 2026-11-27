import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Search, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/PageTransition";
import { SeerahChapterCard } from "@/components/seerah/SeerahChapterCard";
import { goBackOrFallback } from "@/lib/navigation";
import { getLastRead, getReadingProgress } from "@/lib/reading-storage";
import { useLanguage } from "@/contexts/LanguageContext-new";
import { useContentLanguage, translateIslamicText } from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import {
  loadSeerahChapterList,
  loadSeerahMetadata,
  type SeerahChapterSummary,
  type SeerahMetadata,
} from "@/lib/seerah";

type PeriodFilter = "all" | "pre-prophethood" | "makkan" | "madinan" | "final-days";

export default function SeerahHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { contentLang, isRtl } = useContentLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [metadata, setMetadata] = useState<SeerahMetadata | null>(null);
  const [chapters, setChapters] = useState<SeerahChapterSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [translatedMetaTitle, setTranslatedMetaTitle] = useState("");
  const [translatedMetaDesc, setTranslatedMetaDesc] = useState("");
  const [translatedLastReadTitle, setTranslatedLastReadTitle] = useState("");

  const lastReadId = useMemo(() => getLastRead("seerah"), []);
  const lastReadChapter = useMemo(() => lastReadId ? chapters.find(c => c.id === lastReadId) : null, [lastReadId, chapters]);

  useEffect(() => {
    if (!lastReadChapter) return;
    if (contentLang === 'en') {
      setTranslatedLastReadTitle(lastReadChapter.title);
      return;
    }
    let isMounted = true;
    translateIslamicText(lastReadChapter.title, contentLang).then(t => {
      if (isMounted) setTranslatedLastReadTitle(t);
    });
    return () => { isMounted = false; };
  }, [lastReadChapter?.id, lastReadChapter?.title, contentLang]);

  useEffect(() => {
    if (!metadata) return;
    if (contentLang === 'en') {
      setTranslatedMetaTitle(metadata.title);
      setTranslatedMetaDesc(metadata.description);
      return;
    }
    let isMounted = true;
    Promise.all([
      translateIslamicText(metadata.title, contentLang),
      translateIslamicText(metadata.description, contentLang),
    ]).then(([tTitle, tDesc]) => {
      if (isMounted) {
        setTranslatedMetaTitle(tTitle);
        setTranslatedMetaDesc(tDesc);
      }
    });
    return () => { isMounted = false; };
  }, [metadata, contentLang]);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [meta, chaps] = await Promise.all([
          loadSeerahMetadata(),
          loadSeerahChapterList(),
        ]);
        setMetadata(meta);
        setChapters(chaps);
      } catch (error) {
        console.error("Failed to load Seerah data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim().toLowerCase());
    }, 200);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const periodLabels: Record<PeriodFilter, string> = useMemo(() => {
    if (contentLang === 'ur') {
      return {
        all: "تمام ادوار",
        "pre-prophethood": "قبل از نبوت",
        makkan: "مکی دور",
        madinan: "مدنی دور",
        "final-days": "آخری ایام",
      };
    }
    if (contentLang === 'gu') {
      return {
        all: "બધા",
        "pre-prophethood": "નબુવ્વત પહેલાં",
        makkan: "મક્કી દોર",
        madinan: "મદની દોર",
        "final-days": "આખરી દિવસો",
      };
    }
    return {
      all: t("all"),
      "pre-prophethood": t("seerahPeriodPreProphethood"),
      makkan: t("seerahPeriodMakkan"),
      madinan: t("seerahPeriodMadinan"),
      "final-days": t("seerahPeriodFinalDays"),
    };
  }, [contentLang, t]);

  const searchPlaceholder = useMemo(() => {
    if (contentLang === 'ur') return "سیرت مبارکہ کے ابواب تلاش کریں...";
    if (contentLang === 'gu') return "સીરતના પ્રકરણો શોધો...";
    return t("search");
  }, [contentLang, t]);

  const filteredChapters = useMemo(() => {
    let result = chapters;

    if (periodFilter !== "all") {
      result = result.filter((chapter) => chapter.period === periodFilter);
    }

    if (debouncedSearchTerm) {
      result = result.filter(
        (chapter) =>
          chapter.title.toLowerCase().includes(debouncedSearchTerm) ||
          chapter.arabicTitle.includes(debouncedSearchTerm) ||
          chapter.tags.some((tag) => tag.toLowerCase().includes(debouncedSearchTerm))
      );
    }

    return result;
  }, [chapters, debouncedSearchTerm, periodFilter]);

  const handleChapterClick = (chapterId: string) => {
    navigate(`/seerah/${chapterId}`);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-transparent relative z-10 pb-24">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <div className="h-8 w-32 bg-muted rounded-lg animate-pulse mb-8" />
            <div className="h-48 bg-muted/50 rounded-[28px] animate-pulse mb-6" />
            <div className="h-10 bg-muted/50 rounded-xl animate-pulse mb-6 max-w-md mx-auto" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-36 bg-muted/50 rounded-[20px] animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="min-h-screen bg-transparent pb-4 safe-top relative z-10" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
          {/* Header with Row 1 (Back + Title) and Row 2 (Full-Width Language Bar) */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => goBackOrFallback(navigate, '/services')}
                className="rounded-xl shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex-1 min-w-0">
                <h1
                  dir="auto"
                  style={{ unicodeBidi: 'plaintext', fontSize: '22px' }}
                  className="font-bold text-[var(--text-primary)] line-clamp-2 leading-tight"
                >
                  {t("seerah")}
                </h1>
                <p className="text-[var(--text-secondary)] text-xs sm:text-sm line-clamp-2 leading-snug">
                  {t("seerahDescription")}
                </p>
              </div>
            </div>
            <ContentLanguageBar fullWidth />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-[24px] border border-[var(--border)] shadow-xl mb-6"
            style={{ background: 'var(--surface)' }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(circle at top right, var(--accent-soft) 0%, transparent 65%)',
              }}
            />

            <div className="relative z-10 p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent-text)]">
                  {t("seerah")}
                </span>
              </div>

              <h2
                className={`font-bold text-[var(--text-primary)] mb-2 line-clamp-2 ${contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'}`}
                dir="auto"
                style={{
                  fontSize: '24px',
                  lineHeight: contentLang === 'ur' ? 1.85 : 1.25,
                  unicodeBidi: 'plaintext',
                }}
              >
                {translatedMetaTitle || metadata?.title || "Ar-Raheeq Al-Makhtum (The Sealed Nectar)"}
              </h2>
              <p className="font-arabic text-xl text-[var(--accent-text)] mb-3 text-right" dir="rtl">
                {metadata?.arabicTitle || "الرحيق المختوم"}
              </p>

              {(metadata?.author || metadata?.arabicAuthor) && (
                <div className="flex items-center gap-3 flex-wrap mb-3">
                  {metadata?.author && <span className="text-[var(--text-secondary)] text-xs sm:text-sm">{metadata.author}</span>}
                  {metadata?.author && metadata?.arabicAuthor && <span className="text-[var(--border)] text-sm">•</span>}
                  {metadata?.arabicAuthor && <span className="text-[var(--text-secondary)] text-xs sm:text-sm font-arabic">{metadata.arabicAuthor}</span>}
                </div>
              )}

              <p
                className={`text-[var(--text-secondary)] text-sm mb-4 ${contentLang === 'ur' ? 'font-urdu text-right text-base leading-[2.3]' : isRtl ? 'font-arabic text-right text-base' : 'text-left'}`}
                dir="auto"
                style={{ unicodeBidi: 'plaintext' }}
              >
                {translatedMetaDesc || metadata?.description || "A comprehensive biography of Prophet Muhammad (ﷺ)."}
              </p>

              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge className="bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--border)]">
                  {metadata?.totalChapters || chapters.length || 17} {t("seerahChapters")}
                </Badge>
                <Badge className="bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] font-semibold">
                  EN • اردو • ગુજ
                </Badge>
              </div>
            </div>
          </motion.div>

          {/* Continue Reading */}
          {(() => {
            const lastReadId = getLastRead("seerah");
            const lastReadChapter = lastReadId ? chapters.find(c => c.id === lastReadId) : null;
            if (lastReadChapter && !loading) {
              const progress = getReadingProgress(lastReadId!, "seerah");
              const continueLabel = contentLang === 'ur' ? 'مطالعہ جاری رکھیں' : contentLang === 'gu' ? 'વાંચન ચાલુ રાખો' : 'Continue Reading';
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4"
                >
                  <Card
                    className="p-4 cursor-pointer hover:bg-muted/50 transition-colors border-primary/20 bg-gradient-to-r from-primary/5 to-transparent"
                    onClick={() => handleChapterClick(lastReadChapter.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Bookmark className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground mb-0.5">{continueLabel}</p>
                        <p className={`text-sm font-semibold truncate ${contentLang === 'ur' ? 'font-urdu' : ''}`}>{translatedLastReadTitle || lastReadChapter.title}</p>
                        {progress > 0 && (
                          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                      <BookOpen className="w-4 h-4 text-primary shrink-0" />
                    </div>
                  </Card>
                </motion.div>
              );
            }
            return null;
          })()}

          <div className="relative max-w-md mx-auto mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {(Object.keys(periodLabels) as PeriodFilter[]).map((period) => (
              <Button
                key={period}
                variant={periodFilter === period ? "default" : "outline"}
                size="sm"
                onClick={() => setPeriodFilter(period)}
                className={
                  periodFilter === period
                    ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)]"
                }
              >
                {periodLabels[period]}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {filteredChapters.map((chapter, index) => (
              <SeerahChapterCard
                key={chapter.id}
                chapter={chapter}
                onClick={() => handleChapterClick(chapter.id)}
                index={index}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[var(--surface)] rounded-[24px] p-5 border border-[var(--border)]"
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              {contentLang === 'ur' ? 'خلاصہ و ابواب' : contentLang === 'gu' ? 'વિહંગાવલોકન' : t("overview")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent-text)]">
                  {metadata?.totalChapters || chapters.length || 17}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">{contentLang === 'ur' ? 'کل ابواب' : contentLang === 'gu' ? 'કુલ પ્રકરણો' : t("seerahChapters")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {chapters.filter((chapter) => chapter.period === "pre-prophethood").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {periodLabels["pre-prophethood"]}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent-text)]">
                  {chapters.filter((chapter) => chapter.period === "makkan").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {periodLabels["makkan"]}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {chapters.filter((chapter) => chapter.period === "madinan").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {periodLabels["madinan"]}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}
