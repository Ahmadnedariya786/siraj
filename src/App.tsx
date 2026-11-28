import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { markStartupStep, completeStartupStep } from "@/lib/startup-breadcrumb";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BottomNav from "@/components/BottomNav";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { normalizeAppRoute } from "@/lib/route-utils";

import { LayoutManager } from "@/components/LayoutManager";
import { SplashScreen, forceReleaseSplashScrollLock } from "@/components/SplashScreen";
import { THEME_BG_HEX_MAP, ThemeId } from "@/lib/theme-engine";
import { SettingsProvider, useSettings } from "@/contexts/SettingsContext";
import { MotionConfig } from "framer-motion";
import { LazyMotionWrapper } from "@/components/LazyMotionWrapper";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n-new";
import { LOCATION_STORAGE_KEY } from "@/lib/location-config";
import { useWidgetSync } from "@/hooks/useWidgetSync";
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useAutoBackup } from "@/hooks/useAutoBackup";
import { useAnimationTier } from "@/hooks/useAnimationTier";
import { preloadCriticalResources, isLowEndDevice, monitorFPS } from "@/lib/performance-optimizations";
import { applyTieredVisualOverrides, getAnimationTier } from "@/lib/device-performance";
import { recordBreadcrumb } from "@/lib/diagnostics-engine";
import { TilawahProvider, useTilawah } from "@/contexts/TilawahContext";
import {
  runP1IdleChunks,
  scheduleP3NetworkIdle,
  SPLASH_HARD_CAP_MS,
  markSplashDismissed,
  markBootOrchestratorStarted,
  getLatestBootTrace,
  recordAlarmArmed,
  yieldToMainThread,
  P1_SW_ALARMS_DELAY_MS,
  P1_WIDGET_SYNC_DELAY_MS,
  P1_EVENTS_PRAYER_DELAY_MS,
  P3_NETWORK_IDLE_DELAY_MS,
  WIDGET_SYNC_FRESHNESS_MS,
  WIDGET_SYNC_META_KEY,
} from "@/lib/boot-scheduler";
import { initHomeLastStateSyncListeners } from "@/lib/home-last-state";

/**
 * RouteBreadcrumbTracker — automatically logs timestamped breadcrumbs on every route change.
 */
function RouteBreadcrumbTracker() {
  const location = useLocation();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    const current = (location.pathname || '/') + (location.search || '') + (location.hash || '');
    if (prevPathRef.current !== null && prevPathRef.current !== current) {
      recordBreadcrumb('ROUTE_CHANGE', `${prevPathRef.current} -> ${current}`);
    } else if (prevPathRef.current === null) {
      recordBreadcrumb('ROUTE_INITIAL', current);
    }
    prevPathRef.current = current;
  }, [location]);

  return null;
}

/**
 * DeepLinkListener — subscribes to widget deep-links (siraj://app/<path>?<query>)
 * and routes them through React Router. Must live inside <BrowserRouter> so useNavigate works.

 *
 * Handles both cold start (Capacitor delivers the launch URL on appUrlOpen) and warm start
 * (MainActivity.onNewIntent forwards the intent to the App plugin). No-op on web.
 */
function DeepLinkListener() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastHandledUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const routeFromUrl = (rawUrl: string) => {
      if (!rawUrl || cancelled) return;
      if (lastHandledUrlRef.current === rawUrl) return;
      lastHandledUrlRef.current = rawUrl;

      // Normalize deep-link URL (strips siraj://app, noorconnect://app, https://localhost, collapses //)
      const targetPath = normalizeAppRoute(rawUrl);

      // If already at target path, do not navigate again
      const currentFull = location.pathname + location.search;
      if (currentFull === targetPath || location.pathname === targetPath) {
        return;
      }

      try {
        navigate(targetPath, { replace: true });
      } catch (e) {
        console.warn('DeepLinkListener: could not navigate to', targetPath, e);
      }
    };

    // Clean up window.location.pathname if it contains embedded scheme fragments on initial load
    if (typeof window !== 'undefined' && window.location.pathname) {
      if (/siraj|noorconnect|\/\//i.test(window.location.pathname)) {
        const cleanBootRoute = normalizeAppRoute(window.location.pathname + window.location.search);
        if (cleanBootRoute !== window.location.pathname) {
          navigate(cleanBootRoute, { replace: true });
        }
      }
    }

    // Warm start: subsequent URL opens while app is running
    const cleanupPromise = CapacitorApp.addListener('appUrlOpen', ({ url }) => {
      routeFromUrl(url);
    });

    // Cold start: if app was launched from a widget tap, get the launch URL
    CapacitorApp.getLaunchUrl()
      .then((data) => {
        if (data?.url) {
          routeFromUrl(data.url);
        }
      })
      .catch((err) => {
        console.debug('DeepLink getLaunchUrl skipped:', err);
      });

    // Handle taps on native Sajdah-e-Tilawat reminder notifications cleanly (deferred dynamic import)
    let notifHandle: { remove?: () => Promise<void> } | null = null;
    if (Capacitor.isNativePlatform()) {
      import('@capacitor/local-notifications')
        .then(async ({ LocalNotifications }) => {
          if (cancelled) return;
          notifHandle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
            const notif = event?.notification;
            if (
              notif?.id === 1099 ||
              notif?.extra?.type === 'sajdah_reminder' ||
              notif?.extra?.route === '/sajdah'
            ) {
              navigate('/sajdah');
            }
          });
        })
        .catch((err) => console.debug('DeepLinkListener LocalNotifications skipped:', err));
    }

    return () => {
      cancelled = true;
      cleanupPromise.then((h) => h?.remove?.()).catch((err) => console.debug('appUrlOpen cleanup:', err));
      notifHandle?.remove?.().catch((err) => console.debug('localNotificationActionPerformed cleanup:', err));
    };
  }, [navigate, location.pathname, location.search]);
  return null;
}

