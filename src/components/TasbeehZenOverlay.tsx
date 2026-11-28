import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { RotateCcw, Smartphone, Volume2, VolumeX, X } from "lucide-react";

export type ZenFeedbackMode = "all" | "vibrate" | "silent";

interface TapRipple {
  id: number;
  x: number;
  y: number;
}

interface TasbeehZenOverlayProps {
  open: boolean;
  count: number;
  targetGoal: number;
  progress: number;
  setNumber: number;
  isChainMode: boolean;
  chainStepIndex: number;
  nextChainPreview?: string;
  dhikrArabic: string;
  dhikrTransliteration: string;
  feedbackMode: ZenFeedbackMode;
  language: string;
  exitLabel: string;
  setLabel: string;
  resetLabel: string;
  soundLabel: string;
  vibrateLabel: string;
  muteLabel: string;
  onIncrement: () => void;
  onExit: () => void;
  onReset: () => void;
  onCycleFeedback: () => void;
}

const ZEN_UI_COPY: Record<
  "en" | "ur" | "gu",
  { tapHint: string; infinite: string; setPrefix: string; nextPrefix: string }
> = {
  en: {
    tapHint: "Tap anywhere to count",
    infinite: "Infinite",
    setPrefix: "Set",
    nextPrefix: "Next",
  },
  ur: {
    tapHint: "گننے کے لیے کہیں بھی چھوئیں",
    infinite: "لامحدود",
    setPrefix: "سیٹ",
    nextPrefix: "اگلا",
  },
  gu: {
    tapHint: "ગણવા માટે ગમે ત્યાં ટૅપ કરો",
    infinite: "અનંત",
    setPrefix: "સેટ",
    nextPrefix: "આગળ",
  },
};

const RING_SIZE = 208;
const RING_RADIUS = 94;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MULTI_TOUCH_BOUNCE_GUARD_MS = 80;

