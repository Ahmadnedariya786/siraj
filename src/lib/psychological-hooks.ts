/**
 * Psychological Hooks & Retention Messages
 * Theme-token compliant styling across all 8 Royal Themes (high contrast >= 4.5:1)
 */

import { quizStore } from '@/lib/quiz-store';
import { quizManager } from '@/lib/quiz-manager';
import { quizEconomy } from '@/lib/quiz-economy';
import { livesSystem } from '@/lib/lives-system';
import { timeEventsSystem } from '@/lib/time-events';
import { mysteryBoxSystem } from '@/lib/mystery-box';

export type LossAversionType = 'lives' | 'streak' | 'daily_reward' | 'event' | 'mystery_box';

export interface LossAversionMessage {
  type: LossAversionType;
  message: string;
  subMessage?: string;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
  color: string;
  actionText?: string;
  countdown?: string;
}

export class PsychologicalHooks {
  private static instance: PsychologicalHooks;

  static getInstance(): PsychologicalHooks {
    if (!PsychologicalHooks.instance) {
      PsychologicalHooks.instance = new PsychologicalHooks();
    }
    return PsychologicalHooks.instance;
  }

  getLivesScarcityMessage(): LossAversionMessage | null {
    const lives = livesSystem.getCurrentLives();
    const maxLives = livesSystem.getMaxLives();
    const timeUntilNext = livesSystem.getTimeUntilNextLife();

    if (lives === 1) {
      return {
        type: 'lives',
        message: 'Last Life Remaining',
        subMessage: 'You have 1 life remaining. Play carefully!',
        urgency: 'critical',
        icon: 'alert',
        color: 'text-[var(--danger)] border-[var(--danger)]',
        actionText: 'Refill Now (100 XP)',
        countdown: timeUntilNext,
      };
    }

    if (lives === 2) {
      return {
        type: 'lives',
        message: 'Only 2 lives left',
        subMessage: `Next life in ${timeUntilNext}`,
        urgency: 'high',
        icon: 'heart',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        actionText: 'Get More Lives',
      };
    }

    if (lives <= maxLives * 0.4) {
      return {
        type: 'lives',
        message: `${lives} lives remaining`,
        subMessage: `Next life in ${timeUntilNext}`,
        urgency: 'medium',
        icon: 'heart',
        color: 'text-[var(--text-primary)] border-[var(--border)]',
      };
    }

    return null;
  }

  getStreakLossMessage(): LossAversionMessage | null {
    const dailyStatus = quizStore.getDailyRewardStatus();

    if (!dailyStatus.canClaimToday && dailyStatus.currentStreak > 0) {
      return null;
    }

    const hoursLeft = this.getHoursUntilMidnight();

    if (dailyStatus.currentStreak === 0) return null;

    if (hoursLeft <= 2 && dailyStatus.currentStreak > 5) {
      return {
        type: 'streak',
        message: `${dailyStatus.currentStreak}-Day Streak Expiring`,
        subMessage: `Your streak expires in ${Math.ceil(hoursLeft)} hours! Play now to save it.`,
        urgency: 'critical',
        icon: 'flame',
        color: 'text-[var(--danger)] border-[var(--danger)]',
        actionText: 'Play Now',
        countdown: `${Math.ceil(hoursLeft)}h left`,
      };
    }

    if (hoursLeft <= 4 && dailyStatus.currentStreak > 0) {
      return {
        type: 'streak',
        message: `${dailyStatus.currentStreak}-Day Streak`,
        subMessage: `Expires in ${Math.ceil(hoursLeft)} hours. Protect your progress!`,
        urgency: 'high',
        icon: 'clock',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        countdown: `${Math.ceil(hoursLeft)}h left`,
      };
    }

    if (dailyStatus.currentStreak >= 6) {
      return {
        type: 'streak',
        message: `${dailyStatus.currentStreak}-Day Streak`,
        subMessage: 'One more day for the 7-day bonus reward!',
        urgency: 'medium',
        icon: 'flame',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
      };
    }

    return null;
  }

  getDailyRewardUrgency(): LossAversionMessage | null {
    const dailyStatus = quizStore.getDailyRewardStatus();

    if (!dailyStatus.canClaimToday) return null;

    const hoursLeft = this.getHoursUntilMidnight();
    const nextReward = dailyStatus.nextReward;

    if (hoursLeft <= 2) {
      return {
        type: 'daily_reward',
        message: 'Daily Reward Expires Soon',
        subMessage: `Day ${nextReward?.day || 1} reward waiting — claim before midnight!`,
        urgency: 'high',
        icon: 'gift',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        actionText: 'Claim Now',
        countdown: `${Math.ceil(hoursLeft)}h left`,
      };
    }

    if (hoursLeft <= 6) {
      return {
        type: 'daily_reward',
        message: 'Daily Reward Waiting',
        subMessage: `Claim your Day ${nextReward?.day || 1} reward today.`,
        urgency: 'medium',
        icon: 'gift',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        actionText: 'Claim Reward',
      };
    }

    return null;
  }

