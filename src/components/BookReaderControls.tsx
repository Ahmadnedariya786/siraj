/**
 * Unified "Aa" Book Reader Controls Sheet + Status Banner + Formatted Islamic Prose Components
 * Shared across Hadith, Seerah, and Prophets Readers (`siraj_reader_prefs_v1`).
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, RefreshCw, RotateCcw, WifiOff, X } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import {
  CONTENT_LANGUAGES,
  type ContentLang,
  useContentLanguage,
} from '@/lib/content-translator';
import {
  type ReaderLineSpacing,
  useBookReaderPrefs,
  splitInlineHonorifics,
  getReaderBlockDirection,
  getReaderLineHeight,
} from '@/lib/reader-typography';

const SPACING_OPTIONS: { id: ReaderLineSpacing; label: string }[] = [
  { id: 'compact', label: 'Compact' },
  { id: 'standard', label: 'Standard' },
  { id: 'relaxed', label: 'Relaxed' },
];

export function AaReaderControlsButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { prefs, updatePrefs, resetPrefs } = useBookReaderPrefs();
  const { contentLang, setContentLang } = useContentLanguage();

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
            className="w-full max-w-[calc(100vw-16px)] sm:max-w-md rounded-2xl border border-[var(--border)] shadow-2xl overflow-hidden"
            style={{ background: 'var(--surface)', color: 'var(--text-primary)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[var(--accent-soft)] border border-[var(--border)] flex items-center justify-center text-xs font-extrabold text-[var(--accent-text)]">
                  Aa
                </span>
                <div>
                  <h4 className="text-sm font-bold text-[var(--text-primary)] leading-tight">
                    Book Reader Controls
                  </h4>
                  <p className="text-[11px] text-[var(--text-secondary)]">
                    Applies cleanly across Hadith, Seerah & Prophets
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close reader settings"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--surface-2)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
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
                        style={active ? {
                          background: 'var(--accent)',
                          color: 'var(--on-accent)',
                        } : {
                          background: 'transparent',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {opt.nativeLabel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Body Font Size Slider (13px - 21px) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Body Font Size</span>
                  <span className="font-mono font-bold text-[var(--accent-text)]">{prefs.bodyFontSize}px</span>
                </div>
                <Slider
                  value={[prefs.bodyFontSize]}
                  min={13}
                  max={21}
                  step={1}
                  onValueChange={([v]) => updatePrefs({ bodyFontSize: v })}
                  className="cursor-pointer"
                />
              </div>

              {/* Arabic Font Size Slider (16px - 26px) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[var(--text-primary)]">Arabic Text Size</span>
                  <span className="font-mono font-bold text-[var(--accent-text)]">{prefs.arabicFontSize}px</span>
                </div>
                <Slider
                  value={[prefs.arabicFontSize]}
                  min={16}
                  max={26}
                  step={1}
                  onValueChange={([v]) => updatePrefs({ arabicFontSize: v })}
                  className="cursor-pointer"
                />
              </div>

              {/* Line Spacing */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Line Spacing
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {SPACING_OPTIONS.map((opt) => {
                    const active = prefs.lineSpacing === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => updatePrefs({ lineSpacing: opt.id })}
                        className="py-2 px-2 rounded-xl text-xs font-semibold border transition-colors"
                        style={active ? {
                          background: 'var(--accent-soft)',
                          borderColor: 'var(--accent)',
                          color: 'var(--accent-text)',
                        } : {
                          background: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
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
  fontSize: number;
  lineSpacing: ReaderLineSpacing;
  className?: string;
}

export function BookProseParagraph({
  text,
  actualLang,
  fontSize,
  lineSpacing,
  className = '',
}: BookProseParagraphProps) {
  const { dir, textAlignClass, textAlign } = getReaderBlockDirection(actualLang);
  const lineHeight = getReaderLineHeight(actualLang, lineSpacing);
  const isUrdu = actualLang === 'ur';

  return (
    <p
      dir={dir}
      className={`${textAlignClass} ${isUrdu ? 'font-urdu' : ''} break-words ${className}`}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight,
        marginBottom: '14px',
        textAlign,
        fontFamily: isUrdu ? 'var(--font-urdu)' : undefined,
      }}
    >
      <FormattedIslamicText text={text} />
    </p>
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
            Showing English (Offline) — Connect once to translate & save in {targetName}
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
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] border border-[var(--border)] text-[var(--accent-text)]">
          <Check className="w-3 h-3" />
          {source === 'scholar-edition' ? 'Scholar Urdu ✓' : 'Translated Offline ✓'}
        </span>
      )}

      {isStreaming && totalChunks > 0 && (
        <div className="w-full px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-xs font-medium text-[var(--accent-text)]">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent)]" />
            Translating chapter to {targetName}... {doneChunks}/{totalChunks}
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
