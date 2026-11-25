import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  History,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { AppBar } from '@/components/AppBar';
import { PageTransition } from '@/components/PageTransition';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext-new';
import { useToast } from '@/hooks/use-toast';
import { getPageForSurahAndAyah } from '@/lib/interactive-mushaf';
import { getFallbackLocationByTimezone, LOCATION_STORAGE_KEY } from '@/lib/location-config';
import { calculateQiblaBearing } from '@/lib/qibla';
import { formatSajdahString, getSajdahI18n, type SajdahI18nStrings } from '@/lib/sajdah-i18n';
import {
  formatAyahRef,
  getLiveMakruhStatus,
  getSajdahByKey,
  SAJDAH_AYAHS,
  useSajdahTracker,
  type SajdahAyahEntry,
  type SajdahCompletedEntry,
  type SajdahSource,
  type SajdahUndoSnapshot,
} from '@/lib/sajdah-tracker';
import { get24HourTime } from '@/lib/storage';

type DirectoryFilter = 'all' | 'pending' | 'shafi';

function getStoredTimeFormat(): '12h' | '24h' {
  try {
    return get24HourTime() ? '24h' : '12h';
  } catch (err) {
    console.warn('[SajdahTracker] time-format read failed:', err);
    return '12h';
  }
}

function getQiblaDegree(): number {
  try {
    const raw = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const lat = parsed?.latitude ?? parsed?.lat;
      const lon = parsed?.longitude ?? parsed?.lon;
      if (typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon)) {
        return Math.round(calculateQiblaBearing(lat, lon));
      }
    }
  } catch (err) {
    console.warn('[SajdahTracker] location read failed:', err);
  }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const fallback = getFallbackLocationByTimezone(tz);
  return Math.round(calculateQiblaBearing(fallback.lat, fallback.lon));
}

