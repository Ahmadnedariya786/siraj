import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppBar } from '@/components/AppBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useLanguage } from '@/contexts/LanguageContext-new';
import { Badge } from '@/components/ui/badge';
import { LayoutManager } from '@/components/LayoutManager';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import {
  Trophy,
  RotateCcw,
  CheckCircle,
  Check,
  XCircle,
  Lightbulb,
  Award,
  Star,
  Zap,
  Clock,
  Target,
  Crown,
  TrendingUp,
  HelpCircle,
  Calendar,
  Sparkles,
  Store,
  ChevronRight,
  Heart,
  Gift as GiftIcon,
  ArrowLeft,
  ArrowRight,
  Landmark,
  BookOpen,
  Users,
  Compass,
  BookText,
  SkipForward,
  AlertTriangle,
} from 'lucide-react';
import { quizManager } from '@/lib/quiz-manager';
import { quizStore } from '@/lib/quiz-store';
import { useQuizEconomy } from '@/lib/quiz-economy';
import { variableRewardsSystem } from '@/lib/variable-rewards';
import { feedbackSystem } from '@/lib/feedback-system';
import { timeEventsSystem } from '@/lib/time-events';
import { AchievementDisplay } from '@/components/AchievementDisplay';
import { markP2FeatureVisited } from '@/lib/boot-scheduler';
import { QuizStore } from '@/components/quiz/QuizStore';
import { GameModeSelector, GameMode } from '@/components/quiz/GameModeSelector';
import { ComboDisplay } from '@/components/quiz/ComboDisplay';
import { DailyRewards } from '@/components/quiz/DailyRewards';
import { LivesDisplay, LivesCompact } from '@/components/quiz/LivesDisplay';
import { MysteryBoxPanel } from '@/components/quiz/MysteryBoxPanel';
import { LossAversionBanner } from '@/components/quiz/LossAversionBanner';
import { QuizLucideIcon } from '@/components/quiz/QuizLucideIcon';
import { getStoreItemById } from '@/data/store-catalog';
import {
  QUIZ_CATEGORIES,
  type QuizQuestion,
  type QuizStats,
  type Achievement,
  type PowerUp,
} from '@/data/enhanced-quiz-data';
import { QuizSession } from '@/data/quiz-store-data';

const getCategoryVectorIcon = (id: string) => {
  switch (id) {
    case 'pillars':
      return <Landmark className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'quran':
      return <BookOpen className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'prophets':
      return <Users className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'prayer':
      return <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'ramadan':
      return <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'history':
      return <Compass className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'hadith':
      return <BookText className="w-4 h-4 text-[var(--accent-text)]" />;
    default:
      return <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />;
  }
};

const getPowerUpVectorIcon = (id: string) => {
  switch (id) {
    case 'fifty_fifty':
      return (
        <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[var(--accent-soft)] text-[var(--accent-text)] border border-[var(--border)] leading-none">
          50:50
        </span>
      );
    case 'extra_time':
      return <Clock className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'skip':
      return <SkipForward className="w-4 h-4 text-[var(--accent-text)]" />;
    case 'freeze_time':
      return <Zap className="w-4 h-4 text-[var(--accent-text)]" />;
    default:
      return <QuizLucideIcon id={id} className="w-4 h-4 text-[var(--accent-text)]" />;
  }
};

interface GameState {
  questions: QuizQuestion[];
  currentQuestion: number;
  selectedAnswer: number | null;
  showResult: boolean;
  score: number;
  streak: number;
  timeLeft: number;
  isTimerActive: boolean;
  usedPowerUps: string[];
  eliminatedOptions: number[];
  categoryAnswers: Record<string, { correct: number; total: number }>;
  quizMode: 'classic' | 'timeAttack' | 'survival' | 'daily' | 'category';
  gameModeConfig?: unknown;
  userAnswers: { questionId: string; selectedAnswer: number; correct: boolean }[];
}

type QuizViewMode =
  | 'menu'
  | 'playing'
  | 'results'
  | 'achievements'
  | 'store'
  | 'modeSelect'
  | 'dailyRewards'
  | 'mysteryBox';

