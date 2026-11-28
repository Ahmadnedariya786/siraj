/**
 * Daily Rewards Component
 * 7-day login reward system backed by single-source useQuizEconomy store
 * Responsive 360px layout + high-contrast theme tokens
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { quizStore } from '@/lib/quiz-store';
import { useQuizEconomy } from '@/lib/quiz-economy';
import { DailyReward } from '@/data/quiz-store-data';
import { QuizLucideIcon } from '@/components/quiz/QuizLucideIcon';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  Coins,
  Crown,
  Flame,
  Gift,
  Package,
  Sparkles,
  Trophy,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DailyRewardsProps {
  onClose: () => void;
}

export function DailyRewards({ onClose }: DailyRewardsProps) {
  const { xp, streak } = useQuizEconomy();
  const [claiming, setClaiming] = useState(false);
  const [justClaimed, setJustClaimed] = useState<DailyReward | null>(null);
  const { toast } = useToast();

  const rewardStatus = useMemo(() => {
    void streak;
    void xp;
    return quizStore.getDailyRewardStatus();
  }, [streak, xp]);

  const handleClaim = () => {
    if (!rewardStatus?.canClaimToday || claiming) return;

    setClaiming(true);

    setTimeout(() => {
      const result = quizStore.claimDailyReward();

      if (result.success && result.reward) {
        setJustClaimed(result.reward);
        toast({
          title: 'Daily Reward Claimed',
          description: `Received Day ${result.reward.day} rewards (+${result.reward.xp} XP)!`,
        });

        setTimeout(() => {
          setJustClaimed(null);
        }, 3000);
      } else {
        toast({
          title: 'Unable to Claim',
          description: result.message || 'Please try again later.',
          variant: 'destructive',
        });
      }

      setClaiming(false);
    }, 450);
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
                Daily Rewards
              </h1>
              <p className="text-xs text-[var(--text-secondary)] leading-tight">
                Come back every day for XP bonuses
              </p>
            </div>
          </div>

          <div
            data-testid="daily-xp-balance"
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
        {/* Streak Counter Card */}
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: 'var(--accent)',
            color: 'var(--text-primary)',
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center border"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    borderColor: 'var(--accent)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-secondary)]">Current Streak</p>
                  <p className="text-2xl font-bold text-[var(--text-primary)]">
                    {rewardStatus.currentStreak} Days
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-secondary)]">Next Reward</p>
                <p className="text-sm font-bold text-[var(--accent-text)]">
                  Day {Math.min(rewardStatus.currentStreak + 1, 7)}
                </p>
              </div>
            </div>

            <div className="mt-3.5">
              <div className="flex justify-between text-xs mb-1.5 text-[var(--text-secondary)]">
                <span>Progress to Weekly Bonus</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {rewardStatus.currentStreak}/7
                </span>
              </div>
              <div
                className="h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: 'var(--surface)' }}
              >
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: 'var(--accent)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(rewardStatus.currentStreak / 7) * 100}%` }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                />
              </div>
              <p className="text-[11px] mt-2 text-[var(--text-secondary)]">
                Complete 7 days for +500 Bonus XP and a Legendary Power-Up
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Claim CTA */}
        {rewardStatus.canClaimToday && rewardStatus.nextReward && (
          <Button
            data-testid="claim-daily-reward-btn"
            onClick={handleClaim}
            disabled={claiming}
            className="w-full h-12 text-sm font-bold"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--on-accent)',
            }}
          >
            <Gift className="w-4 h-4 mr-2" />
            {claiming ? 'Claiming...' : `Claim Day ${rewardStatus.nextReward.day} Reward`}
          </Button>
        )}

        {!rewardStatus.canClaimToday && (
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardContent className="p-3.5 flex items-center gap-3">
              <Check className="w-5 h-5 text-[var(--success)] shrink-0" />
              <div>
                <p className="font-semibold text-sm text-[var(--text-primary)]">
                  Already Claimed Today
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Come back tomorrow for your next daily reward.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Claimed Reward Confirmation */}
        <AnimatePresence>
          {justClaimed && (
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: -8 }}
            >
              <Card
                className="border"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--success)',
                }}
              >
                <CardContent className="p-4 text-center">
                  <div className="flex justify-center mb-2">
                    <Trophy className="w-9 h-9 text-[var(--accent-text)]" />
                  </div>
                  <h3 className="font-bold text-base text-[var(--success)]">
                    Day {justClaimed.day} Reward Claimed
                  </h3>
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <Coins className="w-4 h-4 text-[var(--accent-text)]" />
                    <span className="font-bold text-sm text-[var(--text-primary)]">
                      +{justClaimed.xp} XP
                    </span>
                  </div>
                  {justClaimed.items && justClaimed.items.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-1.5 text-xs text-[var(--text-secondary)]">
                      <Package className="w-4 h-4 text-[var(--accent-text)]" />
                      <span>
                        +{justClaimed.items.reduce((acc, item) => acc + item.quantity, 0)} Power-up(s)
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 7-Day Reward Grid (fits 360px with zero squishing) */}
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <CardHeader className="pb-2.5 pt-3.5 px-3.5">
            <CardTitle className="text-sm flex items-center gap-2 text-[var(--text-primary)]">
              <Calendar className="w-4 h-4 text-[var(--accent-text)]" />
              Weekly Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3.5 pb-3.5">
            <div className="grid grid-cols-4 gap-2">
              {rewardStatus.rewards.map((reward) => {
                const isClaimed = reward.claimed;
                const isToday =
                  reward.day === rewardStatus.currentStreak + 1 && rewardStatus.canClaimToday;

                return (
                  <div
                    key={reward.day}
                    className={`relative rounded-xl border flex flex-col items-center justify-center text-center p-2 min-h-[78px] ${
                      reward.day === 7 ? 'col-span-2' : ''
                    }`}
                    style={{
                      backgroundColor: isToday ? 'var(--accent-soft)' : 'var(--surface-2)',
                      borderColor: isClaimed
                        ? 'var(--success)'
                        : isToday
                          ? 'var(--accent)'
                          : 'var(--border)',
                    }}
                  >
                    <span
                      className="text-[11px] font-bold flex items-center gap-1"
                      style={{
                        color: isClaimed
                          ? 'var(--success)'
                          : isToday
                            ? 'var(--accent-text)'
                            : 'var(--text-secondary)',
                      }}
                    >
                      {reward.day === 7 ? (
                        <>
                          <Crown className="w-3.5 h-3.5" />
                          <span>Day 7</span>
                        </>
                      ) : (
                        `Day ${reward.day}`
                      )}
                    </span>

                    <div className="mt-1">
                      {isClaimed ? (
                        <Check className="w-4 h-4 text-[var(--success)] mx-auto" />
                      ) : reward.day === 7 ? (
                        <Sparkles className="w-4 h-4 text-[var(--accent-text)] mx-auto" />
                      ) : reward.items ? (
                        <QuizLucideIcon
                          id={reward.items[0].itemId}
                          className="w-4 h-4 text-[var(--accent-text)] mx-auto"
                        />
                      ) : (
                        <Coins className="w-4 h-4 text-[var(--accent-text)] mx-auto" />
                      )}
                    </div>

                    <span className="text-[11px] font-semibold text-[var(--text-primary)] mt-1">
                      {isClaimed ? 'Claimed' : `${reward.xp} XP`}
                    </span>

                    {reward.day === 7 && (
                      <Badge
                        className="mt-1 text-[9px] px-1.5 py-0"
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: 'var(--on-accent)',
                        }}
                      >
                        BONUS
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card
          className="border"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
          }}
        >
          <CardContent className="p-3.5">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
              <div>
                <h4 className="font-semibold text-xs text-[var(--text-primary)]">
                  How Daily Rewards Work
                </h4>
                <ul className="text-xs text-[var(--text-secondary)] mt-1 space-y-1">
                  <li>• Claim one reward each calendar day</li>
                  <li>• Use a Streak Freeze to protect against missed days</li>
                  <li>• Day 7 grants 300 XP + 500 Bonus XP + Perfect Round</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
