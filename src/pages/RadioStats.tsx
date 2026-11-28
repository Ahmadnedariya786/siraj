import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Clock, Flame, MonitorPlay, Radio, Target, Trash2, TrendingUp, Trophy, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  computeNormalizedMediaSummary,
  formatDuration,
  getSortedStationStats,
  getTotalListeningTime,
  resetRadioStats,
  subscribeMediaStats,
  type NormalizedStationStat,
  type StationStats,
} from '@/lib/radio-stats';
import {
  ACHIEVEMENT_I18N,
  getAllAchievements,
  getCurrentStreak,
  type Achievement,
} from '@/lib/radio-achievements';
import { useContentLanguage } from '@/lib/content-translator';
import { ContentLanguageBar } from '@/components/ContentLanguageBar';

const STATS_I18N = {
  en: {
    title: 'Media Statistics',
    subtitle: 'Listen & Watch Habits',
    streak: 'day streak',
    days: 'days',
    totalTime: 'Total Time',
    currentStreak: 'Current Streak',
    totalSessions: 'Total Sessions',
    avgSession: 'Avg Session',
    topStation: 'Top Station / Stream',
    achievements: 'Achievements',
    unlocked: 'unlocked',
    mediaBreakdown: 'Media Breakdown',
    noData: 'No media data yet',
    noDataSub: 'Start listening to radio or watching streams to see statistics',
    reset: 'Reset All Statistics',
    confirmReset: 'Are you sure you want to reset all listening statistics?',
    resetTitle: 'Statistics Reset',
    resetDesc: 'All listening statistics have been cleared',
    sessions: 'session(s)',
    loadError: 'Failed to load listening statistics',
    resetError: 'Failed to reset statistics',
  },
  ur: {
    title: 'میڈیا کے اعداد و شمار',
    subtitle: 'سننے اور دیکھنے کی عادات',
    streak: 'دن کا تسلسل',
    days: 'دن',
    totalTime: 'مجموعی وقت',
    currentStreak: 'موجودہ تسلسل',
    totalSessions: 'کل سیشنز',
    avgSession: 'اوسط دورانیہ',
    topStation: 'مقبول ترین اسٹیشن و نشریات',
    achievements: 'کامیابیاں و اعزازات',
    unlocked: 'حاصل شدہ',
    mediaBreakdown: 'تفصیلی میڈیا رپورٹ',
    noData: 'ابھی کوئی ریکارڈ موجود نہیں',
    noDataSub: 'اعداد و شمار دیکھنے کے لیے ریڈیو سنیں یا لائیو نشریات دیکھیں',
    reset: 'تمام اعداد و شمار ری سیٹ کریں',
    confirmReset: 'کیا آپ واقعی سننے اور دیکھنے کے تمام اعداد و شمار صاف کرنا چاہتے ہیں؟',
    resetTitle: 'اعداد و شمار صاف کر دیے گئے',
    resetDesc: 'تمام ریکارڈ کامیابی سے ری سیٹ ہو گیا ہے',
    sessions: 'سیشنز',
    loadError: 'اعداد و شمار لوڈ کرنے میں ناکامی',
    resetError: 'اعداد و شمار صاف کرنے میں ناکامی',
  },
  gu: {
    title: 'મીડિયા આંકડાશાસ્ત્ર',
    subtitle: 'સાંભળવા અને જોવાની ટેવ',
    streak: 'દિવસની સ્ટ્રીક',
    days: 'દિવસ',
    totalTime: 'કુલ સમય',
    currentStreak: 'વર્તમાન સ્ટ્રીક',
    totalSessions: 'કુલ સત્રો',
    avgSession: 'સરેરાશ સત્ર',
    topStation: 'ટોચનું સ્ટેશન / પ્રસારણ',
    achievements: 'સિદ્ધિઓ',
    unlocked: 'અનલોક થયેલ',
    mediaBreakdown: 'મીડિયા વિશ્લેષણ',
    noData: 'હજુ કોઈ ડેટા નથી',
    noDataSub: 'આંકડા જોવા માટે રેડિયો સાંભળવાનું અથવા લાઈવ જોવાનું શરૂ કરો',
    reset: 'બધા આંકડા રીસેટ કરો',
    confirmReset: 'શું તમે ખરેખર બધા આંકડા રીસેટ કરવા માંગો છો?',
    resetTitle: 'આંકડા રીસેટ થયા',
    resetDesc: 'બધા આંકડા સફળતાપૂર્વક સાફ થઈ ગયા છે',
    sessions: 'સત્રો',
    loadError: 'આંકડા લોડ કરવામાં નિષ્ફળ',
    resetError: 'આંકડા રીસેટ કરવામાં નિષ્ફળ',
  },
};

