/**
 * Single-Source Quiz Economy Store (`siraj_quiz_state_v1`)
 * Unifies XP, Level, Lives, Power-Ups Inventory, Mystery Box counts, Daily Streak, and Badges
 * across Quiz Lobby, Power-Up Store, Mystery Box Panel, Daily Rewards, and Achievements.
 */

import { useSyncExternalStore } from 'react';
import {
  LEVEL_THRESHOLDS,
  POWER_UPS,
  ACHIEVEMENTS,
  type QuizStats,
  type Achievement,
  type PowerUp,
} from '@/data/enhanced-quiz-data';
import {
  STORAGE_KEYS,
  type ActiveBooster,
  type XPTransaction,
  type PurchaseRecord,
  type StoreState,
} from '@/data/quiz-store-data';
import { getStoreItemById, meetsRequirements } from '@/data/store-catalog';

export const QUIZ_ECONOMY_STORAGE_KEY = 'siraj_quiz_state_v1';

const LEGACY_STATS_KEY = 'enhanced-quiz-stats';
const LEGACY_POWERUPS_KEY = 'quiz-power-ups';
const LEGACY_ACHIEVEMENTS_KEY = 'quiz-achievements';
const LEGACY_LIVES_KEY = 'quiz-lives-system';
const LEGACY_BOX_CLAIM_KEY = 'mystery-box-last-claim';
const LEGACY_BOX_HISTORY_KEY = 'mystery-box-history';

export const MAX_LIVES = 5;

export interface SirajQuizStateV1 {
  version: 1;
  xp: number;
  level: number;
  totalGames: number;
  totalCorrect: number;
  totalQuestions: number;
  currentStreak: number;
  bestStreak: number;
  dailyStreak: number;
  longestDailyStreak: number;
  lastDailyPlay: string;
  lastPlayed: string;
  categoryMastery: Record<string, number>;
  badges: string[];
  lives: number;
  maxLives: number;
  lastLifeRegenAt: string;
  totalLivesUsed: number;
  totalRefills: number;
  powerups: Record<string, number>;
  activeBoosters: ActiveBooster[];
  totalBoxesOpened: number;
  lastFreeBoxDate: string | null;
  streak: number;
  lastDailyRewardDate: string | null;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('[quiz-economy] Failed parsing stored JSON state:', err);
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (err) {
    console.warn(`[quiz-economy] Failed writing localStorage key "${key}":`, err);
  }
}

export function calculateLevelForXP(xp: number): { level: number; title: string } {
  const safeXp = Math.max(0, Math.floor(xp));
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (safeXp >= LEVEL_THRESHOLDS[i].xp) {
      return {
        level: LEVEL_THRESHOLDS[i].level,
        title: LEVEL_THRESHOLDS[i].title,
      };
    }
  }
  return { level: 1, title: 'Beginner' };
}

export function getLevelProgressFromXP(xp: number): {
  current: number;
  next: number;
  progress: number;
  remaining: number;
} {
  const safeXp = Math.max(0, Math.floor(xp));
  const levelInfo = calculateLevelForXP(safeXp);
  const currentLevel = LEVEL_THRESHOLDS.find((l) => l.level === levelInfo.level);
  const nextLevel = LEVEL_THRESHOLDS.find((l) => l.level === levelInfo.level + 1);

  if (!currentLevel) return { current: 0, next: 100, progress: 0, remaining: 100 };
  if (!nextLevel) return { current: currentLevel.xp, next: currentLevel.xp, progress: 100, remaining: 0 };

  const currentXP = safeXp - currentLevel.xp;
  const neededXP = nextLevel.xp - currentLevel.xp;
  const progress = neededXP > 0 ? (currentXP / neededXP) * 100 : 100;

  return {
    current: Math.max(0, currentXP),
    next: neededXP,
    progress: Math.min(100, Math.max(0, progress)),
    remaining: Math.max(0, neededXP - currentXP),
  };
}

export function canClaimDailyFreeBox(lastFreeBoxDate: string | null): boolean {
  if (!lastFreeBoxDate) return true;
  const lastDate = new Date(lastFreeBoxDate);
  if (Number.isNaN(lastDate.getTime())) return true;
  return lastDate.toDateString() !== new Date().toDateString();
}

