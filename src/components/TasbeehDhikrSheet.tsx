import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus, Sparkles, X } from "lucide-react";

export interface DhikrPresetItem {
  value: string;
  label: string;
  transliteration: string;
  translation: string;
  target?: number;
}

export interface CustomDhikrConfig {
  label: string;
  transliteration: string;
  target: number;
}

interface TasbeehDhikrSheetProps {
  open: boolean;
  presets: DhikrPresetItem[];
  selectedValue: string;
  customDhikr: CustomDhikrConfig | null;
  language: string;
  onSelectPreset: (value: string) => void;
  onSaveCustom: (config: CustomDhikrConfig) => void;
  onClose: () => void;
}

const SHEET_COPY: Record<
  "en" | "ur" | "gu",
  {
    title: string;
    customSection: string;
    arabicPlaceholder: string;
    namePlaceholder: string;
    targetLabel: string;
    applyCustom: string;
    editCustom: string;
    targetPrefix: string;
  }
> = {
  en: {
    title: "Select Dhikr",
    customSection: "Custom Dhikr",
    arabicPlaceholder: "Arabic (optional)",
    namePlaceholder: "Dhikr name or phrase",
    targetLabel: "Target",
    applyCustom: "Use Custom Dhikr",
    editCustom: "Add / Edit Custom Dhikr",
    targetPrefix: "×",
  },
  ur: {
    title: "ذکر منتخب کریں",
    customSection: "اپنا ذکر شامل کریں",
    arabicPlaceholder: "عربی عبارت (اختیاری)",
    namePlaceholder: "ذکر کا نام لکھیں",
    targetLabel: "تعداد",
    applyCustom: "ذکر استعمال کریں",
    editCustom: "نیا یا ذاتی ذکر شامل کریں",
    targetPrefix: "×",
  },
  gu: {
    title: "ઝિક્ર પસંદ કરો",
    customSection: "કસ્ટમ ઝિક્ર",
    arabicPlaceholder: "અરબી (વૈકલ્પિક)",
    namePlaceholder: "ઝિક્રનું નામ લખો",
    targetLabel: "લક્ષ્ય",
    applyCustom: "કસ્ટમ ઝિક્ર વાપરો",
    editCustom: "કસ્ટમ ઝિક્ર ઉમેરો / બદલો",
    targetPrefix: "×",
  },
};

