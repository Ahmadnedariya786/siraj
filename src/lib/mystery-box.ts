/**
 * Mystery Box / Loot Box System
 * Connected atomically to the single-source quiz-economy store (`siraj_quiz_state_v1`)
 */

import { ALL_STORE_ITEMS } from '@/data/store-catalog';
import { quizEconomy, canClaimDailyFreeBox } from '@/lib/quiz-economy';

export interface MysteryBox {
  id: string;
  name: string;
  description: string;
  cost: number;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  drops: BoxDrop[];
}

export interface BoxDrop {
  itemId: string;
  quantity: number;
  probability: number;
}

export interface BoxOpeningResult {
  itemId: string;
  itemName: string;
  quantity: number;
  rarity: string;
  icon: string;
}

export const MYSTERY_BOXES: MysteryBox[] = [
  {
    id: 'basic_box',
    name: 'Knowledge Box',
    description: 'Contains basic power-ups and small XP rewards',
    cost: 100,
    icon: 'package',
    rarity: 'common',
    drops: [
      { itemId: 'hint', quantity: 1, probability: 40 },
      { itemId: 'extra_time', quantity: 1, probability: 30 },
      { itemId: 'fifty_fifty', quantity: 1, probability: 20 },
      { itemId: 'xp_50', quantity: 1, probability: 10 },
    ],
  },
  {
    id: 'premium_box',
    name: 'Wisdom Chest',
    description: 'Better rewards including premium items',
    cost: 250,
    icon: 'sparkles',
    rarity: 'rare',
    drops: [
      { itemId: 'double_points', quantity: 1, probability: 35 },
      { itemId: 'freeze_time', quantity: 1, probability: 25 },
      { itemId: 'skip', quantity: 1, probability: 20 },
      { itemId: 'hint', quantity: 3, probability: 15 },
      { itemId: 'xp_150', quantity: 1, probability: 5 },
    ],
  },
  {
    id: 'legendary_box',
    name: "Prophet's Treasure",
    description: 'Legendary items and massive XP rewards',
    cost: 500,
    icon: 'crown',
    rarity: 'epic',
    drops: [
      { itemId: 'perfect_round', quantity: 1, probability: 30 },
      { itemId: 'barakah_boost', quantity: 1, probability: 25 },
      { itemId: 'wisdom_sahaba', quantity: 1, probability: 20 },
      { itemId: 'double_points', quantity: 2, probability: 15 },
      { itemId: 'xp_400', quantity: 1, probability: 8 },
      { itemId: 'divine_guidance', quantity: 1, probability: 2 },
    ],
  },
  {
    id: 'daily_free_box',
    name: 'Daily Gift',
    description: 'Free daily reward box',
    cost: 0,
    icon: 'gift',
    rarity: 'common',
    drops: [
      { itemId: 'hint', quantity: 1, probability: 50 },
      { itemId: 'extra_time', quantity: 1, probability: 30 },
      { itemId: 'fifty_fifty', quantity: 1, probability: 15 },
      { itemId: 'xp_25', quantity: 1, probability: 5 },
    ],
  },
];

export const XP_DROPS: Record<string, number> = {
  xp_25: 25,
  xp_50: 50,
  xp_150: 150,
  xp_400: 400,
};

export class MysteryBoxSystem {
  private static instance: MysteryBoxSystem;

  static getInstance(): MysteryBoxSystem {
    if (!MysteryBoxSystem.instance) {
      MysteryBoxSystem.instance = new MysteryBoxSystem();
    }
    return MysteryBoxSystem.instance;
  }

  getBoxes(): MysteryBox[] {
    return MYSTERY_BOXES;
  }

  canClaimDailyBox(): boolean {
    return canClaimDailyFreeBox(quizEconomy.getState().lastFreeBoxDate);
  }

