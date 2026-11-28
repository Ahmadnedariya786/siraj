/**
 * Mystery Box UI Component
 * Subscribed to unified useQuizEconomy store with <= 800ms reveal timing,
 * crisp Lucide icons, and theme-token portal reveal modal (`createPortal(..., document.body)`).
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { mysteryBoxSystem, MYSTERY_BOXES, BoxOpeningResult } from '@/lib/mystery-box';
import { useQuizEconomy } from '@/lib/quiz-economy';
import { feedbackSystem } from '@/lib/feedback-system';
import { QuizLucideIcon } from '@/components/quiz/QuizLucideIcon';
import {
  ArrowLeft,
  Coins,
  Gift,
  Package,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MysteryBoxPanelProps {
  onClose: () => void;
}

export function MysteryBoxPanel({ onClose }: MysteryBoxPanelProps) {
  const { xp, totalBoxesOpened, canClaimFreeBox } = useQuizEconomy();
  const { toast } = useToast();
  const [selectedBox, setSelectedBox] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);
  const [results, setResults] = useState<BoxOpeningResult[] | null>(null);
  const [timeUntilNext, setTimeUntilNext] = useState(() => mysteryBoxSystem.getTimeUntilNextBox());

  useEffect(() => {
    setTimeUntilNext(mysteryBoxSystem.getTimeUntilNextBox());
    const interval = setInterval(() => {
      setTimeUntilNext(mysteryBoxSystem.getTimeUntilNextBox());
    }, 1000);
    return () => clearInterval(interval);
  }, [canClaimFreeBox]);

  const handleOpen = async (explicitBoxId?: string) => {
    const targetBoxId = explicitBoxId ?? selectedBox;
    if (!targetBoxId || isOpening) return;

    const targetBox = MYSTERY_BOXES.find((b) => b.id === targetBoxId);
    if (!targetBox) return;

    if (targetBox.id === 'daily_free_box' && !canClaimFreeBox) {
      toast({
        title: 'Daily Box Claimed',
        description: `Next free box available in ${timeUntilNext}.`,
      });
      return;
    }

    if (targetBox.cost > 0 && xp < targetBox.cost) {
      toast({
        title: 'Not Enough XP',
        description: `Need ${targetBox.cost - xp} XP more for ${targetBox.name}.`,
        variant: 'destructive',
      });
      return;
    }

    setSelectedBox(targetBoxId);
    setIsOpening(true);
    feedbackSystem.feedbackBoxOpen();

    // Keep box opening transition concise (<= 800ms)
    await new Promise((resolve) => setTimeout(resolve, 600));

    const result = mysteryBoxSystem.openBox(targetBoxId);
    if (result.success && result.results) {
      setResults(result.results);
    } else if (result.message) {
      toast({
        title: 'Unable to Open Box',
        description: result.message,
        variant: 'destructive',
      });
    }

    setIsOpening(false);
  };

  const handleCloseResults = () => {
    setResults(null);
    setSelectedBox(null);
  };

  const getRarityLabel = (rarity: string) => {
    switch (rarity) {
      case 'xp':
        return 'XP Bonus';
      case 'legendary':
        return 'Legendary';
      case 'epic':
        return 'Epic';
      case 'rare':
      case 'premium':
        return 'Premium';
      default:
        return 'Common';
    }
  };

  const selectedBoxObj = MYSTERY_BOXES.find((b) => b.id === selectedBox);
  const canAffordSelected = selectedBoxObj
    ? selectedBoxObj.id === 'daily_free_box'
      ? canClaimFreeBox
      : xp >= selectedBoxObj.cost
    : false;

  const openingPortal =
    isOpening && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            data-state="open"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backgroundColor: 'rgba(0,0,0,0.72)',
            }}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: [0.95, 1.06, 0.98, 1.04, 1], opacity: 1 }}
              transition={{ duration: 0.55 }}
              className="w-full max-w-[280px] rounded-2xl border p-6 text-center"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              <div
                className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3 border"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--accent)',
                  color: 'var(--accent-text)',
                }}
              >
                <Gift className="w-8 h-8" />
              </div>
              <p className="text-sm font-bold text-[var(--text-primary)]">
                Unlocking Mystery Box...
              </p>
            </motion.div>
          </div>,
          document.body
        )
      : null;

  const revealPortal =
    results && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            data-state="open"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backgroundColor: 'rgba(0,0,0,0.72)',
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-[336px] rounded-2xl border overflow-hidden shadow-xl"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              <div
                className="p-5 text-center border-b"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <div
                  className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 border"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    borderColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <Trophy className="w-7 h-7" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  Reward Unlocked
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Added directly to your Quiz account
                </p>
              </div>

              <div className="p-4 space-y-3">
                {results.map((result, idx) => (
                  <div
                    key={`${result.itemId}-${idx}`}
                    className="p-3 rounded-xl border flex items-center justify-between gap-2"
                    style={{
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          borderColor: 'var(--border)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <QuizLucideIcon id={result.itemId} className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                          {result.itemName}
                        </p>
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1.5 py-0 mt-0.5 border"
                          style={{
                            backgroundColor: 'var(--accent-soft)',
                            borderColor: 'var(--border)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          {getRarityLabel(result.rarity)}
                        </Badge>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-[var(--accent-text)] shrink-0">
                      {result.rarity === 'xp' ? `+${result.quantity} XP` : `x${result.quantity}`}
                    </span>
                  </div>
                ))}

                <div
                  className="px-3 py-2 rounded-xl border flex items-center justify-between text-xs"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--border)',
                  }}
                >
                  <span className="text-[var(--text-secondary)]">Total Boxes Opened</span>
                  <span className="font-bold text-[var(--text-primary)]">{totalBoxesOpened}</span>
                </div>

                <Button
                  data-testid="mystery-box-claim-continue"
                  onClick={handleCloseResults}
                  className="w-full font-semibold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--on-accent)',
                  }}
                >
                  Claim &amp; Continue
                </Button>
              </div>
            </motion.div>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      className="min-h-screen pb-[calc(var(--player-inset,0px)+24px)] bg-transparent relative z-10"
      style={{ background: 'transparent' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-40 sticky-glass-header safe-top border-b"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="max-w-lg mx-auto px-3 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to Quiz Lobby"
              onClick={onClose}
              className="w-9 h-9 rounded-full border shrink-0"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-[var(--text-primary)] leading-tight">
                Mystery Boxes
              </h1>
              <p className="text-xs text-[var(--text-secondary)] leading-tight">
                Open boxes for XP &amp; power-ups
              </p>
            </div>
          </div>

          <div
            data-testid="mystery-xp-balance"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border shrink-0"
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--accent)',
              color: 'var(--accent-text)',
            }}
          >
            <Coins className="w-4 h-4 shrink-0" />
            <span className="text-xs font-bold whitespace-nowrap">
              {xp.toLocaleString()} XP
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {/* Daily Free Box */}
        <Card
          className="overflow-hidden border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: canClaimFreeBox ? 'var(--accent)' : 'var(--border)',
          }}
        >
          <div
            className="p-3.5 border-b flex items-center justify-between gap-2"
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--border)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center border shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--border)',
                  color: 'var(--accent-text)',
                }}
              >
                <Gift className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm text-[var(--text-primary)] leading-tight">
                  Daily Free Box
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {canClaimFreeBox ? 'Ready to claim today' : `Next free box in ${timeUntilNext}`}
                </p>
              </div>
            </div>
            {canClaimFreeBox && (
              <Badge
                className="text-[10px] font-bold shrink-0"
                style={{
                  backgroundColor: 'var(--accent)',
                  color: 'var(--on-accent)',
                }}
              >
                FREE
              </Badge>
            )}
          </div>
          <CardContent className="p-3.5 space-y-2">
            <Button
              data-testid="open-daily-free-box"
              className="w-full font-semibold"
              style={
                canClaimFreeBox
                  ? {
                      backgroundColor: 'var(--accent)',
                      color: 'var(--on-accent)',
                    }
                  : {
                      backgroundColor: 'var(--surface-2)',
                      color: 'var(--text-secondary)',
                      borderColor: 'var(--border)',
                    }
              }
              disabled={!canClaimFreeBox || isOpening}
              onClick={() => handleOpen('daily_free_box')}
            >
              {canClaimFreeBox ? 'Open Free Box' : `Wait ${timeUntilNext}`}
            </Button>
            <p className="text-[11px] text-[var(--text-secondary)] text-center">
              Common 70% • Rare 25% • Legendary 5%
            </p>
          </CardContent>
        </Card>

        {/* Premium Boxes */}
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[var(--text-primary)]">
            <Package className="w-4 h-4 text-[var(--accent-text)]" />
            XP Mystery Boxes
          </h3>

          {MYSTERY_BOXES.filter((b) => b.id !== 'daily_free_box').map((box) => {
            const affordable = xp >= box.cost;
            const deficit = Math.max(0, box.cost - xp);

            return (
              <Card
                key={box.id}
                onClick={() => setSelectedBox(box.id)}
                className="cursor-pointer overflow-hidden border transition-all"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: selectedBox === box.id ? 'var(--accent)' : 'var(--border)',
                }}
              >
                <CardContent className="p-3.5">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0"
                      style={{
                        backgroundColor: 'var(--accent-soft)',
                        borderColor: 'var(--border)',
                        color: 'var(--accent-text)',
                      }}
                    >
                      <QuizLucideIcon id={box.id} className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                          {box.name}
                        </h4>
                        <span
                          className="text-xs font-bold shrink-0"
                          style={{
                            color: affordable ? 'var(--accent-text)' : 'var(--danger)',
                          }}
                        >
                          {box.cost} XP
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                        {box.description}
                      </p>
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <Badge
                          variant="secondary"
                          className="text-[11px] capitalize border"
                          style={{
                            backgroundColor: 'var(--surface-2)',
                            borderColor: 'var(--border)',
                            color: 'var(--text-primary)',
                          }}
                        >
                          {box.rarity}
                        </Badge>
                        {!affordable ? (
                          <span className="text-[11px] font-medium text-[var(--danger)]">
                            Need {deficit} XP more
                          </span>
                        ) : selectedBox === box.id ? (
                          <span className="text-[11px] font-semibold text-[var(--accent-text)] flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Selected
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Open Selected Paid Box CTA */}
        {selectedBox && selectedBox !== 'daily_free_box' && !results && (
          <Button
            size="lg"
            className="w-full font-semibold"
            onClick={() => handleOpen()}
            disabled={isOpening || !canAffordSelected}
            style={
              canAffordSelected
                ? {
                    backgroundColor: 'var(--accent)',
                    color: 'var(--on-accent)',
                  }
                : {
                    backgroundColor: 'var(--surface-2)',
                    color: 'var(--text-secondary)',
                    borderColor: 'var(--border)',
                  }
            }
          >
            <Gift className="w-4 h-4 mr-2" />
            {canAffordSelected
              ? `Open ${selectedBoxObj?.name}`
              : `Need ${(selectedBoxObj?.cost || 0) - xp} XP more`}
          </Button>
        )}

        {/* Stats */}
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)]">Total Boxes Opened</span>
              <span
                data-testid="total-boxes-opened"
                className="font-bold text-[var(--text-primary)]"
              >
                {totalBoxesOpened}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {openingPortal}
      {revealPortal}
    </div>
  );
}