/**
 * TilawahRouteHandler — seamless entry point for /tilawah route
 * Opens the dedicated Tilawah Player modal and navigates to the Quran section.
 */
function TilawahRouteHandler() {
  const { openPlayer } = useTilawah();
  const navigate = useNavigate();
  useEffect(() => {
    openPlayer();
    navigate('/quran', { replace: true });
  }, [openPlayer, navigate]);
  return null;
}

// Create QueryClient for React Query with performance optimizations
const isLowEndForQuery = isLowEndDevice();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: isLowEndForQuery ? 5 * 60 * 1000 : 60 * 60 * 1000, // 5 min for low-end, 1 hour for others
      gcTime: isLowEndForQuery ? 2 * 60 * 1000 : 5 * 60 * 1000, // 2 min for low-end, 5 min for others
      retry: isLowEndForQuery ? 0 : 1, // No retry for low-end devices
      refetchOnWindowFocus: false,
      refetchOnReconnect: !isLowEndForQuery, // Disable reconnection refetch on low-end
    },
    mutations: {
      retry: isLowEndForQuery ? 0 : 1,
    },
  },
});

// Global Players & Deferred Overlays - Lazy loaded
const GlobalRadioPlayer = lazy(() => import("@/components/GlobalRadioPlayer").then(m => ({ default: m.GlobalRadioPlayer })));
const GlobalQuranPlayer = lazy(() => import("@/components/GlobalQuranPlayer").then(m => ({ default: m.GlobalQuranPlayer })));
const GlobalNasheedPlayer = lazy(() => import("@/components/GlobalNasheedPlayer").then(m => ({ default: m.GlobalNasheedPlayer })));
const GlobalTilawahBar = lazy(() => import("@/components/GlobalTilawahBar").then(m => ({ default: m.GlobalTilawahBar })));
const TilawahPlayerModal = lazy(() => import("@/components/Quran/TilawahPlayerModal").then(m => ({ default: m.TilawahPlayerModal })));
const AutoBackupRestoreDialog = lazy(() => import("@/components/AutoBackupRestoreDialog").then(m => ({ default: m.AutoBackupRestoreDialog })));
const ExactAlarmPermissionDialog = lazy(() => import("@/components/ExactAlarmPermissionDialog").then(m => ({ default: m.ExactAlarmPermissionDialog })));
const HardwareBackButtonHandler = lazy(() => import("@/components/HardwareBackButtonHandler").then(m => ({ default: m.HardwareBackButtonHandler })));
const EidChecklistNotification = lazy(() => import("@/components/EidChecklistNotification").then(m => ({ default: m.EidChecklistNotification })));
const FitranaCalculatorNotification = lazy(() => import("@/components/FitranaCalculatorNotification").then(m => ({ default: m.FitranaCalculatorNotification })));
const GlobalPrayerAlarm = lazy(() => import("@/components/GlobalPrayerAlarm").then(module => ({ default: module.GlobalPrayerAlarm })));
const SalamGreeting = lazy(() => import("@/components/SalamGreeting").then(module => ({ default: module.SalamGreeting })));
const FestivePopup = lazy(() => import("@/components/FestivePopup").then(module => ({ default: module.FestivePopup })));

// Keep ONLY Home Dashboard eager for instant cold boot (<1.8s)
import Dashboard from "./pages/Dashboard";

