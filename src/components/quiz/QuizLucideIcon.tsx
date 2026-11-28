/**
 * Shared Lucide icon helper for Quiz items, Mystery Boxes, Rewards, and Banners.
 * Eliminates raw emoji icons across Store, Mystery Box reveal, Daily Rewards, and Lobby.
 */

import {
  BookOpen,
  Clock,
  Coins,
  Crown,
  Eye,
  Flame,
  Gift,
  Heart,
  Landmark,
  Lightbulb,
  Package,
  Scissors,
  Shield,
  SkipForward,
  Sparkles,
  Snowflake,
  Star,
  TimerReset,
  Trophy,
  Users,
  Zap,
  AlertTriangle,
  Compass,
  BookText,
} from 'lucide-react';

interface QuizLucideIconProps {
  id: string;
  className?: string;
}

export function QuizLucideIcon({ id, className = 'w-5 h-5' }: QuizLucideIconProps) {
  switch (id) {
    case 'fifty_fifty':
      return <Scissors className={className} />;
    case 'extra_time':
    case 'hafiz_memory':
    case 'clock':
      return <Clock className={className} />;
    case 'hint':
      return <Lightbulb className={className} />;
    case 'skip':
      return <SkipForward className={className} />;
    case 'double_points':
    case 'fast_learner':
    case 'zap':
      return <Zap className={className} />;
    case 'freeze_time':
    case 'streak_freeze':
      return <Snowflake className={className} />;
    case 'second_chance':
    case 'streak_shield':
    case 'blessed_streak':
      return <Shield className={className} />;
    case 'category_expert':
    case 'knowledge_seeker':
    case 'quran':
      return <BookOpen className={className} />;
    case 'reveal_answer':
      return <Eye className={className} />;
    case 'time_warp':
      return <TimerReset className={className} />;
    case 'perfect_round':
    case 'wisdom_sahaba':
    case 'divine_guidance':
    case 'premium_box':
    case 'sparkles':
    case 'prayer':
    case 'ramadan':
      return <Sparkles className={className} />;
    case 'barakah_boost':
    case 'legendary_box':
    case 'scholars_aura':
    case 'crown':
      return <Crown className={className} />;
    case 'daily_free_box':
    case 'gift':
      return <Gift className={className} />;
    case 'basic_box':
    case 'package':
      return <Package className={className} />;
    case 'flame':
      return <Flame className={className} />;
    case 'heart':
      return <Heart className={className} />;
    case 'trophy':
      return <Trophy className={className} />;
    case 'alert':
      return <AlertTriangle className={className} />;
    case 'pillars':
      return <Landmark className={className} />;
    case 'prophets':
      return <Users className={className} />;
    case 'history':
      return <Compass className={className} />;
    case 'hadith':
      return <BookText className={className} />;
    case 'star':
      return <Star className={className} />;
    default:
      if (id.startsWith('xp_')) {
        return <Coins className={className} />;
      }
      return <Package className={className} />;
  }
}
