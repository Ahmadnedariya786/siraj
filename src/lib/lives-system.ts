/**
 * Lives System - Scarcity and regeneration backed by quiz-economy store (`siraj_quiz_state_v1`)
 */

import { quizEconomy, MAX_LIVES } from '@/lib/quiz-economy';

const REGENERATION_MINUTES = 30;
const REFILL_COST = 100;

export interface LivesState {
  currentLives: number;
  maxLives: number;
  lastRegenerationTime: string;
  totalLivesUsed: number;
  totalRefills: number;
}

export class LivesSystem {
  private static instance: LivesSystem;

  static getInstance(): LivesSystem {
    if (!LivesSystem.instance) {
      LivesSystem.instance = new LivesSystem();
    }
    return LivesSystem.instance;
  }

  private getState(): LivesState {
    const eco = quizEconomy.getState();
    return {
      currentLives: eco.lives,
      maxLives: eco.maxLives,
      lastRegenerationTime: eco.lastLifeRegenAt,
      totalLivesUsed: eco.totalLivesUsed,
      totalRefills: eco.totalRefills,
    };
  }

  private saveState(state: LivesState): void {
    quizEconomy.updateLives({
      lives: state.currentLives,
      maxLives: state.maxLives,
      lastLifeRegenAt: state.lastRegenerationTime,
      totalLivesUsed: state.totalLivesUsed,
      totalRefills: state.totalRefills,
    });
  }

  private calculateRegeneratedLives(state: LivesState): number {
    const now = new Date();
    const lastRegen = new Date(state.lastRegenerationTime);
    const minutesPassed = (now.getTime() - lastRegen.getTime()) / (1000 * 60);
    const livesToAdd = Math.floor(minutesPassed / REGENERATION_MINUTES);
    return Math.max(0, Math.min(livesToAdd, state.maxLives - state.currentLives));
  }

  getCurrentLives(): number {
    const state = this.getState();
    const regenerated = this.calculateRegeneratedLives(state);

    if (regenerated > 0) {
      state.currentLives = Math.min(state.currentLives + regenerated, state.maxLives);
      state.lastRegenerationTime = new Date().toISOString();
      this.saveState(state);
    }

    return state.currentLives;
  }

  getMaxLives(): number {
    return this.getState().maxLives;
  }

  hasLives(): boolean {
    return this.getCurrentLives() > 0;
  }

  useLife(): boolean {
    const state = this.getState();
    const regenerated = this.calculateRegeneratedLives(state);
    if (regenerated > 0) {
      state.currentLives = Math.min(state.currentLives + regenerated, state.maxLives);
      state.lastRegenerationTime = new Date().toISOString();
    }

    if (state.currentLives <= 0) {
      return false;
    }

    state.currentLives -= 1;
    state.totalLivesUsed += 1;
    this.saveState(state);
    return true;
  }

  getTimeUntilNextLife(): string {
    const state = this.getState();
    if (state.currentLives >= state.maxLives) {
      return '00:00';
    }
    const now = new Date();
    const lastRegen = new Date(state.lastRegenerationTime);
    const minutesPassed = (now.getTime() - lastRegen.getTime()) / (1000 * 60);
    const minutesUntilNext = REGENERATION_MINUTES - (minutesPassed % REGENERATION_MINUTES);

    if (minutesUntilNext <= 0) return '00:00';

    const hours = Math.floor(minutesUntilNext / 60);
    const minutes = Math.floor(minutesUntilNext % 60);

    return hours > 0
      ? `${hours}h ${minutes.toString().padStart(2, '0')}m`
      : `${minutes.toString().padStart(2, '0')}m`;
  }

  refillLivesWithXP(): { success: boolean; message?: string } {
    const state = this.getState();
    if (state.currentLives >= state.maxLives) {
      return { success: false, message: 'Lives already full!' };
    }

    const spent = quizEconomy.spendXP(REFILL_COST, 'Life Refill');
    if (!spent) {
      return { success: false, message: `Need ${REFILL_COST} XP to refill` };
    }

    state.currentLives = state.maxLives;
    state.totalRefills += 1;
    this.saveState(state);
    return { success: true, message: 'Lives refilled!' };
  }

  addExtraLife(): boolean {
    const state = this.getState();
    if (state.currentLives < state.maxLives) {
      state.currentLives += 1;
      this.saveState(state);
      return true;
    }
    return false;
  }

  getLivesProgress(): number {
    return (this.getCurrentLives() / this.getMaxLives()) * 100;
  }

  getLossAversionMessage(): string | null {
    const lives = this.getCurrentLives();
    if (lives === 1) return 'Last life remaining. Play carefully!';
    if (lives === 2) return `2 lives remaining. Next life in ${this.getTimeUntilNextLife()}`;
    if (lives <= MAX_LIVES * 0.5) return `${lives} lives left. Next life in ${this.getTimeUntilNextLife()}`;
    return null;
  }

  isCritical(): boolean {
    return this.getCurrentLives() <= 2;
  }

  getStats(): { totalUsed: number; totalRefills: number } {
    const state = this.getState();
    return {
      totalUsed: state.totalLivesUsed,
      totalRefills: state.totalRefills,
    };
  }

  resetLives(): void {
    quizEconomy.updateLives({
      lives: MAX_LIVES,
      maxLives: MAX_LIVES,
      lastLifeRegenAt: new Date().toISOString(),
      totalLivesUsed: 0,
      totalRefills: 0,
    });
  }
}

export const livesSystem = LivesSystem.getInstance();