// Lazy-split ALL secondary routes & heavy modals out of the initial entry bundle
const SurahList = lazy(() => import("./pages/SurahList"));
const QuranReader = lazy(() => import("./pages/QuranReader"));
const Qibla = lazy(() => import("./pages/Qibla"));
const Services = lazy(() => import("./pages/Services"));
const Profile = lazy(() => import("./pages/Profile"));
const SettingsSubPage = lazy(() => import("./pages/SettingsSubPage"));
const SettingsThemePage = lazy(() => import("./pages/SettingsThemePage"));
const ZakatCalculator = lazy(() => import("./pages/ZakatCalculator"));

// Lazy load secondary/deep route components
const DashboardWidgets = lazy(() => import("./pages/DashboardWidgets"));
const QuranProgress = lazy(() => import("./pages/QuranProgress"));
const Tasbeeh = lazy(() => import("./pages/Tasbeeh"));
const Duas = lazy(() => import("./pages/Duas"));
const Hadith = lazy(() => import("./pages/Hadith"));
const HadithCollections = lazy(() => import("./pages/HadithCollections"));
const HadithBook = lazy(() => import("./pages/HadithBook"));
const HadithBookContent = lazy(() => import("./pages/HadithBookContent"));
const HadithDetail = lazy(() => import("./pages/HadithDetail"));
const HadithBookmarksPage = lazy(() => import("./pages/HadithBookmarks"));
const IslamicCalendar = lazy(() => import("./pages/IslamicCalendar"));
const Ebooks = lazy(() => import("./pages/EbooksModern"));
const QazaPage = lazy(() => import("./pages/QazaPage"));
const RamadanMode = lazy(() => import("./pages/RamadanMode"));