const REFRESH_MINUTES_INTERVAL_MS = 30000;

const getAchievementIcon = (id: string) => {
  switch (id) {
    case 'first_listen':
      return <Radio className="w-4 h-4 text-[var(--accent)]" />;
    case 'hour_listen':
    case 'ten_hours':
    case 'hundred_hours':
      return <Clock className="w-4 h-4 text-[var(--accent)]" />;
    case 'five_sessions':
    case 'fifty_sessions':
    case 'hundred_sessions':
      return <Target className="w-4 h-4 text-[var(--accent)]" />;
    case 'three_day_streak':
    case 'seven_day_streak':
    case 'thirty_day_streak':
      return <Flame className="w-4 h-4 text-[var(--accent)]" />;
    case 'five_stations':
    case 'ten_stations':
      return <TrendingUp className="w-4 h-4 text-[var(--accent)]" />;
    default:
      return <Trophy className="w-4 h-4 text-[var(--accent)]" />;
  }
};

interface KpiStatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon: 'clock' | 'flame' | 'target' | 'trending';
  isRtl: boolean;
  isUrdu: boolean;
}

const KpiStatCard = memo(function KpiStatCard({
  label,
  value,
  unit,
  icon,
  isRtl,
  isUrdu,
}: KpiStatCardProps) {
  const iconEl =
    icon === 'clock' ? (
      <Clock className="w-4 h-4 text-[var(--accent)] shrink-0" />
    ) : icon === 'flame' ? (
      <Flame className="w-4 h-4 text-[var(--accent)] shrink-0" />
    ) : icon === 'target' ? (
      <Target className="w-4 h-4 text-[var(--accent)] shrink-0" />
    ) : (
      <TrendingUp className="w-4 h-4 text-[var(--accent)] shrink-0" />
    );

  return (
    <div className="siraj-media-card rounded-2xl p-3.5 min-w-0">
      <div className={`flex items-center gap-2 mb-1.5 ${isRtl ? 'text-right' : 'text-left'}`}>
        {iconEl}
        <p className={`text-xs font-medium text-[var(--muted)] leading-snug break-words ${isUrdu ? 'font-urdu' : ''}`}>
          {label}
        </p>
      </div>
      <p className={`text-xl font-black text-[var(--text)] leading-tight ${isRtl ? 'text-right' : 'text-left'}`}>
        <span dir="ltr" className="tabular-nums">
          {value}
        </span>
        {unit ? (
          <span className={`text-sm font-bold text-[var(--muted)] ms-1 ${isUrdu ? 'font-urdu' : ''}`}>
            {unit}
          </span>
        ) : null}
      </p>
    </div>
  );
});

interface TopStationCardProps {
  station: NormalizedStationStat;
  label: string;
  isRtl: boolean;
  isUrdu: boolean;
}