export default function EnhancedIslamicQuiz() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const {
    xp,
    level,
    levelProgress,
    powerups: economyPowerups,
    canClaimFreeBox,
    streak: dailyRewardStreak,
    stats,
  } = useQuizEconomy();

  const [gameState, setGameState] = useState<GameState>({
    questions: [],
    currentQuestion: 0,
    selectedAnswer: null,
    showResult: false,
    score: 0,
    streak: 0,
    timeLeft: 30,
    isTimerActive: false,
    usedPowerUps: [],
    eliminatedOptions: [],
    categoryAnswers: {},
    quizMode: 'classic',
    userAnswers: [],
  });

  const [quizComplete, setQuizComplete] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([]);
  const [showAchievements, setShowAchievements] = useState(false);
  const [gameMode, setGameMode] = useState<QuizViewMode>('menu');
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode>('classic');
  const [combo, setCombo] = useState(0);
  const [comboMultiplier, setComboMultiplier] = useState(1);
  const [quizStartTime, setQuizStartTime] = useState<number>(0);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [activeEvent, setActiveEvent] = useState<ReturnType<typeof timeEventsSystem.getActiveEvent>>(
    null
  );

  const finishQuizRef = useRef<() => void>(() => {});
  const explanationRef = useRef<HTMLDivElement | null>(null);
  const survivalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    markP2FeatureVisited('quiz');
    setActiveEvent(timeEventsSystem.getActiveEvent());
    return () => {
      if (survivalTimeoutRef.current) {
        clearTimeout(survivalTimeoutRef.current);
      }
    };
  }, []);

  // Derived PowerUp list synchronized directly with unified economy store
  const powerUps: PowerUp[] = quizManager.getPowerUps();

  const startNewQuiz = useCallback(
    (mode: GameMode = selectedGameMode, config?: { difficulty?: string }) => {
      let questionCount = 10;
      if (mode === 'timeAttack') questionCount = 50;
      if (mode === 'survival') questionCount = 100;

      const questions = quizManager.getQuestions(
        selectedCategories.length > 0 ? selectedCategories : undefined,
        selectedDifficulty !== 'all' ? selectedDifficulty : config?.difficulty || undefined,
        questionCount
      );

      if (survivalTimeoutRef.current) {
        clearTimeout(survivalTimeoutRef.current);
        survivalTimeoutRef.current = null;
      }

      setGameState({
        questions,
        currentQuestion: 0,
        selectedAnswer: null,
        showResult: false,
        score: 0,
        streak: 0,
        timeLeft: questions[0]?.timeLimit || 30,
        isTimerActive: true,
        usedPowerUps: [],
        eliminatedOptions: [],
        categoryAnswers: {},
        quizMode: mode,
        gameModeConfig: config,
        userAnswers: [],
      });
      setQuizComplete(false);
      setShowQuitConfirm(false);
      setNewAchievements([]);
      setGameMode('playing');
      setQuizStartTime(Date.now());
      setCombo(0);
      setComboMultiplier(1);
    },
    [selectedCategories, selectedDifficulty, selectedGameMode]
  );

  const finishQuiz = useCallback(() => {
    setQuizComplete(true);
    setShowQuitConfirm(false);
    setGameMode('results');

    const timeSpent = Math.floor((Date.now() - quizStartTime) / 1000);
    const totalQuestions = Math.max(1, gameState.questions.length);

    const session: QuizSession = {
      id: `quiz_${Date.now()}`,
      date: new Date().toISOString(),
      mode: gameState.quizMode,
      score: gameState.score,
      totalQuestions: gameState.questions.length,
      accuracy: Math.round((gameState.score / totalQuestions) * 100),
      xpEarned: 0,
      maxCombo: combo,
      powerUpsUsed: gameState.usedPowerUps,
      categories: Object.keys(gameState.categoryAnswers),
      timeSpent,
      streakAtEnd: gameState.streak,
    };

    const baseXP = gameState.score * 10;
    const perfectBonus = gameState.score === gameState.questions.length ? 50 : 0;
    const comboBonus = combo >= 10 ? combo * 5 : 0;
    const eventMultiplier = timeEventsSystem.getCurrentMultiplier();
    const totalXP = Math.round(
      (baseXP + perfectBonus + comboBonus) * comboMultiplier * eventMultiplier
    );

    session.xpEarned = totalXP;

    const prevBadges = [...stats.achievements];
    const prevLevel = stats.level;

    quizManager.updateStats(
      gameState.score,
      gameState.questions.length,
      gameState.categoryAnswers,
      gameState.streak,
      0
    );

    const actualXP = quizStore.addXP(totalXP, `${gameState.quizMode} Quiz Complete`);

    const completionReward = variableRewardsSystem.rollQuizCompletionReward(
      gameState.score,
      session.accuracy,
      combo,
      gameState.streak
    );

    if (completionReward) {
      toast({
        title: 'Bonus Reward Unlocked',
        description: completionReward.message,
      });
    }

    quizStore.saveQuizSession(session);

    if (gameState.quizMode === 'daily') {
      quizStore.completeDailyChallenge();
    }

    const updatedStats = quizManager.getStats();
    const achievements = quizManager.getAchievements();
    const newOnes = achievements.filter((a) => a.unlocked && !prevBadges.includes(a.id));
    setNewAchievements(newOnes);

    if (newOnes.length > 0) {
      setShowAchievements(true);
    }

    toast({
      title: 'Quiz Complete',
      description: `Earned +${actualXP} XP!`,
    });

    if (updatedStats.level > prevLevel) {
      feedbackSystem.feedbackLevelUp();
    }
  }, [gameState, combo, comboMultiplier, quizStartTime, stats.achievements, stats.level, toast]);

  useEffect(() => {
    finishQuizRef.current = finishQuiz;
  }, [finishQuiz]);

  const handleTimeUp = useCallback(() => {
    setGameState((prev) => {
      const question = prev.questions[prev.currentQuestion];
      const userAnswer = question
        ? { questionId: question.id, selectedAnswer: -1, correct: false }
        : null;
      return {
        ...prev,
        showResult: true,
        isTimerActive: false,
        streak: 0,
        userAnswers: userAnswer ? [...prev.userAnswers, userAnswer] : prev.userAnswers,
      };
    });

    if (gameState.quizMode === 'survival') {
      survivalTimeoutRef.current = setTimeout(() => {
        finishQuizRef.current();
      }, 1500);
    }
  }, [gameState.quizMode]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (gameState.isTimerActive && gameState.timeLeft > 0) {
      timer = setTimeout(() => {
        setGameState((prev) => ({
          ...prev,
          timeLeft: prev.timeLeft - 1,
        }));
      }, 1000);
    } else if (gameState.timeLeft === 0 && gameState.isTimerActive) {
      handleTimeUp();
    }
    return () => clearTimeout(timer);
  }, [gameState.timeLeft, gameState.isTimerActive, handleTimeUp]);

  // Smooth auto-scroll (~250ms) when explanation renders after answer selection
  useEffect(() => {
    if (gameMode === 'playing' && gameState.showResult && !quizComplete) {
      const timer = setTimeout(() => {
        explanationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [gameMode, gameState.showResult, gameState.currentQuestion, quizComplete]);

  const handleGameplayBack = useCallback(() => {
    if (gameMode === 'playing' && !quizComplete) {
      const hasProgress =
        gameState.currentQuestion > 0 ||
        gameState.showResult ||
        gameState.userAnswers.length > 0;
      if (hasProgress) {
        setShowQuitConfirm(true);
        return;
      }
    }
    if (survivalTimeoutRef.current) {
      clearTimeout(survivalTimeoutRef.current);
      survivalTimeoutRef.current = null;
    }
    setGameState((prev) => ({ ...prev, isTimerActive: false }));
    setShowQuitConfirm(false);
    setGameMode('menu');
  }, [gameMode, quizComplete, gameState.currentQuestion, gameState.showResult, gameState.userAnswers.length]);

  const confirmLeaveToLobby = useCallback(() => {
    if (survivalTimeoutRef.current) {
      clearTimeout(survivalTimeoutRef.current);
      survivalTimeoutRef.current = null;
    }
    setGameState((prev) => ({ ...prev, isTimerActive: false }));
    setShowQuitConfirm(false);
    setGameMode('menu');
  }, []);

  // Intercept Android hardware back press during active quiz sub-views so it returns to Lobby (never Home)
  useEffect(() => {
    if (gameMode === 'menu') return;

    const onNativeBackCapture = (event: Event) => {
      event.stopImmediatePropagation();
      event.preventDefault();
      if (showQuitConfirm) {
        setShowQuitConfirm(false);
        return;
      }
      if (gameMode === 'playing' && !quizComplete) {
        handleGameplayBack();
        return;
      }
      setGameMode('menu');
    };

    window.addEventListener('nativeBackPressed', onNativeBackCapture, true);
    return () => {
      window.removeEventListener('nativeBackPressed', onNativeBackCapture, true);
    };
  }, [gameMode, quizComplete, showQuitConfirm, handleGameplayBack]);

  const handleAnswer = useCallback(
    (answerIndex: number) => {
      if (gameState.showResult) return;
      if (gameState.eliminatedOptions.includes(answerIndex)) return;

      const question = gameState.questions[gameState.currentQuestion];
      if (!question) return;

      const isCorrect = answerIndex === question.correctAnswer;

      if (isCorrect) {
        feedbackSystem.feedbackCorrect();
      } else {
        feedbackSystem.feedbackWrong();
      }

      const newComboState = quizStore.updateCombo(isCorrect);
      setCombo(newComboState.currentCombo);
      setComboMultiplier(newComboState.comboMultiplier);

      if (newComboState.currentCombo > 0 && newComboState.currentCombo % 5 === 0) {
        feedbackSystem.feedbackCombo(newComboState.currentCombo);
      }

      const streakReward = variableRewardsSystem.checkStreakMilestone(newComboState.currentCombo);
      if (streakReward) {
        toast({
          title: streakReward.message,
          description: streakReward.itemId
            ? 'Bonus item added to inventory!'
            : `+${streakReward.amount} XP bonus!`,
        });
      }

      const luckyFind = variableRewardsSystem.rollLuckyFind();
      if (luckyFind) {
        toast({
          title: luckyFind.message,
        });
      }

      const categoryAnswers = { ...gameState.categoryAnswers };
      if (!categoryAnswers[question.category]) {
        categoryAnswers[question.category] = { correct: 0, total: 0 };
      }
      categoryAnswers[question.category].total += 1;
      if (isCorrect) {
        categoryAnswers[question.category].correct += 1;
      }

      const userAnswer = {
        questionId: question.id,
        selectedAnswer: answerIndex,
        correct: isCorrect,
      };

      setGameState((prev) => ({
        ...prev,
        selectedAnswer: answerIndex,
        showResult: true,
        isTimerActive: false,
        score: isCorrect ? prev.score + 1 : prev.score,
        streak: isCorrect ? prev.streak + 1 : 0,
        categoryAnswers,
        userAnswers: [...prev.userAnswers, userAnswer],
      }));

      if (!isCorrect && gameState.quizMode === 'survival') {
        feedbackSystem.feedbackStreakBreak();
        survivalTimeoutRef.current = setTimeout(() => {
          finishQuizRef.current();
        }, 1600);
      }
    },
    [
      gameState.showResult,
      gameState.eliminatedOptions,
      gameState.questions,
      gameState.currentQuestion,
      gameState.categoryAnswers,
      gameState.quizMode,
      toast,
    ]
  );

  const nextQuestion = useCallback(() => {
    if (gameState.quizMode === 'survival') {
      const lastAnswer = gameState.selectedAnswer;
      const lastQuestion = gameState.questions[gameState.currentQuestion];
      if (!lastQuestion || lastAnswer !== lastQuestion.correctAnswer) {
        return;
      }
    }

    if (gameState.currentQuestion < gameState.questions.length - 1) {
      const nextIndex = gameState.currentQuestion + 1;
      const nextQ = gameState.questions[nextIndex];

      setGameState((prev) => ({
        ...prev,
        currentQuestion: nextIndex,
        selectedAnswer: null,
        showResult: false,
        eliminatedOptions: [],
        timeLeft: nextQ?.timeLimit || 30,
        isTimerActive: true,
      }));
    } else {
      finishQuiz();
    }
  }, [gameState, finishQuiz]);

  const handleUsePowerUp = useCallback(
    (powerUpId: string) => {
      if (gameState.usedPowerUps.includes(powerUpId)) return;

      const currentQ = gameState.questions[gameState.currentQuestion];
      const success = quizStore.useItem(powerUpId);
      if (!success) {
        toast({
          title: 'Not Available',
          description: "You don't have this item in your inventory.",
          variant: 'destructive',
        });
        return;
      }

      const item = getStoreItemById(powerUpId);

      switch (powerUpId) {
        case 'fifty_fifty': {
          const wrongIndices = currentQ
            ? currentQ.options
                .map((_, idx) => idx)
                .filter((idx) => idx !== currentQ.correctAnswer)
            : [];
          const eliminated = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
          setGameState((prev) => ({
            ...prev,
            usedPowerUps: [...prev.usedPowerUps, powerUpId],
            eliminatedOptions: eliminated,
          }));
          toast({
            title: '50:50 Used',
            description: 'Two wrong answers removed.',
          });
          break;
        }
        case 'extra_time': {
          setGameState((prev) => ({
            ...prev,
            timeLeft: prev.timeLeft + 30,
            usedPowerUps: [...prev.usedPowerUps, powerUpId],
          }));
          toast({
            title: 'Extra Time Added',
            description: '+30 seconds added to the timer.',
          });
          break;
        }
        case 'skip': {
          nextQuestion();
          toast({
            title: 'Question Skipped',
            description: 'Moved to the next question.',
          });
          break;
        }
        case 'freeze_time': {
          setGameState((prev) => ({
            ...prev,
            isTimerActive: false,
            usedPowerUps: [...prev.usedPowerUps, powerUpId],
          }));
          toast({
            title: 'Time Frozen',
            description: 'Timer paused for 15 seconds.',
          });
          setTimeout(() => {
            setGameState((prev) => ({
              ...prev,
              isTimerActive: prev.showResult ? false : true,
            }));
          }, 15000);
          break;
        }
        default: {
          setGameState((prev) => ({
            ...prev,
            usedPowerUps: [...prev.usedPowerUps, powerUpId],
          }));
          toast({
            title: `${item?.name || 'Power-up'} Activated`,
            description: item?.description || 'Power-up applied.',
          });
        }
      }
    },
    [gameState.usedPowerUps, gameState.questions, gameState.currentQuestion, nextQuestion, toast]
  );

  if (gameMode === 'menu') {
    return (
      <QuizMenu
        onStartQuiz={startNewQuiz}
        onSelectMode={() => setGameMode('modeSelect')}
        selectedCategories={selectedCategories}
        setSelectedCategories={setSelectedCategories}
        selectedDifficulty={selectedDifficulty}
        setSelectedDifficulty={setSelectedDifficulty}
        stats={stats}
        xp={xp}
        level={level}
        levelProgress={levelProgress}
        powerUps={powerUps}
        canClaimMysteryBox={canClaimFreeBox}
        dailyRewardStreak={dailyRewardStreak}
        onShowAchievements={() => setGameMode('achievements')}
        onOpenStore={() => setGameMode('store')}
        onOpenDailyRewards={() => setGameMode('dailyRewards')}
        onOpenMysteryBox={() => setGameMode('mysteryBox')}
        activeEvent={activeEvent}
      />
    );
  }

  if (gameMode === 'store') {
    return <QuizStore onClose={() => setGameMode('menu')} />;
  }

  if (gameMode === 'modeSelect') {
    return (
      <GameModeSelector
        onSelectMode={(mode: GameMode, config?: { difficulty?: string }) => {
          setSelectedGameMode(mode);
          startNewQuiz(mode, config);
        }}
        onBack={() => setGameMode('menu')}
      />
    );
  }

  if (gameMode === 'mysteryBox') {
    return <MysteryBoxPanel onClose={() => setGameMode('menu')} />;
  }

  if (gameMode === 'dailyRewards') {
    return <DailyRewards onClose={() => setGameMode('menu')} />;
  }

  if (gameMode === 'achievements') {
    return (
      <LayoutManager>
        <div className="min-h-screen bg-transparent" style={{ background: 'transparent' }}>
          <AppBar
            title={t('achievements') || 'Achievements'}
            showBack
            onBack={() => setGameMode('menu')}
          />
          <div className="max-w-lg mx-auto p-4 pb-[calc(var(--player-inset,0px)+24px)]">
            <AchievementDisplay />
          </div>
        </div>
      </LayoutManager>
    );
  }

  if (gameMode === 'playing' && gameState.questions.length === 0) {
    return (
      <LayoutManager>
        <div className="min-h-screen bg-transparent" style={{ background: 'transparent' }}>
          <AppBar
            title={t('islamicQuiz') || 'Islamic Quiz'}
            showBack
            onBack={() => setGameMode('menu')}
          />
          <div className="flex flex-col items-center justify-center h-64 gap-3 px-4 text-center">
            <p className="text-sm text-[var(--text-secondary)]">
              No matching questions found for this filter.
            </p>
            <Button onClick={() => setGameMode('menu')}>Return to Lobby</Button>
          </div>
        </div>
      </LayoutManager>
    );
  }

  const question = gameState.questions[gameState.currentQuestion];
  const progress =
    gameState.quizMode === 'timeAttack' || gameState.quizMode === 'survival'
      ? 0
      : ((gameState.currentQuestion + 1) / gameState.questions.length) * 100;
  const timerProgress = question?.timeLimit
    ? ((question.timeLimit - gameState.timeLeft) / question.timeLimit) * 100
    : 0;
  const ownedPowerUpEntries = Object.entries(economyPowerups).filter(
    ([, count]) => count > 0
  );

  const quitConfirmPortal =
    showQuitConfirm && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            data-state="open"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              backgroundColor: 'rgba(0,0,0,0.72)',
            }}
          >
            <div
              className="w-full max-w-[320px] rounded-2xl border p-5 space-y-4 shadow-xl"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--accent)',
                color: 'var(--text-primary)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: 'var(--accent-soft)',
                    borderColor: 'var(--border)',
                    color: 'var(--accent-text)',
                  }}
                >
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Return to Quiz Lobby?
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    Your current round progress will be discarded.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowQuitConfirm(false)}
                >
                  Continue Quiz
                </Button>
                <Button
                  data-testid="confirm-leave-quiz"
                  className="flex-1 font-semibold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--on-accent)',
                  }}
                  onClick={confirmLeaveToLobby}
                >
                  Leave to Lobby
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <LayoutManager>
      <div className="min-h-screen bg-transparent" style={{ background: 'transparent' }}>
        <AppBar
          title={t('islamicQuiz') || 'Islamic Quiz'}
          showBack
          onBack={quizComplete ? () => setGameMode('menu') : handleGameplayBack}
        />

        <div className="max-w-lg mx-auto px-3 pt-2.5 pb-[calc(var(--player-inset,0px)+88px)] space-y-2.5">
          {!quizComplete ? (
            <>
              {/* Compact Gameplay HUD */}
              <Card
                className="border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Trophy className="w-4 h-4 text-[var(--accent-text)]" />
                      <span className="font-bold text-sm text-[var(--text-primary)]">
                        {gameState.score}
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">pts</span>
                    </div>

                    {gameState.quizMode !== 'timeAttack' && gameState.quizMode !== 'survival' && (
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        Q {gameState.currentQuestion + 1}/{gameState.questions.length}
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <ComboDisplay
                        combo={combo}
                        multiplier={comboMultiplier}
                        isActive={combo > 0}
                      />
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full border"
                        style={{
                          backgroundColor: 'var(--surface-2)',
                          borderColor:
                            gameState.timeLeft <= 10 ? 'var(--danger)' : 'var(--border)',
                          color:
                            gameState.timeLeft <= 10
                              ? 'var(--danger)'
                              : 'var(--accent-text)',
                        }}
                      >
                        {gameState.timeLeft}s
                      </span>
                    </div>
                  </div>

                  {/* Timer + Round Progress Bars */}
                  <div className="space-y-1">
                    <div
                      className="w-full rounded-full h-1.5 overflow-hidden"
                      style={{ backgroundColor: 'var(--surface-2)' }}
                    >
                      <div
                        className="h-1.5 rounded-full transition-all duration-1000"
                        style={{
                          width: `${Math.max(0, 100 - timerProgress)}%`,
                          backgroundColor:
                            gameState.timeLeft <= 10 ? 'var(--danger)' : 'var(--accent)',
                        }}
                      />
                    </div>
                    {gameState.quizMode !== 'timeAttack' && gameState.quizMode !== 'survival' && (
                      <Progress value={progress} className="h-1.5" />
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Compact Power-ups Strip */}
              {ownedPowerUpEntries.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                  {ownedPowerUpEntries.slice(0, 4).map(([itemId, count]) => {
                    const item = getStoreItemById(itemId);
                    if (!item) return null;
                    return (
                      <Button
                        key={itemId}
                        size="sm"
                        variant="outline"
                        onClick={() => handleUsePowerUp(itemId)}
                        disabled={
                          gameState.usedPowerUps.includes(itemId) || gameState.showResult
                        }
                        className="h-8 px-2.5 text-xs shrink-0 flex items-center gap-1.5 border"
                        style={{
                          backgroundColor: 'var(--surface)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <QuizLucideIcon
                          id={item.id}
                          className="w-3.5 h-3.5 text-[var(--accent-text)]"
                        />
                        <span>{item.name}</span>
                        <Badge
                          variant="secondary"
                          className="h-4 px-1.5 text-[10px]"
                          style={{
                            backgroundColor: 'var(--accent-soft)',
                            color: 'var(--accent-text)',
                          }}
                        >
                          {count}
                        </Badge>
                      </Button>
                    );
                  })}
                </div>
              )}

              {/* Compact Question & 4 Option Rows */}
              <Card
                className="border"
                style={{
                  backgroundColor: 'var(--surface)',
                  borderColor: 'var(--border)',
                }}
              >
                <CardHeader className="p-3.5 pb-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                      <Lightbulb className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                      <span>
                        {QUIZ_CATEGORIES.find((c) => c.id === question.category)?.name}
                      </span>
                    </div>
                    <Badge
                      variant={
                        question.difficulty === 'easy'
                          ? 'secondary'
                          : question.difficulty === 'medium'
                            ? 'default'
                            : 'destructive'
                      }
                      className="text-[10px] capitalize"
                    >
                      {question.difficulty}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-semibold leading-snug text-[var(--text-primary)]">
                    {question.question}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-3.5 pt-1 space-y-2">
                  {question.options.map((option, index) => {
                    const isEliminated = gameState.eliminatedOptions.includes(index);
                    const isCorrectOpt = gameState.showResult && index === question.correctAnswer;
                    const isWrongSelected =
                      gameState.showResult &&
                      index === gameState.selectedAnswer &&
                      index !== question.correctAnswer;

                    return (
                      <Button
                        key={index}
                        type="button"
                        variant="outline"
                        data-testid={`quiz-option-${index}`}
                        className={`w-full justify-start text-left h-auto min-h-[44px] py-3 px-3.5 text-sm leading-snug whitespace-normal border transition-colors ${
                          isEliminated ? 'opacity-35 line-through' : ''
                        }`}
                        style={{
                          backgroundColor: isCorrectOpt
                            ? 'var(--accent-soft)'
                            : isWrongSelected
                              ? 'var(--surface-2)'
                              : 'var(--surface-2)',
                          borderColor: isCorrectOpt
                            ? 'var(--success)'
                            : isWrongSelected
                              ? 'var(--danger)'
                              : 'var(--border)',
                          color: isCorrectOpt
                            ? 'var(--success)'
                            : isWrongSelected
                              ? 'var(--danger)'
                              : 'var(--text-primary)',
                        }}
                        onClick={() => handleAnswer(index)}
                        disabled={gameState.showResult || isEliminated}
                      >
                        <div className="flex items-center gap-2.5 w-full">
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                            style={{
                              backgroundColor: 'var(--accent-soft)',
                              color: 'var(--accent-text)',
                            }}
                          >
                            {String.fromCharCode(65 + index)}
                          </span>
                          <span className="flex-1 text-left leading-snug">{option}</span>
                          {isCorrectOpt && (
                            <CheckCircle className="w-4 h-4 shrink-0 text-[var(--success)]" />
                          )}
                          {isWrongSelected && (
                            <XCircle className="w-4 h-4 shrink-0 text-[var(--danger)]" />
                          )}
                        </div>
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>

              {/* Inline Explanation Card (auto-scrolled into view) */}
              {gameState.showResult && (
                <div ref={explanationRef} data-testid="quiz-explanation-card">
                  <Card
                    className="border"
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      borderColor: 'var(--accent)',
                    }}
                  >
                    <CardContent className="p-3.5">
                      <div className="flex items-start gap-2.5">
                        <Lightbulb className="w-4 h-4 text-[var(--accent-text)] mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-xs text-[var(--accent-text)] mb-0.5">
                            Explanation
                          </p>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                            {question.explanation}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Sticky Bottom Action Bar above Mini-Player */}
              {gameState.showResult && (
                <div
                  className="sticky z-30 pt-1.5"
                  style={{ bottom: 'calc(var(--player-inset, 0px) + 8px)' }}
                >
                  <Button
                    data-testid="quiz-next-btn"
                    onClick={nextQuestion}
                    size="lg"
                    className="w-full h-12 font-bold shadow-lg border"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--on-accent)',
                      borderColor: 'var(--border)',
                    }}
                  >
                    <span>
                      {gameState.currentQuestion < gameState.questions.length - 1
                        ? 'Next Question'
                        : 'See Results'}
                    </span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <QuizResults
              stats={stats}
              score={gameState.score}
              totalQuestions={gameState.questions.length}
              onPlayAgain={() => startNewQuiz()}
              onBackToMenu={() => setGameMode('menu')}
              newAchievements={newAchievements}
              showAchievements={showAchievements}
              setShowAchievements={setShowAchievements}
              questions={gameState.questions}
              userAnswers={gameState.userAnswers}
            />
          )}
        </div>
      </div>

      {quitConfirmPortal}
    </LayoutManager>
  );
}

interface QuizMenuProps {
  onStartQuiz: (mode: GameMode, config?: { difficulty?: string }) => void;
  onSelectMode: () => void;
  selectedCategories: string[];
  setSelectedCategories: React.Dispatch<React.SetStateAction<string[]>>;
  selectedDifficulty: string;
  setSelectedDifficulty: React.Dispatch<React.SetStateAction<string>>;
  stats: QuizStats;
  xp: number;
  level: number;
  levelProgress: { current: number; next: number; progress: number; remaining: number };
  powerUps: PowerUp[];
  canClaimMysteryBox: boolean;
  dailyRewardStreak: number;
  onShowAchievements: () => void;
  onOpenStore: () => void;
  onOpenDailyRewards: () => void;
  onOpenMysteryBox: () => void;
  activeEvent: ReturnType<typeof timeEventsSystem.getActiveEvent>;
}

function QuizMenu({
  onStartQuiz,
  onSelectMode,
  selectedCategories,
  setSelectedCategories,
  selectedDifficulty,
  setSelectedDifficulty,
  stats,
  xp,
  level,
  levelProgress,
  powerUps,
  canClaimMysteryBox,
  dailyRewardStreak,
  onShowAchievements,
  onOpenStore,
  onOpenDailyRewards,
  onOpenMysteryBox,
  activeEvent,
}: QuizMenuProps) {
  const { t } = useLanguage();
  const dailyStatus = quizStore.getDailyRewardStatus();
  const canClaimDaily = dailyStatus.canClaimToday;

  return (
    <LayoutManager>
      <div className="min-h-screen bg-transparent" style={{ background: 'transparent' }}>
        <AppBar title={t('islamicQuiz') || 'Islamic Quiz'} showBack />

        <LossAversionBanner
          onAction={(type: string) => {
            if (type === 'streak' || type === 'daily_reward') {
              onOpenDailyRewards();
            } else if (type === 'event') {
              onSelectMode();
            } else if (type === 'mystery_box') {
              onOpenMysteryBox();
            }
          }}
        />

        <div className="max-w-lg mx-auto p-3.5 pb-[calc(var(--player-inset,0px)+28px)] space-y-3.5">
          {/* Player Stats with Lives + Single-Source XP */}
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5 text-[var(--accent-text)]" />
                  <span className="font-bold text-[var(--text-primary)]">Level {level}</span>
                </div>
                <div className="flex items-center gap-2">
                  <LivesCompact />
                  <div
                    data-testid="lobby-xp-balance"
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full border"
                    style={{
                      backgroundColor: 'var(--surface-2)',
                      borderColor: 'var(--accent)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    <Star className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold">{xp.toLocaleString()} XP</span>
                  </div>
                </div>
              </div>
              <Progress value={levelProgress.progress} className="h-2 mb-3" />
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="font-bold text-[var(--accent-text)]">{stats.totalGames}</p>
                  <p className="text-[var(--text-secondary)]">Games</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--accent-text)]">{stats.bestStreak}</p>
                  <p className="text-[var(--text-secondary)]">Best Streak</p>
                </div>
                <div>
                  <p className="font-bold text-[var(--accent-text)]">
                    {Math.max(stats.dailyStreak, dailyRewardStreak)}
                  </p>
                  <p className="text-[var(--text-secondary)]">Daily Streak</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Themed Quick Status Banners for Daily Reward & Free Mystery Box */}
          {(canClaimDaily || canClaimMysteryBox) && (
            <div className="grid grid-cols-1 gap-2">
              {canClaimDaily && (
                <Card
                  onClick={onOpenDailyRewards}
                  className="cursor-pointer border transition-all"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          Daily Reward Available
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Tap to claim Day {Math.min(dailyStatus.currentStreak + 1, 7)} XP bonus
                        </p>
                      </div>
                    </div>
                    <Badge
                      className="text-[10px] shrink-0"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--on-accent)',
                      }}
                    >
                      Claim
                    </Badge>
                  </CardContent>
                </Card>
              )}

              {canClaimMysteryBox && (
                <Card
                  onClick={onOpenMysteryBox}
                  className="cursor-pointer border transition-all"
                  style={{
                    backgroundColor: 'var(--surface-2)',
                    borderColor: 'var(--accent)',
                  }}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-soft)',
                          color: 'var(--accent-text)',
                        }}
                      >
                        <GiftIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[var(--text-primary)]">
                          Free Mystery Box Ready!
                        </p>
                        <p className="text-[11px] text-[var(--text-secondary)]">
                          Open now for power-ups or bonus XP
                        </p>
                      </div>
                    </div>
                    <Badge
                      className="text-[10px] shrink-0"
                      style={{
                        backgroundColor: 'var(--accent)',
                        color: 'var(--on-accent)',
                      }}
                    >
                      Open
                    </Badge>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Active Event Banner */}
          {activeEvent && (
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Card
                className="border"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--accent)',
                }}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-[var(--accent-text)]" />
                    <div>
                      <p className="font-bold text-sm text-[var(--text-primary)]">
                        {activeEvent.title}
                      </p>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {activeEvent.multiplier}x XP Active
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent-text)',
                    }}
                  >
                    {timeEventsSystem.getTimeRemaining()}
                  </Badge>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Store, Rewards & Mystery Box 3-button Grid */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              data-testid="open-store-btn"
              onClick={onOpenStore}
              variant="outline"
              className="w-full border"
              style={{
                backgroundColor: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <Store className="w-4 h-4 mr-1 text-[var(--accent-text)]" />
              <span className="text-xs font-semibold">Store</span>
            </Button>
            <Button
              data-testid="open-daily-btn"
              onClick={onOpenDailyRewards}
              variant="outline"
              className="w-full border"
              style={{
                backgroundColor: canClaimDaily ? 'var(--accent-soft)' : 'var(--surface-2)',
                borderColor: canClaimDaily ? 'var(--accent)' : 'var(--border)',
                color: canClaimDaily ? 'var(--accent-text)' : 'var(--text-primary)',
              }}
            >
              <Calendar className="w-4 h-4 mr-1" />
              <span className="text-xs font-semibold">Daily</span>
            </Button>
            <Button
              data-testid="open-mystery-box-btn"
              onClick={onOpenMysteryBox}
              variant="outline"
              className="w-full border"
              style={{
                backgroundColor: canClaimMysteryBox ? 'var(--accent-soft)' : 'var(--surface-2)',
                borderColor: canClaimMysteryBox ? 'var(--accent)' : 'var(--border)',
                color: canClaimMysteryBox ? 'var(--accent-text)' : 'var(--text-primary)',
              }}
            >
              <GiftIcon className="w-4 h-4 mr-1" />
              <span className="text-xs font-semibold">Mystery</span>
            </Button>
          </div>

          {/* Quick Start CTA */}
          <Button
            data-testid="start-quiz-btn"
            onClick={() => onStartQuiz('classic')}
            className="w-full font-bold"
            size="lg"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'var(--on-accent)',
            }}
          >
            <Target className="w-4 h-4 mr-2" />
            Start Quiz
          </Button>
          <p className="text-center text-xs text-[var(--text-secondary)] -mt-1.5">
            {selectedCategories.length > 0
              ? QUIZ_CATEGORIES.filter((c) => selectedCategories.includes(c.id))
                  .map((c) => c.name)
                  .join(', ')
              : 'All topics'}
            {' · '}
            {selectedDifficulty === 'all' ? 'All difficulties' : selectedDifficulty}
            {' · 10 questions'}
          </p>

          {/* Category Selection */}
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardHeader className="pb-2.5">
              <CardTitle className="text-base">Select Topics</CardTitle>
              <CardDescription className="text-xs">
                {selectedCategories.length > 0
                  ? `${selectedCategories.length} selected — tap again to deselect`
                  : 'Choose topics (none selected = all topics)'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUIZ_CATEGORIES.filter((c) => c.unlocked).map((category) => {
                const isSelected = selectedCategories.includes(category.id);
                return (
                  <Button
                    key={category.id}
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() =>
                      setSelectedCategories((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== category.id)
                          : [...prev, category.id]
                      )
                    }
                    className="w-full justify-start"
                    style={
                      isSelected
                        ? {
                            backgroundColor: 'var(--accent)',
                            color: 'var(--on-accent)',
                          }
                        : undefined
                    }
                  >
                    <span className="mr-2.5 flex items-center">
                      {getCategoryVectorIcon(category.id)}
                    </span>
                    <span>{category.name}</span>
                    {isSelected && <Check className="w-4 h-4 ml-auto" />}
                    {!isSelected && stats.categoryMastery[category.id] !== undefined && (
                      <Badge variant="secondary" className="ml-auto">
                        {stats.categoryMastery[category.id]}%
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* Difficulty Selection */}
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardHeader className="pb-2.5">
              <CardTitle className="text-base">Difficulty</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {['all', 'easy', 'medium', 'hard'].map((difficulty) => (
                <Button
                  key={difficulty}
                  variant={selectedDifficulty === difficulty ? 'default' : 'outline'}
                  onClick={() => setSelectedDifficulty(difficulty)}
                  className="w-full justify-center capitalize text-xs"
                  style={
                    selectedDifficulty === difficulty
                      ? {
                          backgroundColor: 'var(--accent)',
                          color: 'var(--on-accent)',
                        }
                      : undefined
                  }
                >
                  {difficulty === 'all' ? 'All Levels' : difficulty}
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Lives Display */}
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Heart className="w-4 h-4 text-[var(--danger)]" />
                Lives
              </CardTitle>
            </CardHeader>
            <CardContent>
              <LivesDisplay />
            </CardContent>
          </Card>

          {/* Power-ups */}
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardHeader className="pb-2.5">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-[var(--accent-text)]" />
                Power-ups
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {powerUps.map((powerUp) => (
                <div key={powerUp.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center">{getPowerUpVectorIcon(powerUp.id)}</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">
                      {powerUp.name}
                    </span>
                  </div>
                  <Badge variant={powerUp.uses > 0 ? 'default' : 'secondary'}>
                    {powerUp.uses}/{powerUp.maxUses}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Game Mode Selection */}
          <Card
            className="border"
            style={{
              backgroundColor: 'var(--surface)',
              borderColor: 'var(--border)',
            }}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--accent-text)]" />
                Game Modes
              </CardTitle>
              <CardDescription className="text-xs">
                Classic, Time Attack, Survival &amp; Daily Challenge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={onSelectMode} className="w-full" variant="outline">
                <Target className="w-4 h-4 mr-2" />
                Choose Game Mode
                <ChevronRight className="w-4 h-4 ml-auto" />
              </Button>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Button onClick={onShowAchievements} variant="outline" className="w-full">
            <Trophy className="w-4 h-4 mr-2 text-[var(--accent-text)]" />
            View Achievements
          </Button>
        </div>
      </div>
    </LayoutManager>
  );
}

interface QuizResultsProps {
  stats: QuizStats;
  score: number;
  totalQuestions: number;
  onPlayAgain: () => void;
  onBackToMenu: () => void;
  newAchievements: Achievement[];
  showAchievements: boolean;
  setShowAchievements: (show: boolean) => void;
  questions: QuizQuestion[];
  userAnswers: { questionId: string; selectedAnswer: number; correct: boolean }[];
}

function QuizResults({
  stats,
  score,
  totalQuestions,
  onPlayAgain,
  onBackToMenu,
  newAchievements,
  questions,
  userAnswers,
}: QuizResultsProps) {
  const accuracy = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const xpEarned = score * 10 + (score === totalQuestions ? 50 : 0);
  const [showReview, setShowReview] = useState(false);

  if (showReview && questions) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowReview(false)}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-lg font-bold">Review Answers</h2>
            <p className="text-xs text-[var(--text-secondary)]">
              {score}/{totalQuestions} correct
            </p>
          </div>
        </div>
        {questions.map((q, idx) => {
          const ua = userAnswers?.find((a) => a.questionId === q.id);
          const isCorrect = ua?.correct;
          const selectedIdx = ua?.selectedAnswer;
          return (
            <Card
              key={q.id}
              className="border-l-4"
              style={{
                borderLeftColor: isCorrect ? 'var(--success)' : 'var(--danger)',
              }}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-secondary)]">Q{idx + 1}</span>
                  <Badge variant={isCorrect ? 'default' : 'destructive'} className="text-xs">
                    {isCorrect ? 'Correct' : 'Wrong'}
                  </Badge>
                </div>
                <p className="text-sm font-medium">{q.question}</p>
                {q.options.map((opt, oi) => (
                  <div
                    key={oi}
                    className="text-xs p-2 rounded-md"
                    style={{
                      backgroundColor:
                        oi === q.correctAnswer ? 'var(--accent-soft)' : 'var(--surface-2)',
                      color:
                        oi === q.correctAnswer
                          ? 'var(--success)'
                          : oi === selectedIdx
                            ? 'var(--danger)'
                            : 'var(--text-secondary)',
                    }}
                  >
                    {String.fromCharCode(65 + oi)}. {opt}
                  </div>
                ))}
                <p className="text-xs text-[var(--text-secondary)] pt-1 border-t">
                  {q.explanation}
                </p>
              </CardContent>
            </Card>
          );
        })}
        <Button onClick={() => setShowReview(false)} variant="outline" className="w-full">
          Back to Results
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card
        className="overflow-hidden border"
        style={{
          backgroundColor: 'var(--surface-2)',
          borderColor: 'var(--accent)',
        }}
      >
        <div className="p-6 text-center">
          <Award className="w-14 h-14 mx-auto text-[var(--accent-text)] mb-3" />
          <h2 className="text-2xl font-bold mb-1">Quiz Complete!</h2>
          <p className="text-4xl font-bold text-[var(--accent-text)] mb-2">
            {score} / {totalQuestions}
          </p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {accuracy >= 90
              ? 'Excellent! Ma sha Allah!'
              : accuracy >= 70
                ? 'Good job! Keep learning!'
                : accuracy >= 50
                  ? 'Nice effort! Review and try again!'
                  : "Keep studying! You'll improve!"}
          </p>
          <div className="flex items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-1 text-[var(--accent-text)] font-semibold">
              <Star className="w-4 h-4" />
              <span>+{xpEarned} XP</span>
            </div>
            <div className="flex items-center gap-1 text-[var(--text-primary)] font-semibold">
              <TrendingUp className="w-4 h-4 text-[var(--accent-text)]" />
              <span>{accuracy}% Accuracy</span>
            </div>
          </div>
        </div>
      </Card>

      {newAchievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="w-5 h-5 text-[var(--accent-text)]" />
              New Achievements Unlocked
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {newAchievements.map((achievement) => (
              <div
                key={achievement.id}
                className="flex items-center gap-3 p-2.5 rounded-lg border"
                style={{
                  backgroundColor: 'var(--surface-2)',
                  borderColor: 'var(--border)',
                }}
              >
                <Award className="w-5 h-5 text-[var(--accent-text)] shrink-0" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{achievement.name}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{achievement.description}</p>
                </div>
                <Badge variant="secondary" className="ml-auto shrink-0">
                  +{achievement.points} XP
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-[var(--accent-text)]">{stats.totalGames}</p>
              <p className="text-xs text-[var(--text-secondary)]">Total Games</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--accent-text)]">{stats.level}</p>
              <p className="text-xs text-[var(--text-secondary)]">Current Level</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--accent-text)]">{stats.bestStreak}</p>
              <p className="text-xs text-[var(--text-secondary)]">Best Streak</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--accent-text)]">{stats.dailyStreak}</p>
              <p className="text-xs text-[var(--text-secondary)]">Daily Streak</p>
            </div>
          </div>

          {questions && questions.length > 0 && (
            <Button onClick={() => setShowReview(true)} variant="secondary" className="w-full">
              <HelpCircle className="w-4 h-4 mr-2" />
              Review Answers
            </Button>
          )}

          <div className="flex gap-2">
            <Button
              onClick={onPlayAgain}
              className="flex-1"
              style={{
                backgroundColor: 'var(--accent)',
                color: 'var(--on-accent)',
              }}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Play Again
            </Button>
            <Button onClick={onBackToMenu} variant="outline" className="flex-1">
              Back to Lobby
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
