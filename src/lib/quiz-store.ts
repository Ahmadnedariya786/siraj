/**
 * Quiz Store Manager - Handles inventory, purchases, and XP economy
 * Backed by the single-source quiz-economy reactive store (`siraj_quiz_state_v1`)
 */

import {
  StoreItem,
  UserInventory,
  PurchaseRecord,
  StoreState,
  DailyReward,
  DailyRewardStatus,
  ComboState,
  QuizSession,
  DailyChallenge,
  XPTransaction,
  STORAGE_KEYS,
  ActiveBooster,
} from '@/data/quiz-store-data';
import { ALL_STORE_ITEMS, getStoreItemById, meetsRequirements } from '@/data/store-catalog';
import { quizEconomy } from '@/lib/quiz-economy';

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn('[quiz-store] Failed parsing JSON from localStorage:', err);
    return null;
  }
}

export class QuizStore {
  private static instance: QuizStore;

  static getInstance(): QuizStore {
    if (!QuizStore.instance) {
      QuizStore.instance = new QuizStore();
    }
    return QuizStore.instance;
  }

  // ==================== INVENTORY ====================

  getInventory(): UserInventory {
    const state = quizEconomy.getState();
    return {
      items: { ...state.powerups },
      activeBoosters: [...state.activeBoosters],
    };
  }

  private saveInventory(inventory: UserInventory): void {
    quizEconomy.setPowerupsAndBoosters(inventory.items, inventory.activeBoosters);
  }

  getItemQuantity(itemId: string): number {
    return quizEconomy.getPowerUpQuantity(itemId);
  }

  addToInventory(itemId: string, quantity: number = 1): boolean {
    const item = getStoreItemById(itemId);
    if (!item) return false;
    return quizEconomy.addPowerUp(itemId, quantity);
  }

  removeFromInventory(itemId: string, quantity: number = 1): boolean {
    return quizEconomy.consumePowerUp(itemId, quantity);
  }

  useItem(itemId: string): boolean {
    const item = getStoreItemById(itemId);
    if (!item) return false;

    if (item.type === 'booster') {
      return this.activateBooster(itemId);
    }

    return this.removeFromInventory(itemId, 1);
  }

  // ==================== STORE STATE & PURCHASES ====================

  getStoreState(): StoreState {
    const saved = safeParseJson<Partial<StoreState>>(localStorage.getItem(STORAGE_KEYS.STORE_STATE));
    return {
      inventory: this.getInventory(),
      purchaseHistory: Array.isArray(saved?.purchaseHistory) ? saved.purchaseHistory : [],
      totalSpent: typeof saved?.totalSpent === 'number' ? saved.totalSpent : 0,
    };
  }

  getStoreItems(): (StoreItem & { owned: number; canAfford: boolean; unlocked: boolean })[] {
    const state = quizEconomy.getState();
    const achievements = state.badges;
    const currentXP = state.xp;

    return ALL_STORE_ITEMS.map((item) => {
      const owned = state.powerups[item.id] || 0;
      const canAfford = currentXP >= item.cost;
      const unlocked = meetsRequirements(item, state.level, achievements, state.categoryMastery);

      return {
        ...item,
        owned,
        canAfford,
        unlocked,
      };
    });
  }

  purchaseItem(itemId: string): { success: boolean; message?: string } {
    return quizEconomy.purchaseStoreItem(itemId);
  }

  getPurchaseHistory(): PurchaseRecord[] {
    return this.getStoreState().purchaseHistory;
  }

  // ==================== XP MANAGEMENT ====================

  spendXP(amount: number, reason: string): boolean {
    return quizEconomy.spendXP(amount, reason);
  }

  addXP(amount: number, source: string): number {
    return quizEconomy.addXP(amount, source, true);
  }

  getXPTransactions(): XPTransaction[] {
    return safeParseJson<XPTransaction[]>(localStorage.getItem(STORAGE_KEYS.XP_TRANSACTIONS)) || [];
  }

  // ==================== BOOSTERS ====================

  activateBooster(itemId: string): boolean {
    return quizEconomy.activateBooster(itemId);
  }

  getActiveBoosters(): ActiveBooster[] {
    return quizEconomy.pruneExpiredBoosters();
  }

  isEffectActive(effectType: string): boolean {
    return this.getActiveBoosters().some((b) => b.effect.type === effectType);
  }

  getEffectValue(effectType: string): number {
    const booster = this.getActiveBoosters().find((b) => b.effect.type === effectType);
    return booster ? booster.effect.value : 0;
  }

  // ==================== DAILY REWARDS ====================

