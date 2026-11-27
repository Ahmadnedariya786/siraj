import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Users, BookOpen, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageTransition } from "@/components/PageTransition";
import { ProphetCard } from "@/components/qisas/ProphetCard";
import { goBackOrFallback } from "@/lib/navigation";
import { getLastRead, getReadingProgress } from "@/lib/reading-storage";
import { useLanguage } from "@/contexts/LanguageContext-new";
import { useContentLanguage, translateIslamicText } from "@/lib/content-translator";
import { ContentLanguageBar } from "@/components/ContentLanguageBar";
import {
  getCachedProphetListSync,
  loadProphetList,
  loadQisasMetadata,
  type ProphetSummary,
  type QisasMetadata,
} from "@/lib/qisas";

type EraFilter =
  | "all"
  | "beginning-of-creation"
  | "pre-flood"
  | "patriarchal"
  | "israelite"
  | "post-israelite";

export default function QisasHome() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { contentLang, isRtl } = useContentLanguage();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [eraFilter, setEraFilter] = useState<EraFilter>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [metadata, setMetadata] = useState<QisasMetadata | null>(null);
  const [prophets, setProphets] = useState<ProphetSummary[]>(() => getCachedProphetListSync());
  const [loading, setLoading] = useState<boolean>(() => getCachedProphetListSync().length === 0);
  const [translatedMetaTitle, setTranslatedMetaTitle] = useState("");
  const [translatedMetaDesc, setTranslatedMetaDesc] = useState("");

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
      if (prophets.length === 0) setLoading(true);
      try {
        const [meta, list] = await Promise.all([
          loadQisasMetadata(),
          loadProphetList(),
        ]);
        setMetadata(meta);
        if (Array.isArray(list) && list.length > 0) {
          setProphets(list);
        }
      } catch (error) {
        console.error("Failed to load Qisas data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm.trim().toLowerCase());
    }, 200);

    return () => window.clearTimeout(timer);
  }, [searchTerm]);

  const eraLabels: Record<EraFilter, string> = useMemo(() => {
    if (contentLang === 'ur') {
      return {
        all: "تمام ادوار",
        "beginning-of-creation": "ابتدائے آفرینش",
        "pre-flood": "طوفانِ نوح سے قبل",
        patriarchal: "دورِ ابراہیمی",
        israelite: "بنی اسرائیل کا دور",
        "post-israelite": "مابعد بنی اسرائیل",
      };
    }
    if (contentLang === 'gu') {
      return {
        all: "બધા",
        "beginning-of-creation": "શરૂઆતનો સમય",
        "pre-flood": "નૂહ પૂર પહેલાં",
        patriarchal: "ઇબ્રાહીમ દોર",
        israelite: "ઇઝરાયલી દોર",
        "post-israelite": "અન્ય પયગંબરો",
      };
    }
    return {
      all: t("all"),
      "beginning-of-creation": t("qisasEraBeginning"),
      "pre-flood": t("qisasEraPreFlood"),
      patriarchal: t("qisasEraPatriarchal"),
      israelite: t("qisasEraIsraelite"),
      "post-israelite": t("qisasEraPostIsraelite"),
    };
  }, [contentLang, t]);

  const searchPlaceholder = useMemo(() => {
    if (contentLang === 'ur') return "انبیاء کرام کے مبارک واقعات تلاش کریں...";
    if (contentLang === 'gu') return "પયગંબરોની વાતો શોધો...";
    return t("search");
  }, [contentLang, t]);

  const filteredProphets = useMemo(() => {
    let result = prophets;

    if (eraFilter !== "all") {
      result = result.filter((prophet) => prophet.era === eraFilter);
    }

    if (debouncedSearchTerm) {
      result = result.filter(
        (prophet) =>
          prophet.name.toLowerCase().includes(debouncedSearchTerm) ||
          prophet.arabicName.includes(debouncedSearchTerm) ||
          prophet.title.toLowerCase().includes(debouncedSearchTerm) ||
          prophet.tags.some((tag) => tag.toLowerCase().includes(debouncedSearchTerm))
      );
    }

    return result;
  }, [debouncedSearchTerm, eraFilter, prophets]);

  const handleProphetClick = (prophetId: string) => {
    navigate(`/qisas/${prophetId}`);
  };

  if (loading) {
    return (
      <PageTransition>
        <div className="min-h-screen bg-transparent relative z-10 pb-24">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="h-8 w-32 bg-[var(--surface-2)] rounded-lg animate-pulse mb-6" />
            <div className="h-44 bg-[var(--surface-2)] rounded-[24px] animate-pulse mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-28 bg-[var(--surface-2)] rounded-[20px] animate-pulse" />
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
        <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
          {/* Header with Row 1 (Back + 2-Line Clamped Title) and Row 2 (Full-Width Language Bar) */}
          <div className="space-y-3">
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
                  {t("qisas")}
                </h1>
                <p className="text-[var(--text-secondary)] text-xs sm:text-sm line-clamp-2 leading-snug">
                  {t("qisasDescription")}
                </p>
              </div>
            </div>
            <ContentLanguageBar fullWidth />
          </div>

          {/* Continue Reading */}
          {(() => {
            const lastReadId = getLastRead("qisas");
            const lastReadProphet = lastReadId ? prophets.find((p) => p.id === lastReadId) : null;
            if (lastReadProphet && !loading) {
              const progress = getReadingProgress(lastReadId!, "qisas");
              const continueLabel = contentLang === 'ur' ? 'مطالعہ جاری رکھیں' : contentLang === 'gu' ? 'વાંચન ચાલુ રાખો' : 'Continue Reading';
              return (
                <div>
                  <Card
                    className="p-3.5 cursor-pointer hover:border-[var(--accent)]/45 transition-colors border-[var(--border)] bg-[var(--surface)]"
                    onClick={() => handleProphetClick(lastReadProphet.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-[var(--accent-soft)] border border-[var(--border)]">
                        <BookOpen className="w-4 h-4 text-[var(--accent)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-[var(--text-secondary)] mb-0.5">{continueLabel}</p>
                        <p
                          dir="auto"
                          style={{ unicodeBidi: 'plaintext' }}
                          className={`text-sm font-semibold line-clamp-1 ${contentLang === 'ur' ? 'font-urdu' : ''}`}
                        >
                          {lastReadProphet.name}
                        </p>
                        {progress > 0 && (
                          <div className="mt-1.5 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                            <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${progress}%` }} />
                          </div>
                        )}
                      </div>
                      <BookOpen className="w-4 h-4 text-[var(--accent)] shrink-0" />
                    </div>
                  </Card>
                </div>
              );
            }
            return null;
          })()}

          {/* Tokenized Royal Hero (title <= 24px / 2-line clamp) */}
          <div
            className="relative overflow-hidden rounded-[24px] border border-[var(--border)] shadow-xl"
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
                <Users className="w-4 h-4 text-[var(--accent)]" />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-[var(--accent-text)]">
                  {t("qisas")}
                </span>
              </div>

              <h2
                className={`font-bold text-[var(--text-primary)] mb-1.5 line-clamp-2 ${contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'}`}
                dir="auto"
                style={{
                  fontSize: '24px',
                  lineHeight: contentLang === 'ur' ? 1.85 : 1.25,
                  unicodeBidi: 'plaintext',
                }}
              >
                {translatedMetaTitle || metadata?.title || "Stories of the Prophets"}
              </h2>
              <p className="font-arabic text-xl text-[var(--accent-text)] mb-3 text-right" dir="rtl">
                {metadata?.arabicTitle || "قصص الأنبياء"}
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
                {translatedMetaDesc || metadata?.description || "Stories of the Prophets from Adam to Isa (peace be upon them all)."}
              </p>

              <div className="flex items-center gap-2.5 flex-wrap">
                <Badge className="bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--border)]">
                  {metadata?.totalProphets || prophets.length || 24} {t("qisasProphets")}
                </Badge>
                <Badge className="bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)] font-semibold">
                  EN • اردو • ગુજ
                </Badge>
              </div>
            </div>
          </div>

          {/* Search Bar + Grid/List Toggle */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="pl-10 rounded-xl bg-[var(--surface)] border-[var(--border)]"
              />
            </div>
            <div
              className="inline-flex items-center p-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] shrink-0"
              role="group"
              aria-label="View layout toggle"
            >
              <button
                type="button"
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                style={
                  viewMode === "grid"
                    ? { background: "var(--accent)", color: "var(--on-accent)" }
                    : { background: "transparent", color: "var(--text-secondary)" }
                }
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
                style={
                  viewMode === "list"
                    ? { background: "var(--accent)", color: "var(--on-accent)" }
                    : { background: "transparent", color: "var(--text-secondary)" }
                }
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sticky Era-Filter Bar with Token-Mixed Semantic Chips */}
          <div
            data-testid="sticky-era-filter-bar"
            className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-[var(--bg-base)] border-y border-[var(--border)]"
          >
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {(Object.keys(eraLabels) as EraFilter[]).map((era) => {
                const active = eraFilter === era;
                const semanticClass = era === "all" ? "" : `era-chip-${era}`;
                return (
                  <button
                    key={era}
                    type="button"
                    onClick={() => setEraFilter(era)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all active:scale-95 ${
                      contentLang === "ur" ? "font-urdu" : ""
                    } ${active ? "ring-1 ring-[var(--accent)]" : ""} ${
                      era === "all"
                        ? active
                          ? "bg-[var(--accent)] text-[var(--on-accent)] border-[var(--accent)]"
                          : "bg-[var(--surface-2)] text-[var(--text-secondary)] border-[var(--border)]"
                        : semanticClass
                    }`}
                    style={
                      active && era !== "all"
                        ? { boxShadow: "0 0 0 1px var(--accent)" }
                        : undefined
                    }
                  >
                    {eraLabels[era]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid or List View */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {filteredProphets.map((prophet, index) => (
                <ProphetCard
                  key={prophet.id}
                  prophet={prophet}
                  onClick={() => handleProphetClick(prophet.id)}
                  index={index}
                  variant="grid"
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 mb-6">
              {filteredProphets.map((prophet, index) => (
                <ProphetCard
                  key={prophet.id}
                  prophet={prophet}
                  onClick={() => handleProphetClick(prophet.id)}
                  index={index}
                  variant="list"
                />
              ))}
            </div>
          )}

          {/* Tokenized Overview Card */}
          <div
            className="bg-[var(--surface)] rounded-[24px] p-5 border border-[var(--border)]"
          >
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              {t("overview")}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent-text)]">
                  {metadata?.totalProphets || prophets.length || 24}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {t("qisasProphets")}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {prophets.filter((prophet) => prophet.era === "beginning-of-creation").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {eraLabels["beginning-of-creation"]}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {prophets.filter((prophet) => prophet.era === "pre-flood").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {eraLabels["pre-flood"]}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent-text)]">
                  {prophets.filter((prophet) => prophet.era === "patriarchal").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {eraLabels["patriarchal"]}
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[var(--accent)]">
                  {prophets.filter((prophet) => prophet.era === "israelite").length}
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  {eraLabels["israelite"]}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