export function TasbeehZenOverlay({
  open,
  count,
  targetGoal,
  progress,
  setNumber,
  isChainMode,
  chainStepIndex,
  nextChainPreview,
  dhikrArabic,
  dhikrTransliteration,
  feedbackMode,
  language,
  exitLabel,
  setLabel,
  resetLabel,
  soundLabel,
  vibrateLabel,
  muteLabel,
  onIncrement,
  onExit,
  onReset,
  onCycleFeedback,
}: TasbeehZenOverlayProps) {
  const [ripples, setRipples] = useState<TapRipple[]>([]);
  const lastTapTimeRef = useRef<number>(0);
  const rippleIdRef = useRef<number>(0);
  const rippleTimersRef = useRef<number[]>([]);

  const langKey: "en" | "ur" | "gu" =
    language === "ur" || language === "gu" ? language : "en";
  const isUrdu = langKey === "ur";
  const copy = ZEN_UI_COPY[langKey];

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExit();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onExit]);

  useEffect(() => {
    const timers = rippleTimersRef.current;
    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      timers.length = 0;
    };
  }, []);

  const handleZenTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const now = Date.now();
      if (now - lastTapTimeRef.current < MULTI_TOUCH_BOUNCE_GUARD_MS) {
        return;
      }
      lastTapTimeRef.current = now;

      const x = e.clientX || window.innerWidth / 2;
      const y = e.clientY || window.innerHeight / 2;
      const id = ++rippleIdRef.current;

      setRipples((prev) => [...prev.slice(-4), { id, x, y }]);
      const timerId = window.setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 420);
      rippleTimersRef.current.push(timerId);

      onIncrement();
    },
    [onIncrement]
  );

  if (!open || typeof document === "undefined") {
    return null;
  }

  const lapValue =
    targetGoal === Infinity
      ? count
      : count > 0 && count % targetGoal === 0
        ? targetGoal
        : count % targetGoal;
  const dashOffset =
    RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * Math.max(0, Math.min(100, progress))) / 100;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Zen Tasbih Mode"
      data-state="open"
      data-testid="tasbeeh-zen-portal"
      onClick={handleZenTap}
      className="select-none"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: "#06070A",
        backgroundImage:
          "radial-gradient(circle at 50% 44%, var(--accent-soft, rgba(212,175,55,0.14)) 0%, rgba(6,7,10,0.98) 65%)",
        color: "var(--text-primary, #FFFFFF)",
        paddingTop: "calc(16px + env(safe-area-inset-top, 0px))",
        paddingBottom: "calc(20px + env(safe-area-inset-bottom, 0px))",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        touchAction: "manipulation",
      }}
    >
      <style>{`
        @keyframes zenTapRipple {
          0% {
            transform: translate3d(-50%, -50%, 0) scale(0.25);
            opacity: 0.45;
          }
          100% {
            transform: translate3d(-50%, -50%, 0) scale(2.1);
            opacity: 0;
          }
        }
        .tasbeeh-zen-ripple {
          position: fixed;
          width: 96px;
          height: 96px;
          border-radius: 9999px;
          border: 1.5px solid var(--accent, #D4AF37);
          background: var(--accent-soft, rgba(212,175,55,0.16));
          pointer-events: none;
          will-change: transform, opacity;
          animation: zenTapRipple 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      {/* Lightweight GPU Pointer Tap Ripples */}
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden="true"
          className="tasbeeh-zen-ripple"
          style={{ left: `${r.x}px`, top: `${r.y}px` }}
        />
      ))}

      {/* Top Subtle Header */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-4 w-full max-w-md mx-auto relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-3 py-1.5 rounded-full text-xs font-semibold truncate max-w-[62%]"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border, rgba(255,255,255,0.14))",
            color: "var(--text-secondary, #B9C2D0)",
          }}
        >
          {isChainMode ? (
            <span>
              {copy.setPrefix} <span dir="ltr">{chainStepIndex + 1}/6</span>
              {nextChainPreview ? ` • ${copy.nextPrefix}: ${nextChainPreview}` : ""}
            </span>
          ) : (
            <span>
              {setLabel}{" "}
              <span dir="ltr" className="font-bold" style={{ color: "var(--accent, #D4AF37)" }}>
                {setNumber}
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="zen-feedback-toggle"
          onClick={(e) => {
            e.stopPropagation();
            onCycleFeedback();
          }}
          className="min-h-[36px] px-3 py-1.5 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 active:scale-95 transition-transform cursor-pointer shrink-0"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border, rgba(255,255,255,0.14))",
            color: "var(--text-primary, #FFFFFF)",
          }}
        >
          {feedbackMode === "all" && (
            <>
              <Volume2 className="w-3.5 h-3.5" style={{ color: "var(--accent, #D4AF37)" }} />
              <span>{soundLabel}</span>
            </>
          )}
          {feedbackMode === "vibrate" && (
            <>
              <Smartphone className="w-3.5 h-3.5" style={{ color: "var(--accent, #D4AF37)" }} />
              <span>{vibrateLabel}</span>
            </>
          )}
          {feedbackMode === "silent" && (
            <>
              <VolumeX className="w-3.5 h-3.5" style={{ color: "var(--text-secondary, #B9C2D0)" }} />
              <span style={{ color: "var(--text-secondary, #B9C2D0)" }}>{muteLabel}</span>
            </>
          )}
        </button>
      </div>

      {/* Center Tap Zone */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-6 w-full max-w-md mx-auto relative z-10">
        <p
          dir="rtl"
          className="text-2xl sm:text-3xl font-bold font-arabic mb-2 text-center leading-[1.6] break-words w-full"
          style={{ color: "var(--accent, #D4AF37)" }}
        >
          {dhikrArabic}
        </p>

        <p
          className="text-sm opacity-75 mb-6 text-center max-w-[320px] break-words leading-snug"
          style={{ color: "var(--text-primary, #FFFFFF)" }}
        >
          {dhikrTransliteration}
        </p>

        {/* Clean Circular Progress Ring (w-52 h-52 = 208px) */}
        <div className="relative w-52 h-52 flex items-center justify-center shrink-0 pointer-events-none">
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          >
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="rgba(255,255,255,0.03)"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={7}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_RADIUS}
              fill="transparent"
              stroke="var(--accent, #D4AF37)"
              strokeWidth={7}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              style={{ transition: "stroke-dashoffset 0.25s ease-out" }}
            />
          </svg>

          <span
            data-testid="zen-count-readout"
            className="font-black leading-none tabular-nums select-none"
            style={{
              fontSize: "clamp(44px, 14vw, 68px)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--text-primary, #FFFFFF)",
            }}
          >
            <span dir="ltr">{count}</span>
          </span>
        </div>

        {/* Goal Chip Below Ring */}
        <div
          className="mt-4 px-3.5 py-1 rounded-full text-xs font-bold"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid var(--border, rgba(255,255,255,0.14))",
            color: "var(--accent-text, var(--accent, #D4AF37))",
          }}
        >
          <span dir="ltr" className="tabular-nums">
            {targetGoal === Infinity ? `${count} • ${copy.infinite}` : `${lapValue} / ${targetGoal}`}
          </span>
        </div>

        <p
          className={`mt-2.5 text-xs opacity-60 text-center ${isUrdu ? "font-urdu text-sm" : ""}`}
          style={{ color: "var(--text-secondary, #B9C2D0)" }}
        >
          {copy.tapHint}
        </p>
      </div>

      {/* Bottom One-Handed Controls */}
      <div
        className="shrink-0 flex items-center justify-center gap-3 px-4 pt-2 relative z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid="zen-exit-btn"
          onClick={(e) => {
            e.stopPropagation();
            onExit();
          }}
          className="min-h-[44px] px-5 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
          style={{
            backgroundColor: "rgba(255,255,255,0.10)",
            border: "1px solid var(--border, rgba(255,255,255,0.18))",
            color: "var(--text-primary, #FFFFFF)",
          }}
        >
          <X className="w-4 h-4 shrink-0" />
          <span>{exitLabel.replace(/^✕\s*/, "")}</span>
        </button>

        <button
          type="button"
          data-testid="zen-reset-btn"
          aria-label={resetLabel}
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          className="w-11 h-11 min-h-[44px] min-w-[44px] rounded-full inline-flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
          style={{
            backgroundColor: "rgba(255,255,255,0.08)",
            border: "1px solid var(--border, rgba(255,255,255,0.18))",
            color: "var(--accent, #D4AF37)",
          }}
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