  getDailyRewardStatus(): DailyRewardStatus {
    const saved = safeParseJson<DailyRewardStatus>(localStorage.getItem(STORAGE_KEYS.DAILY_REWARDS));
    const today = new Date().toDateString();

    const status: DailyRewardStatus = saved || this.createDefaultDailyRewards();

    const lastClaim = status.lastClaimDate ? new Date(status.lastClaimDate) : null;
    if (lastClaim && !Number.isNaN(lastClaim.getTime())) {
      const daysDiff = Math.round(
        (new Date(today).getTime() - lastClaim.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 1) {
        const streakFreezes = this.getItemQuantity('streak_freeze');
        if (streakFreezes > 0) {
          this.removeFromInventory('streak_freeze', 1);
        } else {
          status.rewards = this.createDefaultDailyRewards().rewards;
          status.currentStreak = 0;
        }
      }
    }

    if (status.currentStreak >= 7 && status.lastClaimDate !== today) {
      status.rewards = this.createDefaultDailyRewards().rewards;
      status.currentStreak = 0;
    }

    const todayReward = status.rewards.find((r) => r.day === status.currentStreak + 1);
    status.canClaimToday = status.lastClaimDate !== today && Boolean(todayReward);
    status.nextReward = status.canClaimToday && todayReward ? todayReward : null;

    localStorage.setItem(STORAGE_KEYS.DAILY_REWARDS, JSON.stringify(status));
    return status;
  }

  private createDefaultDailyRewards(): DailyRewardStatus {
    const rewards: DailyReward[] = [
      { day: 1, xp: 50, claimed: false },
      { day: 2, xp: 75, items: [{ itemId: 'fifty_fifty', quantity: 1 }], claimed: false },
      { day: 3, xp: 100, items: [{ itemId: 'hint', quantity: 2 }], claimed: false },
      { day: 4, xp: 125, items: [{ itemId: 'extra_time', quantity: 1 }], claimed: false },
      { day: 5, xp: 150, items: [{ itemId: 'skip', quantity: 1 }], claimed: false },
      { day: 6, xp: 200, items: [{ itemId: 'double_points', quantity: 1 }], claimed: false },
      { day: 7, xp: 300, items: [{ itemId: 'perfect_round', quantity: 1 }], claimed: false },
    ];

    return {
      currentStreak: 0,
      lastClaimDate: null,
      rewards,
      canClaimToday: true,
      nextReward: rewards[0],
    };
  }

  claimDailyReward(): { success: boolean; reward?: DailyReward; message?: string } {
    const status = this.getDailyRewardStatus();
    const today = new Date().toDateString();

    if (!status.canClaimToday) {
      return { success: false, message: 'Already claimed today' };
    }

    const reward = status.rewards.find((r) => r.day === status.currentStreak + 1);
    if (!reward) {
      return { success: false, message: 'No reward available' };
    }

    reward.claimed = true;
    reward.claimDate = today;

    status.currentStreak = reward.day;
    status.lastClaimDate = today;

    if (reward.xp > 0) {
      this.addXP(reward.xp, 'Daily Reward Day ' + reward.day);
    }

    if (reward.items) {
      reward.items.forEach((item) => {
        this.addToInventory(item.itemId, item.quantity);
      });
    }

    if (status.currentStreak === 7) {
      this.addXP(500, 'Weekly Streak Complete!');
    }

    status.nextReward = null;
    status.canClaimToday = false;

    localStorage.setItem(STORAGE_KEYS.DAILY_REWARDS, JSON.stringify(status));
    quizEconomy.syncDailyRewards(status.currentStreak, status.lastClaimDate);

    return { success: true, reward };
  }

  // ==================== COMBO SYSTEM ====================

  getComboState(): ComboState {
    const saved = safeParseJson<Partial<ComboState>>(localStorage.getItem(STORAGE_KEYS.COMBO_STATE));
    if (saved) {
      return { ...this.getDefaultComboState(), ...saved };
    }
    return this.getDefaultComboState();
  }

  private getDefaultComboState(): ComboState {
    return {
      currentCombo: 0,
      maxCombo: 0,
      comboMultiplier: 1,
      lastAnswerTime: 0,
      isActive: false,
    };
  }

  private saveComboState(state: ComboState): void {
    localStorage.setItem(STORAGE_KEYS.COMBO_STATE, JSON.stringify(state));
  }

  updateCombo(isCorrect: boolean): ComboState {
    const state = this.getComboState();

    if (isCorrect) {
      state.currentCombo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.currentCombo);
      state.isActive = true;
      state.lastAnswerTime = Date.now();

      const multiplierBonus = Math.floor(state.currentCombo / 3) * 0.1;
      state.comboMultiplier = Math.min(1 + multiplierBonus, 3);
      this.checkComboRewards(state.currentCombo);
    } else {
      const hasProtection = this.isEffectActive('streakProtection');
      state.currentCombo = 0;
      state.comboMultiplier = 1;
      state.isActive = false;

      if (hasProtection) {
        const inventory = this.getInventory();
        inventory.activeBoosters = inventory.activeBoosters.filter(
          (b) => b.effect.type !== 'streakProtection'
        );
        this.saveInventory(inventory);
      }
    }

    this.saveComboState(state);
    return state;
  }

  private checkComboRewards(combo: number): void {
    if (combo % 10 === 0) {
      const basicItems = ALL_STORE_ITEMS.filter((i) => i.category === 'basic');
      const randomItem = basicItems[Math.floor(Math.random() * basicItems.length)];
      if (randomItem) {
        this.addToInventory(randomItem.id, 1);
      }
    }

    const streakRewards: Record<number, { xp: number; item?: string }> = {
      5: { xp: 10 },
      10: { xp: 25, item: 'hint' },
      15: { xp: 50, item: 'skip' },
      20: { xp: 100 },
    };

    const reward = streakRewards[combo];
    if (reward) {
      this.addXP(reward.xp, `${combo} Answer Streak!`);
      if (reward.item) {
        this.addToInventory(reward.item, 1);
      }
    }
  }