const NotificationHistory = lazy(() => import("./pages/NotificationHistory"));
const NamesOfAllah = lazy(() => import("./pages/NamesOfAllah"));
const IslamicQuiz = lazy(() => import("./pages/EnhancedIslamicQuiz"));
const PrayerStats = lazy(() => import("./pages/PrayerStats"));
const HabitTracker = lazy(() => import("./pages/HabitTracker"));
const QuranRadio = lazy(() => import("./pages/QuranRadio"));
const QuranAudio = lazy(() => import("./pages/QuranAudio"));
const NasheedPlayer = lazy(() => import("./pages/NasheedPlayer"));
const LiveStreams = lazy(() => import("./pages/LiveStreams"));
const RadioStats = lazy(() => import("./pages/RadioStats"));
const IslamicRemedies = lazy(() => import("./pages/IslamicRemedies"));
const RemedyFavorites = lazy(() => import("./pages/RemedyFavorites"));
const Tafsir = lazy(() => import("./pages/Tafsir-New"));
const EidChecklist = lazy(() => import("./pages/EidChecklist"));
const FitranaCalculator = lazy(() => import("./pages/FitranaCalculator"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SeerahHome = lazy(() => import("./pages/SeerahHome"));
const SeerahReader = lazy(() => import("./pages/SeerahReader"));
const HaidhTracker = lazy(() => import("./pages/HaidhTracker"));
const QisasHome = lazy(() => import("./pages/QisasHome"));
const QisasReader = lazy(() => import("./pages/QisasReader"));
const MonthlyTimetable = lazy(() => import("./pages/MonthlyTimetable"));
const WidgetSettings = lazy(() => import("./pages/WidgetSettings"));
const MosqueFinder = lazy(() => import("./pages/MosqueFinder"));
const SettingsCalculationPage = lazy(() => import("./pages/SettingsCalculationPage"));
const SajdahTracker = lazy(() => import("./pages/SajdahTracker"));

function AppRoutes() {
  const location = useLocation();
  const { animationEnabled } = useSettings();
  const { t } = useTranslation(undefined, { i18n });

  // Scroll to top on navigation — single pass, no repeated layout thrashing
  useEffect(() => {
    const resetScroll = () => {
      window.scrollTo(0, 0);
      const scrollContainer = document.getElementById("main-content");
      if (scrollContainer) scrollContainer.scrollTop = 0;
    };
    resetScroll();
    const id = requestAnimationFrame(resetScroll);
    return () => cancelAnimationFrame(id);
  }, [location.pathname]);

  return (
    <Suspense
      fallback={
        <div className="w-full min-h-screen bg-transparent flex items-center justify-center">
          <div
            className="w-7 h-7 rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin"
            aria-label="Loading screen"
          />
        </div>
      }
    >
      <div
        key={location.pathname}
        className={`w-full h-full page-transition-wrapper ${animationEnabled ? "animate-page-enter" : ""}`}
        style={{ background: 'transparent' }}
      >
        <Routes location={location}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard-widgets" element={<DashboardWidgets />} />
          {/* Widget deep-link targets (WidgetDeeplink.kt) that have no dedicated page */}
          <Route path="/prayers" element={<Navigate to="/dashboard" replace />} />
          <Route path="/quran/reading" element={<Navigate to="/quran-progress" replace />} />
          <Route path="/quran" element={<SurahList />} />
          <Route path="/tilawah" element={<TilawahRouteHandler />} />
          <Route path="/quran-reader/:surahNumber" element={<Navigate to="/quran" replace />} />
          <Route path="/quran/:surahName" element={<QuranReader />} />
          <Route path="/quran-progress" element={<QuranProgress />} />
          <Route path="/tasbeeh" element={<Tasbeeh />} />
          <Route path="/tasbih" element={<Navigate to="/tasbeeh" replace />} />
          <Route path="/services/tasbih" element={<Navigate to="/tasbeeh" replace />} />
          <Route path="/services/calendar" element={<Navigate to="/calendar" replace />} />
          <Route path="/timetable" element={<MonthlyTimetable />} />
          <Route path="/services/timetable" element={<Navigate to="/timetable" replace />} />
          <Route path="/mosques" element={<MosqueFinder />} />
          <Route path="/masjid" element={<MosqueFinder />} />
          <Route path="/services/mosques" element={<Navigate to="/mosques" replace />} />
          <Route path="/qibla" element={<Qibla />} />
          <Route path="/duas" element={<Duas />} />
          <Route path="/hadith" element={<Hadith />} />
          <Route path="/hadith/collections" element={<HadithCollections />} />
          <Route path="/hadith/collections/:collection" element={<HadithBook />} />
          <Route path="/hadith/collections/:collection/:book" element={<HadithBookContent />} />
          <Route path="/hadith/collections/:collection/:book/:hadithNumber" element={<HadithDetail />} />
          <Route path="/hadith/bookmarks" element={<HadithBookmarksPage />} />
          <Route path="/seerah" element={<SeerahHome />} />
          <Route path="/seerah/:chapterId" element={<SeerahReader />} />
          <Route path="/qisas" element={<QisasHome />} />
          <Route path="/qisas/:prophetId" element={<QisasReader />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/calendar" element={<IslamicCalendar />} />
          <Route path="/ebooks" element={<Ebooks />} />
          <Route path="/qaza" element={<QazaPage />} />
          <Route path="/qaza-tracker" element={<QazaPage />} />
          <Route path="/services/qaza" element={<QazaPage />} />
          <Route path="/services/qaza-tracker" element={<QazaPage />} />
          <Route path="/sajdah" element={<SajdahTracker />} />
          <Route path="/services/sajdah" element={<SajdahTracker />} />
          <Route path="/ramadan" element={<RamadanMode />} />
          <Route path="/menstrual-mode" element={<Navigate to="/noor-cycle" replace />} />
          <Route path="/enhanced-menstrual-mode" element={<Navigate to="/noor-cycle" replace />} />
          <Route path="/noor-cycle" element={<HaidhTracker />} />
          <Route path="/notification-history" element={<NotificationHistory />} />
          <Route path="/zakat" element={<ZakatCalculator />} />
          <Route path="/names-of-allah" element={<NamesOfAllah />} />
          <Route path="/quiz" element={<IslamicQuiz />} />
          <Route path="/prayer-stats" element={<PrayerStats />} />
          <Route path="/services/salah-tracker" element={<PrayerStats />} />
          <Route path="/salah-tracker" element={<PrayerStats />} />
          <Route path="/habit-tracker" element={<HabitTracker />} />
          <Route path="/quran-radio" element={<QuranRadio />} />
          <Route path="/quran-audio" element={<QuranAudio />} />
          <Route path="/nasheeds" element={<NasheedPlayer />} />
          <Route path="/live" element={<LiveStreams />} />
          <Route path="/radio-stats" element={<RadioStats />} />
          <Route path="/services" element={<Services />} />
          <Route path="/islamic-remedies" element={<IslamicRemedies />} />
          <Route path="/remedy-favorites" element={<RemedyFavorites />} />
          <Route path="/tafsir" element={<Tafsir />} />
          <Route path="/eid-checklist" element={<EidChecklist />} />
          <Route path="/fitrana-calculator" element={<FitranaCalculator />} />
          <Route path="/support" element={<Navigate to="/settings/about" replace />} />
          <Route path="/donate" element={<Navigate to="/settings/about" replace />} />
          <Route path="/settings" element={<Navigate to="/profile" replace />} />
          <Route path="/settings/theme" element={<SettingsThemePage />} />
          <Route path="/settings/app-theme" element={<SettingsThemePage />} />
          <Route path="/settings/calculation" element={<SettingsCalculationPage />} />
          <Route path="/settings/prayer-calculation" element={<SettingsCalculationPage />} />
          <Route path="/settings/prayer" element={<SettingsCalculationPage />} />
          <Route path="/settings/personal" element={<ZakatCalculator />} />
          <Route path="/settings/zakat" element={<ZakatCalculator />} />
          <Route path="/settings/widgets" element={<WidgetSettings />} />
          <Route path="/settings/:sectionId" element={<SettingsSubPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Suspense>
  );
}

function RoutedErrorBoundary({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary pathname={location.pathname}>{children}</ErrorBoundary>;
}

function AppContent({ splashActive }: { splashActive?: boolean }) {
  const { animationEnabled, greetingEnabled } = useSettings();
  const tier = useAnimationTier();
  const reduceMotion = tier.shouldReduceAnimations;

  return (
    <MotionConfig reducedMotion={(!animationEnabled || reduceMotion) ? "always" : "user"}>
      <LazyMotionWrapper>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <TilawahProvider>
            {/* Global Fixed Theme Signature Pattern Canvas (Layer 1) */}
            <div className="theme-app-pattern sig-pattern-layer" aria-hidden="true" />

            <div className="flex flex-col min-h-screen overflow-x-hidden relative bg-transparent" style={{ position: 'relative', zIndex: 1, background: 'transparent' }}>
              <Suspense fallback={null}>
                <GlobalTilawahBar />
              </Suspense>
              <div className="flex-shrink-0">
                <Suspense fallback={null}>
                  <GlobalPrayerAlarm />
                  {greetingEnabled && <SalamGreeting splashActive={splashActive} />}
                  <FestivePopup />
                  <EidChecklistNotification />
                  <FitranaCalculatorNotification />
                  <AutoBackupRestoreDialog />
                </Suspense>
              </div>

              <LayoutManager>
                <RoutedErrorBoundary>
                  <Suspense fallback={null}>
                    <HardwareBackButtonHandler />
                  </Suspense>
                  <RouteBreadcrumbTracker />
                  <DeepLinkListener />
                  <AppRoutes />
                </RoutedErrorBoundary>
              </LayoutManager>
            </div>

            <BottomNav />
            <Suspense fallback={null}>
              <TilawahPlayerModal />
              <GlobalRadioPlayer />
              <GlobalQuranPlayer />
              <GlobalNasheedPlayer />
            </Suspense>
          </TilawahProvider>
        </BrowserRouter>
      </LazyMotionWrapper>
    </MotionConfig>
  );
}

function AppShell() {
  const isWarmOrWidgetLaunch = typeof window !== 'undefined' && (
    sessionStorage.getItem('noor_app_booted') === 'true'
  );
  const [showSplash, setShowSplash] = useState(!isWarmOrWidgetLaunch);
  const { animationEnabled, splashGreetingEnabled, splashEnabled } = useSettings();

  useEffect(() => {
    try {
      sessionStorage.setItem('noor_app_booted', 'true');
    } catch {
      // ignore
    }
  }, []);
  // Always-on auto backup: runs immediately, then every 20 minutes of app use
  // while any page is open (not just the Settings page).
  useAutoBackup();
  // Push Quran-progress + tasbeeh state to native widgets when they change
  useWidgetSync();

  // Keep Home Last-State cache synchronized on Qaza/Sajdah/Theme/Widget mutations
  useEffect(() => initHomeLastStateSyncListeners(), []);

  // Sync native Android window and WebView background color immediately on startup
  useEffect(() => {
    try {
      const savedTheme = (localStorage.getItem('noor-theme') || localStorage.getItem('noor_theme') || 'oxford-gold') as ThemeId;
      const bgHex = THEME_BG_HEX_MAP[savedTheme] || '#000000';
      (window as Window & { AndroidBridge?: { setNativeThemeBg?: (bgHex: string) => void } }).AndroidBridge?.setNativeThemeBg?.(bgHex);
    } catch {
      // Safe fallback when AndroidBridge is unavailable
    }
  }, []);
  
  // Initialize animation preference (deferred from module scope)
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      const storedAnimationPreference = localStorage.getItem("animations_enabled");
      const isLowEndDeviceCheck = isLowEndDevice();
      let isAnimationDisabled: boolean;

      if (storedAnimationPreference === null) {
        isAnimationDisabled = isLowEndDeviceCheck;
        localStorage.setItem("animations_enabled", isAnimationDisabled.toString());
      } else {
        isAnimationDisabled = storedAnimationPreference === "false";
      }

      if (isAnimationDisabled) {
        document.documentElement.classList.add("no-animations");
      }
      document.documentElement.dataset.animations = isAnimationDisabled ? "off" : "on";
    }
  }, []);

  // Apply tiered visual overrides (deferred from module scope)
  const tierInitializedRef = useRef(false);
  useEffect(() => {
    if (!tierInitializedRef.current) {
      tierInitializedRef.current = true;
      applyTieredVisualOverrides(getAnimationTier());
    }
  }, []);

  const splashHandoffDoneRef = useRef(false);
  const handleSplashComplete = useCallback(() => {
    if (splashHandoffDoneRef.current) return;
    splashHandoffDoneRef.current = true;

    markStartupStep('splash-handoff');
    try {
      setShowSplash(false);
      forceReleaseSplashScrollLock();
      markSplashDismissed();
    } catch (e) {
      console.warn('Splash handoff error', e);
    } finally {
      completeStartupStep('splash-handoff');
    }
  }, []);

  // Hard cap failsafe: splash dismisses at P0 complete or at most 1200ms
  useEffect(() => {
    if (!splashEnabled) {
      handleSplashComplete();
      forceReleaseSplashScrollLock();
      return;
    }
    const timer = setTimeout(() => {
      handleSplashComplete();
      forceReleaseSplashScrollLock();
    }, SPLASH_HARD_CAP_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Strictly empty dependency array []

  // Initialize performance optimizations
  useEffect(() => {
    try {
      preloadCriticalResources();
    } catch (e) {
      console.warn('preloadCriticalResources failed', e);
    }

    // ── FPS monitor: DEV only ─────────────────────────────────────────────
    if (import.meta.env.DEV) {
      try {
        const stopFPS = monitorFPS((fps: number) => {
          const style =
            fps >= 55
              ? 'color:#4ade80;font-weight:bold'
              : fps >= 30
              ? 'color:#facc15;font-weight:bold'
              : 'color:#f87171;font-weight:bold';
          console.debug(`%c[FPS] ${fps}`, style);
        });
        return () => {
          stopFPS();
        };
      } catch {
        // silent fallback - intentional, see stability hardening notes
      }
    }
  }, []);

  const bootStartedRef = useRef(false);

  useEffect(() => {
    markStartupStep('app-shell-mount');
    completeStartupStep('app-shell-mount');

    let notificationManagerStop: (() => void) | null = null;
    let widgetAutoUpdateTimer: ReturnType<typeof setInterval> | null = null;

    if (!bootStartedRef.current && markBootOrchestratorStarted()) {
      bootStartedRef.current = true;

      // P1 — Staggered sequential idle-chunked boot slices (<=30ms per slice, zero Home pointer-events block)
      runP1IdleChunks([
        {
          name: 'p1-sw-and-alarms',
          delayMs: P1_SW_ALARMS_DELAY_MS, // t + 350ms
          run: async () => {
            markStartupStep('service-worker-init');
            try {
              if (Capacitor.isNativePlatform()) {
                if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations()
                    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
                    .catch((err) => console.debug('SW unregister skipped:', err));
                }
                if (typeof window !== 'undefined' && 'caches' in window) {
                  caches.keys()
                    .then((keys) => Promise.all(keys.filter((k) => /workbox|precache|vite-pwa/i.test(k)).map((k) => caches.delete(k))))
                    .catch((err) => console.debug('Cache cleanup skipped:', err));
                }
              } else if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !navigator.serviceWorker.controller) {
                import('@/lib/service-worker-registration')
                  .then(({ serviceWorkerManager }) => serviceWorkerManager.register())
                  .catch((err) => console.warn('Service worker registration failed:', err));
              }
            } finally {
              completeStartupStep('service-worker-init');
            }

            await yieldToMainThread(true, 200);

            try {
              const { localNotifications } = await import('@/lib/local-notifications');
              await localNotifications.initialize();
              await localNotifications.schedulePrayerNotificationsFromAPI();
              const currentTrace = getLatestBootTrace();
              if (currentTrace.alarmArmedAtMs === null && Capacitor.isNativePlatform()) {
                const { nativeAdhan } = await import('@/lib/native-adhan');
                const st = await nativeAdhan.getStatus();
                if (st.count > 0) {
                  recordAlarmArmed(st.count);
                }
              }
            } catch (e) {
              console.warn('Startup: localNotifications alarm init failed', e);
            }
          },
        },
        {
          name: 'p1-widget-sync',
          delayMs: P1_WIDGET_SYNC_DELAY_MS, // t + 900ms
          run: async () => {
            markStartupStep('widget-auto-update-init');
            try {
              const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
              if (savedLocation) {
                const parsed = JSON.parse(savedLocation);
                if (parsed && typeof parsed === 'object' && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
                  const { latitude, longitude, locationName } = parsed;
                  const widgetSig = `${latitude.toFixed(3)}|${longitude.toFixed(3)}|${locationName || ''}|${new Date().toDateString()}`;
                  let isFresh = false;
                  try {
                    const metaRaw = localStorage.getItem(WIDGET_SYNC_META_KEY);
                    if (metaRaw) {
                      const meta = JSON.parse(metaRaw) as { sig?: string; syncedAt?: number };
                      if (meta?.sig === widgetSig && typeof meta.syncedAt === 'number' && (Date.now() - meta.syncedAt) < WIDGET_SYNC_FRESHNESS_MS) {
                        isFresh = true;
                      }
                    }
                  } catch (metaErr) {
                    console.debug('[BootScheduler] Widget freshness check fallback:', metaErr);
                  }

                  const { WidgetService } = await import('@/lib/widget-service');
                  if (!isFresh) {
                    try {
                      await WidgetService.updateWidget(latitude, longitude, locationName);
                      localStorage.setItem(WIDGET_SYNC_META_KEY, JSON.stringify({ sig: widgetSig, syncedAt: Date.now() }));
                    } catch (e) {
                      console.warn('Failed to sync widget payload', e);
                    }
                  }
                  widgetAutoUpdateTimer = setInterval(() => {
                    WidgetService.updateWidget(latitude, longitude, locationName).catch((err) => {
                      console.debug('[WidgetService] Periodic update skipped:', err);
                    });
                  }, 30 * 60 * 1000);
                }
              }
            } catch (err) {
              console.warn('Startup: widget auto-update failed', err);
            } finally {
              completeStartupStep('widget-auto-update-init');
            }

            await yieldToMainThread(true, 200);
            await import('@/lib/qaza-tracker')
              .then(({ initQazaRolloverListeners }) => initQazaRolloverListeners())
              .catch((err) => console.debug('Qaza rollover init skipped:', err));
            await import('@/lib/sajdah-reminder')
              .then(({ initSajdahReminderLifecycle }) => initSajdahReminderLifecycle())
              .catch((err) => console.debug('Sajdah reminder init skipped:', err));

            await yieldToMainThread(true, 200);
            markStartupStep('notification-service-init');
            try {
              const { notificationManager } = await import('@/lib/notification-manager');
              notificationManager.start();
              notificationManagerStop = () => notificationManager.stop();
            } catch (e) {
              console.warn('Startup: notificationManager.start failed', e);
            } finally {
              completeStartupStep('notification-service-init');
            }

            markStartupStep('backup-restore');
            import('@/lib/backup-service')
              .then(({ initBackupService }) => initBackupService())
              .catch((e) => console.warn('Startup: initBackupService failed', e))
              .finally(() => completeStartupStep('backup-restore'));

            markStartupStep('onboarding-permissions-init');
            if (Capacitor.isNativePlatform()) {
              import('@/lib/onboarding-permissions')
                .then(({ healPermissionOnboardingFlags, runFirstLaunchPermissionOnboarding }) => {
                  healPermissionOnboardingFlags().catch((err) => console.debug('Heal onboarding skipped:', err));
                  return runFirstLaunchPermissionOnboarding();
                })
                .catch((err) => console.warn('Startup permission onboarding error:', err))
                .finally(() => completeStartupStep('onboarding-permissions-init'));
            } else {
              completeStartupStep('onboarding-permissions-init');
            }
          },
        },
        {
          name: 'p1-events-and-stale-prayer',
          delayMs: P1_EVENTS_PRAYER_DELAY_MS, // t + 1500ms
          run: async () => {
            try {
              const { islamicCalendarService } = await import('@/lib/islamic-calendar-service');
              const info = await islamicCalendarService.getIslamicCalendarInfo();
              if (info.hijriMonth !== 9) {
                const { RamadanNotifications } = await import('@/lib/ramadan-notifications');
                await RamadanNotifications.getInstance().clearRamadanNotifications();
              }
            } catch (e) {
              console.warn('Failed to safety clear Ramadan notifications', e);
            }

            await yieldToMainThread(true, 200);

            markStartupStep('islamic-events-init');
            try {
              const { islamicEventsService } = await import('@/lib/islamic-events-service');
              await islamicEventsService.scheduleUpcomingEvents();
            } catch (error) {
              console.warn('Failed to schedule Islamic events:', error);
            } finally {
              completeStartupStep('islamic-events-init');
            }

            // Stale prayer cache check: trigger refresh if cached Home state date is from a previous day
            try {
              const { readHomeLastStateSync } = await import('@/lib/home-last-state');
              const snap = readHomeLastStateSync();
              const d = new Date();
              const todayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              if (!snap || snap.dateKey !== todayKey) {
                window.dispatchEvent(new CustomEvent('noor:stale-prayer-refresh'));
              }
            } catch (staleErr) {
              console.debug('[BootScheduler] Stale prayer check skipped:', staleErr);
            }
          },
        },
      ]);

      // P3 — Network-idle prefetch (OTA update check + greeting warm-up + bullion + nearby mosques, strictly >= 2200ms)
      scheduleP3NetworkIdle([
        {
          name: 'p3-bullion-rates-prefetch',
          run: async () => {
            const { fetchLiveMetalRates } = await import('@/lib/zakat-market-api');
            await fetchLiveMetalRates();
          },
        },
        {
          name: 'p3-nearby-mosques-prefetch',
          run: async () => {
            const savedLocation = localStorage.getItem(LOCATION_STORAGE_KEY);
            if (!savedLocation) return;
            const parsed = JSON.parse(savedLocation);
            if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
              const { fetchNearbyMosques } = await import('@/lib/mosque-service');
              await fetchNearbyMosques(parsed.latitude, parsed.longitude);
            }
          },
        },
      ], P3_NETWORK_IDLE_DELAY_MS);
    }

    // ── Defensive Resume Handler (idempotent, guarded) ──
    const handleResume = () => {
      try {
        if (Capacitor.isNativePlatform()) {
          import('@/lib/onboarding-permissions').then(({ checkPendingOnboardingStepB, healPermissionOnboardingFlags }) => {
            healPermissionOnboardingFlags?.().catch((err) => console.debug('Resume heal skipped:', err));
            checkPendingOnboardingStepB?.().catch((err) => {
              console.warn('Resume onboarding check error:', err);
            });
          }).catch((err) => {
            console.warn('Resume onboarding import failed:', err);
          });
        }
      } catch (e) {
        console.warn('Resume: onboarding step B check error', e);
      }

      try {
        if (Capacitor.isNativePlatform()) {
          import('@/lib/native-adhan').then(({ isExactAlarmPermissionGranted }) => {
            isExactAlarmPermissionGranted?.().catch((err) => {
              console.warn('Resume exact alarm check skipped:', err);
            });
          }).catch((err) => {
            console.warn('Resume native-adhan import failed:', err);
          });
        }
      } catch (e) {
        console.warn('Resume: exact-alarm check error', e);
      }

      try {
        const loc = localStorage.getItem(LOCATION_STORAGE_KEY);
        if (loc) {
          const parsed = JSON.parse(loc);
          if (parsed && typeof parsed === 'object' && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
            const { latitude, longitude, locationName } = parsed;
            import('@/lib/widget-service').then(({ WidgetService }) => {
              WidgetService.startAutoUpdate?.(latitude, longitude, locationName);
            }).catch((err) => {
              console.warn('Background widget resume update error:', err);
            });
          }
        }
      } catch (e) {
        console.warn('Resume: widget sync error', e);
      }

      import('@/lib/notification-manager')
        .then(({ notificationManager }) => {
          notificationManager.checkMissedNotifications?.();
        })
        .catch((e) => {
          console.warn('Resume: notification check error', e);
        });
    };

    let resumeSubCleanup: (() => void) | null = null;
    try {
      const subPromise = CapacitorApp.addListener('appStateChange', (state) => {
        if (state.isActive) {
          handleResume();
        }
      });
      resumeSubCleanup = () => {
        subPromise.then(handle => handle.remove?.()).catch((err) => console.debug('appStateChange cleanup:', err));
      };
    } catch (e) {
      console.debug('CapacitorApp listener unavailable on web:', e);
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      if (widgetAutoUpdateTimer !== null) {
        clearInterval(widgetAutoUpdateTimer);
      }
      try {
        notificationManagerStop?.();
      } catch (e) {
        console.warn('Cleanup: notificationManager.stop failed', e);
      }
      if (resumeSubCleanup) {
        resumeSubCleanup();
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      {/* Exact-alarm rationale modal — lazy singleton, shown before system settings */}
      <Suspense fallback={null}>
        <ExactAlarmPermissionDialog />
      </Suspense>
      {showSplash && splashEnabled && (
        <SplashScreen
          animationsEnabled={animationEnabled}
          showGreeting={splashGreetingEnabled}
          onComplete={handleSplashComplete}
        />
      )}
      <AppContent splashActive={showSplash && splashEnabled} />
    </TooltipProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <AppShell />
        </SettingsProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
