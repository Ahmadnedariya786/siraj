/**
 * Quiz Manager - Handles all gamification logic
 * Delegates persistent state to unified quiz-economy store (`siraj_quiz_state_v1`)
 */

import {
  QuizStats,
  Achievement,
  PowerUp,
  ACHIEVEMENTS,
  ENHANCED_QUESTIONS,
  type QuizQuestion,
} from '@/data/enhanced-quiz-data';
import {
  quizEconomy,
  calculateLevelForXP,
  getLevelProgressFromXP,
} from '@/lib/quiz-economy';

const ACHIEVEMENTS_KEY = 'quiz-achievements';

export class QuizManager {
  private static instance: QuizManager;

  static getInstance(): QuizManager {
    if (!QuizManager.instance) {
      QuizManager.instance = new QuizManager();
    }
    return QuizManager.instance;
  }

  getStats(): QuizStats {
    return quizEconomy.toQuizStats();
  }

  updateStats(
    score: number,
    totalQuestions: number,
    categoryAnswers: Record<string, { correct: number; total: number }>,
    streak: number,
    xpOverride?: number
  ): QuizStats {
    const stats = this.getStats();

    stats.totalGames += 1;
    stats.totalCorrect += score;
    stats.totalQuestions += totalQuestions;
    stats.currentStreak = streak;
    stats.bestStreak = Math.max(stats.bestStreak, streak);
    stats.lastPlayed = new Date().toISOString();

    const xpEarned =
      xpOverride !== undefined
        ? xpOverride
        : this.calculateXPEarned(score, totalQuestions, streak);

    Object.entries(categoryAnswers).forEach(([category, answers]) => {
      const mastery = answers.total > 0 ? (answers.correct / answers.total) * 100 : 0;
      stats.categoryMastery[category] = Math.round(mastery);
    });

    this.updateDailyStreak(stats);

    const previewStats: QuizStats = {
      ...stats,
      xp: stats.xp + xpEarned,
      level: calculateLevelForXP(stats.xp + xpEarned).level,
    };

    const newlyUnlocked = this.checkAchievements(previewStats);
    const achievementBonusXP = newlyUnlocked.reduce((sum, a) => sum + a.points, 0);

    return quizEconomy.updateStats(
      stats,
      newlyUnlocked.map((a) => a.id),
      xpEarned + achievementBonusXP
    );
  }

  private calculateXPEarned(score: number, totalQuestions: number, streak: number): number {
    let xp = score * 10;
    xp += streak * 5;
    if (score === totalQuestions && totalQuestions > 0) {
      xp += 50;
    }
    const accuracy = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;
    if (accuracy >= 90) xp += 30;
    else if (accuracy >= 80) xp += 20;
    else if (accuracy >= 70) xp += 10;
    return xp;
  }

  private updateDailyStreak(stats: QuizStats): void {
    const today = new Date().toDateString();
    const lastPlay = stats.lastDailyPlay ? new Date(stats.lastDailyPlay).toDateString() : '';

    if (today === lastPlay) {
      return;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (lastPlay === yesterday.toDateString()) {
      stats.dailyStreak += 1;
      stats.longestDailyStreak = Math.max(stats.longestDailyStreak, stats.dailyStreak);
    } else {
      stats.dailyStreak = 1;
    }

    stats.lastDailyPlay = today;
  }

  private checkAchievements(stats: QuizStats): Achievement[] {
    const unlockedAchievements: Achievement[] = [];
    const currentAchievements = this.getAchievements();

    ACHIEVEMENTS.forEach((achievement) => {
      if (currentAchievements.find((a) => a.id === achievement.id)?.unlocked) {
        return;
      }

      let unlocked = false;
      switch (achievement.requirement.type) {
        case 'total':
          unlocked =
            achievement.requirement.value === 7
              ? stats.dailyStreak >= 7
              : stats.totalGames >= achievement.requirement.value;
          break;
        case 'score':
          unlocked = stats.totalCorrect >= achievement.requirement.value;
          break;
        case 'streak':
          unlocked = stats.bestStreak >= achievement.requirement.value;
          break;
        case 'category': {
          const categoryCorrect = stats.categoryMastery[achievement.requirement.category!] || 0;
          unlocked = categoryCorrect >= achievement.requirement.value;
          break;
        }
        case 'accuracy':
          if (stats.totalQuestions > 0) {
            const accuracy = (stats.totalCorrect / stats.totalQuestions) * 100;
            unlocked = accuracy >= achievement.requirement.value;
          }
          break;
        case 'level':
          unlocked = stats.level >= achievement.requirement.value;
          break;
      }

      if (unlocked) {
        const updatedAchievement: Achievement = {
          ...achievement,
          unlocked: true,
          unlockedAt: new Date().toISOString(),
        };
        const existingIdx = currentAchievements.findIndex((a) => a.id === achievement.id);
        if (existingIdx >= 0) {
          currentAchievements[existingIdx] = updatedAchievement;
        } else {
          currentAchievements.push(updatedAchievement);
        }
        unlockedAchievements.push(updatedAchievement);
      }
    });

    try {
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(currentAchievements));
    } catch (err) {
      console.warn('[quiz-manager] Failed saving achievements:', err);
    }

    return unlockedAchievements;
  }

  getAchievements(): Achievement[] {
    return quizEconomy.getAchievementsList();
  }

  getPowerUps(): PowerUp[] {
    return quizEconomy.getPowerUpsList();
  }

  usePowerUp(powerUpId: string): boolean {
    return quizEconomy.consumePowerUp(powerUpId, 1);
  }

  addPowerUpUses(powerUpId: string, uses: number): void {
    quizEconomy.addPowerUp(powerUpId, uses);
  }

  getQuestions(categories?: string[], difficulty?: string, count: number = 10): QuizQuestion[] {
    let filtered = ENHANCED_QUESTIONS;

    if (categories && categories.length > 0) {
      filtered = filtered.filter((q) => categories.includes(q.category));
    }

    if (difficulty) {
      filtered = filtered.filter((q) => q.difficulty === difficulty);
    }

    return [...filtered]
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(count, filtered.length));
  }

  getLevelProgress(): { current: number; next: number; progress: number; remaining: number } {
    return getLevelProgressFromXP(quizEconomy.getState().xp);
  }

  resetStats(): void {
    quizEconomy.resetAll();
  }
}

export const quizManager = QuizManager.getInstance();
