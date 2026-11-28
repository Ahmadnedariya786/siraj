import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { NoorDynamicLogo, getActiveLogoEdition, NOOR_LOGO_EDITIONS } from "@/components/NoorDynamicLogo";
import { getAnimationTier } from "@/lib/device-performance";
import {
    BOOT_P0_COMPLETE_EVENT,
    SPLASH_HARD_CAP_MS,
    markSplashDismissed,
} from "@/lib/boot-scheduler";

const FIXED_STARS = [
    { id: 1, x: 18, y: 22, size: 2, delay: 0 },
    { id: 2, x: 82, y: 19, size: 2.5, delay: 0.5 },
    { id: 3, x: 25, y: 75, size: 1.5, delay: 1.0 },
    { id: 4, x: 78, y: 72, size: 2, delay: 1.5 },
    { id: 5, x: 12, y: 48, size: 2, delay: 0.8 },
    { id: 6, x: 88, y: 52, size: 1.5, delay: 1.2 },
    { id: 7, x: 35, y: 15, size: 2.2, delay: 0.3 },
    { id: 8, x: 65, y: 84, size: 1.8, delay: 1.7 },
];

function CelestialStars({ enabled }: { enabled: boolean }) {
    if (!enabled) return null;
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
            {FIXED_STARS.map((star) => (
                <div
                    key={star.id}
                    className="absolute rounded-full animate-[pulseStar_3s_ease-in-out_infinite]"
                    style={{
                        left: `${star.x}%`,
                        top: `${star.y}%`,
                        width: star.size,
                        height: star.size,
                        backgroundColor: 'var(--accent-text)',
                        opacity: 0.45,
                        animationDelay: `${star.delay}s`,
                    }}
                />
            ))}
        </div>
    );
}

// Safe helper to release scroll lock and physically remove static splash node
export function forceReleaseSplashScrollLock(): void {
    try {
        document.documentElement.classList.remove("splash-active");
        document.body.classList.remove("splash-active");
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
        document.documentElement.style.touchAction = "";
        document.body.style.touchAction = "";
        document.documentElement.style.overscrollBehavior = "";
        document.body.style.overscrollBehavior = "";
        const elInitial = document.getElementById("initial-splash");
        if (elInitial) {
            elInitial.remove();
        }
        const elStatic = document.getElementById("static-splash");
        if (elStatic) {
            elStatic.remove();
        }
    } catch {
        // Safe fallback: ensure scroll unlock never throws
    }
}

interface SplashScreenProps {
    animationsEnabled: boolean;
    showGreeting: boolean;
    onComplete: () => void;
}