  getEventFOMOMessage(): LossAversionMessage | null {
    const event = timeEventsSystem.getActiveEvent();
    if (!event) return null;

    const timeRemaining = timeEventsSystem.getTimeRemaining();
    const [hours, minutes] = timeRemaining.split(':').map(Number);

    if (hours === 0 && minutes < 30) {
      return {
        type: 'event',
        message: `${event.title} Ending Soon`,
        subMessage: `${event.multiplier}x XP ends in ${minutes}m!`,
        urgency: 'critical',
        icon: 'sparkles',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        actionText: 'Play Now',
        countdown: `${minutes}m left`,
      };
    }

    if (hours === 0 && minutes < 60) {
      return {
        type: 'event',
        message: `${event.title} Ends in 1 Hour`,
        subMessage: `${event.multiplier}x XP active now.`,
        urgency: 'high',
        icon: 'clock',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        actionText: 'Join Event',
        countdown: '1h left',
      };
    }

    if (hours < 3) {
      return {
        type: 'event',
        message: `${event.title} Active`,
        subMessage: `${event.multiplier}x XP — ends in ${hours}h ${minutes}m`,
        urgency: 'medium',
        icon: 'sparkles',
        color: 'text-[var(--accent-text)] border-[var(--accent)]',
        countdown: `${hours}h ${minutes}m left`,
      };
    }

    return {
      type: 'event',
      message: `${event.title} Live`,
      subMessage: `${event.multiplier}x XP for ${hours} more hours`,
      urgency: 'low',
      icon: 'sparkles',
      color: 'text-[var(--accent-text)] border-[var(--accent)]',
    };
  }

  getMysteryBoxUrgency(): LossAversionMessage | null {
    const canClaim = mysteryBoxSystem.canClaimDailyBox();

    if (!canClaim) {
      const timeUntil = mysteryBoxSystem.getTimeUntilNextBox();
      return {
        type: 'mystery_box',
        message: 'Free Mystery Box Tomorrow',
        subMessage: `Next free box in ${timeUntil}`,
        urgency: 'low',
        icon: 'package',
        color: 'text-[var(--text-primary)] border-[var(--border)]',
      };
    }

    return {
      type: 'mystery_box',
      message: 'Free Mystery Box Ready!',
      subMessage: 'Open it now for random rewards — Free today',
      urgency: 'medium',
      icon: 'gift',
      color: 'text-[var(--accent-text)] border-[var(--accent)]',
      actionText: 'Open Box',
    };
  }

  getMostUrgentMessage(): LossAversionMessage | null {
    const messages: LossAversionMessage[] = [];

    const livesMsg = this.getLivesScarcityMessage();
    if (livesMsg) messages.push(livesMsg);

    const streakMsg = this.getStreakLossMessage();
    if (streakMsg) messages.push(streakMsg);

    const dailyMsg = this.getDailyRewardUrgency();
    if (dailyMsg) messages.push(dailyMsg);

    const eventMsg = this.getEventFOMOMessage();
    if (eventMsg) messages.push(eventMsg);

    const boxMsg = this.getMysteryBoxUrgency();
    if (boxMsg) messages.push(boxMsg);

    const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    messages.sort((a, b) => urgencyOrder[b.urgency] - urgencyOrder[a.urgency]);

    return messages[0] || null;
  }

  getProgressHook(): string | null {
    const currentXP = quizEconomy.getState().xp;
    const levelProgress = quizManager.getLevelProgress();

    if (levelProgress.progress > 80) {
      return `Only ${levelProgress.remaining} XP to level up!`;
    }

    const milestones = [1000, 2500, 5000, 10000, 25000];
    const nextMilestone = milestones.find((m) => currentXP < m);
    if (nextMilestone) {
      const remaining = nextMilestone - currentXP;
      if (remaining <= 200) {
        return `Just ${remaining} XP to reach ${nextMilestone.toLocaleString()} total!`;
      }
    }

    return null;
  }

  getFOMOMessage(): string | null {
    const messages: string[] = [];

    const event = timeEventsSystem.getActiveEvent();
    if (event) {
      messages.push(`${event.multiplier}x XP event active!`);
    }

    const dailyStatus = quizStore.getDailyRewardStatus();
    if (dailyStatus.currentStreak > 5) {
      messages.push(`Protect your ${dailyStatus.currentStreak}-day streak!`);
    }

    const lives = livesSystem.getCurrentLives();
    if (lives === livesSystem.getMaxLives()) {
      messages.push('Full lives ready — start a round!');
    }

    if (mysteryBoxSystem.canClaimDailyBox()) {
      messages.push('Free mystery box waiting!');
    }

    return messages.length > 0 ? messages[0] : null;
  }

  getMotivationMessage(): string | null {
    const messages = [
      'Every question deepens your Islamic knowledge.',
      'Consistency brings barakah in learning.',
      'Seek knowledge from the cradle to the grave.',
      'Stay steady — your streak is growing.',
    ];

    return messages[Math.floor(Math.random() * messages.length)];
  }

  private getHoursUntilMidnight(): number {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return (midnight.getTime() - now.getTime()) / (1000 * 60 * 60);
  }
}

export const psychologicalHooks = PsychologicalHooks.getInstance();