  resetCombo(): void {
    this.saveComboState(this.getDefaultComboState());
  }

  getCurrentMultiplier(): number {
    return this.getComboState().comboMultiplier;
  }

  // ==================== QUIZ HISTORY ====================

  saveQuizSession(session: QuizSession): void {
    const history = this.getQuizHistory();
    history.unshift(session);
    if (history.length > 50) {
      history.pop();
    }
    localStorage.setItem(STORAGE_KEYS.QUIZ_HISTORY, JSON.stringify(history));
  }

  getQuizHistory(): QuizSession[] {
    return safeParseJson<QuizSession[]>(localStorage.getItem(STORAGE_KEYS.QUIZ_HISTORY)) || [];
  }

  getQuizHistoryByMode(mode: QuizSession['mode']): QuizSession[] {
    return this.getQuizHistory().filter((s) => s.mode === mode);
  }

  getBestScore(mode: QuizSession['mode']): number {
    return this.getQuizHistoryByMode(mode).reduce(
      (best, session) => Math.max(best, session.score),
      0
    );
  }

  // ==================== DAILY CHALLENGES ====================

  getDailyChallenge(): DailyChallenge {
    const saved = safeParseJson<DailyChallenge>(localStorage.getItem(STORAGE_KEYS.DAILY_CHALLENGE));
    const today = new Date().toDateString();

    if (saved && new Date(saved.date).toDateString() === today) {
      return saved;
    }

    const newChallenge = this.generateDailyChallenge();
    localStorage.setItem(STORAGE_KEYS.DAILY_CHALLENGE, JSON.stringify(newChallenge));
    return newChallenge;
  }

  private generateDailyChallenge(): DailyChallenge {
    const today = new Date();
    const types: DailyChallenge['type'][] = ['category', 'speedRun', 'noPowerups', 'hardMode', 'mystery'];
    const categories = ['quran', 'prophets', 'prayer', 'pillars', 'history', 'ramadan'];

    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const type = types[dayOfYear % types.length];
    const category = categories[dayOfYear % categories.length];

    const challengeConfigs: Record<DailyChallenge['type'], Partial<DailyChallenge>> = {
      category: {
        title: 'Category Focus',
        description: `Answer 10 questions about ${category}`,
        rules: { category, questionCount: 10, allowPowerups: true },
      },
      speedRun: {
        title: 'Speed Run',
        description: 'Answer 20 questions as fast as possible!',
        rules: { questionCount: 20, timeLimit: 180, allowPowerups: true },
      },
      noPowerups: {
        title: 'Pure Knowledge',
        description: 'Test your knowledge without any power-ups! 2x XP reward.',
        rules: { questionCount: 15, allowPowerups: false },
      },
      hardMode: {
        title: 'Hard Mode',
        description: 'Only hard questions! 3x XP reward.',
        rules: { questionCount: 10, difficulty: 'hard', allowPowerups: true },
      },
      mystery: {
        title: 'Mystery Mix',
        description: 'Random categories and difficulties!',
        rules: { questionCount: 15, difficulty: 'mixed', allowPowerups: true },
      },
    };

    const config = challengeConfigs[type];

    return {
      id: `challenge_${today.toISOString().split('T')[0]}`,
      date: today.toISOString(),
      type,
      title: config.title!,
      description: config.description!,
      rules: {
        questionCount: 10,
        allowPowerups: true,
        ...config.rules,
      },
      reward: {
        xp: type === 'hardMode' ? 300 : type === 'noPowerups' ? 200 : 100,
        item: { itemId: 'hint', quantity: 1 },
      },
      completed: false,
    };
  }

  completeDailyChallenge(): void {
    const challenge = this.getDailyChallenge();
    if (challenge.completed) return;

    challenge.completed = true;
    challenge.completedAt = new Date().toISOString();

    this.addXP(challenge.reward.xp, 'Daily Challenge Complete!');
    if (challenge.reward.item) {
      this.addToInventory(challenge.reward.item.itemId, challenge.reward.item.quantity);
    }

    localStorage.setItem(STORAGE_KEYS.DAILY_CHALLENGE, JSON.stringify(challenge));
  }

  // ==================== UTILITY ====================

  getXPSummary(): { earned: number; spent: number; current: number } {
    const transactions = this.getXPTransactions();
    const earned = transactions
      .filter((t) => t.type === 'earned')
      .reduce((sum, t) => sum + t.amount, 0);
    const spent = transactions
      .filter((t) => t.type === 'spent')
      .reduce((sum, t) => sum + t.amount, 0);

    return { earned, spent, current: quizEconomy.getState().xp };
  }

  resetStore(): void {
    quizEconomy.resetAll();
  }
}

export const quizStore = QuizStore.getInstance();