function createDefaultState(): SirajQuizStateV1 {
  return {
    version: 1,
    xp: 0,
    level: 1,
    totalGames: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    currentStreak: 0,
    bestStreak: 0,
    dailyStreak: 0,
    longestDailyStreak: 0,
    lastDailyPlay: '',
    lastPlayed: '',
    categoryMastery: {},
    badges: [],
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    lastLifeRegenAt: new Date().toISOString(),
    totalLivesUsed: 0,
    totalRefills: 0,
    powerups: {},
    activeBoosters: [],
    totalBoxesOpened: 0,
    lastFreeBoxDate: null,
    streak: 0,
    lastDailyRewardDate: null,
  };
}

function migrateLegacyState(): SirajQuizStateV1 {
  const base = createDefaultState();

  const legacyStats = safeParseJson<Partial<QuizStats>>(localStorage.getItem(LEGACY_STATS_KEY));
  if (legacyStats) {
    if (typeof legacyStats.xp === 'number') base.xp = Math.max(0, legacyStats.xp);
    if (typeof legacyStats.totalGames === 'number') base.totalGames = legacyStats.totalGames;
    if (typeof legacyStats.totalCorrect === 'number') base.totalCorrect = legacyStats.totalCorrect;
    if (typeof legacyStats.totalQuestions === 'number') base.totalQuestions = legacyStats.totalQuestions;
    if (typeof legacyStats.currentStreak === 'number') base.currentStreak = legacyStats.currentStreak;
    if (typeof legacyStats.bestStreak === 'number') base.bestStreak = legacyStats.bestStreak;
    if (typeof legacyStats.dailyStreak === 'number') base.dailyStreak = legacyStats.dailyStreak;
    if (typeof legacyStats.longestDailyStreak === 'number') base.longestDailyStreak = legacyStats.longestDailyStreak;
    if (typeof legacyStats.lastDailyPlay === 'string') base.lastDailyPlay = legacyStats.lastDailyPlay;
    if (typeof legacyStats.lastPlayed === 'string') base.lastPlayed = legacyStats.lastPlayed;
    if (legacyStats.categoryMastery && typeof legacyStats.categoryMastery === 'object') {
      base.categoryMastery = { ...legacyStats.categoryMastery };
    }
    if (Array.isArray(legacyStats.achievements)) {
      base.badges = Array.from(new Set(legacyStats.achievements));
    }
  }

  // Fallback legacy alt XP keys if someone upgraded from pre-v3 builds
  if (base.xp === 0) {
    const altQuizStats = safeParseJson<{ xp?: number }>(localStorage.getItem('quizStats'));
    if (altQuizStats && typeof altQuizStats.xp === 'number' && altQuizStats.xp > 0) {
      base.xp = altQuizStats.xp;
    }
  }

  const legacyAchievements = safeParseJson<Achievement[]>(localStorage.getItem(LEGACY_ACHIEVEMENTS_KEY));
  if (Array.isArray(legacyAchievements)) {
    const unlockedIds = legacyAchievements.filter((a) => a && a.unlocked).map((a) => a.id);
    base.badges = Array.from(new Set([...base.badges, ...unlockedIds]));
  }

  const legacyInventory = safeParseJson<{ items?: Record<string, number>; activeBoosters?: ActiveBooster[] }>(
    localStorage.getItem(STORAGE_KEYS.INVENTORY)
  );
  if (legacyInventory?.items && typeof legacyInventory.items === 'object') {
    for (const [k, v] of Object.entries(legacyInventory.items)) {
      if (typeof v === 'number' && v > 0) {
        base.powerups[k] = v;
      }
    }
  }
  if (Array.isArray(legacyInventory?.activeBoosters)) {
    const now = Date.now();
    base.activeBoosters = legacyInventory.activeBoosters.filter(
      (b) => b && new Date(b.expiresAt).getTime() > now
    );
  }

  const legacyPowerUps = safeParseJson<PowerUp[]>(localStorage.getItem(LEGACY_POWERUPS_KEY));
  if (Array.isArray(legacyPowerUps)) {
    for (const p of legacyPowerUps) {
      if (p && typeof p.id === 'string' && typeof p.uses === 'number' && p.uses > 0) {
        base.powerups[p.id] = Math.max(base.powerups[p.id] || 0, p.uses);
      }
    }
  }

  const legacyLives = safeParseJson<{
    currentLives?: number;
    maxLives?: number;
    lastRegenerationTime?: string;
    totalLivesUsed?: number;
    totalRefills?: number;
  }>(localStorage.getItem(LEGACY_LIVES_KEY));
  if (legacyLives) {
    if (typeof legacyLives.currentLives === 'number') base.lives = Math.max(0, legacyLives.currentLives);
    if (typeof legacyLives.maxLives === 'number') base.maxLives = Math.max(1, legacyLives.maxLives);
    if (typeof legacyLives.lastRegenerationTime === 'string') base.lastLifeRegenAt = legacyLives.lastRegenerationTime;
    if (typeof legacyLives.totalLivesUsed === 'number') base.totalLivesUsed = legacyLives.totalLivesUsed;
    if (typeof legacyLives.totalRefills === 'number') base.totalRefills = legacyLives.totalRefills;
  }

  const legacyDaily = safeParseJson<{ currentStreak?: number; lastClaimDate?: string | null }>(
    localStorage.getItem(STORAGE_KEYS.DAILY_REWARDS)
  );
  if (legacyDaily) {
    if (typeof legacyDaily.currentStreak === 'number') base.streak = legacyDaily.currentStreak;
    if (legacyDaily.lastClaimDate !== undefined) base.lastDailyRewardDate = legacyDaily.lastClaimDate;
  }

  const legacyBoxClaim = localStorage.getItem(LEGACY_BOX_CLAIM_KEY);
  if (legacyBoxClaim) base.lastFreeBoxDate = legacyBoxClaim;

  const legacyBoxHistory = safeParseJson<unknown[]>(localStorage.getItem(LEGACY_BOX_HISTORY_KEY));
  if (Array.isArray(legacyBoxHistory)) base.totalBoxesOpened = legacyBoxHistory.length;

  base.level = calculateLevelForXP(base.xp).level;
  return base;
}