const TopStationCard = memo(function TopStationCard({
  station,
  label,
  isRtl,
  isUrdu,
}: TopStationCardProps) {
  const isLive = station.stationId.startsWith('live_');
  return (
    <div className="siraj-media-card rounded-2xl p-4 min-w-0">
      <div className={`flex items-center gap-3 ${isRtl ? 'text-right' : 'text-left'}`}>
        <div className="siraj-media-chip w-10 h-10 rounded-full flex items-center justify-center shrink-0">
          {isLive ? (
            <MonitorPlay className="w-5 h-5 text-[var(--accent)]" />
          ) : (
            <Radio className="w-5 h-5 text-[var(--accent)]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium text-[var(--muted)] ${isUrdu ? 'font-urdu' : ''}`}>
            {label}
          </p>
          <p className="text-sm font-bold text-[var(--text)] break-words">
            {station.stationName}
          </p>
        </div>
        <div className={`shrink-0 ${isRtl ? 'text-left' : 'text-right'}`}>
          <p className="text-sm font-bold text-[var(--text)]">
            <span dir="ltr" className="tabular-nums">
              {formatDuration(station.totalSeconds)}
            </span>
          </p>
          <p className="text-xs font-semibold text-[var(--accent)]">
            <span dir="ltr" className="tabular-nums">
              {station.sharePct.toFixed(1)}%
            </span>
          </p>
        </div>
      </div>
    </div>
  );
});

interface AchievementTileProps {
  achievement: Achievement;
  title: string;
  description: string;
  isRtl: boolean;
  isUrdu: boolean;
}

const AchievementTile = memo(function AchievementTile({
  achievement,
  title,
  description,
  isRtl,
  isUrdu,
}: AchievementTileProps) {
  return (
    <div
      className={`rounded-2xl p-3 min-w-0 flex flex-col justify-between ${
        achievement.unlocked ? 'siraj-media-card-unlocked' : 'siraj-media-card-locked'
      }`}
    >
      <div className={isRtl ? 'text-right' : 'text-left'}>
        <div className="flex items-center gap-2 mb-2">
          <div className="siraj-media-chip w-8 h-8 rounded-full flex items-center justify-center shrink-0">
            {getAchievementIcon(achievement.id)}
          </div>
          <p
            className={`text-xs font-bold text-[var(--text)] leading-snug break-words whitespace-normal flex-1 min-w-0 ${
              isUrdu ? 'font-urdu' : ''
            }`}
          >
            {title}
          </p>
        </div>
        <p
          className={`text-[11px] text-[var(--muted)] leading-relaxed break-words whitespace-normal ${
            isUrdu ? 'font-urdu' : ''
          }`}
        >
          {description}
        </p>
      </div>
      {achievement.unlocked ? (
        <div className="mt-2.5 w-full h-1 rounded-full overflow-hidden bg-[var(--border)]">
          <div className="h-full rounded-full w-full bg-[var(--accent)]" />
        </div>
      ) : null}
    </div>
  );
});

interface BreakdownStationRowProps {
  station: NormalizedStationStat;
  sessionsLabel: string;
  isRtl: boolean;
  isUrdu: boolean;
}

const BreakdownStationRow = memo(function BreakdownStationRow({
  station,
  sessionsLabel,
  isRtl,
  isUrdu,
}: BreakdownStationRowProps) {
  const isLive = station.stationId.startsWith('live_');
  const clampedPct = Math.max(0, Math.min(100, station.sharePct));
  return (
    <div className="siraj-media-card rounded-2xl p-3.5 min-w-0">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className={`flex items-center gap-2.5 min-w-0 flex-1 ${isRtl ? 'text-right' : 'text-left'}`}>
            <div className="siraj-media-chip w-8 h-8 rounded-full flex items-center justify-center shrink-0">
              {isLive ? (
                <MonitorPlay className="w-4 h-4 text-[var(--accent)]" />
              ) : (
                <Radio className="w-4 h-4 text-[var(--accent)]" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[var(--text)] break-words">{station.stationName}</p>
              <p className={`text-xs text-[var(--muted)] ${isUrdu ? 'font-urdu' : ''}`}>
                <span dir="ltr" className="tabular-nums">
                  {station.sessionCount}
                </span>{' '}
                {sessionsLabel}
              </p>
            </div>
          </div>
          <div className={`shrink-0 ${isRtl ? 'text-left' : 'text-right'}`}>
            <p className="text-sm font-bold text-[var(--text)]">
              <span dir="ltr" className="tabular-nums">
                {formatDuration(station.totalSeconds)}
              </span>
            </p>
            <p className="text-xs font-semibold text-[var(--accent)]">
              <span dir="ltr" className="tabular-nums">
                {station.sharePct.toFixed(1)}%
              </span>
            </p>
          </div>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-[var(--border)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
            style={{ width: `${clampedPct}%` }}
          />
        </div>
      </div>
    </div>
  );
});

export default function RadioStats() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { contentLang, isRtl } = useContentLanguage();
  const langKey = contentLang === 'ur' || contentLang === 'gu' ? contentLang : 'en';
  const isUrdu = langKey === 'ur';
  const strings = STATS_I18N[langKey];
  const achievementCopy = ACHIEVEMENT_I18N[langKey];

  const [stats, setStats] = useState<StationStats[]>([]);
  const [streak, setStreak] = useState<number>(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const mountedRef = useRef(true);
  const lastTotalMinutesRef = useRef<number>(-1);

  const loadStats = useCallback(
    async (showSpinner = false) => {
      if (showSpinner && mountedRef.current) {
        setLoading(true);
      }
      try {
        const [stations, currentStreak, allAchievements] = await Promise.all([
          getSortedStationStats(),
          getCurrentStreak(),
          getAllAchievements(),
        ]);
        if (!mountedRef.current) return;
        const sumSeconds = stations.reduce((sum, s) => sum + Math.max(0, s.totalSeconds), 0);
        lastTotalMinutesRef.current = Math.floor(sumSeconds / 60);
        setStats(stations);
        setStreak(currentStreak);
        setAchievements(allAchievements);
      } catch (error) {
        console.error('Failed to load stats:', error);
        if (mountedRef.current) {
          toast({
            title: 'Error',
            description: strings.loadError,
            variant: 'destructive',
          });
        }
      } finally {
        if (showSpinner && mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [strings.loadError, toast]
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadStats(true);

    const unsubscribe = subscribeMediaStats(() => {
      void loadStats(false);
    });

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void loadStats(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    // Low-frequency 30s check only refreshes when totalMinutes actually changes
    const minuteSyncId = window.setInterval(async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const latestSeconds = await getTotalListeningTime();
        const latestMinutes = Math.floor(Math.max(0, latestSeconds) / 60);
        if (latestMinutes !== lastTotalMinutesRef.current) {
          await loadStats(false);
        }
      } catch (error) {
        console.error('Failed to refresh minute stats:', error);
      }
    }, REFRESH_MINUTES_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(minuteSyncId);
    };
  }, [loadStats]);

  const handleResetConfirm = useCallback(async () => {
    setIsResetting(true);
    try {
      await resetRadioStats();
      setStreak(0);
      setStats([]);
      await loadStats(false);
      setShowResetConfirm(false);
      toast({
        title: strings.resetTitle,
        description: strings.resetDesc,
      });
    } catch (error) {
      console.error('Failed to reset stats:', error);
      toast({
        title: 'Error',
        description: strings.resetError,
        variant: 'destructive',
      });
    } finally {
      setIsResetting(false);
    }
  }, [loadStats, strings.resetDesc, strings.resetError, strings.resetTitle, toast]);

  const summary = useMemo(() => computeNormalizedMediaSummary(stats), [stats]);
  const unlockedCount = useMemo(
    () => achievements.filter((achievement) => achievement.unlocked).length,
    [achievements]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent overflow-x-hidden flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-transparent overflow-x-hidden safe-top"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <style>{`
        .siraj-media-card {
          background: var(--surface);
          background: color-mix(in srgb, var(--surface) 84%, transparent);
          border: 1px solid var(--border);
        }
        .siraj-media-card-unlocked {
          background: var(--surface);
          background: color-mix(in srgb, var(--surface) 84%, transparent);
          border: 1px solid var(--accent);
        }
        .siraj-media-card-locked {
          background: var(--surface);
          background: color-mix(in srgb, var(--surface) 64%, transparent);
          border: 1px solid var(--border);
          opacity: 0.72;
        }
        .siraj-media-chip {
          background: var(--surface-2);
          background: color-mix(in srgb, var(--surface-2) 86%, transparent);
          border: 1px solid var(--border);
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-3.5 py-5 pb-28 space-y-4">
        {/* Page Header */}
        <div className={`flex items-center gap-2.5 ${isRtl ? 'text-right' : 'text-left'}`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/quran-radio')}
            className="rounded-full shrink-0"
          >
            <ArrowLeft className={`w-5 h-5 ${isRtl ? 'rotate-180' : ''}`} />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className={`text-xl font-black text-[var(--text)] tracking-tight ${isUrdu ? 'font-urdu' : ''}`}>
              {strings.title}
            </h1>
            <p className={`text-[11px] font-bold text-[var(--muted)] uppercase tracking-wider ${isUrdu ? 'font-urdu text-xs normal-case tracking-normal' : ''}`}>
              {strings.subtitle}
            </p>
          </div>
          {streak > 0 ? (
            <div className="siraj-media-chip flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0">
              <Flame className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span className={`text-xs font-bold text-[var(--text)] ${isUrdu ? 'font-urdu' : ''}`}>
                <span dir="ltr" className="tabular-nums">
                  {streak}
                </span>{' '}
                {strings.streak}
              </span>
            </div>
          ) : null}
        </div>

        {/* 3-Language Selector Bar (EN / UR / GU) */}
        <ContentLanguageBar fullWidth />

        {/* 4 Flat Luxury KPI Cards */}
        <div className="grid grid-cols-2 gap-2.5">
          <KpiStatCard
            label={strings.totalTime}
            value={formatDuration(summary.totalSeconds)}
            icon="clock"
            isRtl={isRtl}
            isUrdu={isUrdu}
          />
          <KpiStatCard
            label={strings.currentStreak}
            value={String(streak)}
            unit={strings.days}
            icon="flame"
            isRtl={isRtl}
            isUrdu={isUrdu}
          />
          <KpiStatCard
            label={strings.totalSessions}
            value={String(summary.totalSessions)}
            icon="target"
            isRtl={isRtl}
            isUrdu={isUrdu}
          />
          <KpiStatCard
            label={strings.avgSession}
            value={formatDuration(summary.avgSessionSeconds)}
            icon="trending"
            isRtl={isRtl}
            isUrdu={isUrdu}
          />
        </div>

        {/* Top Station / Stream (derived from same totalSeconds denominator) */}
        {summary.topStation ? (
          <TopStationCard
            station={summary.topStation}
            label={strings.topStation}
            isRtl={isRtl}
            isUrdu={isUrdu}
          />
        ) : null}

        {/* Achievements Section (2-column unclipped 360px grid) */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2.5">
            <h2 className={`text-base font-bold text-[var(--text)] flex items-center gap-2 ${isUrdu ? 'font-urdu' : ''}`}>
              <Trophy className="w-4 h-4 text-[var(--accent)] shrink-0" />
              {strings.achievements}
            </h2>
            <span className={`text-xs font-medium text-[var(--muted)] shrink-0 ${isUrdu ? 'font-urdu' : ''}`}>
              <span dir="ltr" className="tabular-nums">
                {unlockedCount}/{achievements.length}
              </span>{' '}
              {strings.unlocked}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {achievements.map((achievement) => {
              const localized = achievementCopy[achievement.id];
              return (
                <AchievementTile
                  key={achievement.id}
                  achievement={achievement}
                  title={localized ? localized.title : achievement.title}
                  description={localized ? localized.description : achievement.description}
                  isRtl={isRtl}
                  isUrdu={isUrdu}
                />
              );
            })}
          </div>
        </div>

        {/* Normalized 100.0% Media Breakdown */}
        <div>
          <h2 className={`text-base font-bold text-[var(--text)] mb-2.5 ${isUrdu ? 'font-urdu text-right' : ''}`}>
            {strings.mediaBreakdown}
          </h2>
          {summary.stations.length === 0 ? (
            <div className="siraj-media-card rounded-2xl p-6 text-center">
              <MonitorPlay className="w-10 h-10 mx-auto mb-3 text-[var(--muted)]" />
              <p className={`text-sm font-medium text-[var(--text)] ${isUrdu ? 'font-urdu' : ''}`}>
                {strings.noData}
              </p>
              <p className={`text-xs text-[var(--muted)] mt-1 ${isUrdu ? 'font-urdu' : ''}`}>
                {strings.noDataSub}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {summary.stations.map((station) => (
                <BreakdownStationRow
                  key={station.stationId}
                  station={station}
                  sessionsLabel={strings.sessions}
                  isRtl={isRtl}
                  isUrdu={isUrdu}
                />
              ))}
            </div>
          )}
        </div>

        {/* Reset Action */}
        <div className="pt-1">
          <Button
            variant="destructive"
            data-testid="media-stats-reset-btn"
            onClick={() => setShowResetConfirm(true)}
            className={`w-full rounded-2xl ${isUrdu ? 'font-urdu' : ''}`}
          >
            <Trash2 className="w-4 h-4 me-2" />
            {strings.reset}
          </Button>
        </div>
      </div>

      {/* Themed Portal Reset Confirmation Modal (opaque backdrop) */}
      {showResetConfirm && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          data-state="open"
          aria-labelledby="reset-stats-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isResetting) setShowResetConfirm(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.72)',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[330px] rounded-2xl border p-5 space-y-4 shadow-2xl"
            style={{
              backgroundColor: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                  style={{
                    backgroundColor: 'var(--surface)',
                    borderColor: 'var(--danger)',
                    color: 'var(--danger)',
                  }}
                >
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="reset-stats-modal-title" className="text-sm font-bold text-[var(--text-primary)]">
                    {strings.reset}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                    {strings.confirmReset}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--surface)', color: 'var(--text-secondary)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 text-xs"
                disabled={isResetting}
                onClick={() => setShowResetConfirm(false)}
              >
                {langKey === 'ur' ? 'منسوخ' : langKey === 'gu' ? 'રદ કરો' : 'Cancel'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                data-testid="media-stats-confirm-reset"
                className="flex-1 text-xs font-bold"
                disabled={isResetting}
                onClick={handleResetConfirm}
              >
                {isResetting ? '...' : strings.resetTitle}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
