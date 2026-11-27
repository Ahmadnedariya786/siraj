import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext-new";
import { useContentLanguage, translateIslamicText } from "@/lib/content-translator";
import { ReaderTagChips } from "@/components/BookReaderControls";
import type { SeerahChapterSummary } from "@/lib/seerah";

interface SeerahChapterCardProps {
  chapter: SeerahChapterSummary;
  onClick: () => void;
  index: number;
}

export function SeerahChapterCard({ chapter, onClick, index }: SeerahChapterCardProps) {
  const { t } = useLanguage();
  const { contentLang, isRtl } = useContentLanguage();
  const [translatedTitle, setTranslatedTitle] = useState(chapter.title);

  useEffect(() => {
    if (contentLang === 'en') {
      setTranslatedTitle(chapter.title);
      return;
    }
    let isMounted = true;
    translateIslamicText(chapter.title, contentLang).then((val) => {
      if (isMounted) setTranslatedTitle(val);
    });
    return () => { isMounted = false; };
  }, [chapter.title, contentLang]);

  const periodLabels: Record<SeerahChapterSummary["period"], string> = {
    "pre-prophethood": contentLang === 'ur' ? 'قبل از نبوت' : contentLang === 'gu' ? 'નબુવ્વત પહેલાં' : t("seerahPeriodPreProphethood"),
    makkan: contentLang === 'ur' ? 'مکی دور' : contentLang === 'gu' ? 'મક્કી દોર' : t("seerahPeriodMakkan"),
    madinan: contentLang === 'ur' ? 'مدنی دور' : contentLang === 'gu' ? 'મદની દોર' : t("seerahPeriodMadinan"),
    "final-days": contentLang === 'ur' ? 'آخری ایام' : contentLang === 'gu' ? 'આખરી દિવસો' : t("seerahPeriodFinalDays"),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.25) }}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-[var(--surface)] rounded-[22px] p-4 cursor-pointer border border-[var(--border)] hover:border-[var(--accent)]/50 transition-all duration-200 space-y-2.5"
    >
      <div className="flex items-center justify-between gap-2">
        {/* Royal Restyled Chapter Medallion */}
        <div
          className="w-10 h-10 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0"
          style={{
            backgroundImage: 'radial-gradient(circle at center, var(--accent-soft) 0%, transparent 72%)',
          }}
        >
          <span className="text-[var(--accent-text)] font-bold text-sm font-mono">{chapter.number}</span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border period-chip-${chapter.period} ${
            contentLang === 'ur' ? 'font-urdu' : ''
          }`}
        >
          {periodLabels[chapter.period]}
        </span>
      </div>

      <h3
        className={`text-[var(--text-primary)] font-semibold text-base line-clamp-2 leading-snug ${
          contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'
        }`}
        dir="auto"
        style={{ unicodeBidi: 'plaintext' }}
      >
        {translatedTitle}
      </h3>

      <p className="font-arabic text-lg text-[var(--accent-text)] text-right truncate" dir="rtl">
        {chapter.arabicTitle}
      </p>

      {chapter.tags.length > 0 && (
        <ReaderTagChips
          tags={chapter.tags}
          contentLang={contentLang}
          limit={3}
          moreLabel={t("more")}
        />
      )}
    </motion.div>
  );
}