function normalizeState(raw: Partial<SirajQuizStateV1> | null): SirajQuizStateV1 {
  if (!raw) return migrateLegacyState();
  const def = createDefaultState();
  const xp = typeof raw.xp === 'number' && Number.isFinite(raw.xp) ? Math.max(0, raw.xp) : def.xp;
  const now = Date.now();
  const activeBoosters = Array.isArray(raw.activeBoosters)
    ? raw.activeBoosters.filter((b) => b && new Date(b.expiresAt).getTime() > now)
    : [];

  return {
    version: 1,
    xp,
    level: calculateLevelForXP(xp).level,
    totalGames: typeof raw.totalGames === 'number' ? raw.totalGames : def.totalGames,
    totalCorrect: typeof raw.totalCorrect === 'number' ? raw.totalCorrect : def.totalCorrect,
    totalQuestions: typeof raw.totalQuestions === 'number' ? raw.totalQuestions : def.totalQuestions,
    currentStreak: typeof raw.currentStreak === 'number' ? raw.currentStreak : def.currentStreak,
    bestStreak: typeof raw.bestStreak === 'number' ? raw.bestStreak : def.bestStreak,
    dailyStreak: typeof raw.dailyStreak === 'number' ? raw.dailyStreak : def.dailyStreak,
    longestDailyStreak: typeof raw.longestDailyStreak === 'number' ? raw.longestDailyStreak : def.longestDailyStreak,
    lastDailyPlay: typeof raw.lastDailyPlay === 'string' ? raw.lastDailyPlay : def.lastDailyPlay,
    lastPlayed: typeof raw.lastPlayed === 'string' ? raw.lastPlayed : def.lastPlayed,
    categoryMastery: raw.categoryMastery && typeof raw.categoryMastery === 'object' ? { ...raw.categoryMastery } : {},
    badges: Array.isArray(raw.badges) ? Array.from(new Set(raw.badges)) : [],
    lives: typeof raw.lives === 'number' ? Math.max(0, raw.lives) : def.lives,
    maxLives: typeof raw.maxLives === 'number' ? Math.max(1, raw.maxLives) : def.maxLives,
    lastLifeRegenAt: typeof raw.lastLifeRegenAt === 'string' ? raw.lastLifeRegenAt : def.lastLifeRegenAt,
    totalLivesUsed: typeof raw.totalLivesUsed === 'number' ? raw.totalLivesUsed : def.totalLivesUsed,
    totalRefills: typeof raw.totalRefills === 'number' ? raw.totalRefills : def.totalRefills,
    powerups: raw.powerups && typeof raw.powerups === 'object' ? { ...raw.powerups } : {},
    activeBoosters,
    totalBoxesOpened: typeof raw.totalBoxesOpened === 'number' ? Math.max(0, raw.totalBoxesOpened) : 0,
    lastFreeBoxDate: typeof raw.lastFreeBoxDate === 'string' ? raw.lastFreeBoxDate : null,
    streak: typeof raw.streak === 'number' ? Math.max(0, raw.streak) : 0,
    lastDailyRewardDate: typeof raw.lastDailyRewardDate === 'string' ? raw.lastDailyRewardDate : null,
  };
}