export function TasbeehDhikrSheet({
  open,
  presets,
  selectedValue,
  customDhikr,
  language,
  onSelectPreset,
  onSaveCustom,
  onClose,
}: TasbeehDhikrSheetProps) {
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customArabic, setCustomArabic] = useState(customDhikr?.label || "");
  const [customName, setCustomName] = useState(customDhikr?.transliteration || "");
  const [customTarget, setCustomTarget] = useState(String(customDhikr?.target || 33));

  const langKey: "en" | "ur" | "gu" =
    language === "ur" || language === "gu" ? language : "en";
  const isUrdu = langKey === "ur";
  const copy = SHEET_COPY[langKey];

  useEffect(() => {
    if (!open) {
      setShowCustomForm(false);
      return;
    }

    setCustomArabic(customDhikr?.label || "");
    setCustomName(customDhikr?.transliteration || "");
    setCustomTarget(String(customDhikr?.target || 33));

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, customDhikr, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = customName.trim();
    const trimmedArabic = customArabic.trim();
    if (!trimmedName && !trimmedArabic) return;

    const parsedTarget = Math.max(1, Math.min(10000, parseInt(customTarget, 10) || 33));
    onSaveCustom({
      label: trimmedArabic || trimmedName,
      transliteration: trimmedName || trimmedArabic,
      target: parsedTarget,
    });
    setShowCustomForm(false);
    onClose();
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      data-state="open"
      data-testid="tasbeeh-dhikr-sheet-portal"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12px",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
        background: "rgba(0, 0, 0, 0.72)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[360px] max-h-[70dvh] overflow-y-auto rounded-3xl flex flex-col"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
        }}
      >
        {/* Sheet Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
          }}
        >
          <h2 className={`text-sm font-bold text-[var(--text-primary)] ${isUrdu ? "font-urdu text-base" : ""}`}>
            {copy.title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform cursor-pointer shrink-0"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Presets & Custom Dhikr List */}
        <div className="p-3 space-y-2">
          {presets.map((preset) => {
            const isSelected = selectedValue === preset.value;
            const targetCount = preset.target ?? 33;
            return (
              <button
                key={preset.value}
                type="button"
                onClick={() => {
                  onSelectPreset(preset.value);
                  onClose();
                }}
                className="w-full text-start rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
                style={{
                  background: isSelected ? "var(--accent-soft)" : "var(--surface-2)",
                  border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                }}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <p
                    dir="rtl"
                    className="font-arabic text-base font-bold leading-[1.6] break-words text-right"
                    style={{ color: "var(--accent-text)" }}
                  >
                    {preset.label}
                  </p>
                  <p className="text-xs font-medium break-words leading-snug text-[var(--text-secondary)]">
                    {preset.transliteration}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    dir="ltr"
                    className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums"
                    style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--accent-text)",
                    }}
                  >
                    {copy.targetPrefix}{targetCount}
                  </span>
                  {isSelected ? (
                    <Check className="w-4 h-4 text-[var(--accent)]" />
                  ) : null}
                </div>
              </button>
            );
          })}

          {/* Saved Custom Dhikr (if configured) */}
          {customDhikr ? (
            <button
              type="button"
              onClick={() => {
                onSelectPreset("custom");
                onClose();
              }}
              className="w-full text-start rounded-2xl p-3 flex items-center gap-3 active:scale-[0.99] transition-transform cursor-pointer"
              style={{
                background: selectedValue === "custom" ? "var(--accent-soft)" : "var(--surface-2)",
                border: `1px solid ${selectedValue === "custom" ? "var(--accent)" : "var(--border)"}`,
              }}
            >
              <div className="flex-1 min-w-0 space-y-1">
                <p
                  dir="rtl"
                  className="font-arabic text-base font-bold leading-[1.6] break-words text-right"
                  style={{ color: "var(--accent-text)" }}
                >
                  {customDhikr.label}
                </p>
                <p className="text-xs font-medium break-words text-[var(--text-secondary)]">
                  {customDhikr.transliteration} ({copy.customSection})
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span
                  dir="ltr"
                  className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--accent-text)",
                  }}
                >
                  {copy.targetPrefix}{customDhikr.target}
                </span>
                {selectedValue === "custom" ? (
                  <Check className="w-4 h-4 text-[var(--accent)]" />
                ) : null}
              </div>
            </button>
          ) : null}

          {/* Add / Edit Custom Dhikr Option */}
          {!showCustomForm ? (
            <button
              type="button"
              data-testid="tasbeeh-custom-dhikr-btn"
              onClick={() => setShowCustomForm(true)}
              className="w-full rounded-2xl p-3 flex items-center justify-center gap-2 text-xs font-bold cursor-pointer active:scale-[0.99] transition-transform"
              style={{
                background: "var(--surface-2)",
                border: "1px dashed var(--accent)",
                color: "var(--accent-text)",
              }}
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>{copy.editCustom}</span>
            </button>
          ) : (
            <form
              onSubmit={handleCustomSubmit}
              className="rounded-2xl p-3 space-y-2.5"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--accent-text)]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{copy.customSection}</span>
              </div>

              <input
                type="text"
                dir="rtl"
                placeholder={copy.arabicPlaceholder}
                value={customArabic}
                onChange={(e) => setCustomArabic(e.target.value)}
                className="w-full rounded-xl px-3 py-2 text-sm focus:outline-none"
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              />

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={copy.namePlaceholder}
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="flex-1 min-w-0 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
                <input
                  type="number"
                  min={1}
                  max={10000}
                  aria-label={copy.targetLabel}
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  className="w-20 rounded-xl px-2.5 py-2 text-sm text-center tabular-nums focus:outline-none"
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-xl py-2 text-xs font-bold cursor-pointer active:scale-95 transition-transform"
                style={{
                  background: "var(--accent)",
                  color: "var(--on-accent)",
                }}
              >
                {copy.applyCustom}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
