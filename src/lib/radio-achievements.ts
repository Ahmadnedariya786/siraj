/**
 * Radio Listening Achievements System
 * Tracks and unlocks achievements based on listening habits
 */

import { Preferences } from '@capacitor/preferences';

export type AchievementType = 'time' | 'sessions' | 'streak' | 'variety' | 'dedication';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: number;
  type: AchievementType;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface UserAchievements {
  unlocked: string[];
  streakDays: number;
  lastListenDate: number | null;
  consecutiveDays: number;
}

const USER_ACHIEVEMENTS_KEY = 'user-radio-achievements';

export type AchievementLang = 'en' | 'ur' | 'gu';

export const ACHIEVEMENT_I18N: Record<AchievementLang, Record<string, { title: string; description: string }>> = {
  en: {
    first_listen: { title: 'First Listen', description: 'Listen to radio for the first time' },
    hour_listen: { title: 'Dedicated Listener', description: 'Listen for 1 hour total' },
    ten_hours: { title: 'Devoted Listener', description: 'Listen for 10 hours total' },
    hundred_hours: { title: 'Quran Scholar', description: 'Listen for 100 hours total' },
    five_sessions: { title: 'Getting Started', description: 'Complete 5 listening sessions' },
    fifty_sessions: { title: 'Regular Listener', description: 'Complete 50 listening sessions' },
    hundred_sessions: { title: 'Radio Enthusiast', description: 'Complete 100 listening sessions' },
    three_day_streak: { title: 'Consistent Start', description: 'Listen for 3 consecutive days' },
    seven_day_streak: { title: 'Week Warrior', description: 'Listen for 7 consecutive days' },
    thirty_day_streak: { title: 'Month Master', description: 'Listen for 30 consecutive days' },
    five_stations: { title: 'Explorer', description: 'Listen to 5 different stations' },
    ten_stations: { title: 'World Traveler', description: 'Listen to 10 different stations' },
  },
  ur: {
    first_listen: { title: 'پہلی سماعت', description: 'پہلی بار ریڈیو یا تلاوت سنیں' },
    hour_listen: { title: 'پابند سامع', description: 'مجموعی طور پر 1 گھنٹہ سنیں' },
    ten_hours: { title: 'مخلص سامع', description: 'مجموعی طور پر 10 گھنٹے سنیں' },
    hundred_hours: { title: 'عالمِ قرآن', description: 'مجموعی طور پر 100 گھنٹے سنیں' },
    five_sessions: { title: 'آغازِ سفر', description: '5 سماعت سیشن مکمل کریں' },
    fifty_sessions: { title: 'باقاعدہ سامع', description: '50 سماعت سیشن مکمل کریں' },
    hundred_sessions: { title: 'شوقین سامع', description: '100 سماعت سیشن مکمل کریں' },
    three_day_streak: { title: 'مسلسل آغاز', description: 'لگاتار 3 دن سنیں' },
    seven_day_streak: { title: 'ہفتہ وار تسلسل', description: 'لگاتار 7 دن سنیں' },
    thirty_day_streak: { title: 'ماہانہ استقامت', description: 'لگاتار 30 دن سنیں' },
    five_stations: { title: 'کھوجی', description: '5 مختلف اسٹیشنز سنیں' },
    ten_stations: { title: 'عالمی مسافر', description: '10 مختلف اسٹیشنز سنیں' },
  },
  gu: {
    first_listen: { title: 'પ્રથમ શ્રવણ', description: 'પ્રથમ વખત રેડિયો સાંભળો' },
    hour_listen: { title: 'સમર્પિત શ્રોતા', description: 'કુલ 1 કલાક સુધી સાંભળો' },
    ten_hours: { title: 'નિષ્ઠાવાન શ્રોતા', description: 'કુલ 10 કલાક સુધી સાંભળો' },
    hundred_hours: { title: 'કુરાન વિદ્વાન', description: 'કુલ 100 કલાક સુધી સાંભળો' },
    five_sessions: { title: 'શરૂઆત', description: '5 શ્રવણ સત્રો પૂર્ણ કરો' },
    fifty_sessions: { title: 'નિયમિત શ્રોતા', description: '50 શ્રવણ સત્રો પૂર્ણ કરો' },
    hundred_sessions: { title: 'રેડિયો ઉત્સાહી', description: '100 શ્રવણ સત્રો પૂર્ણ કરો' },
    three_day_streak: { title: 'સતત શરૂઆત', description: 'સતત 3 દિવસ સુધી સાંભળો' },
    seven_day_streak: { title: 'અઠવાડિયાનો યોદ્ધો', description: 'સતત 7 દિવસ સુધી સાંભળો' },
    thirty_day_streak: { title: 'માસિક નિષ્ણાત', description: 'સતત 30 દિવસ સુધી સાંભળો' },
    five_stations: { title: 'સંશોધક', description: '5 અલગ સ્ટેશનો સાંભળો' },
    ten_stations: { title: 'વિશ્વ પ્રવાસી', description: '10 અલગ સ્ટેશનો સાંભળો' },
  },
};