function mirrorToLegacyKeys(state: SirajQuizStateV1): void {
  const legacyStats: QuizStats = {
    totalGames: state.totalGames,
    totalCorrect: state.totalCorrect,
    totalQuestions: state.totalQuestions,
    currentStreak: state.currentStreak,
    bestStreak: state.bestStreak,
    xp: state.xp,
    level: state.level,
    achievements: [...state.badges],
    categoryMastery: { ...state.categoryMastery },
    lastPlayed: state.lastPlayed,
    dailyStreak: state.dailyStreak,
    longestDailyStreak: state.longestDailyStreak,
    lastDailyPlay: state.lastDailyPlay,
  };
  safeSetItem(LEGACY_STATS_KEY, JSON.stringify(legacyStats));
  safeSetItem(
    STORAGE_KEYS.INVENTORY,
    JSON.stringify({ items: state.powerups, activeBoosters: state.activeBoosters })
  );
  safeSetItem(
    LEGACY_LIVES_KEY,
    JSON.stringify({
      currentLives: state.lives,
      maxLives: state.maxLives,
      lastRegenerationTime: state.lastLifeRegenAt,
      totalLivesUsed: state.totalLivesUsed,
      totalRefills: state.totalRefills,
    })
  );
  if (state.lastFreeBoxDate) {
    safeSetItem(LEGACY_BOX_CLAIM_KEY, state.lastFreeBoxDate);
  } else {
    localStorage.removeItem(LEGACY_BOX_CLAIM_KEY);
  }
}

function loadInitialState(): SirajQuizStateV1 {
  const existing = safeParseJson<Partial<SirajQuizStateV1>>(localStorage.getItem(QUIZ_ECONOMY_STORAGE_KEY));
  const normalized = normalizeState(existing);
  if (!existing) {
    safeSetItem(QUIZ_ECONOMY_STORAGE_KEY, JSON.stringify(normalized));
    mirrorToLegacyKeys(normalized);
  }
  return normalized;
}

let cachedState: SirajQuizStateV1 = loadInitialState();
const listeners = new Set<() => void>();

function emitChange(): void {
  listeners.forEach((listener) => listener());
}

function commitState(next: SirajQuizStateV1): SirajQuizStateV1 {
  const clean: SirajQuizStateV1 = {
    ...next,
    version: 1,
    xp: Math.max(0, Math.round(next.xp)),
    level: calculateLevelForXP(next.xp).level,
  };
  cachedState = clean;
  safeSetItem(QUIZ_ECONOMY_STORAGE_KEY, JSON.stringify(clean));
  mirrorToLegacyKeys(clean);
  emitChange();
  return clean;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (
      event.key === QUIZ_ECONOMY_STORAGE_KEY ||
      event.key === LEGACY_STATS_KEY ||
      event.key === STORAGE_KEYS.INVENTORY ||
      event.key === null
    ) {
      cachedState = normalizeState(safeParseJson<Partial<SirajQuizStateV1>>(localStorage.getItem(QUIZ_ECONOMY_STORAGE_KEY)));
      emitChange();
    }
  });
}

