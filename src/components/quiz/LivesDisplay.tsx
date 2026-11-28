/**
 * Lives Display Component
 * Subscribed to unified useQuizEconomy store for instant XP & Lives sync
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { livesSystem } from '@/lib/lives-system';
import { useQuizEconomy } from '@/lib/quiz-economy';
import { Heart, Clock, Plus } from 'lucide-react';

interface LivesDisplayProps {
  onRefill?: () => void;
  showRefillButton?: boolean;
}

export function LivesDisplay({ onRefill, showRefillButton = true }: LivesDisplayProps) {
  const { lives, maxLives, xp } = useQuizEconomy();
  const [timeUntilNext, setTimeUntilNext] = useState(() => livesSystem.getTimeUntilNextLife());

  useEffect(() => {
    const updateTimer = () => {
      livesSystem.getCurrentLives();
      setTimeUntilNext(livesSystem.getTimeUntilNextLife());
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lives]);

  const isLow = lives <= 2;

  const handleRefill = () => {
    const result = livesSystem.refillLivesWithXP();
    if (result.success) {
      onRefill?.();
    }
    return result;
  };

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl border"
      style={{
        backgroundColor: 'var(--surface-2)',
        borderColor: isLow ? 'var(--danger)' : 'var(--border)',
      }}
    >
      <div className="flex items-center gap-0.5">
        {Array.from({ length: maxLives }).map((_, i) => (
          <motion.div
            key={i}
            initial={i < lives ? { scale: 1 } : { scale: 0.85 }}
            animate={i < lives ? { scale: 1 } : { scale: 0.75, opacity: 0.35 }}
          >
            <Heart
              className="w-4 h-4"
              style={{
                color: i < lives ? 'var(--danger)' : 'var(--text-secondary)',
                fill: i < lives ? 'var(--danger)' : 'transparent',
              }}
            />
          </motion.div>
        ))}
      </div>

      <span
        className="font-bold text-sm"
        style={{ color: isLow ? 'var(--danger)' : 'var(--text-primary)' }}
      >
        {lives}/{maxLives}
      </span>

      {lives < maxLives ? (
        <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)]">
          <Clock className="w-3 h-3" />
          <span>{timeUntilNext}</span>
        </div>
      ) : (
        <span className="text-[11px] font-bold text-[var(--accent-text)] bg-[var(--accent-soft)] border border-[var(--border)] px-2 py-0.5 rounded-full whitespace-nowrap">
          Full • Ready
        </span>
      )}

      {showRefillButton && lives < maxLives && (
        <Button
          size="sm"
          variant="outline"
          disabled={xp < 100}
          className="h-7 px-2 text-xs ml-auto"
          onClick={handleRefill}
        >
          <Plus className="w-3 h-3 mr-1" />
          100 XP
        </Button>
      )}
    </div>
  );
}

export function LivesCompact() {
  const { lives } = useQuizEconomy();
  const isLow = lives <= 2;

  return (
    <Badge
      variant={isLow ? 'destructive' : 'secondary'}
      className="flex items-center gap-1 border border-[var(--border)]"
      style={
        isLow
          ? undefined
          : {
              backgroundColor: 'var(--surface-2)',
              color: 'var(--text-primary)',
            }
      }
    >
      <Heart
        className="w-3 h-3"
        style={{
          color: lives > 0 ? 'var(--danger)' : 'var(--text-secondary)',
          fill: lives > 0 ? 'var(--danger)' : 'transparent',
        }}
      />
      <span className="text-xs font-bold">{lives}</span>
    </Badge>
  );
}