export const ACHIEVEMENTS: Achievement[] = [
  // Time-based achievements
  {
    id: 'first_listen',
    title: 'First Listen',
    description: 'Listen to radio for the first time',
    icon: '🎧',
    requirement: 1,
    type: 'time',
    unlocked: false,
  },
  {
    id: 'hour_listen',
    title: 'Dedicated Listener',
    description: 'Listen for 1 hour total',
    icon: '⏱️',
    requirement: 3600,
    type: 'time',
    unlocked: false,
  },
  {
    id: 'ten_hours',
    title: 'Devoted Listener',
    description: 'Listen for 10 hours total',
    icon: '📚',
    requirement: 36000,
    type: 'time',
    unlocked: false,
  },
  {
    id: 'hundred_hours',
    title: 'Quran Scholar',
    description: 'Listen for 100 hours total',
    icon: '🎓',
    requirement: 360000,
    type: 'time',
    unlocked: false,
  },
  // Session-based achievements
  {
    id: 'five_sessions',
    title: 'Getting Started',
    description: 'Complete 5 listening sessions',
    icon: '🎯',
    requirement: 5,
    type: 'sessions',
    unlocked: false,
  },
  {
    id: 'fifty_sessions',
    title: 'Regular Listener',
    description: 'Complete 50 listening sessions',
    icon: '🌟',
    requirement: 50,
    type: 'sessions',
    unlocked: false,
  },
  {
    id: 'hundred_sessions',
    title: 'Radio Enthusiast',
    description: 'Complete 100 listening sessions',
    icon: '🏆',
    requirement: 100,
    type: 'sessions',
    unlocked: false,
  },
  // Streak-based achievements
  {
    id: 'three_day_streak',
    title: 'Consistent Start',
    description: 'Listen for 3 consecutive days',
    icon: '🔥',
    requirement: 3,
    type: 'streak',
    unlocked: false,
  },
  {
    id: 'seven_day_streak',
    title: 'Week Warrior',
    description: 'Listen for 7 consecutive days',
    icon: '💪',
    requirement: 7,
    type: 'streak',
    unlocked: false,
  },
  {
    id: 'thirty_day_streak',
    title: 'Month Master',
    description: 'Listen for 30 consecutive days',
    icon: '👑',
    requirement: 30,
    type: 'streak',
    unlocked: false,
  },
  // Variety-based achievements
  {
    id: 'five_stations',
    title: 'Explorer',
    description: 'Listen to 5 different stations',
    icon: '🗺️',
    requirement: 5,
    type: 'variety',
    unlocked: false,
  },
  {
    id: 'ten_stations',
    title: 'World Traveler',
    description: 'Listen to 10 different stations',
    icon: '🌍',
    requirement: 10,
    type: 'variety',
    unlocked: false,
  },
];

