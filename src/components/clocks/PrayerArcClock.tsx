import React, { useMemo, memo } from 'react';
import { type ClockProps } from '@/types/clock';
import { cn } from '@/lib/utils';
import { useAnalogClockHands } from './useAnalogClockHands';
import { PrayerArcCountdownPill } from './ClockMinuteParts';

function parseTimeTo12hAngle(timeStr?: string, dateObj?: Date | null): number {
  if (dateObj instanceof Date && !isNaN(dateObj.getTime())) {
    return ((dateObj.getHours() % 12) + dateObj.getMinutes() / 60) * 30;
  }
  if (!timeStr) return 0;
  const cleaned = timeStr.replace(/\s*\(.*?\)\s*/g, '').trim();
  const match = cleaned.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (cleaned.toLowerCase().includes('pm') && h < 12) h += 12;
  if (cleaned.toLowerCase().includes('am') && h === 12) h = 0;
  return ((h % 12) + m / 60) * 30;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const span = ((endAngle - startAngle) % 360 + 360) % 360;
  if (span <= 0.1) return '';
  if (span >= 359.9) {
    const p1 = polarToCartesian(cx, cy, r, startAngle);
    const pMid = polarToCartesian(cx, cy, r, startAngle + 180);
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 1 1 ${pMid.x} ${pMid.y} A ${r} ${r} 0 1 1 ${p1.x} ${p1.y}`;
  }

  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = span > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export const PrayerArcClock: React.FC<ClockProps> = memo(({
  now,
  hijriDate,
  nextPrayer,
  previousPrayer,
  isStaticPreview = false,
}) => {
  const { hourHandRef, minuteHandRef, secondHandRef, initialAngles } = useAnalogClockHands({
    isStaticPreview,
    externalNow: now,
  });

  const center = 120;
  const arcRadius = 70;
  const numeralRadius = 92;

  // Compute angles for previous and next prayer
  const startAngle = useMemo(() => {
    if (isStaticPreview) return 155; // ~5:10
    return parseTimeTo12hAngle(previousPrayer?.time, previousPrayer?.date);
  }, [previousPrayer, isStaticPreview]);

  const endAngle = useMemo(() => {
    if (isStaticPreview) return 20; // ~12:40
    return parseTimeTo12hAngle(nextPrayer?.time, nextPrayer?.targetTime);
  }, [nextPrayer, isStaticPreview]);

  const span = useMemo(() => {
    const s = ((endAngle - startAngle) % 360 + 360) % 360;
    return s === 0 ? 360 : s;
  }, [startAngle, endAngle]);

  const progress = useMemo(() => {
    if (isStaticPreview) return 0.55;
    const raw = nextPrayer?.progress ?? 0;
    return Math.min(1, Math.max(0, raw > 1 ? raw / 100 : raw));
  }, [nextPrayer, isStaticPreview]);

  const currentFilledAngle = startAngle + span * progress;

  // Arc paths
  const backgroundArcPath = useMemo(() => {
    return describeArc(center, center, arcRadius, startAngle, endAngle);
  }, [center, arcRadius, startAngle, endAngle]);

  const filledArcPath = useMemo(() => {
    if (progress <= 0.005) return '';
    return describeArc(center, center, arcRadius, startAngle, currentFilledAngle);
  }, [center, arcRadius, startAngle, currentFilledAngle, progress]);

  // Badge positions at arc start and end
  const startBadge = useMemo(() => polarToCartesian(center, center, arcRadius, startAngle), [center, arcRadius, startAngle]);
  const endBadge = useMemo(() => polarToCartesian(center, center, arcRadius, endAngle), [center, arcRadius, endAngle]);

  // 60 Chapter Ring ticks
  const chapterTicks = useMemo(() => {
    const ticks = [];
    for (let i = 0; i < 60; i++) {
      const isHour = i % 5 === 0;
      const len = isHour ? 6 : 3;
      const rOuter = 108;
      const rInner = rOuter - len;
      const a = (i * 6 * Math.PI) / 180;
      ticks.push({
        id: i,
        x1: center + rInner * Math.sin(a),
        y1: center - rInner * Math.cos(a),
        x2: center + rOuter * Math.sin(a),
        y2: center - rOuter * Math.cos(a),
        isHour,
      });
    }
    return ticks;
  }, [center]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center select-none w-full",
        isStaticPreview ? "py-1" : "pt-2 pb-3"
      )}
    >
      <div
        className={cn(
          "relative rounded-full transition-all flex items-center justify-center",
          isStaticPreview
            ? "w-28 h-28 sm:w-32 sm:h-32 shadow-md"
            : "w-[220px] h-[220px] sm:w-[250px] sm:h-[250px] shadow-2xl"
        )}
        style={{
          border: '1.5px solid var(--border)',
          background: 'radial-gradient(circle at 50% 35%, var(--surface-2) 0%, var(--surface) 50%, var(--bg-base) 100%)',
          boxShadow: '0 16px 40px rgba(0,0,0,0.65), inset 0 1px 0 var(--card-sheen-line, var(--card-sheen))',
        }}
      >
        <svg
          viewBox="0 0 240 240"
          className="w-full h-full"
          style={{ overflow: 'visible', isolation: 'isolate' }}
        >
          <defs>
            <linearGradient id="prayerArcGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>

          {/* ── Layer 1: Outer Double Bezel Rings ── */}
          <circle
            cx={center}
            cy={center}
            r="114"
            fill="none"
            stroke="var(--border)"
            strokeWidth="2"
          />
          <circle
            cx={center}
            cy={center}
            r="110.5"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1"
            opacity="0.35"
          />

          {/* ── Layer 2: 60-Minute Chapter Ring Ticks ── */}
          {chapterTicks.map((t) => (
            <line
              key={`tick-${t.id}`}
              x1={t.x1.toFixed(2)}
              y1={t.y1.toFixed(2)}
              x2={t.x2.toFixed(2)}
              y2={t.y2.toFixed(2)}
              stroke={t.isHour ? 'var(--accent)' : 'var(--border)'}
              strokeWidth={t.isHour ? '1.8' : '1'}
              opacity={t.isHour ? '0.85' : '0.4'}
              strokeLinecap="round"
            />
          ))}

          {/* 12 Hour Numerals around the perimeter */}
          {Array.from({ length: 12 }, (_, i) => {
            const hr = i === 0 ? 12 : i;
            const a = (i * 30 * Math.PI) / 180;
            const x = center + numeralRadius * Math.sin(a);
            const y = center - numeralRadius * Math.cos(a);
            const isCardinal = hr % 3 === 0;
            return (
              <text
                key={`arc-num-${hr}`}
                x={x.toFixed(2)}
                y={(y + (isCardinal ? 3.5 : 3)).toFixed(2)}
                textAnchor="middle"
                dominantBaseline="middle"
                fontFamily="sans-serif"
                fontWeight={isCardinal ? '800' : '600'}
                fontSize={isCardinal ? '11' : '9'}
                fill={isCardinal ? 'var(--text-primary)' : 'var(--text-secondary)'}
              >
                {hr}
              </text>
            );
          })}

          {/* ── Layer 3: Prayer Arc Tracks & Badges ── */}
          {/* Background Prayer Arc Track */}
          {backgroundArcPath && (
            <path
              d={backgroundArcPath}
              fill="none"
              stroke="var(--accent-soft)"
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.45"
            />
          )}

          {/* Thick Glowing Active Prayer Arc */}
          {filledArcPath && (
            <path
              d={filledArcPath}
              fill="none"
              stroke="url(#prayerArcGold)"
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}

          {/* Previous Prayer Badge (Moon) at arc start */}
          <g transform={`translate(${startBadge.x}, ${startBadge.y})`}>
            <circle
              cx="0"
              cy="0"
              r="7.5"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
            {/* Moon icon vector */}
            <path
              d="M 1.5 -3.5 A 3.8 3.8 0 1 0 1.5 3.5 A 2.8 2.8 0 0 1 1.5 -3.5 Z"
              fill="var(--accent-text)"
            />
          </g>

          {/* Next Prayer Badge (Bell) at arc end */}
          <g transform={`translate(${endBadge.x}, ${endBadge.y})`}>
            <circle
              cx="0"
              cy="0"
              r="7.5"
              fill="var(--surface)"
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
            {/* Bell icon vector */}
            <path
              d="M -2.5 1.5 C -2.5 -0.5, -1 -2, 0 -2.5 C 1 -2, 2.5 -0.5, 2.5 1.5 L 3.2 2.5 L -3.2 2.5 Z M -0.8 3 C -0.8 3.5, 0.8 3.5, 0.8 3"
              fill="var(--accent-text)"
              stroke="var(--accent-text)"
              strokeWidth="0.5"
            />
          </g>

          {/* ── Layer 4 (TOP): Watch Hands + Center Jewel Cap (100% Unobstructed 360° Sweep) ── */}
          <g id="prayer-arc-hands">
            {/* Tapered Hour Hand */}
            <g
              ref={hourHandRef}
              style={{
                transform: `rotate(${initialAngles.hourAngle}deg)`,
                transformOrigin: `${center}px ${center}px`,
                willChange: 'transform',
              }}
            >
              <line
                x1={center}
                y1={center + 8}
                x2={center}
                y2={center - 46}
                stroke="rgba(0,0,0,0.8)"
                strokeWidth={isStaticPreview ? "4.5" : "5.5"}
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center + 8}
                x2={center}
                y2={center - 46}
                stroke="var(--text-primary)"
                strokeWidth={isStaticPreview ? "3" : "4"}
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center + 6}
                x2={center}
                y2={center - 42}
                stroke="var(--accent-text)"
                strokeWidth="1"
                strokeLinecap="round"
              />
            </g>

            {/* Tapered Minute Hand */}
            <g
              ref={minuteHandRef}
              style={{
                transform: `rotate(${initialAngles.minuteAngle}deg)`,
                transformOrigin: `${center}px ${center}px`,
                willChange: 'transform',
              }}
            >
              <line
                x1={center}
                y1={center + 10}
                x2={center}
                y2={center - 68}
                stroke="rgba(0,0,0,0.8)"
                strokeWidth={isStaticPreview ? "3.5" : "4.5"}
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center + 10}
                x2={center}
                y2={center - 68}
                stroke="var(--text-primary)"
                strokeWidth={isStaticPreview ? "2" : "2.8"}
                strokeLinecap="round"
              />
              <line
                x1={center}
                y1={center + 8}
                x2={center}
                y2={center - 64}
                stroke="var(--accent-text)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </g>

            {/* Sweeping Thin Second Hand */}
            {!isStaticPreview && (
              <g
                ref={secondHandRef}
                style={{
                  transform: `rotate(${initialAngles.secondAngle}deg)`,
                  transformOrigin: `${center}px ${center}px`,
                  willChange: 'transform',
                }}
              >
                <line
                  x1={center}
                  y1={center + 18}
                  x2={center}
                  y2={center - 86}
                  stroke="var(--accent)"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
                <circle
                  cx={center}
                  cy={center + 12}
                  r="2.5"
                  fill="var(--accent)"
                  stroke="var(--surface-2)"
                  strokeWidth="0.6"
                />
              </g>
            )}

            {/* 3-Layer Center Jewel Cap */}
            <circle
              cx={center}
              cy={center}
              r="4.5"
              fill="var(--accent)"
              stroke="var(--surface-2)"
              strokeWidth="0.8"
            />
            <circle
              cx={center}
              cy={center}
              r="2.8"
              fill="var(--surface)"
            />
            <circle
              cx={center}
              cy={center}
              r="1.2"
              fill="var(--accent-text)"
            />
          </g>
        </svg>
      </div>

      {/* ── Integrated Prayer Status Pill & Hijri Date (100% Unobstructed Dial Sweep) ── */}
      <div className="flex flex-col items-center justify-center gap-1.5 mt-2.5 select-none">
        <PrayerArcCountdownPill
          nextPrayerName={nextPrayer.name}
          targetTime={nextPrayer.targetTime}
          isStaticPreview={isStaticPreview}
          externalNow={now}
        />

        {!isStaticPreview && (
          <div className="flex items-center justify-center gap-2 select-none">
            <span className="text-[9px] select-none" style={{ color: 'var(--accent)' }}>◈</span>
            <p
              className="text-xs font-semibold tracking-[0.06em] text-center"
              style={{
                background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {(hijriDate || '')
                .replace(/[\u014d\u014c\u00f4\u00d4]/g, 'ū')
                .replace(/al-ola/gi, 'al-ūlā')
                .replace(/al-ōlā/gi, 'al-ūlā')
                .replace(/ō/g, 'ū')}
            </p>
            <span className="text-[9px] select-none" style={{ color: 'var(--accent)' }}>◈</span>
          </div>
        )}
      </div>
    </div>
  );
});

PrayerArcClock.displayName = 'PrayerArcClock';

export default PrayerArcClock;