function formatRelativeElapsed(iso: string, nowMs: number, strings: SajdahI18nStrings): string {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return strings.justNow;
  const diffMin = Math.max(0, Math.floor((nowMs - ts) / 60_000));
  if (diffMin < 1) return strings.justNow;
  if (diffMin < 60) return formatSajdahString(strings.minsAgo, { n: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return formatSajdahString(strings.hoursAgo, { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  return formatSajdahString(strings.daysAgo, { n: diffDays });
}

function getSourceLabel(source: SajdahSource, strings: SajdahI18nStrings): string {
  switch (source) {
    case 'read':
      return strings.sourceRead;
    case 'listen':
      return strings.sourceListen;
    case 'heard':
      return strings.sourceHeard;
    case 'manual':
    default:
      return strings.sourceManual;
  }
}

function getLocalDateGroupKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function SajdahTracker() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const strings = useMemo(() => getSajdahI18n(language), [language]);
  const isUrdu = language === 'ur';

  const {
    state,
    madhab,
    visibleAyahs,
    totalPendingCount,
    addPendingSajdah,
    addAllKhatamSajdahs,
    markSajdahPerformed,
    undoLastSajdahAction,
  } = useSajdahTracker();

  const [now, setNow] = useState<Date>(() => new Date());
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>(() => getStoredTimeFormat());
  const [searchQuery, setSearchQuery] = useState('');
  const [dirFilter, setDirFilter] = useState<DirectoryFilter>('all');
  const [guideOpen, setGuideOpen] = useState(false);
  const [makruhGuardKey, setMakruhGuardKey] = useState<string | null>(null);
  const [confirmKhatamOpen, setConfirmKhatamOpen] = useState(false);

  // Live 1s ticker so Makruh windows auto-dismiss cleanly at :00s
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);
    const onTimeFmt = () => setTimeFormat(getStoredTimeFormat());
    window.addEventListener('time-format-changed', onTimeFmt);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('time-format-changed', onTimeFmt);
    };
  }, []);

  const makruhState = useMemo(() => getLiveMakruhStatus(now, timeFormat), [now, timeFormat]);
  const qiblaDeg = useMemo(() => getQiblaDegree(), []);

  // Preserve ALL existing pending keys even if madhab changes from shafi -> hanafi
  const pendingRows = useMemo(() => {
    const rows: Array<{
      key: string;
      entry: SajdahAyahEntry;
      count: number;
      source: SajdahSource;
      lastLoggedAt: string;
    }> = [];
    for (const [key, item] of Object.entries(state.pending)) {
      if (!item || item.count <= 0) continue;
      const entry = getSajdahByKey(key) ?? SAJDAH_AYAHS.find((a) => a.id === key);
      if (!entry) continue;
      rows.push({
        key,
        entry,
        count: item.count,
        source: item.source,
        lastLoggedAt: item.lastLoggedAt,
      });
    }
    return rows.sort(
      (a, b) =>
        a.entry.surahNumber - b.entry.surahNumber || a.entry.markAyah - b.entry.markAyah,
    );
  }, [state.pending]);

  const filteredDirectory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return visibleAyahs.filter((entry) => {
      if (dirFilter === 'pending' && !(state.pending[entry.id]?.count > 0)) {
        return false;
      }
      if (dirFilter === 'shafi' && entry.school !== 'shafi-extra') {
        return false;
      }
      if (!q) return true;
      const ref = formatAyahRef(entry).toLowerCase();
      return (
        entry.surahName.toLowerCase().includes(q) ||
        entry.surahArabic.includes(searchQuery.trim()) ||
        ref.includes(q) ||
        String(entry.surahNumber) === q ||
        `juz ${entry.juz}`.includes(q)
      );
    });
  }, [visibleAyahs, searchQuery, dirFilter, state.pending]);

  const monthlyPerformedCount = useMemo(() => {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    return state.completedLog.filter((item) => {
      const d = new Date(item.performedAt);
      return !Number.isNaN(d.getTime()) && d.getFullYear() === curYear && d.getMonth() === curMonth;
    }).length;
  }, [state.completedLog, now]);

  const groupedHistory = useMemo(() => {
    const groups = new Map<string, SajdahCompletedEntry[]>();
    for (const item of state.completedLog.slice(0, 60)) {
      const dateKey = getLocalDateGroupKey(item.performedAt);
      const list = groups.get(dateKey);
      if (list) list.push(item);
      else groups.set(dateKey, [item]);
    }
    return Array.from(groups.entries());
  }, [state.completedLog]);

  const todayKey = getLocalDateGroupKey(now.toISOString());
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayKey = getLocalDateGroupKey(yesterdayDate.toISOString());

  const showUndoToast = (message: string, snapshot: SajdahUndoSnapshot, durationMs: number) => {
    const handle = toast({
      duration: durationMs,
      description: (
        <div className="flex items-center justify-between gap-2 w-full">
          <span className="text-xs font-medium leading-snug">{message}</span>
          <button
            type="button"
            onClick={() => {
              undoLastSajdahAction(snapshot);
              handle.dismiss();
              toast({ duration: 2200, title: strings.toastUndone });
            }}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer active:scale-95 inline-flex items-center gap-1"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            <RotateCcw className="w-3 h-3" />
            <span>{strings.undoBtn}</span>
          </button>
        </div>
      ),
    });
  };

  const openQuranAyah = (entry: SajdahAyahEntry) => {
    const page = getPageForSurahAndAyah(entry.surahNumber, entry.markAyah);
    navigate(`/quran/${entry.surahNumber}?page=${page}&ayah=${entry.markAyah}`);
  };

  const handlePerformPending = (key: string) => {
    if (makruhState.isMakruhNow && makruhState.activeWindow) {
      setMakruhGuardKey(key);
      return;
    }
    const entry = getSajdahByKey(key);
    const snap = markSajdahPerformed(key, 'later');
    showUndoToast(
      formatSajdahString(strings.toastMarkedPerformed, {
        ref: entry ? formatAyahRef(entry) : key,
      }),
      snap,
      5000,
    );
  };

  const handleConfirmMakruhEarlier = () => {
    if (!makruhGuardKey) return;
    const entry = getSajdahByKey(makruhGuardKey);
    const snap = markSajdahPerformed(makruhGuardKey, 'later');
    setMakruhGuardKey(null);
    showUndoToast(
      formatSajdahString(strings.toastMarkedPerformed, {
        ref: entry ? formatAyahRef(entry) : makruhGuardKey,
      }),
      snap,
      5000,
    );
  };

  const handleAddDirectoryPending = (entry: SajdahAyahEntry) => {
    const snap = addPendingSajdah(entry.id, 'manual', 1);
    showUndoToast(
      formatSajdahString(strings.toastAddedPending, { ref: formatAyahRef(entry) }),
      snap,
      5000,
    );
  };

  const handleConfirmKhatamAdd = () => {
    const count = visibleAyahs.length;
    const snap = addAllKhatamSajdahs(madhab);
    setConfirmKhatamOpen(false);
    showUndoToast(
      formatSajdahString(strings.toastKhatamAdded, { count }),
      snap,
      10000,
    );
  };

  const formatDateHeader = (dateKey: string) => {
    if (dateKey === todayKey) return t('today') || 'Today';
    if (dateKey === yesterdayKey) return t('yesterday') || 'Yesterday';
    const d = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateKey;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatHistoryClock = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: timeFormat !== '24h',
    });
  };

  return (
    <PageTransition>
      <div
        className="min-h-screen bg-transparent pb-4"
        style={{ background: 'transparent' }}
      >
        <AppBar title={strings.pageTitle} showBack={true} transparent />

        <main
          className="max-w-lg mx-auto px-3.5 pt-3 space-y-3.5"
          style={isUrdu ? { fontFamily: 'var(--font-urdu, inherit)' } : undefined}
        >
          {/* 1. HERO SUMMARY CARD */}
          <section
            aria-label="Sajdah summary"
            className="siraj-translucent-card rounded-2xl p-4 border space-y-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {strings.pageSubtitle}
                </p>
                <div className="mt-1.5 flex items-baseline gap-2.5 flex-wrap">
                  <span
                    className="text-3xl font-extrabold tracking-tight tabular-nums"
                    style={{ color: 'var(--accent-text)' }}
                    data-testid="sajdah-total-pending"
                  >
                    <bdi dir="ltr">{totalPendingCount}</bdi>
                  </span>
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    {strings.totalPending}
                  </span>
                </div>
              </div>

              <div
                className="siraj-translucent-subtle rounded-xl px-3 py-2 border text-right shrink-0"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-[10px] font-medium text-[var(--text-secondary)] whitespace-nowrap">
                  {strings.performedAllTime}
                </p>
                <p
                  className="text-lg font-extrabold tabular-nums text-[var(--text-primary)]"
                  data-testid="sajdah-total-performed"
                >
                  <bdi dir="ltr">{state.totalPerformedAllTime}</bdi>
                </p>
              </div>
            </div>

            {makruhState.isMakruhNow && makruhState.activeWindow ? (
              <div
                role="status"
                data-testid="sajdah-makruh-banner"
                className="rounded-xl px-3 py-2.5 border flex items-start gap-2 text-xs font-semibold leading-snug"
                style={{
                  background: 'rgba(220, 38, 38, 0.14)',
                  borderColor: 'rgba(220, 38, 38, 0.42)',
                  color: '#FCA5A5',
                }}
              >
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <span className="min-w-0 flex-1 text-[var(--text-primary)]">
                  {formatSajdahString(strings.makruhActiveWarning, {
                    end: makruhState.activeWindow.endFormatted,
                  })}
                </span>
              </div>
            ) : (
              <div
                className="siraj-translucent-subtle rounded-xl px-3 py-2 border flex items-center justify-between gap-2"
                style={{ borderColor: 'var(--border)' }}
              >
                <span className="text-[11px] font-medium text-[var(--text-secondary)] min-w-0 truncate">
                  {strings.cleanWindowStatus}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/qibla')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer active:scale-95 transition-transform"
                  style={{
                    background: 'var(--accent-soft)',
                    color: 'var(--accent-text)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Compass className="w-3.5 h-3.5" />
                  <span>
                    <bdi dir="ltr">{formatSajdahString(strings.qiblaShortcut, { deg: qiblaDeg })}</bdi>
                  </span>
                </button>
              </div>
            )}
          </section>

          {/* 2. PENDING QUEUE */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {strings.pendingQueueTitle}
              </h2>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
              >
                <bdi dir="ltr">{totalPendingCount}</bdi>
              </span>
            </div>

            {pendingRows.length === 0 ? (
              <div
                className="siraj-translucent-card rounded-2xl p-5 border text-center space-y-1.5"
                style={{ borderColor: 'var(--border)' }}
                data-testid="sajdah-pending-empty"
              >
                <div
                  className="w-10 h-10 rounded-full mx-auto flex items-center justify-center text-lg font-bold"
                  style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                >
                  ۩
                </div>
                <p className="text-sm font-bold text-[var(--text-primary)]">
                  {strings.emptyPendingTitle}
                </p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  {strings.emptyPendingBody}
                </p>
              </div>
            ) : (
              <div className="space-y-2" data-testid="sajdah-pending-list">
                {pendingRows.map(({ key, entry, count, source, lastLoggedAt }) => (
                  <div
                    key={key}
                    className="siraj-translucent-card rounded-2xl p-3.5 border space-y-2.5"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <span
                          className="w-8 h-8 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
                          style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                          aria-hidden="true"
                        >
                          ۩
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-bold text-[var(--text-primary)]">
                              {entry.surahName}
                            </span>
                            <span
                              dir="rtl"
                              className="text-sm font-semibold"
                              style={{
                                color: 'var(--accent-text)',
                                fontFamily: 'var(--font-arabic, Amiri, serif)',
                                letterSpacing: 'normal',
                                textTransform: 'none',
                              }}
                            >
                              {entry.surahArabic}
                            </span>
                            {entry.school === 'shafi-extra' && (
                              <span
                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                                style={{
                                  background: 'var(--accent-soft)',
                                  color: 'var(--accent-text)',
                                }}
                              >
                                {strings.shafiBadge}
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11px] text-[var(--text-secondary)]">
                            <span className="font-semibold text-[var(--text-primary)]">
                              <bdi dir="ltr">{formatAyahRef(entry)}</bdi>
                            </span>
                            <span>•</span>
                            <span>
                              {strings.juzLabel} <bdi dir="ltr">{entry.juz}</bdi>
                            </span>
                            <span>•</span>
                            <span
                              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: 'var(--surface-2)' }}
                            >
                              {getSourceLabel(source, strings)}
                            </span>
                            <span>•</span>
                            <span>{formatRelativeElapsed(lastLoggedAt, now.getTime(), strings)}</span>
                          </div>
                        </div>
                      </div>

                      {count > 1 && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-extrabold shrink-0 whitespace-nowrap"
                          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                        >
                          <bdi dir="ltr">×{count}</bdi>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handlePerformPending(key)}
                        className="flex-1 min-w-0 py-2 px-3 rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-transform whitespace-nowrap text-center"
                        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                      >
                        {strings.performedMinusOne}
                      </button>
                      <button
                        type="button"
                        onClick={() => openQuranAyah(entry)}
                        className="py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer active:scale-95 transition-transform whitespace-nowrap shrink-0 inline-flex items-center gap-1"
                        style={{
                          background: 'var(--surface-2)',
                          borderColor: 'var(--border)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{strings.openAyah}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 3. FULL QURAN KHATAM BULK CARD */}
          <section
            className="siraj-translucent-card rounded-2xl p-4 border space-y-2.5"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-start gap-2.5">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
              >
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{strings.khatamTitle}</h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                  {formatSajdahString(strings.khatamDesc, { count: visibleAyahs.length })}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmKhatamOpen(true)}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold border cursor-pointer active:scale-[0.99] transition-transform"
              style={{
                background: 'var(--accent-soft)',
                borderColor: 'var(--border)',
                color: 'var(--accent-text)',
              }}
            >
              {formatSajdahString(strings.addAllKhatamBtn, { count: visibleAyahs.length })}
            </button>
          </section>

          {/* 4. COLLAPSIBLE HOW TO PERFORM GUIDE */}
          <section
            className="siraj-translucent-card rounded-2xl border overflow-hidden"
            style={{ borderColor: 'var(--border)' }}
          >
            <button
              type="button"
              aria-expanded={guideOpen}
              onClick={() => setGuideOpen((prev) => !prev)}
              className="w-full p-4 flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-bold text-[var(--text-primary)]">{strings.guideTitle}</h2>
                <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                  {strings.guideSubtitle}
                </p>
              </div>
              {guideOpen ? (
                <ChevronUp className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
              )}
            </button>

            {guideOpen && (
              <div
                className="px-4 pb-4 pt-1 space-y-3 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <ol className="space-y-2">
                  {strings.guideSteps.map((stepText, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-[var(--text-primary)] leading-relaxed">
                      <span
                        className="w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                      >
                        <bdi dir="ltr">{idx + 1}</bdi>
                      </span>
                      <span className="min-w-0 flex-1">{stepText}</span>
                    </li>
                  ))}
                </ol>

                <div
                  className="siraj-translucent-subtle rounded-xl p-3 border space-y-2"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {strings.guideDuaTitle}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                    >
                      {strings.guideDuaBadge}
                    </span>
                  </div>

                  <p
                    dir="rtl"
                    className="text-base leading-loose text-right text-[var(--text-primary)]"
                    style={{
                      fontFamily: 'var(--font-arabic, Amiri, serif)',
                      letterSpacing: 'normal',
                      textTransform: 'none',
                    }}
                  >
                    {strings.guideDuaArabic}
                  </p>
                  <p className="text-[11px] italic text-[var(--text-secondary)] leading-relaxed">
                    {strings.guideDuaTranslit}
                  </p>
                  <p className="text-xs text-[var(--text-primary)] leading-relaxed">
                    {strings.guideDuaTranslation}
                  </p>
                </div>

                <p
                  className="text-[11px] font-medium text-[var(--text-secondary)] leading-relaxed rounded-xl px-3 py-2 border"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}
                >
                  {strings.guideMadhabNote}
                </p>
              </div>
            )}
          </section>

          {/* 5. COMPLETE 14(+1) AYAH DIRECTORY */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                {formatSajdahString(strings.directoryTitle, { count: visibleAyahs.length })}
              </h2>
            </div>

            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--text-secondary)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={strings.searchPlaceholder}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border text-xs bg-[var(--surface)] text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] outline-none"
                  style={{ borderColor: 'var(--border)' }}
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {(
                  [
                    { id: 'all', label: strings.filterAll },
                    { id: 'pending', label: strings.filterPendingOnly },
                    ...(madhab === 'shafi'
                      ? [{ id: 'shafi', label: strings.filterShafiOnly }]
                      : []),
                  ] as Array<{ id: DirectoryFilter; label: string }>
                ).map((pill) => {
                  const active = dirFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setDirFilter(pill.id)}
                      className="px-3 py-1 rounded-full text-[11px] font-bold border cursor-pointer whitespace-nowrap transition-colors"
                      style={{
                        background: active ? 'var(--accent)' : 'var(--surface)',
                        color: active ? 'var(--on-accent)' : 'var(--text-secondary)',
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                      }}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredDirectory.length === 0 ? (
              <div
                className="siraj-translucent-card rounded-2xl p-4 border text-center text-xs text-[var(--text-secondary)]"
                style={{ borderColor: 'var(--border)' }}
              >
                {strings.noDirectoryMatches}
              </div>
            ) : (
              <div className="space-y-2" data-testid="sajdah-directory-list">
                {filteredDirectory.map((entry, idx) => {
                  const pendingCount = state.pending[entry.id]?.count ?? 0;
                  return (
                    <div
                      key={entry.id}
                      className="siraj-translucent-card rounded-2xl p-3.5 border space-y-2.5"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                          <span
                            className="w-6 h-6 rounded-lg text-[11px] font-bold flex items-center justify-center shrink-0"
                            style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                          >
                            <bdi dir="ltr">{idx + 1}</bdi>
                          </span>
                          <span className="text-sm font-bold text-[var(--text-primary)]">
                            {entry.surahName}
                          </span>
                          <span
                            dir="rtl"
                            className="text-sm font-semibold"
                            style={{
                              color: 'var(--accent-text)',
                              fontFamily: 'var(--font-arabic, Amiri, serif)',
                              letterSpacing: 'normal',
                              textTransform: 'none',
                            }}
                          >
                            {entry.surahArabic}
                          </span>
                          {entry.school === 'shafi-extra' && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
                              style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
                            >
                              {strings.shafiBadge}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-bold text-[var(--text-secondary)] whitespace-nowrap">
                            <bdi dir="ltr">{formatAyahRef(entry)}</bdi> • {strings.juzLabel}{' '}
                            <bdi dir="ltr">{entry.juz}</bdi>
                          </span>
                        </div>
                      </div>

                      <p
                        dir="rtl"
                        className="text-base leading-loose text-right text-[var(--text-primary)] siraj-translucent-subtle rounded-xl px-3 py-2 border"
                        style={{
                          borderColor: 'var(--border)',
                          fontFamily: 'var(--font-arabic, Amiri, serif)',
                          letterSpacing: 'normal',
                          textTransform: 'none',
                        }}
                      >
                        {entry.arabicSnippet}
                      </p>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div>
                          {pendingCount > 0 && (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
                              style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                            >
                              <bdi dir="ltr">
                                {formatSajdahString(strings.pendingBadgeCount, { n: pendingCount })}
                              </bdi>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleAddDirectoryPending(entry)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer active:scale-95 transition-transform whitespace-nowrap inline-flex items-center gap-1"
                            style={{
                              background: 'var(--accent-soft)',
                              color: 'var(--accent-text)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>{strings.addOnePending}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openQuranAyah(entry)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer active:scale-95 transition-transform whitespace-nowrap inline-flex items-center gap-1"
                            style={{
                              background: 'var(--surface-2)',
                              borderColor: 'var(--border)',
                              color: 'var(--text-primary)',
                            }}
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                            <span>{strings.readBtn}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 6. COMPLETED HISTORY */}
          <section
            className="siraj-translucent-card rounded-2xl p-4 border space-y-3"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <History className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] truncate">
                  {strings.historyTitle}
                </h2>
              </div>
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0"
                style={{ background: 'var(--accent-soft)', color: 'var(--accent-text)' }}
              >
                <bdi dir="ltr">
                  {formatSajdahString(strings.thisMonthSummary, { count: monthlyPerformedCount })}
                </bdi>
              </span>
            </div>

            {groupedHistory.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)]">{strings.emptyHistory}</p>
            ) : (
              <div className="space-y-3" data-testid="sajdah-history-list">
                {groupedHistory.map(([dateKey, items]) => (
                  <div key={dateKey} className="space-y-1.5">
                    <p className="text-[11px] font-bold text-[var(--text-secondary)]">
                      {formatDateHeader(dateKey)}
                    </p>
                    <div className="space-y-1.5">
                      {items.map((item, idx) => {
                        const entry = getSajdahByKey(item.key);
                        return (
                          <div
                            key={`${item.key}-${item.performedAt}-${idx}`}
                            className="siraj-translucent-subtle rounded-xl px-3 py-2 border flex items-center justify-between gap-2 text-xs"
                            style={{ borderColor: 'var(--border)' }}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="font-semibold text-[var(--text-primary)] truncate">
                                {entry ? entry.surahName : item.key}{' '}
                                <bdi dir="ltr">{entry ? formatAyahRef(entry) : item.key}</bdi>
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 text-[10px] text-[var(--text-secondary)]">
                              <span
                                className="px-1.5 py-0.5 rounded font-semibold"
                                style={{ background: 'var(--surface)' }}
                              >
                                {item.method === 'immediate'
                                  ? strings.methodImmediate
                                  : strings.methodLater}
                              </span>
                              <span>•</span>
                              <span className="inline-flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />
                                <bdi dir="ltr">{formatHistoryClock(item.performedAt)}</bdi>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* MAKRUH PERFORM GUARD PORTAL MODAL (zIndex 9999) */}
        {makruhGuardKey &&
          makruhState.activeWindow &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sajdah-makruh-modal-title"
              className="fixed inset-0 flex items-center justify-center p-4"
              style={{
                zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.72)',
              }}
              onClick={() => setMakruhGuardKey(null)}
            >
              <div
                className="w-full max-w-sm rounded-2xl p-5 border space-y-4 shadow-2xl"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'rgba(220, 38, 38, 0.45)',
                  color: 'var(--text-primary)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(220, 38, 38, 0.16)', color: '#F87171' }}
                  >
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 id="sajdah-makruh-modal-title" className="text-base font-bold">
                      {strings.makruhModalTitle}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      {formatSajdahString(strings.makruhModalBody, {
                        name: makruhState.activeWindow.title,
                        end: makruhState.activeWindow.endFormatted,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setMakruhGuardKey(null)}
                    className="w-full rounded-xl font-bold text-xs"
                  >
                    {formatSajdahString(strings.waitUntilBtn, {
                      end: makruhState.activeWindow.endFormatted,
                    })}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmMakruhEarlier}
                    className="w-full rounded-xl font-bold text-xs"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    {strings.performedEarlierBtn}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* FULL KHATAM CONFIRMATION PORTAL MODAL (zIndex 9999) */}
        {confirmKhatamOpen &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sajdah-khatam-modal-title"
              className="fixed inset-0 flex items-center justify-center p-4"
              style={{
                zIndex: 9999,
                background: 'rgba(0, 0, 0, 0.72)',
              }}
              onClick={() => setConfirmKhatamOpen(false)}
            >
              <div
                className="w-full max-w-sm rounded-2xl p-5 border space-y-4 shadow-2xl"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-primary)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1.5">
                  <h3 id="sajdah-khatam-modal-title" className="text-base font-bold">
                    {strings.khatamModalTitle}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {formatSajdahString(strings.khatamModalBody, {
                      count: visibleAyahs.length,
                      scope:
                        madhab === 'shafi'
                          ? strings.khatamScopeShafi
                          : strings.khatamScopeStandard,
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmKhatamOpen(false)}
                    className="flex-1 rounded-xl font-bold text-xs"
                  >
                    {strings.cancelBtn}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmKhatamAdd}
                    className="flex-1 rounded-xl font-bold text-xs"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    {formatSajdahString(strings.confirmAddAllBtn, {
                      count: visibleAyahs.length,
                    })}
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}
      </div>
    </PageTransition>
  );
}
