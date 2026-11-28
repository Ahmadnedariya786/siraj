import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
import { X, Heart, Volume2, VolumeX, Copy, Check, Share2, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useToast } from '@/hooks/use-toast';
import type { ContentLang } from '@/lib/content-translator';
import { NAMES_UI_I18N, type AsmaNameItem } from '@/components/NamesOfAllahData';

interface NamesDetailModalProps {
  selectedName: AsmaNameItem | null;
  contentLang: ContentLang;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (number: number) => void;
  onPrev: () => void;
  onNext: () => void;
  totalCount: number;
  currentIndex: number;
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const NamesDetailModal: React.FC<NamesDetailModalProps> = memo(({
  selectedName,
  contentLang,
  isFavorite,
  onClose,
  onToggleFavorite,
  onPrev,
  onNext,
  totalCount,
  currentIndex,
}) => {
  const { toast } = useToast();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isOpen = Boolean(selectedName);
  const isUrdu = contentLang === 'ur';
  const ui = NAMES_UI_I18N[contentLang] || NAMES_UI_I18N.en;
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance === 'function';

  useBodyScrollLock(isOpen);

  const stopSpeech = useCallback(() => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (err) {
      console.debug('[NamesDetailModal] speech cancel skipped:', err);
    }
    setIsSpeaking(false);
  }, []);

  // 150ms scale-fade entrance + focus restoration
  useEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      stopSpeech();
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const rafId = requestAnimationFrame(() => {
      setIsVisible(true);
      closeBtnRef.current?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(rafId);
      stopSpeech();
      previousFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [isOpen, stopSpeech]);

  // Reset transient copied/speaking state when switching Prev/Next name
  useEffect(() => {
    setCopied(false);
    stopSpeech();
  }, [selectedName?.number, stopSpeech]);

  // Keyboard Escape + Focus Trap + Arrow Left/Right
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && panelRef.current) {
        const focusables = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        ).filter((el) => el.offsetParent !== null);

        if (focusables.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (e.shiftKey) {
          if (active === first || !panelRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !panelRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Android hardware back button closes modal without exiting page
  useEffect(() => {
    if (!isOpen || !Capacitor.isNativePlatform()) return;

    let subscribed = true;
    let backHandle: { remove: () => Promise<void> } | null = null;

    CapacitorApp.addListener('backButton', () => {
      if (subscribed) {
        onClose();
      }
    })
      .then((h) => {
        if (subscribed) {
          backHandle = h;
        } else {
          h.remove().catch((err) => console.debug('[NamesDetailModal] backHandle remove:', err));
        }
      })
      .catch((err) => console.debug('[NamesDetailModal] backButton listener skipped:', err));

    return () => {
      subscribed = false;
      backHandle?.remove().catch((err) => console.debug('[NamesDetailModal] backHandle cleanup:', err));
    };
  }, [isOpen, onClose]);

  const handlePlayAudio = useCallback(() => {
    if (!selectedName) return;
    if (!speechSupported) {
      toast({
        title: selectedName.transliteration,
        description: ui.audioUnsupported,
      });
      return;
    }

    if (isSpeaking) {
      stopSpeech();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(selectedName.arabic);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.85;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.debug('[NamesDetailModal] speech playback failed:', err);
      setIsSpeaking(false);
      toast({
        title: selectedName.transliteration,
        description: ui.audioUnsupported,
      });
    }
  }, [isSpeaking, selectedName, speechSupported, stopSpeech, toast, ui.audioUnsupported]);

  const handleCopy = useCallback(async () => {
    if (!selectedName) return;
    const loc = selectedName[contentLang] || selectedName.en;
    const text = `${selectedName.number}. ${selectedName.arabic} (${selectedName.transliteration})\n${loc.meaning}\n${loc.reflection}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: ui.copied, description: selectedName.transliteration });
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      console.debug('[NamesDetailModal] clipboard copy skipped:', err);
    }
  }, [contentLang, selectedName, toast, ui.copied]);

  const handleShare = useCallback(async () => {
    if (!selectedName) return;
    const loc = selectedName[contentLang] || selectedName.en;
    const title = `${selectedName.arabic} • ${selectedName.transliteration}`;
    const text = `${selectedName.number}. ${selectedName.arabic} (${selectedName.transliteration})\n${loc.meaning}\n\n${loc.reflection}\n\n— Siraj`;

    try {
      if (Capacitor.isNativePlatform()) {
        await Share.share({ title, text, dialogTitle: title });
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      toast({ title: ui.copied, description: selectedName.transliteration });
    } catch (err) {
      console.debug('[NamesDetailModal] share cancelled or fallback:', err);
    }
  }, [contentLang, selectedName, toast, ui.copied]);

  if (!selectedName || typeof document === 'undefined') return null;

  const localized = selectedName[contentLang] || selectedName.en;
  const displayIndex = currentIndex >= 0 ? currentIndex + 1 : selectedName.number;
  const displayTotal = totalCount > 0 ? totalCount : 99;

  const modalNode = (
    <div
      data-testid="names-detail-portal"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        background: 'rgba(0, 0, 0, 0.72)',
        opacity: isVisible ? 1 : 0,
        transition: 'opacity 150ms ease-out',
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="name-detail-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[340px] max-h-[84dvh] overflow-y-auto rounded-[28px] outline-none select-none"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65), inset 0 1px 0 var(--card-sheen-line, var(--card-sheen))',
          transform: isVisible ? 'scale(1)' : 'scale(0.95)',
          opacity: isVisible ? 1 : 0,
          transition: 'transform 150ms ease-out, opacity 150ms ease-out',
          willChange: 'transform, opacity',
        }}
      >
        {/* Top Calligraphy Banner (Opaque var(--surface-2)) */}
        <div
          className="relative px-4 pt-4 pb-6 text-center border-b"
          style={{
            background: 'var(--surface-2)',
            borderColor: 'var(--border)',
          }}
        >
          {/* Top bar: Number medallion + crisp 40px Close button */}
          <div className="flex items-center justify-between mb-3">
            <span
              dir="ltr"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full text-sm font-extrabold tabular-nums border"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--border)',
                color: 'var(--accent-text)',
              }}
            >
              {selectedName.number}
            </span>

            <span
              dir="ltr"
              className="text-[11px] font-bold tracking-wider uppercase tabular-nums px-2.5 py-1 rounded-full border"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-secondary)',
              }}
            >
              {displayIndex} / {displayTotal}
            </span>

            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              aria-label={ui.close}
              className="w-10 h-10 rounded-full flex items-center justify-center border transition-transform active:scale-95 cursor-pointer"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Arabic Calligraphy (zero letter-spacing) */}
          <h2
            id="name-detail-title"
            dir="rtl"
            className="text-5xl font-arabic font-bold leading-[1.6] py-1"
            style={{
              color: 'var(--accent)',
              letterSpacing: '0px',
            }}
          >
            {selectedName.arabic}
          </h2>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Transliteration & Localized Meaning (stacked cleanly in flex-col gap-1) */}
          <div className="flex flex-col items-center text-center gap-1">
            <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--accent-text)' }}>
              <span className={isUrdu ? 'font-urdu tracking-normal text-xs' : ''}>
                {ui.attributeLabel}
              </span>
              <span dir="ltr" className="tabular-nums">#{selectedName.number}</span>
            </div>

            <h3
              dir="ltr"
              className="text-2xl font-bold font-serif leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {selectedName.transliteration}
            </h3>

            <p
              dir={isUrdu ? 'rtl' : 'ltr'}
              className={`text-sm font-bold leading-snug ${isUrdu ? 'font-urdu text-base leading-[2.1] text-center' : ''}`}
              style={{ color: 'var(--accent-text)' }}
            >
              {localized.meaning}
            </p>
          </div>

          {/* Localized Reflection Box */}
          <div
            className="rounded-2xl p-4 border relative"
            dir={isUrdu ? 'rtl' : 'ltr'}
            style={{
              background: 'var(--bg-elev)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider ${isUrdu ? 'font-urdu tracking-normal text-xs' : ''}`}
                style={{ color: 'var(--text-secondary)' }}
              >
                {ui.reflectionLabel}
              </span>
              <Info className="w-3.5 h-3.5 shrink-0 opacity-70" style={{ color: 'var(--accent)' }} />
            </div>
            <p
              className={`text-sm leading-relaxed font-medium break-words ${
                isUrdu ? 'font-urdu text-right text-[15px] leading-[2.3]' : 'text-left'
              }`}
              style={{ color: 'var(--text-primary)' }}
            >
              {localized.reflection}
            </p>
          </div>

          {/* Action Row: Favorite, Audio, Copy, Share */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => onToggleFavorite(selectedName.number)}
              aria-label={ui.favoritesFilterLabel}
              className="h-10 rounded-xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              style={{
                background: isFavorite ? 'var(--accent-soft)' : 'var(--surface-2)',
                borderColor: isFavorite ? 'var(--accent)' : 'var(--border)',
                color: isFavorite ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
            </button>

            <button
              type="button"
              onClick={handlePlayAudio}
              aria-label={isSpeaking ? ui.stop : ui.listen}
              title={speechSupported ? (isSpeaking ? ui.stop : ui.listen) : ui.audioUnsupported}
              className="h-10 rounded-xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              style={{
                background: isSpeaking ? 'var(--accent-soft)' : 'var(--surface-2)',
                borderColor: isSpeaking ? 'var(--accent)' : 'var(--border)',
                color: isSpeaking ? 'var(--accent)' : 'var(--text-primary)',
                opacity: speechSupported ? 1 : 0.65,
              }}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleCopy}
              aria-label={ui.copy}
              className="h-10 rounded-xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                borderColor: copied ? 'var(--accent)' : 'var(--border)',
                color: copied ? 'var(--accent)' : 'var(--text-primary)',
              }}
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={handleShare}
              aria-label={ui.share}
              className="h-10 rounded-xl border flex items-center justify-center transition-transform active:scale-95 cursor-pointer"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          {/* Prev / Next Name Switcher */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={onPrev}
              className={`h-11 rounded-2xl border px-3 flex items-center justify-center gap-1.5 font-bold text-xs transition-transform active:scale-95 cursor-pointer ${
                isUrdu ? 'font-urdu text-sm' : ''
              }`}
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <ChevronLeft className="w-4 h-4 shrink-0" />
              <span>{ui.prev}</span>
            </button>

            <button
              type="button"
              onClick={onNext}
              className={`h-11 rounded-2xl px-3 flex items-center justify-center gap-1.5 font-bold text-xs transition-transform active:scale-95 cursor-pointer ${
                isUrdu ? 'font-urdu text-sm' : ''
              }`}
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
              }}
            >
              <span>{ui.next}</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
});

NamesDetailModal.displayName = 'NamesDetailModal';

export default NamesDetailModal;
