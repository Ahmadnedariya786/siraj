/**
 * Siraj — Global Persistent Tilawah Floating Mini-Player Dock
 *
 * Renders an elevated floating jewel capsule in the bottom thumb zone above the bottom navigation bar.
 * Zero collision with Android system status bar.
 * Follows the user across all app routes with ergonomic one-handed controls.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTilawah } from '@/contexts/TilawahContext';
import { getPageForSurahAndAyah } from '@/lib/interactive-mushaf';
import { useLanguage } from '@/contexts/LanguageContext-new';
import { useToast } from '@/hooks/use-toast';
import { formatSajdahString, getSajdahI18n } from '@/lib/sajdah-i18n';
import {
  addPendingSajdah,
  formatAyahRef,
  logImmediateSajdah,
  undoLastSajdahAction,
  type SajdahUndoSnapshot,
} from '@/lib/sajdah-tracker';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  BookOpen,
  X,
  Loader2,
} from 'lucide-react';

export const GlobalTilawahBar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { toast } = useToast();
  const sajdahStrings = useMemo(() => getSajdahI18n(language), [language]);

  const {
    isBarVisible,
    isPlayerOpen,
    isPlaying,
    isLoading,
    currentSurah,
    currentAyah,
    surahInfo,
    reciter,
    progressPercent,
    togglePlay,
    nextAyah,
    prevAyah,
    openPlayer,
    dismissBar,
    sajdahAudioPrompt,
    dismissSajdahPrompt,
  } = useTilawah();

  const triggerAudioUndoToast = (msg: string, snap: SajdahUndoSnapshot) => {
    const h = toast({
      duration: 5000,
      description: (
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-xs font-medium">{msg}</span>
          <button
            type="button"
            onClick={() => {
              undoLastSajdahAction(snap);
              h.dismiss();
              toast({ duration: 2000, title: sajdahStrings.toastUndone });
            }}
            className="px-2 py-0.5 rounded text-[11px] font-bold shrink-0 cursor-pointer"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {sajdahStrings.undoBtn}
          </button>
        </div>
      ),
    });
  };

  const isQuranReader = useMemo(() => {
    return /^\/quran\/.+/.test(location.pathname);
  }, [location.pathname]);

  // Touch gesture handling: swipe-down (deltaY > 40px) to dismiss, swipe-up (deltaY < -40px) to open full player
  const touchStartY = useRef<number | null>(null);
  const touchDeltaY = useRef<number>(0);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchDeltaY.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartY.current === null) return;
    touchDeltaY.current = e.touches[0].clientY - touchStartY.current;
  };

  const handleTouchEnd = () => {
    if (touchStartY.current !== null) {
      if (touchDeltaY.current > 40) {
        // Swiped down -> dismiss floating dock
        dismissBar();
      } else if (touchDeltaY.current < -40) {
        // Swiped up -> open full Tilawah player
        openPlayer();
      }
    }
    touchStartY.current = null;
    touchDeltaY.current = 0;
  };

  const shouldShow =
    isBarVisible &&
    !isPlayerOpen &&
    currentSurah > 0 &&
    currentAyah > 0;

  // Manage dynamic bottom dock spacing CSS variable
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (shouldShow) {
        document.documentElement.style.setProperty('--tilawah-dock-space', '68px');
      } else {
        document.documentElement.style.setProperty('--tilawah-dock-space', '0px');
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.style.setProperty('--tilawah-dock-space', '0px');
      }
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  const ayahMushafPage = getPageForSurahAndAyah(currentSurah, currentAyah);

  const handleOpenReader = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/quran/surah-${currentSurah}?page=${ayahMushafPage}&ayah=${currentAyah}`, {
      replace: false,
    });
  };

  const handleTogglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlay();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    nextAyah();
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    prevAyah();
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    dismissBar();
  };

  // Bottom offset: 80px above floating BottomNav on regular pages, 74px above Mushaf footer on /quran/:id
  const bottomOffset = isQuranReader
    ? 'calc(74px + env(safe-area-inset-bottom, 0px))'
    : 'calc(80px + env(safe-area-inset-bottom, 0px))';

  return (
    <aside
      role="region"
      aria-label="Quran Tilawah Mini Player"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="fixed z-[60] left-3 right-3 max-w-lg mx-auto print:hidden select-none animate-in fade-in slide-in-from-bottom-3 duration-200 overflow-hidden"
      style={{
        bottom: bottomOffset,
        minHeight: '58px',
        backgroundColor: 'var(--bg-elev)',
        border: '1px solid var(--accent)',
        borderRadius: '18px',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.55), 0 0 16px var(--accent-glow)',
      }}
    >
      {sajdahAudioPrompt && (
        <div
          data-testid="tilawah-sajdah-chip"
          className="px-2.5 py-1.5 border-b flex items-center justify-between gap-1.5 flex-wrap"
          style={{
            backgroundColor: 'var(--accent-soft)',
            borderColor: 'var(--border)',
          }}
        >
          <span className="text-[11px] font-bold text-[var(--accent-text)] inline-flex items-center gap-1 min-w-0 truncate">
            <span aria-hidden="true">۩</span>
            <span className="truncate">
              {sajdahStrings.tilawahChipPrompt}{' '}
              <bdi dir="ltr">{formatAyahRef(sajdahAudioPrompt)}</bdi>
            </span>
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const snap = logImmediateSajdah(sajdahAudioPrompt.id, 'listen');
                const ref = formatAyahRef(sajdahAudioPrompt);
                dismissSajdahPrompt();
                triggerAudioUndoToast(
                  formatSajdahString(sajdahStrings.toastImmediateLogged, { ref }),
                  snap,
                );
              }}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer whitespace-nowrap"
              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
            >
              {sajdahStrings.tilawahDone}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const snap = addPendingSajdah(sajdahAudioPrompt.id, 'listen', 1);
                const ref = formatAyahRef(sajdahAudioPrompt);
                dismissSajdahPrompt();
                triggerAudioUndoToast(
                  formatSajdahString(sajdahStrings.toastAddedPending, { ref }),
                  snap,
                );
              }}
              className="px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer whitespace-nowrap"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {sajdahStrings.tilawahTrack}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                dismissSajdahPrompt();
              }}
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer whitespace-nowrap"
            >
              {sajdahStrings.tilawahNotNow}
            </button>
          </div>
        </div>
      )}
      <div className="relative w-full h-[58px] px-2.5 flex items-center justify-between gap-2 overflow-hidden">
        {/* Left: Tappable Info Area (opens TilawahPlayerModal) */}
        <div
          onClick={openPlayer}
          role="button"
          tabIndex={0}
          className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer group"
          title="Open Full Tilawah Player"
        >
          {/* Sleek 8px Pulsing Accent Indicator Dot */}
          <div className="relative flex items-center justify-center shrink-0 ml-1 mr-0.5">
            <span
              className={`w-2 h-2 rounded-full ${isPlaying ? 'animate-pulse' : ''}`}
              style={{
                backgroundColor: 'var(--accent)',
                boxShadow: isPlaying ? '0 0 8px var(--accent)' : 'none',
              }}
            />
          </div>

          {/* 2-Line Crisp Reference & Reciter */}
          <div className="flex flex-col min-w-0 flex-1 truncate">
            <span
              className="text-xs font-bold truncate group-hover:text-[var(--accent-text)] transition-colors leading-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              {surahInfo?.englishName || `Surah ${currentSurah}`} • {currentSurah}:{currentAyah}
            </span>
            <span
              className="text-[10px] text-[var(--text-secondary)] font-medium truncate mt-0.5"
            >
              {reciter.shortName} • Tap to expand
            </span>
          </div>
        </div>

        {/* Right: Thumb-Friendly Tightened Control Buttons */}
        <div className="flex items-center shrink-0" style={{ gap: '3px' }}>
          {/* Previous Ayah (30px) */}
          <button
            type="button"
            onClick={handlePrev}
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-transform active:scale-95 text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            title="Previous Ayah"
            aria-label="Previous Ayah"
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          {/* Prominent Circular Play / Pause Jewel (36px) */}
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={isLoading}
            className="w-[36px] h-[36px] rounded-full flex items-center justify-center transition-transform active:scale-90 text-[var(--on-accent)] shadow-md"
            style={{
              backgroundColor: 'var(--accent)',
              boxShadow: '0 0 10px var(--accent-glow)',
            }}
            title={isPlaying ? 'Pause Recitation' : 'Play Recitation'}
            aria-label={isPlaying ? 'Pause Recitation' : 'Play Recitation'}
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-3.5 h-3.5 fill-current" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            )}
          </button>

          {/* Next Ayah (30px) */}
          <button
            type="button"
            onClick={handleNext}
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-transform active:scale-95 text-[var(--text-primary)] hover:bg-[var(--surface-2)]"
            title="Next Ayah"
            aria-label="Next Ayah"
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>

          {/* Open Mushaf Reader at exact Ayah (30px - hidden when already on /quran/:id!) */}
          {!isQuranReader && (
            <button
              type="button"
              onClick={handleOpenReader}
              className="w-[30px] h-[30px] rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--surface-2)] text-[var(--accent-text)]"
              title={`Read Ayah in Mushaf (Page ${ayahMushafPage})`}
              aria-label="Read in Mushaf"
            >
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Dismiss Mini-Player (28px) */}
          <button
            type="button"
            onClick={handleDismiss}
            className="w-[28px] h-[28px] rounded-lg flex items-center justify-center transition-colors hover:bg-rose-500/10 text-[var(--text-secondary)] hover:text-rose-400"
            title="Close Tilawah Player"
            aria-label="Close Tilawah Player"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Bottom Progress Hairline */}
        <div
          className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden"
          style={{ backgroundColor: 'var(--surface-2)' }}
        >
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${Math.min(100, Math.max(0, progressPercent))}%`,
              backgroundColor: 'var(--accent)',
            }}
          />
        </div>
      </div>
    </aside>
  );
};
