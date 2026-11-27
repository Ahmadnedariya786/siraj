/**
 * Unified "Aa" Book Reader Controls Sheet + Royal E-Book Prose Components
 * Shared across Hadith, Seerah, Prophets, and Daily Hadith Readers (`siraj_reader_prefs_v1`).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDown, Check, Copy, RefreshCw, RotateCcw, WifiOff, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CONTENT_LANGUAGES,
  type ContentLang,
  useContentLanguage,
  getCachedTagsSync,
  translateTagsBatch,
} from '@/lib/content-translator';
import {
  BODY_SIZE_MIN,
  BODY_SIZE_MAX,
  ARABIC_SIZE_MIN,
  ARABIC_SIZE_MAX,
  PARAGRAPH_SPACING_EM,
  READER_HEADING_SCALE,
  READER_PRESETS,
  type ReaderLineHeightMode,
  type ReaderLineSpacing,
  type ReaderPresetId,
  useBookReaderPrefs,
  useNastaliqFontReady,
  splitInlineHonorifics,
  getReaderBlockDirection,
  getReaderLineHeight,
  getArabicLineHeight,
  getReaderFontFamily,
  formatIslamicProse,
} from '@/lib/reader-typography';

const SPACING_OPTIONS: { id: ReaderLineHeightMode; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'standard', label: 'Standard' },
  { id: 'relaxed', label: 'Relaxed' },
];

const PRESET_ORDER: Array<Exclude<ReaderPresetId, 'custom'>> = [
  'comfortable',
  'compact',
  'large-print',
];

const LIVE_PREVIEW_SAMPLE: Record<ContentLang, { arabic: string; body: string }> = {
  en: {
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    body: 'Allah (SWT) rewards sincere intention, as Prophet Muhammad (ﷺ) taught in the opening tradition.',
  },
  ur: {
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    body: 'اعمال کا دارومدار نیتوں پر ہے، اور اللہ (سبحانہ و تعالیٰ) اخلاصِ نیت کے مطابق اجر عطا فرماتا ہے۔',
  },
  gu: {
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    body: 'અમલોનો આધાર નિયત પર છે, અને Allah (SWT) નિખાલસ નિયત મુજબ બદલો આપે છે.',
  },
  hi: {
    arabic: 'إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ',
    body: 'अमल का दारोमदार नीयत पर है, और Allah (SWT) सच्ची नीयत के मुताबिक़ बदला अता फ़रमाता है।',
  },
};

export function AaReaderControlsButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { prefs, updatePrefs, applyPreset, resetPrefs } = useBookReaderPrefs();
  const { contentLang, setContentLang } = useContentLanguage();
  const previewSample = LIVE_PREVIEW_SAMPLE[contentLang] || LIVE_PREVIEW_SAMPLE.en;
  const previewDir = getReaderBlockDirection(contentLang);
  const previewLineHeight = getReaderLineHeight(contentLang, prefs.lineHeightMode);
  const previewFontFamily = getReaderFontFamily(contentLang);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reader Typography Settings"
        title="Typography & Language (Aa)"
        className={`h-8 px-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] text-xs font-bold tracking-tight inline-flex items-center justify-center shrink-0 hover:border-[var(--accent)] active:scale-95 transition-colors ${className}`}
      >
        Aa
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Reader Typography Controls"
          className="fixed inset-0 flex items-end sm:items-center justify-center p-2 sm:p-4"
          style={{ zIndex: 99999, background: 'rgba(0, 0, 0, 0.72)' }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-[calc(100vw-16px)] sm:max-w-md max-h-[88dvh] flex flex-col rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
            style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] border border-[var(--border)] flex items-center justify-center text-xs font-extrabold text-[var(--accent-text)] shrink-0">
                  Aa
                </span>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight truncate">
                    Book Reader Controls
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)] truncate">
                    Unified across Hadith, Seerah &amp; Prophets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close reader settings"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-2)] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 overflow-y-auto sheet-scroll-contain">
              {/* Reading Presets */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                    Reading Presets
                  </label>
                  {prefs.preset === 'custom' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--border)]">
                      Custom
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_ORDER.map((presetId) => {
                    const preset = READER_PRESETS[presetId];
                    const active = prefs.preset === presetId;
                    return (
                      <button
                        key={presetId}
                        type="button"
                        onClick={() => applyPreset(presetId)}
                        className="py-2 px-2 rounded-xl text-xs font-semibold border transition-colors text-center"
                        style={
                          active
                            ? {
                                background: 'var(--accent)',
                                borderColor: 'var(--accent)',
                                color: 'var(--on-accent)',
                              }
                            : {
                                background: 'var(--surface-2)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-secondary)',
                              }
                        }
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Language Switcher */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Reading Language
                </label>
                <div className="grid grid-cols-4 gap-1.5 p-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)]">
                  {CONTENT_LANGUAGES.map((opt) => {
                    const active = contentLang === opt.code;
                    return (
                      <button
                        key={opt.code}
                        type="button"
                        onClick={() => setContentLang(opt.code)}
                        className="py-1.5 px-1 rounded-lg text-xs font-semibold transition-colors text-center"
                        style={
                          active
                            ? {
                                background: 'var(--accent)',
                                color: 'var(--on-accent)',
                              }
                            : {
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                              }
                        }
                      >
                        {opt.nativeLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body Font Size Slider (13px - 18px) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Body Font Size</span>
                  <span className="font-mono font-bold text-[var(--accent-text)]">{prefs.bodySize}px</span>
                </div>
                <Slider
                  value={[prefs.bodySize]}
                  min={BODY_SIZE_MIN}
                  max={BODY_SIZE_MAX}
                  step={1}
                  onValueChange={([v]) => updatePrefs({ bodySize: v })}
                  className="cursor-pointer"
                />
              </div>

              {/* Arabic Font Size Slider (18px - 30px) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Arabic Text Size</span>
                  <span className="font-mono font-bold text-[var(--accent-text)]">{prefs.arabicSize}px</span>
                </div>
                <Slider
                  value={[prefs.arabicSize]}
                  min={ARABIC_SIZE_MIN}
                  max={ARABIC_SIZE_MAX}
                  step={1}
                  onValueChange={([v]) => updatePrefs({ arabicSize: v })}
                  className="cursor-pointer"
                />
              </div>

              {/* Line Spacing */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Line Spacing ({contentLang === 'ur' ? 'RTL Nastaliq' : 'LTR'} {previewLineHeight})
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SPACING_OPTIONS.map((opt) => {
                    const active = prefs.lineHeightMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePrefs({ lineHeightMode: opt.id })}
                        className="py-2 px-2 rounded-xl text-xs font-semibold border transition-colors"
                        style={
                          active
                            ? {
                                background: 'var(--accent-soft)',
                                borderColor: 'var(--accent)',
                                color: 'var(--accent-text)',
                              }
                            : {
                                background: 'var(--surface-2)',
                                borderColor: 'var(--border)',
                                color: 'var(--text-secondary)',
                              }
                        }
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LIVE Preview Paragraph */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Live Reader Preview
                </label>
                <div
                  data-testid="reader-live-preview"
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-elev)] p-3 space-y-2.5"
                >
                  <p
                    className="font-arabic reader-arabic-block text-[var(--accent-text)] break-words"
                    dir="rtl"
                    style={{
                      fontSize: `${prefs.arabicSize}px`,
                      lineHeight: getArabicLineHeight(prefs.lineHeightMode),
                      textAlign: 'right',
                      unicodeBidi: 'plaintext',
                    }}
                  >
                    {previewSample.arabic}
                  </p>
                  <p
                    dir={previewDir.dir}
                    className={`reader-prose-block text-[var(--text-primary)] ${
                      contentLang === 'ur' ? 'font-urdu' : ''
                    }`}
                    style={{
                      fontSize: `${prefs.bodySize}px`,
                      lineHeight: previewLineHeight,
                      marginBottom: 0,
                      textAlign: previewDir.textAlign,
                      unicodeBidi: previewDir.unicodeBidi,
                      fontFamily: previewFontFamily,
                    }}
                  >
                    <FormattedIslamicText text={previewSample.body} />
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={resetPrefs}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] py-1.5 px-2.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="py-1.5 px-4 rounded-xl text-xs font-bold"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Renders Islamic prose text cleanly, ensuring ﷺ / صلى الله عليه وسلم inline ligatures
 * never stretch line-height gaps between lines.
 */
export function FormattedIslamicText({ text }: { text: string }) {
  const tokens = splitInlineHonorifics(text);
  return (
    <>
      {tokens.map((tok, idx) =>
        tok.isHonorificGlyph ? (
          <span
            key={idx}
            style={{
              fontSize: '0.95em',
              lineHeight: 1,
              display: 'inline',
              verticalAlign: 'baseline',
              fontFamily: 'var(--font-arabic-amiri), Amiri, serif',
            }}
          >
            {tok.value}
          </span>
        ) : (
          <React.Fragment key={idx}>{tok.value}</React.Fragment>
        )
      )}
    </>
  );
}

export interface BookProseParagraphProps {
  text: string;
  actualLang: ContentLang;
  fontSize?: number;
  lineSpacing?: ReaderLineSpacing;
  className?: string;
}

export function BookProseParagraph({
  text,
  actualLang,
  fontSize,
  lineSpacing,
  className = '',
}: BookProseParagraphProps) {
  const { prefs } = useBookReaderPrefs();
  const fontReady = useNastaliqFontReady(actualLang);
  const resolvedSize = fontSize ?? prefs.bodySize;
  const resolvedSpacing = lineSpacing ?? prefs.lineHeightMode;
  const { dir, textAlignClass, textAlign, unicodeBidi } = getReaderBlockDirection(actualLang);
  const lineHeight = getReaderLineHeight(actualLang, resolvedSpacing);
  const fontFamily = getReaderFontFamily(actualLang);
  const isUrdu = actualLang === 'ur';
  const sanitizedText = formatIslamicProse(text, actualLang);

  if (!fontReady && (actualLang === 'ur' || actualLang === 'hi')) {
    return (
      <div
        aria-busy="true"
        className="space-y-2 py-1"
        style={{ marginBottom: `${PARAGRAPH_SPACING_EM}em` }}
      >
        <div className="h-4 w-full rounded bg-[var(--surface-2)] animate-pulse" />
        <div className="h-4 w-11/12 rounded bg-[var(--surface-2)] animate-pulse" />
      </div>
    );
  }

  return (
    <p
      dir={dir}
      data-reader-prose="true"
      data-align={textAlign}
      className={`reader-prose-block ${textAlignClass} ${isUrdu ? 'font-urdu' : ''} break-words ${className}`}
      style={{
        fontSize: `${resolvedSize}px`,
        lineHeight,
        marginBottom: `${PARAGRAPH_SPACING_EM}em`,
        textAlign,
        unicodeBidi,
        fontFamily,
      }}
    >
      <FormattedIslamicText text={sanitizedText} />
    </p>
  );
}

export interface ReaderHeadingProps {
  level: 'h1' | 'h2' | 'h3';
  text: string;
  actualLang: ContentLang;
  clampTwoLines?: boolean;
  className?: string;
}

export function ReaderHeading({
  level,
  text,
  actualLang,
  clampTwoLines = level === 'h1',
  className = '',
}: ReaderHeadingProps) {
  const { dir, textAlignClass, textAlign, unicodeBidi } = getReaderBlockDirection(actualLang);
  const fontFamily = getReaderFontFamily(actualLang);
  const isUrdu = actualLang === 'ur';
  const fontSize = READER_HEADING_SCALE[level];
  const cleanText = formatIslamicProse(text, actualLang);

  const Tag = level;
  const spacingStyle =
    level === 'h1'
      ? { marginBottom: '0.35em', lineHeight: isUrdu ? 1.85 : 1.3 }
      : level === 'h2'
      ? { marginTop: '1.15em', marginBottom: '0.5em', lineHeight: isUrdu ? 1.9 : 1.35 }
      : { marginTop: '0.9em', marginBottom: '0.4em', lineHeight: isUrdu ? 1.9 : 1.35 };

  return (
    <Tag
      dir={dir}
      data-reader-heading={level}
      data-align={textAlign}
      className={`reader-heading font-bold text-[var(--text-primary)] ${textAlignClass} ${
        isUrdu ? 'font-urdu' : ''
      } ${clampTwoLines ? 'line-clamp-2' : ''} break-words ${className}`}
      style={{
        fontSize: `${fontSize}px`,
        textAlign,
        unicodeBidi,
        fontFamily,
        ...spacingStyle,
      }}
    >
      <FormattedIslamicText text={cleanText} />
    </Tag>
  );
}

export interface ReaderArabicBlockProps {
  text: string;
  arabicSize?: number;
  className?: string;
  onClick?: () => void;
}

export function ReaderArabicBlock({
  text,
  arabicSize,
  className = '',
  onClick,
}: ReaderArabicBlockProps) {
  const { prefs } = useBookReaderPrefs();
  if (!text || !text.trim()) {
    return null;
  }
  const resolvedSize = arabicSize ?? prefs.arabicSize;

  return (
    <div
      onClick={onClick}
      className={`my-3.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] border-r-[3px] border-r-[var(--accent)] ${
        onClick ? 'cursor-pointer hover:border-[var(--accent)]' : ''
      } ${className}`}
      style={{ padding: '12px' }}
    >
      <p
        className="font-arabic reader-arabic-block text-[var(--accent-text)] break-words"
        dir="rtl"
        data-reader-arabic="true"
        style={{
          fontSize: `${resolvedSize}px`,
          lineHeight: getArabicLineHeight(prefs.lineHeightMode),
          textAlign: 'right',
          unicodeBidi: 'plaintext',
        }}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * BiDi-isolated renderer for mixed Latin + Arabic titles so RTL tokens never flip
 * or reorder surrounding English phrases (e.g. "Merits of Dhikr / فضل الذكر").
 */
export function MixedBidiTitle({
  latin,
  arabic,
  separator = ' ',
  className = '',
}: {
  latin?: string;
  arabic?: string;
  separator?: string;
  className?: string;
}) {
  const cleanLatin = (latin || '').trim();
  const cleanArabic = (arabic || '').trim();
  if (!cleanLatin && !cleanArabic) return null;

  return (
    <span className={className}>
      {cleanLatin && (
        <bdi dir="ltr" style={{ unicodeBidi: 'isolate' }}>
          {cleanLatin}
        </bdi>
      )}
      {cleanLatin && cleanArabic && <span aria-hidden="true">{separator}</span>}
      {cleanArabic && (
        <bdi
          dir="rtl"
          className="font-arabic"
          style={{ unicodeBidi: 'isolate', direction: 'rtl' }}
        >
          {cleanArabic}
        </bdi>
      )}
    </span>
  );
}

/**
 * Compact monospace footnote citations rendered cleanly under multi-paragraph
 * hadiths (such as Hisnul Muslim numbered Quran & Hadith references).
 */
export function HadithFootnotesBlock({ footnotes }: { footnotes: string[] }) {
  if (!footnotes || footnotes.length === 0) return null;
  return (
    <aside
      data-testid="hadith-footnotes"
      aria-label="Hadith References"
      dir="ltr"
      style={{ unicodeBidi: 'isolate' }}
      className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] px-3 py-2.5 space-y-1 text-[11px] font-mono leading-relaxed text-[var(--text-secondary)] text-left"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--accent-text)]">
        References
      </p>
      {footnotes.map((note, idx) => (
        <p key={idx} className="break-words">
          {note}
        </p>
      ))}
    </aside>
  );
}

export function ChapterOpenerOrnament({
  badgeText,
  arabicSubtitle,
}: {
  badgeText: string;
  arabicSubtitle?: string;
}) {
  return (
    <div
      className="my-3 px-3.5 py-2.5 rounded-2xl border border-[var(--border)] bg-[var(--accent-soft)] flex items-center justify-between gap-3"
      aria-label={badgeText}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Sharia-safe 8-point khatam medallion */}
        <div
          className="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--accent-text)]"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="6" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
            <rect
              x="6"
              y="6"
              width="12"
              height="12"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.7"
              transform="rotate(45 12 12)"
            />
            <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          </svg>
        </div>
        <span className="text-xs font-bold tracking-wide text-[var(--accent-text)] truncate">
          {badgeText}
        </span>
      </div>
      {arabicSubtitle && (
        <span
          dir="rtl"
          className="font-arabic text-sm text-[var(--accent-text)] shrink-0"
          style={{ unicodeBidi: 'plaintext' }}
        >
          {arabicSubtitle}
        </span>
      )}
    </div>
  );
}

export function ReaderContinueChip({
  progressPct,
  label = 'Continue',
  onContinue,
}: {
  progressPct?: number;
  label?: string;
  onContinue: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onContinue}
      className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-[var(--accent-soft)] border border-[var(--accent)]/40 text-[var(--accent-text)] hover:border-[var(--accent)] active:scale-95 transition-colors"
    >
      <ArrowDown className="w-3.5 h-3.5 text-[var(--accent)]" />
      <span>{label}</span>
      {typeof progressPct === 'number' && progressPct > 0 && (
        <span className="font-mono text-[11px] opacity-85">· {Math.round(progressPct)}%</span>
      )}
    </button>
  );
}

export function ReaderTagChips({
  tags,
  contentLang,
  limit,
  moreLabel = 'more',
}: {
  tags: string[];
  contentLang: ContentLang;
  limit?: number;
  moreLabel?: string;
}) {
  const visibleTags = useMemo(
    () => (typeof limit === 'number' ? tags.slice(0, limit) : tags),
    [tags, limit]
  );
  const extraCount = typeof limit === 'number' ? Math.max(0, tags.length - limit) : 0;

  const [labels, setLabels] = useState<Array<string | null>>(() =>
    getCachedTagsSync(visibleTags, contentLang).labels
  );

  useEffect(() => {
    const syncState = getCachedTagsSync(visibleTags, contentLang);
    setLabels(syncState.labels);
    if (syncState.allReady || contentLang === 'en' || visibleTags.length === 0) {
      return;
    }

    let active = true;
    translateTagsBatch(visibleTags, contentLang)
      .then((res) => {
        if (active) setLabels(res.labels);
      })
      .catch((err) => console.debug('Tag translation skipped:', err));
    return () => {
      active = false;
    };
  }, [visibleTags, contentLang]);

  if (visibleTags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTags.map((tag, idx) => {
        const label = labels[idx];
        if (!label) {
          return (
            <span
              key={`${tag}-skel-${idx}`}
              aria-hidden="true"
              data-testid="tag-skeleton-chip"
              className="inline-block h-5 w-14 rounded-full bg-[var(--surface-2)] border border-[var(--border)] animate-pulse"
            />
          );
        }
        return (
          <span
            key={`${tag}-${idx}`}
            dir="auto"
            style={{ unicodeBidi: 'plaintext' }}
            className={`px-2 py-0.5 rounded-full text-[11px] border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-secondary)] ${
              contentLang === 'ur' ? 'font-urdu' : ''
            }`}
          >
            {label}
          </span>
        );
      })}
      {extraCount > 0 && (
        <span className="px-2 py-0.5 rounded-full text-[11px] text-[var(--text-secondary)]">
          +{extraCount} {moreLabel}
        </span>
      )}
    </div>
  );
}

export function CopyHadithMenuButton({
  onCopyMode,
  copied = false,
  compact = false,
  className = '',
}: {
  onCopyMode: (mode: 'arabic' | 'translation' | 'both') => void;
  copied?: boolean;
  compact?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title="Copy options (Arabic / Translation / Both)"
          aria-label="Copy hadith options"
          className={`inline-flex items-center justify-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--accent)] active:scale-95 transition-colors ${
            compact ? 'h-8 w-8' : 'h-7 px-2.5 text-xs font-medium'
          } ${className}`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--success)]" /> : <Copy className="w-3.5 h-3.5" />}
          {!compact && <span>Copy</span>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(e) => e.stopPropagation()}
        className="w-40 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)] shadow-xl"
      >
        <DropdownMenuItem
          onClick={() => onCopyMode('arabic')}
          className="cursor-pointer rounded-lg text-xs font-medium focus:bg-[var(--accent-soft)] focus:text-[var(--accent-text)]"
        >
          Copy Arabic
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onCopyMode('translation')}
          className="cursor-pointer rounded-lg text-xs font-medium focus:bg-[var(--accent-soft)] focus:text-[var(--accent-text)]"
        >
          Copy Translation
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onCopyMode('both')}
          className="cursor-pointer rounded-lg text-xs font-medium focus:bg-[var(--accent-soft)] focus:text-[var(--accent-text)]"
        >
          Copy Both
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface ReaderStatusBannerProps {
  targetLang: ContentLang;
  actualLang?: ContentLang;
  fromCache: boolean;
  source?: 'scholar-edition' | 'chunked-api' | 'original';
  offlineFallback: boolean;
  isStreaming: boolean;
  doneChunks?: number;
  totalChunks?: number;
  onRetry?: () => void;
}

export function ReaderStatusBanner({
  targetLang,
  fromCache,
  source,
  offlineFallback,
  isStreaming,
  doneChunks = 0,
  totalChunks = 0,
  onRetry,
}: ReaderStatusBannerProps) {
  if (targetLang === 'en') return null;

  const targetMeta = CONTENT_LANGUAGES.find((l) => l.code === targetLang);
  const targetName = targetMeta?.label || targetLang.toUpperCase();

  if (offlineFallback) {
    return (
      <div
        className="mb-4 px-3.5 py-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 flex items-center justify-between gap-2.5"
        role="status"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-xs text-[var(--text-primary)] leading-snug">
            Showing English (Offline) — Connect once to translate &amp; save in {targetName}
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--accent)] text-[var(--on-accent)] active:scale-95"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
      {(fromCache || source === 'scholar-edition') && !isStreaming && (
        <span
          data-testid="offline-ready-chip"
          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] border border-[var(--border)] text-[var(--accent-text)]"
        >
          <Check className="w-3 h-3" />
          {source === 'scholar-edition' ? 'Scholar Urdu · Offline ready' : 'Offline ready'}
        </span>
      )}

      {isStreaming && totalChunks > 0 && (
        <div className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--accent-text)]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
            Translating to {targetName}… {doneChunks}/{totalChunks}
          </span>
          <div className="w-20 h-1.5 rounded-full bg-black/30 overflow-hidden shrink-0">
            <div
              className="h-full bg-[var(--accent)] transition-all duration-200"
              style={{ width: `${Math.min(100, Math.round((doneChunks / totalChunks) * 100))}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