export function SplashScreen({ animationsEnabled, showGreeting, onComplete }: SplashScreenProps) {
    const [progress, setProgress] = useState(35);
    const [isFading, setIsFading] = useState(false);
    const [hasPrePaintSplash] = useState<boolean>(() =>
        typeof document !== 'undefined' && Boolean(document.getElementById('initial-splash'))
    );
    const [isMounted, setIsMounted] = useState(true);
    const hasTriggeredCompletionRef = useRef(false);
    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    const prefersReducedMotion = useMemo(() => {
        if (typeof window === 'undefined') return false;
        try {
            return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        } catch {
            return false;
        }
    }, []);

    const tier = useMemo(() => {
        try {
            return getAnimationTier();
        } catch {
            return { shouldReduceAnimations: false };
        }
    }, []);

    const shouldAnimate = animationsEnabled && !prefersReducedMotion && !tier.shouldReduceAnimations;

    const triggerComplete = useCallback(() => {
        if (hasTriggeredCompletionRef.current) return;
        hasTriggeredCompletionRef.current = true;
        setIsMounted(false);
        forceReleaseSplashScrollLock();
        markSplashDismissed();
        try {
            onCompleteRef.current();
        } catch (e) {
            console.warn('Splash onComplete callback error', e);
        }
    }, []);

    // Single-stage GPU opacity fade (200ms) on P0 completion, hard cap <= 900ms, never blocks pointer-events post-fade
    useEffect(() => {
        let fadeOutTimer: ReturnType<typeof setTimeout> | null = null;

        const beginFadeAndDismiss = () => {
            if (hasTriggeredCompletionRef.current) return;
            setIsFading(true);
            setProgress(100);
            markSplashDismissed();

            const elInitial = document.getElementById('initial-splash');
            if (elInitial) {
                elInitial.style.pointerEvents = 'none';
                const bar = document.getElementById('initial-splash-bar');
                if (bar) bar.style.width = '100%';
                elInitial.style.opacity = '0';
            }

            // Release scroll lock immediately once fade begins so Home is interactive
            document.documentElement.classList.remove('splash-active');
            document.body.classList.remove('splash-active');
            document.documentElement.style.overflow = '';
            document.body.style.overflow = '';
            document.documentElement.style.touchAction = '';
            document.body.style.touchAction = '';

            if (fadeOutTimer !== null) clearTimeout(fadeOutTimer);
            fadeOutTimer = setTimeout(() => {
                triggerComplete();
            }, shouldAnimate ? 150 : 20);
        };

        window.addEventListener(BOOT_P0_COMPLETE_EVENT, beginFadeAndDismiss, { once: true });

        const failsafeTimer = setTimeout(() => {
            beginFadeAndDismiss();
        }, Math.max(200, SPLASH_HARD_CAP_MS - 220));

        const hardDeadlineTimer = setTimeout(() => {
            triggerComplete();
        }, Math.max(300, SPLASH_HARD_CAP_MS - 40));

        if (!hasPrePaintSplash && !shouldAnimate) {
            const fastTimer = setTimeout(() => {
                beginFadeAndDismiss();
            }, 60);
            return () => {
                clearTimeout(fastTimer);
                clearTimeout(hardDeadlineTimer);
                if (fadeOutTimer !== null) clearTimeout(fadeOutTimer);
                window.removeEventListener(BOOT_P0_COMPLETE_EVENT, beginFadeAndDismiss);
                clearTimeout(failsafeTimer);
                forceReleaseSplashScrollLock();
            };
        }

        return () => {
            clearTimeout(hardDeadlineTimer);
            if (fadeOutTimer !== null) clearTimeout(fadeOutTimer);
            window.removeEventListener(BOOT_P0_COMPLETE_EVENT, beginFadeAndDismiss);
            clearTimeout(failsafeTimer);
            forceReleaseSplashScrollLock();
        };
    }, [hasPrePaintSplash, shouldAnimate, triggerComplete]);

    if (!isMounted || hasPrePaintSplash) return null;

    const splashContent = (
        <div
            id="react-splash-screen"
            onClick={triggerComplete}
            role="button"
            tabIndex={0}
            aria-label="Skip splash screen"
            className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden cursor-pointer"
            style={{
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100dvh',
                zIndex: 99999,
                backgroundColor: 'var(--bg-base)',
                backgroundImage: isFading
                    ? 'none'
                    : 'radial-gradient(circle at 50% 38%, var(--accent-soft) 0%, var(--bg-elev) 45%, var(--bg-base) 100%)',
                color: 'var(--text-primary)',
                ['--accent-primary' as string]: 'var(--accent)',
                ['--accent-secondary' as string]: 'var(--accent-text)',
                opacity: isFading ? 0 : 1,
                transition: 'opacity 200ms ease-out',
                pointerEvents: isFading ? 'none' : 'all',
                willChange: 'opacity',
                cursor: 'pointer',
            }}
        >
            {/* Stars Background */}
            <CelestialStars enabled={shouldAnimate && !isFading} />

            {/* Main Content: 100% Pixel-Identical Match with index.html initial-splash */}
            <div
                className="relative z-10 flex flex-col items-center justify-center text-center select-none"
                style={{
                    padding: '24px',
                    opacity: isFading ? 0 : 1,
                    transition: 'opacity 120ms ease-out',
                }}
            >
                {/* 1. 5-Edition Living Islamic Emblem */}
                <NoorDynamicLogo size="xl" animated={shouldAnimate} />

                {/* 2. Brand Title: SIRAJ */}
                <h1
                    style={{
                        margin: '18px 0 0 0',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        letterSpacing: '0.22em',
                        color: 'var(--accent-text)',
                        textShadow: '0 0 18px var(--accent-glow)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                >
                    SIRAJ
                </h1>

                {/* 3. Subtitle: ISLAMIC COMPANION */}
                {showGreeting && (
                    <p
                        style={{
                            margin: '4px 0 0 0',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            letterSpacing: '0.30em',
                            color: 'var(--text-secondary)',
                            textAlign: 'center',
                            textTransform: 'uppercase',
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                        }}
                    >
                        ISLAMIC COMPANION
                    </p>
                )}

                {/* 4. Active Living Emblem Edition Badge */}
                <div
                    style={{
                        marginTop: '10px',
                        padding: '3px 14px',
                        borderRadius: '999px',
                        fontSize: '0.66rem',
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        color: 'var(--accent-text)',
                        backgroundColor: 'var(--accent-soft)',
                        border: '1px solid var(--border)',
                        boxShadow: '0 0 12px var(--accent-glow)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                    }}
                >
                    <span>✦</span>
                    <span>{NOOR_LOGO_EDITIONS[getActiveLogoEdition()]?.shortName || 'Living Emblem'}</span>
                    <span>✦</span>
                </div>

                {/* 4. Sleek Unified Single-Hue Progress Beam (140px track, no split colors) */}
                <div
                    style={{
                        width: '140px',
                        height: '3px',
                        background: 'rgba(255, 255, 255, 0.10)',
                        border: 'none',
                        borderRadius: '999px',
                        overflow: 'hidden',
                        marginTop: '22px',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            height: '100%',
                            width: `${progress}%`,
                            borderRadius: '999px',
                            background: 'var(--accent)',
                            boxShadow: '0 0 10px var(--accent)',
                            transition: shouldAnimate ? 'width 60ms linear' : 'none',
                        }}
                    />
                </div>
            </div>

            {/* Bottom Theme Haze */}
            <div
                className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                style={{
                    background: 'linear-gradient(to top, var(--accent-soft), transparent)',
                }}
            />
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(splashContent, document.body);
    }
    return splashContent;
}