// Default user achievements state
const DEFAULT_USER_ACHIEVEMENTS: UserAchievements = {
  unlocked: [],
  streakDays: 0,
  lastListenDate: null,
  consecutiveDays: 0,
};

/**
 * Load user achievements from storage
 */
export async function loadUserAchievements(): Promise<UserAchievements> {
  try {
    const { value } = await Preferences.get({ key: USER_ACHIEVEMENTS_KEY });
    if (value) {
      return JSON.parse(value);
    }
  } catch (error) {
    console.error('Failed to load user achievements:', error);
  }
  return DEFAULT_USER_ACHIEVEMENTS;
}

/**
 * Save user achievements to storage
 */
export async function saveUserAchievements(achievements: UserAchievements): Promise<void> {
  try {
    await Preferences.set({
      key: USER_ACHIEVEMENTS_KEY,
      value: JSON.stringify(achievements),
    });
  } catch (error) {
    console.error('Failed to save user achievements:', error);
  }
}

/**
 * Get all achievements with unlock status
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  const userAchievements = await loadUserAchievements();
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    unlocked: userAchievements.unlocked.includes(achievement.id),
    unlockedAt: userAchievements.unlocked.includes(achievement.id) 
      ? userAchievements.lastListenDate 
      : undefined,
  }));
}

/**
 * Check and unlock achievements based on stats
 */
export async function checkAchievements(stats: {
  totalSeconds: number;
  totalSessions: number;
  uniqueStations: number;
  currentStreak: number;
}): Promise<string[]> {
  const userAchievements = await loadUserAchievements();
  const newlyUnlocked: string[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (userAchievements.unlocked.includes(achievement.id)) continue;

    let shouldUnlock = false;

    switch (achievement.type) {
      case 'time':
        shouldUnlock = stats.totalSeconds >= achievement.requirement;
        break;
      case 'sessions':
        shouldUnlock = stats.totalSessions >= achievement.requirement;
        break;
      case 'streak':
        shouldUnlock = stats.currentStreak >= achievement.requirement;
        break;
      case 'variety':
        shouldUnlock = stats.uniqueStations >= achievement.requirement;
        break;
      case 'dedication':
        // Not implemented yet - would need session duration tracking
        break;
    }

    if (shouldUnlock) {
      userAchievements.unlocked.push(achievement.id);
      newlyUnlocked.push(achievement.id);
    }
  }

  if (newlyUnlocked.length > 0) {
    await saveUserAchievements(userAchievements);
  }

  return newlyUnlocked;
}

/**
 * Update streak based on listening date
 */
export async function updateStreak(): Promise<void> {
  const userAchievements = await loadUserAchievements();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  if (userAchievements.lastListenDate === null) {
    // First listen
    userAchievements.lastListenDate = todayTimestamp;
    userAchievements.consecutiveDays = 1;
  } else {
    const diffDays = Math.floor((todayTimestamp - userAchievements.lastListenDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, no change
      return;
    } else if (diffDays === 1) {
      // Consecutive day
      userAchievements.consecutiveDays += 1;
      userAchievements.lastListenDate = todayTimestamp;
    } else {
      // Streak broken
      userAchievements.consecutiveDays = 1;
      userAchievements.lastListenDate = todayTimestamp;
    }
  }

  await saveUserAchievements(userAchievements);
}

/**
 * Get current streak
 */
export async function getCurrentStreak(): Promise<number> {
  const userAchievements = await loadUserAchievements();
  return userAchievements.consecutiveDays;
}

/**
 * Reset all unlocked achievements & consecutive streak days cleanly.
 */
export async function resetRadioAchievements(): Promise<void> {
  const empty: UserAchievements = {
    unlocked: [],
    streakDays: 0,
    lastListenDate: null,
    consecutiveDays: 0,
  };
  await saveUserAchievements(empty);
  try {
    localStorage.removeItem(USER_ACHIEVEMENTS_KEY);
  } catch (err) {
    console.warn('[RadioAchievements] localStorage clear skipped:', err);
  }
}