export function subscribeQuizEconomy(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getQuizEconomySnapshot(): SirajQuizStateV1 {
  return cachedState;
}

function recordXPTransaction(amount: number, type: 'earned' | 'spent', source: string, balanceAfter: number): void {
  const transactions = safeParseJson<XPTransaction[]>(localStorage.getItem(STORAGE_KEYS.XP_TRANSACTIONS)) || [];
  transactions.unshift({
    id: `xp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    amount: Math.abs(amount),
    type,
    source,
    timestamp: new Date().toISOString(),
    balanceAfter,
  });
  if (transactions.length > 100) {
    transactions.length = 100;
  }
  safeSetItem(STORAGE_KEYS.XP_TRANSACTIONS, JSON.stringify(transactions));
}

function recordStorePurchase(itemId: string, itemName: string, cost: number, quantity: number): void {
  const existing = safeParseJson<Partial<StoreState>>(localStorage.getItem(STORAGE_KEYS.STORE_STATE));
  const history: PurchaseRecord[] = Array.isArray(existing?.purchaseHistory) ? [...existing.purchaseHistory] : [];
  const totalSpent = typeof existing?.totalSpent === 'number' ? existing.totalSpent : 0;

  history.unshift({
    itemId,
    itemName,
    cost,
    quantity,
    purchasedAt: new Date().toISOString(),
  });
  if (history.length > 50) {
    history.length = 50;
  }
  safeSetItem(
    STORAGE_KEYS.STORE_STATE,
    JSON.stringify({
      inventory: { items: cachedState.powerups, activeBoosters: cachedState.activeBoosters },
      purchaseHistory: history,
      totalSpent: totalSpent + cost,
    })
  );
}

export const quizEconomy = {
  getState(): SirajQuizStateV1 {
    return cachedState;
  },

  refreshFromStorage(): SirajQuizStateV1 {
    const raw = safeParseJson<Partial<SirajQuizStateV1>>(localStorage.getItem(QUIZ_ECONOMY_STORAGE_KEY));
    cachedState = normalizeState(raw);
    emitChange();
    return cachedState;
  },

  toQuizStats(state: SirajQuizStateV1 = cachedState): QuizStats {
    return {
      totalGames: state.totalGames,
      totalCorrect: state.totalCorrect,
      totalQuestions: state.totalQuestions,
      currentStreak: state.currentStreak,
      bestStreak: state.bestStreak,
      xp: state.xp,
      level: state.level,
      achievements: [...state.badges],
      categoryMastery: { ...state.categoryMastery },
      lastPlayed: state.lastPlayed,
      dailyStreak: state.dailyStreak,
      longestDailyStreak: state.longestDailyStreak,
      lastDailyPlay: state.lastDailyPlay,
    };
  },

  addXP(amount: number, source: string = 'Quiz Reward', applyBoosters: boolean = true): number {
    if (!Number.isFinite(amount) || amount <= 0) return 0;

    const now = Date.now();
    const activeBoosters = cachedState.activeBoosters.filter((b) => new Date(b.expiresAt).getTime() > now);
    let multiplier = 1;
    if (applyBoosters) {
      for (const booster of activeBoosters) {
        if (booster.effect.type === 'xpBonus') {
          multiplier += booster.effect.value;
        }
      }
    }

    const finalAmount = Math.round(amount * multiplier);
    const nextXp = cachedState.xp + finalAmount;
    const nextState = commitState({
      ...cachedState,
      xp: nextXp,
      activeBoosters,
    });
    recordXPTransaction(finalAmount, 'earned', source, nextState.xp);
    return finalAmount;
  },

  spendXP(amount: number, reason: string = 'Quiz Purchase'): boolean {
    if (!Number.isFinite(amount) || amount < 0) return false;
    if (cachedState.xp < amount) return false;
    if (amount === 0) return true;

    const nextXp = cachedState.xp - amount;
    const nextState = commitState({
      ...cachedState,
      xp: nextXp,
    });
    recordXPTransaction(-amount, 'spent', reason, nextState.xp);
    return true;
  },

  getPowerUpQuantity(itemId: string): number {
    return cachedState.powerups[itemId] || 0;
  },

  addPowerUp(itemId: string, quantity: number = 1): boolean {
    const item = getStoreItemById(itemId);
    const maxInv = item?.maxInventory ?? 99;
    const current = cachedState.powerups[itemId] || 0;
    const nextQty = Math.min(current + quantity, maxInv);
    commitState({
      ...cachedState,
      powerups: {
        ...cachedState.powerups,
        [itemId]: nextQty,
      },
    });
    return true;
  },

  consumePowerUp(itemId: string, quantity: number = 1): boolean {
    const current = cachedState.powerups[itemId] || 0;
    if (current < quantity) return false;
    const nextPowerups = { ...cachedState.powerups };
    const remaining = current - quantity;
    if (remaining <= 0) {
      delete nextPowerups[itemId];
    } else {
      nextPowerups[itemId] = remaining;
    }
    commitState({
      ...cachedState,
      powerups: nextPowerups,
    });
    return true;
  },

  purchaseStoreItem(itemId: string): { success: boolean; message?: string } {
    const item = getStoreItemById(itemId);
    if (!item) {
      return { success: false, message: 'Item not found' };
    }
    if (!meetsRequirements(item, cachedState.level, cachedState.badges, cachedState.categoryMastery)) {
      return { success: false, message: 'Requirements not met' };
    }
    const owned = cachedState.powerups[itemId] || 0;
    if (owned >= item.maxInventory) {
      return { success: false, message: 'Maximum inventory reached' };
    }
    if (cachedState.xp < item.cost) {
      return { success: false, message: `Need ${item.cost - cachedState.xp} XP more` };
    }

    const nextXp = cachedState.xp - item.cost;
    const nextQty = Math.min(owned + item.quantity, item.maxInventory);
    const nextState = commitState({
      ...cachedState,
      xp: nextXp,
      powerups: {
        ...cachedState.powerups,
        [itemId]: nextQty,
      },
    });
    recordXPTransaction(-item.cost, 'spent', `Purchase: ${item.name}`, nextState.xp);
    recordStorePurchase(item.id, item.name, item.cost, item.quantity);
    return { success: true, message: `Purchased ${item.name}!` };
  },

  activateBooster(itemId: string): boolean {
    const item = getStoreItemById(itemId);
    if (!item || item.type !== 'booster' || !item.effect?.duration) return false;
    const current = cachedState.powerups[itemId] || 0;
    if (current < 1) return false;

    const nextPowerups = { ...cachedState.powerups };
    if (current <= 1) {
      delete nextPowerups[itemId];
    } else {
      nextPowerups[itemId] = current - 1;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + item.effect.duration * 1000);
    const active = cachedState.activeBoosters.filter((b) => new Date(b.expiresAt).getTime() > now.getTime());
    active.push({
      itemId,
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      effect: {
        type: item.effect.type,
        value: item.effect.value,
      },
    });

    commitState({
      ...cachedState,
      powerups: nextPowerups,
      activeBoosters: active,
    });
    return true;
  },

  pruneExpiredBoosters(): ActiveBooster[] {
    const now = Date.now();
    const active = cachedState.activeBoosters.filter((b) => new Date(b.expiresAt).getTime() > now);
    if (active.length !== cachedState.activeBoosters.length) {
      commitState({
        ...cachedState,
        activeBoosters: active,
      });
    }
    return active;
  },

  setPowerupsAndBoosters(powerups: Record<string, number>, activeBoosters: ActiveBooster[]): void {
    commitState({
      ...cachedState,
      powerups: { ...powerups },
      activeBoosters: [...activeBoosters],
    });
  },

  recordBoxOpened(claimIsoDate?: string | null): void {
    commitState({
      ...cachedState,
      totalBoxesOpened: cachedState.totalBoxesOpened + 1,
      lastFreeBoxDate: claimIsoDate !== undefined ? claimIsoDate : cachedState.lastFreeBoxDate,
    });
  },

  syncDailyRewards(streak: number, lastDailyRewardDate: string | null): void {
    commitState({
      ...cachedState,
      streak,
      lastDailyRewardDate,
    });
  },

  updateStats(partial: Partial<QuizStats>, newlyUnlockedBadges: string[] = [], bonusXP: number = 0): QuizStats {
    const mergedBadges = Array.from(new Set([...cachedState.badges, ...newlyUnlockedBadges]));
    const nextState = commitState({
      ...cachedState,
      totalGames: partial.totalGames ?? cachedState.totalGames,
      totalCorrect: partial.totalCorrect ?? cachedState.totalCorrect,
      totalQuestions: partial.totalQuestions ?? cachedState.totalQuestions,
      currentStreak: partial.currentStreak ?? cachedState.currentStreak,
      bestStreak: partial.bestStreak ?? cachedState.bestStreak,
      dailyStreak: partial.dailyStreak ?? cachedState.dailyStreak,
      longestDailyStreak: partial.longestDailyStreak ?? cachedState.longestDailyStreak,
      lastDailyPlay: partial.lastDailyPlay ?? cachedState.lastDailyPlay,
      lastPlayed: partial.lastPlayed ?? cachedState.lastPlayed,
      categoryMastery: partial.categoryMastery ? { ...partial.categoryMastery } : cachedState.categoryMastery,
      badges: mergedBadges,
      xp: cachedState.xp + Math.max(0, bonusXP),
    });
    return this.toQuizStats(nextState);
  },

  updateLives(partial: Partial<{
    lives: number;
    maxLives: number;
    lastLifeRegenAt: string;
    totalLivesUsed: number;
    totalRefills: number;
  }>): void {
    commitState({
      ...cachedState,
      lives: partial.lives ?? cachedState.lives,
      maxLives: partial.maxLives ?? cachedState.maxLives,
      lastLifeRegenAt: partial.lastLifeRegenAt ?? cachedState.lastLifeRegenAt,
      totalLivesUsed: partial.totalLivesUsed ?? cachedState.totalLivesUsed,
      totalRefills: partial.totalRefills ?? cachedState.totalRefills,
    });
  },

  getPowerUpsList(): PowerUp[] {
    return POWER_UPS.map((p) => ({
      ...p,
      uses: cachedState.powerups[p.id] || 0,
      maxUses: Math.max(p.maxUses, cachedState.powerups[p.id] || 0),
    }));
  },

  getAchievementsList(): Achievement[] {
    const saved = safeParseJson<Achievement[]>(localStorage.getItem(LEGACY_ACHIEVEMENTS_KEY)) || [];
    const unlockedSet = new Set(cachedState.badges);
    return ACHIEVEMENTS.map((a) => {
      const savedEntry = saved.find((s) => s.id === a.id);
      const isUnlocked = unlockedSet.has(a.id) || Boolean(savedEntry?.unlocked);
      return {
        ...a,
        unlocked: isUnlocked,
        unlockedAt: savedEntry?.unlockedAt,
      };
    });
  },

  resetAll(): void {
    Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(QUIZ_ECONOMY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_STATS_KEY);
    localStorage.removeItem(LEGACY_POWERUPS_KEY);
    localStorage.removeItem(LEGACY_ACHIEVEMENTS_KEY);
    localStorage.removeItem(LEGACY_LIVES_KEY);
    localStorage.removeItem(LEGACY_BOX_CLAIM_KEY);
    localStorage.removeItem(LEGACY_BOX_HISTORY_KEY);
    commitState(createDefaultState());
  },
};

export function useQuizEconomy() {
  const state = useSyncExternalStore(
    subscribeQuizEconomy,
    getQuizEconomySnapshot,
    getQuizEconomySnapshot
  );

  const levelInfo = calculateLevelForXP(state.xp);
  const levelProgress = getLevelProgressFromXP(state.xp);
  const canClaimFreeBox = canClaimDailyFreeBox(state.lastFreeBoxDate);
  const stats = quizEconomy.toQuizStats(state);

  return {
    state,
    stats,
    xp: state.xp,
    level: state.level,
    levelTitle: levelInfo.title,
    levelProgress,
    lives: state.lives,
    maxLives: state.maxLives,
    powerups: state.powerups,
    totalBoxesOpened: state.totalBoxesOpened,
    lastFreeBoxDate: state.lastFreeBoxDate,
    canClaimFreeBox,
    streak: state.streak,
    badges: state.badges,
    addXP: quizEconomy.addXP.bind(quizEconomy),
    spendXP: quizEconomy.spendXP.bind(quizEconomy),
    addPowerUp: quizEconomy.addPowerUp.bind(quizEconomy),
    consumePowerUp: quizEconomy.consumePowerUp.bind(quizEconomy),
    purchaseStoreItem: quizEconomy.purchaseStoreItem.bind(quizEconomy),
  };
}
