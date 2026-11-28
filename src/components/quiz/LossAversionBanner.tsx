/**
 * Loss Aversion Banner
 * High-contrast theme-token notification banner (8 Royal Themes compatible)
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { psychologicalHooks, LossAversionMessage } from '@/lib/psychological-hooks';
import { useQuizEconomy } from '@/lib/quiz-economy';
import { QuizLucideIcon } from '@/components/quiz/QuizLucideIcon';
import { X, Clock } from 'lucide-react';

interface LossAversionBannerProps {
  onAction?: (type: string) => void;
  dismissible?: boolean;
}

export function LossAversionBanner({ onAction, dismissible = true }: LossAversionBannerProps) {
  const { lives, lastFreeBoxDate, streak, xp } = useQuizEconomy();
  const [message, setMessage] = useState<LossAversionMessage | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const checkMessage = () => {
      if (!dismissed) {
        const urgent = psychologicalHooks.getMostUrgentMessage();
        setMessage(urgent);
      }
    };

    checkMessage();
    const interval = setInterval(checkMessage, 60000);
    return () => clearInterval(interval);
  }, [dismissed, lives, lastFreeBoxDate, streak, xp]);

  const handleDismiss = () => {
    setDismissed(true);
    setMessage(null);
  };

  const handleAction = () => {
    if (message) {
      onAction?.(message.type);
    }
  };

  if (!message || dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="px-4 pt-2 max-w-lg mx-auto"
      >
        <Card
          className="overflow-hidden border"
          style={{
            backgroundColor: 'var(--surface-2)',
            borderColor: message.urgency === 'critical' ? 'var(--danger)' : 'var(--accent)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="p-3 flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--accent-soft)',
                color: message.urgency === 'critical' ? 'var(--danger)' : 'var(--accent-text)',
              }}
            >
              <QuizLucideIcon id={message.icon} className="w-4 h-4" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-[var(--text-primary)] leading-snug">
                {message.message}
              </p>
              {message.subMessage && (
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                  {message.subMessage}
                </p>
              )}

              {message.countdown && (
                <div className="flex items-center gap-1 mt-1 text-xs font-semibold text-[var(--accent-text)]">
                  <Clock className="w-3 h-3" />
                  <span>{message.countdown}</span>
                </div>
              )}

              {message.actionText && (
                <Button
                  size="sm"
                  className="mt-2 h-7 px-3 text-xs font-semibold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--on-accent)',
                  }}
                  onClick={handleAction}
                >
                  {message.actionText}
                </Button>
              )}
            </div>

            {dismissible && message.urgency !== 'critical' && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Dismiss banner"
                className="h-7 w-7 shrink-0 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                onClick={handleDismiss}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}

export function FloatingNotification({ onClick }: { onClick?: () => void }) {
  const [fomo, setFomo] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      setFomo(psychologicalHooks.getFOMOMessage());
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!fomo) return null;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.03 }}
      onClick={onClick}
      className="fixed bottom-20 right-4 z-40 cursor-pointer"
    >
      <div
        className="px-4 py-2 rounded-full shadow-lg flex items-center gap-2 border"
        style={{
          backgroundColor: 'var(--accent)',
          color: 'var(--on-accent)',
          borderColor: 'var(--border)',
        }}
      >
        <span className="text-xs font-semibold">{fomo}</span>
      </div>
    </motion.div>
  );
}

export function MotivationToast() {
  return null;
}