  getTimeUntilNextBox(): string {
    if (this.canClaimDailyBox()) return '00:00:00';

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();
    if (diff <= 0) return '00:00:00';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  openBox(
    boxId: string,
    rng: () => number = Math.random
  ): { success: boolean; results?: BoxOpeningResult[]; message?: string } {
    const box = MYSTERY_BOXES.find((b) => b.id === boxId);
    if (!box) {
      return { success: false, message: 'Box not found' };
    }

    let claimDateUpdate: string | undefined;

    if (boxId === 'daily_free_box') {
      if (!this.canClaimDailyBox()) {
        return { success: false, message: 'Daily box already claimed' };
      }
      claimDateUpdate = new Date().toISOString();
    } else {
      const spent = quizEconomy.spendXP(box.cost, `Mystery Box: ${box.name}`);
      if (!spent) {
        return { success: false, message: `Need ${box.cost - quizEconomy.getState().xp} XP more` };
      }
    }

    const results: BoxOpeningResult[] = [];
    const numDrops = box.rarity === 'legendary' ? 3 : box.rarity === 'epic' ? 2 : 1;

    for (let i = 0; i < numDrops; i++) {
      const drop = this.rollDrop(box.drops, rng);
      if (drop) {
        if (XP_DROPS[drop.itemId]) {
          const xpAmount = XP_DROPS[drop.itemId];
          quizEconomy.addXP(xpAmount, 'Mystery Box XP Drop', false);
          results.push({
            itemId: drop.itemId,
            itemName: `${xpAmount} XP`,
            quantity: xpAmount,
            rarity: 'xp',
            icon: 'sparkles',
          });
        } else {
          const item = ALL_STORE_ITEMS.find((entry) => entry.id === drop.itemId);
          if (item) {
            quizEconomy.addPowerUp(item.id, drop.quantity);
            results.push({
              itemId: item.id,
              itemName: item.name,
              quantity: drop.quantity,
              rarity: item.category,
              icon: item.id,
            });
          }
        }
      }
    }

    this.recordBoxOpening(boxId, results, claimDateUpdate);
    return { success: true, results };
  }

  private rollDrop(drops: BoxDrop[], rng: () => number = Math.random): BoxDrop | null {
    const roll = rng() * 100;
    let cumulative = 0;

    for (const drop of drops) {
      cumulative += drop.probability;
      if (roll <= cumulative) {
        return drop;
      }
    }

    return drops[0] || null;
  }

  private recordBoxOpening(
    boxId: string,
    results: BoxOpeningResult[],
    claimIsoDate?: string
  ): void {
    const history = this.getBoxHistory();
    history.unshift({
      boxId,
      openedAt: new Date().toISOString(),
      results,
    });

    if (history.length > 50) {
      history.pop();
    }

    try {
      localStorage.setItem('mystery-box-history', JSON.stringify(history));
    } catch (err) {
      console.warn('[mystery-box] Failed writing box history:', err);
    }

    quizEconomy.recordBoxOpened(claimIsoDate);
  }

  getBoxHistory(): Array<{ boxId: string; openedAt: string; results: BoxOpeningResult[] }> {
    const saved = localStorage.getItem('mystery-box-history');
    if (!saved) return [];
    try {
      return JSON.parse(saved);
    } catch (err) {
      console.warn('[mystery-box] Failed reading box history:', err);
      return [];
    }
  }

  getTotalBoxesOpened(): number {
    return quizEconomy.getState().totalBoxesOpened;
  }

  getBestDrop(): BoxOpeningResult | null {
    const history = this.getBoxHistory();
    let best: BoxOpeningResult | null = null;

    for (const entry of history) {
      for (const result of entry.results) {
        if (!best || this.getRarityValue(result.rarity) > this.getRarityValue(best.rarity)) {
          best = result;
        }
      }
    }

    return best;
  }

  private getRarityValue(rarity: string): number {
    const values: Record<string, number> = {
      xp: 1,
      basic: 2,
      premium: 3,
      legendary: 4,
      epic: 5,
    };
    return values[rarity] || 0;
  }
}

export const mysteryBoxSystem = MysteryBoxSystem.getInstance();
