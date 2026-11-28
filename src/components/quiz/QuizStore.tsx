/**
 * Quiz Store UI Component
 * Power-up store backed by single-source useQuizEconomy store
 * Features 3 clearly labeled tabs (Basic | Boosters | Premium), zero title truncation,
 * crisp Lucide icons, and theme-token styling across all 8 Royal Themes.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { quizStore } from '@/lib/quiz-store';
import { useQuizEconomy } from '@/lib/quiz-economy';
import { StoreItem } from '@/data/quiz-store-data';
import { QuizLucideIcon } from '@/components/quiz/QuizLucideIcon';
import {
  ArrowLeft,
  Check,
  Coins,
  Crown,
  Info,
  Lock,
  Package,
  ShoppingBag,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type StoreTabKey = 'basic' | 'boosters' | 'premium';

interface StoreItemWithStatus extends StoreItem {
  owned: number;
  canAfford: boolean;
  unlocked: boolean;
}

interface QuizStoreProps {
  onClose: () => void;
}

export function QuizStore({ onClose }: QuizStoreProps) {
  const { xp, level, levelProgress, powerups, badges, stats } = useQuizEconomy();
  const [selectedItem, setSelectedItem] = useState<StoreItemWithStatus | null>(null);
  const [activeTab, setActiveTab] = useState<StoreTabKey>('basic');
  const [purchaseConfirmOpen, setPurchaseConfirmOpen] = useState(false);
  const [purchaseAnimating, setPurchaseAnimating] = useState(false);
  const { toast } = useToast();

  // Recompute whenever unified economy state updates
  const storeItems = useMemo<StoreItemWithStatus[]>(() => {
    void xp;
    void level;
    void powerups;
    void badges;
    void stats.categoryMastery;
    return quizStore.getStoreItems();
  }, [xp, level, powerups, badges, stats.categoryMastery]);

  const itemsByTab = useMemo<Record<StoreTabKey, StoreItemWithStatus[]>>(() => {
    return {
      basic: storeItems.filter(
        (i) => i.type !== 'booster' && i.type !== 'protection' && i.category === 'basic'
      ),
      boosters: storeItems.filter(
        (i) => i.type === 'booster' || i.type === 'protection'
      ),
      premium: storeItems.filter(
        (i) =>
          i.type !== 'booster' &&
          i.type !== 'protection' &&
          (i.category === 'premium' || i.category === 'legendary')
      ),
    };
  }, [storeItems]);

  const handlePurchase = (item: StoreItemWithStatus) => {
    if (!item.unlocked) {
      toast({
        title: 'Locked',
        description: "You don't meet the level requirement for this item yet.",
        variant: 'destructive',
      });
      return;
    }

    if (!item.canAfford) {
      toast({
        title: 'Not Enough XP',
        description: `Need ${item.cost - xp} XP more to buy ${item.name}.`,
        variant: 'destructive',
      });
      return;
    }

    if (item.owned >= item.maxInventory) {
      toast({
        title: 'Inventory Full',
        description: "You can't carry more of this item.",
        variant: 'destructive',
      });
      return;
    }

    setSelectedItem(item);
    setPurchaseConfirmOpen(true);
  };

  const confirmPurchase = () => {
    if (!selectedItem) return;
    setPurchaseAnimating(true);

    setTimeout(() => {
      const result = quizStore.purchaseItem(selectedItem.id);

      if (result.success) {
        toast({
          title: 'Purchase Successful',
          description: `Bought ${selectedItem.name} for ${selectedItem.cost} XP.`,
        });
      } else {
        toast({
          title: 'Purchase Failed',
          description: result.message || 'Something went wrong.',
          variant: 'destructive',
        });
      }

      setPurchaseAnimating(false);
      setPurchaseConfirmOpen(false);
      setSelectedItem(null);
    }, 250);
  };

  const getRequirementText = (item: StoreItemWithStatus) => {
    if (!item.requirements) return null;
    const { minLevel, achievementId, categoryMastery } = item.requirements;
    if (minLevel) return `Requires Level ${minLevel}`;
    if (achievementId) return 'Requires Achievement';
    if (categoryMastery) return 'Requires Category Mastery';
    return null;
  };

  const getEffectSummary = (item: StoreItem): string | null => {
    if (!item.effect) return null;
    switch (item.effect.type) {
      case 'multiplier':
        return `2x points for ${item.effect.duration} questions`;
      case 'addTime':
        return `+${item.effect.value}s to timer`;
      case 'removeWrong':
        return `Removes ${item.effect.value} wrong answers`;
      case 'freezeTime':
        return `Pauses timer for ${item.effect.value}s`;
      case 'streakProtection':
        return 'Protects your streak';
      case 'autoCorrect':
        return `Auto-corrects ${item.effect.value} questions`;
      case 'xpMultiplier':
        return `+${Math.round((item.effect.value - 1) * 100)}% XP earned`;
      default:
        return item.effect.duration && item.type === 'booster'
          ? `Lasts ${Math.round(item.effect.duration / 60)} min`
          : null;
    }
  };

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
        <div className="max-w-lg mx-auto px-3 py-3">
          <div className="flex items-center justify-between gap-2">
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
                  Power-Up Store
                </h1>
                <p className="text-xs text-[var(--text-secondary)] leading-tight">
                  Spend XP on quiz power-ups
                </p>
              </div>
            </div>

            {/* Live Single-Source XP Chip */}
            <div
              data-testid="store-xp-balance"
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
      </div>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-3 py-4 space-y-4">
        {/* Level Progress Card */}
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <CardContent className="p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-[var(--accent-text)]" />
                <span className="font-bold text-sm text-[var(--text-primary)]">
                  Level {level}
                </span>
              </div>
              <span className="text-xs text-[var(--text-secondary)]">
                {levelProgress.remaining} XP to next level
              </span>
            </div>
            <Progress value={levelProgress.progress} className="h-2" />
          </CardContent>
        </Card>

        {/* 3 Labeled Store Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StoreTabKey)}>
          <TabsList
            className="grid grid-cols-3 w-full h-10 p-1 border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <TabsTrigger
              value="basic"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-[var(--on-accent)]"
            >
              <Package className="w-3.5 h-3.5 shrink-0" />
              <span>Basic</span>
            </TabsTrigger>
            <TabsTrigger
              value="boosters"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-[var(--on-accent)]"
            >
              <Zap className="w-3.5 h-3.5 shrink-0" />
              <span>Boosters</span>
            </TabsTrigger>
            <TabsTrigger
              value="premium"
              className="flex items-center justify-center gap-1.5 text-xs font-semibold data-[state=active]:bg-[var(--accent)] data-[state=active]:text-[var(--on-accent)]"
            >
              <Crown className="w-3.5 h-3.5 shrink-0" />
              <span>Premium</span>
            </TabsTrigger>
          </TabsList>

          {(['basic', 'boosters', 'premium'] as StoreTabKey[]).map((tabKey) => (
            <TabsContent key={tabKey} value={tabKey} className="mt-3">
              <div className="grid grid-cols-1 gap-3">
                <AnimatePresence mode="popLayout">
                  {itemsByTab[tabKey].map((item) => {
                    const effectText = getEffectSummary(item);
                    const deficit = Math.max(0, item.cost - xp);

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                      >
                        <Card
                          className={`overflow-hidden border transition-all ${
                            !item.unlocked ? 'opacity-70' : ''
                          }`}
                          style={{
                            backgroundColor: 'var(--surface)',
                            borderColor:
                              item.owned >= item.maxInventory
                                ? 'var(--success)'
                                : 'var(--border)',
                          }}
                        >
                          <CardContent className="p-3.5">
                            <div className="flex items-start gap-3">
                              {/* Lucide Item Icon */}
                              <div
                                className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border"
                                style={{
                                  backgroundColor: 'var(--accent-soft)',
                                  borderColor: 'var(--border)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                <QuizLucideIcon id={item.id} className="w-5 h-5" />
                              </div>

                              {/* Title + Description (2-line safe wrap, zero truncate) */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                                    <h3 className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
                                      {item.name}
                                    </h3>
                                    {item.category === 'legendary' && (
                                      <Badge
                                        variant="secondary"
                                        className="text-[10px] px-1.5 py-0 border"
                                        style={{
                                          backgroundColor: 'var(--accent-soft)',
                                          borderColor: 'var(--border)',
                                          color: 'var(--accent-text)',
                                        }}
                                      >
                                        Legendary
                                      </Badge>
                                    )}
                                  </div>

                                  <div
                                    className="flex items-center gap-1 text-xs font-bold shrink-0"
                                    style={{
                                      color: item.canAfford
                                        ? 'var(--accent-text)'
                                        : 'var(--danger)',
                                    }}
                                  >
                                    <Coins className="w-3.5 h-3.5 shrink-0" />
                                    <span>{item.cost} XP</span>
                                  </div>
                                </div>

                                <p className="text-xs text-[var(--text-secondary)] mt-1 leading-snug">
                                  {item.description}
                                </p>

                                {!item.unlocked && getRequirementText(item) && (
                                  <div className="flex items-center gap-1 mt-1.5 text-xs text-[var(--danger)]">
                                    <Lock className="w-3 h-3 shrink-0" />
                                    <span>{getRequirementText(item)}</span>
                                  </div>
                                )}

                                <div className="flex items-center justify-between gap-2 mt-2.5">
                                  <Badge
                                    variant="secondary"
                                    className="text-xs border"
                                    style={{
                                      backgroundColor: 'var(--surface-2)',
                                      borderColor: 'var(--border)',
                                      color: 'var(--text-primary)',
                                    }}
                                  >
                                    <Package className="w-3 h-3 mr-1" />
                                    Owned: {item.owned}/{item.maxInventory}
                                  </Badge>

                                  <Button
                                    size="sm"
                                    data-testid={`buy-${item.id}`}
                                    onClick={() => handlePurchase(item)}
                                    disabled={
                                      !item.unlocked ||
                                      !item.canAfford ||
                                      item.owned >= item.maxInventory
                                    }
                                    className="h-8 px-3 text-xs font-semibold shrink-0"
                                    style={
                                      item.unlocked &&
                                      item.canAfford &&
                                      item.owned < item.maxInventory
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
                                    {item.owned >= item.maxInventory ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 mr-1" />
                                        Max
                                      </>
                                    ) : !item.unlocked ? (
                                      <>
                                        <Lock className="w-3.5 h-3.5 mr-1" />
                                        Locked
                                      </>
                                    ) : !item.canAfford ? (
                                      <span>Need {deficit} XP more</span>
                                    ) : (
                                      <span>Buy</span>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>

                            {effectText && (
                              <div
                                className="mt-2.5 pt-2 border-t flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <Sparkles className="w-3 h-3 text-[var(--accent-text)] shrink-0" />
                                <span>{effectText}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Compact Store Tips Footer */}
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <CardHeader className="pb-1.5 pt-3 px-3.5">
            <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-[var(--text-primary)]">
              <Info className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              Store Tips
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3 px-3.5">
            <ul className="text-xs text-[var(--text-secondary)] space-y-1">
              <li>• Earn XP by answering quiz questions and building combos</li>
              <li>• Higher levels unlock Premium &amp; Legendary power-ups</li>
              <li>• Check Daily Rewards and Mystery Boxes for free bonuses</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Purchase Confirmation Dialog */}
      <Dialog open={purchaseConfirmOpen} onOpenChange={setPurchaseConfirmOpen}>
        <DialogContent
          className="max-w-[330px] rounded-2xl border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-base">Confirm Purchase</DialogTitle>
            <DialogDescription className="text-xs text-[var(--text-secondary)]">
              Add this item to your shared quiz inventory?
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="flex items-center gap-3 py-2">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border shrink-0"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  borderColor: 'var(--border)',
                  color: 'var(--accent-text)',
                }}
              >
                <QuizLucideIcon id={selectedItem.id} className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-sm text-[var(--text-primary)] leading-snug">
                  {selectedItem.name}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] leading-snug">
                  {selectedItem.description}
                </p>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-[var(--accent-text)]">
                  <Coins className="w-3.5 h-3.5" />
                  <span>{selectedItem.cost} XP</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPurchaseConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              data-testid="confirm-purchase-btn"
              onClick={confirmPurchase}
              disabled={purchaseAnimating}
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--on-accent)',
              }}
            >
              {purchaseAnimating ? (
                'Processing...'
              ) : (
                <>
                  <ShoppingBag className="w-3.5 h-3.5 mr-1.5" />
                  Confirm Purchase
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
