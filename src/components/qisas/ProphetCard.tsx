import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext-new";
import { useContentLanguage, translateIslamicText } from "@/lib/content-translator";
import { ReaderTagChips } from "@/components/BookReaderControls";
import { type ProphetSummary, PROPHET_NAME_TRANSLATIONS, PROPHET_SUBTITLE_TRANSLATIONS } from "@/lib/qisas";

interface ProphetCardProps {
  prophet: ProphetSummary;
  onClick: () => void;
  index: number;
  variant?: 'grid' | 'list';
}

export function ProphetCard({ prophet, onClick, index, variant = 'grid' }: ProphetCardProps) {
  const { t } = useLanguage();
  const { contentLang, isRtl } = useContentLanguage();

  const curatedName = (contentLang === 'ur' || contentLang === 'gu')
    ? PROPHET_NAME_TRANSLATIONS[prophet.id]?.[contentLang]
    : null;
  const curatedTitle = (contentLang === 'ur' || contentLang === 'gu')
    ? PROPHET_SUBTITLE_TRANSLATIONS[prophet.id]?.[contentLang]
    : null;

  const [translatedName, setTranslatedName] = useState(curatedName || prophet.name);
  const [translatedTitle, setTranslatedTitle] = useState(curatedTitle || prophet.title);

  useEffect(() => {
    if (contentLang === 'en') {
      setTranslatedName(prophet.name);
      setTranslatedTitle(prophet.title);
      return;
    }
    if (curatedName && curatedTitle) {
      setTranslatedName(curatedName);
      setTranslatedTitle(curatedTitle);
      return;
    }

    let isMounted = true;
    Promise.all([
      curatedName ? Promise.resolve(curatedName) : translateIslamicText(prophet.name, contentLang),
      curatedTitle ? Promise.resolve(curatedTitle) : translateIslamicText(prophet.title, contentLang),
    ]).then(([tName, tTitle]) => {
      if (isMounted) {
        setTranslatedName(tName);
        setTranslatedTitle(tTitle);
      }
    });
    return () => { isMounted = false; };
  }, [prophet.id, prophet.name, prophet.title, contentLang, curatedName, curatedTitle]);

  const eraLabels: Record<ProphetSummary["era"], string> = {
    "beginning-of-creation": contentLang === 'ur' ? 'ابتدائے آفرینش' : contentLang === 'gu' ? 'શરૂઆતનો સમય' : t("qisasEraBeginning"),
    "pre-flood": contentLang === 'ur' ? 'طوفانِ نوح سے قبل' : contentLang === 'gu' ? 'નૂહ પૂર પહેલાં' : t("qisasEraPreFlood"),
    patriarchal: contentLang === 'ur' ? 'دورِ ابراہیمی' : contentLang === 'gu' ? 'ઇબ્રાહીમ દોર' : t("qisasEraPatriarchal"),
    israelite: contentLang === 'ur' ? 'بنی اسرائیل کا دور' : contentLang === 'gu' ? 'ઇઝરાયલી દોર' : t("qisasEraIsraelite"),
    "post-israelite": contentLang === 'ur' ? 'مابعد بنی اسرائیل' : contentLang === 'gu' ? 'અન્ય પયગંબરો' : t("qisasEraPostIsraelite"),
  };

  const visibleMentions = prophet.quranMentions.slice(0, 2);
  const extraMentions = Math.max(0, prophet.quranMentions.length - visibleMentions.length);

  if (variant === 'list') {
    return (
      <div
        onClick={onClick}
        className="bg-[var(--surface)] rounded-2xl p-3 cursor-pointer border border-[var(--border)] hover:border-[var(--accent)]/45 active:scale-[0.99] transition-all duration-150 flex items-center gap-3"
      >
        <div
          className="w-16 h-12 rounded-xl border border-[var(--border)] flex items-center justify-center shrink-0"
          style={{
            backgroundColor: 'var(--surface-2)',
            backgroundImage: 'radial-gradient(circle at 50% 50%, var(--accent-soft) 0%, transparent 72%)',
          }}
        >
          <span
            className="font-arabic leading-none text-center"
            dir="rtl"
            style={{ color: 'var(--accent-text)', fontSize: '20px' }}
          >
            {prophet.arabicName}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`text-[var(--text-primary)] font-semibold text-sm line-clamp-1 ${
                contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'
              }`}
              dir="auto"
              style={{ unicodeBidi: 'plaintext' }}
            >
              {translatedName}
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0 era-chip-${prophet.era} ${
                contentLang === 'ur' ? 'font-urdu' : ''
              }`}
            >
              {eraLabels[prophet.era]}
            </span>
          </div>
          <p
            className={`text-[var(--text-secondary)] text-xs line-clamp-1 ${
              contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'
            }`}
            dir="auto"
            style={{ unicodeBidi: 'plaintext' }}
          >
            {translatedTitle}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="bg-[var(--surface)] rounded-[22px] p-3.5 cursor-pointer border border-[var(--border)] hover:border-[var(--accent)]/45 hover:scale-[1.01] active:scale-[0.98] transition-all duration-150 space-y-2"
    >
      {/* Compact Calligraphy Panel: surface-2 + accent-soft radial wash, Arabic name in accent-text 20px */}
      <div
        className="w-full h-11 rounded-xl border border-[var(--border)] flex items-center justify-between px-3"
        style={{
          backgroundColor: 'var(--surface-2)',
          backgroundImage: 'radial-gradient(circle at 50% 50%, var(--accent-soft) 0%, transparent 72%)',
        }}
      >
        <span className="text-[11px] font-mono font-bold text-[var(--text-secondary)]">
          #{prophet.number}
        </span>
        <span
          className="font-arabic leading-none"
          dir="rtl"
          style={{ color: 'var(--accent-text)', fontSize: '20px' }}
        >
          {prophet.arabicName}
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border era-chip-${prophet.era} ${
            contentLang === 'ur' ? 'font-urdu' : ''
          }`}
        >
          {eraLabels[prophet.era]}
        </span>
      </div>

      <div>
        <h3
          className={`text-[var(--text-primary)] font-semibold text-base line-clamp-1 leading-snug ${
            contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'
          }`}
          dir="auto"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {translatedName}
        </h3>
        <p
          className={`text-[var(--text-secondary)] text-xs line-clamp-1 ${
            contentLang === 'ur' ? 'font-urdu text-right' : isRtl ? 'font-arabic text-right' : 'text-left'
          }`}
          dir="auto"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {translatedTitle}
        </p>
      </div>

      {prophet.quranMentions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1">
          {visibleMentions.map((mention) => (
            <span
              key={mention}
              className="px-1.5 py-0.5 rounded text-[10px] border border-[var(--border)] bg-[var(--accent-soft)] text-[var(--accent-text)] font-mono"
            >
              {mention}
            </span>
          ))}
          {extraMentions > 0 && (
            <span className="text-[10px] text-[var(--text-secondary)]">
              +{extraMentions} {t("more")}
            </span>
          )}
        </div>
      )}

      {prophet.tags.length > 0 && (
        <ReaderTagChips
          tags={prophet.tags}
          contentLang={contentLang}
          limit={2}
          moreLabel={t("more")}
        />
      )}
    </div>
  );
}
