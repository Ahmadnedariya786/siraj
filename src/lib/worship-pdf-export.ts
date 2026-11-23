/**
 * Siraj — Annual Worship & Prayer Journal PDF Generator & Exporter
 *
 * Generates an authentic, high-DPI Single-Page A4 PDF (%PDF-1.4)
 * detailing annual prayer consistency, Sunnah Rawatib adherence, and Fasting logs.
 * Integrates natively with AndroidBridge.shareBase64Pdf, Web Share API Level 2, and browser download.
 */

import { getRawWorshipDays, getWorshipKPIs } from './worship-log';
import {
  dataUrlToUint8Array,
  jpegBytesToA4PdfBlob,
  blobToBase64,
} from './zakat-pdf-generator';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export async function generateYearJournalPdf(year: number): Promise<Blob> {
  const width = 1240;
  const height = 1754;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to acquire 2D canvas context for Journal PDF generation');
  }

  // Gather days for this year
  const rawDays = getRawWorshipDays();
  const yearPrefix = `${year}-`;
  const yearEntries = Object.entries(rawDays).filter(([key]) => key.startsWith(yearPrefix));

  let totalPrayersCompleted = 0;
  let totalFasts = 0;
  let totalSunnah = 0;

  // Monthly stats
  const monthlyStats = Array.from({ length: 12 }, (_, m) => {
    const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    let monthPrayers = 0;
    let monthFasts = 0;
    let loggedDays = 0;

    for (const [key, log] of yearEntries) {
      if (key.startsWith(monthKey)) {
        loggedDays++;
        if (log.fajr) monthPrayers++;
        if (log.dhuhr) monthPrayers++;
        if (log.asr) monthPrayers++;
        if (log.maghrib) monthPrayers++;
        if (log.isha) monthPrayers++;
        if (log.fasted) monthFasts++;
        if (log.sunnah) {
          totalSunnah += (log.sunnah.fajr || 0) + (log.sunnah.dhuhr || 0) + (log.sunnah.maghrib || 0) + (log.sunnah.isha || 0);
        }
      }
    }

    totalPrayersCompleted += monthPrayers;
    totalFasts += monthFasts;

    const maxPrayers = daysInMonth * 5;
    const completionRate = maxPrayers > 0 ? Math.round((monthPrayers / maxPrayers) * 100) : 0;

    return {
      monthName: MONTH_NAMES[m],
      daysInMonth,
      loggedDays,
      monthPrayers,
      maxPrayers,
      monthFasts,
      completionRate,
    };
  });

  const kpis = getWorshipKPIs();
  const totalPossibleYearPrayers = (year % 4 === 0 ? 366 : 365) * 5;
  const yearCompletionRate = Math.round((totalPrayersCompleted / totalPossibleYearPrayers) * 100);

  // Background — Deep Imperial Luxury Dark Blue & Charcoal
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#0B1220');
  bgGrad.addColorStop(0.5, '#0E1729');
  bgGrad.addColorStop(1, '#080D17');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Ornate Double Border
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 3;
  ctx.strokeRect(32, 32, width - 64, height - 64);

  ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(42, 42, width - 84, height - 84);

  // Header Banner
  const headerY = 60;
  ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
  ctx.fillRect(52, headerY, width - 104, 150);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(52, headerY, width - 104, 150);

  // Brand Header Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText('SIRAJ  •  سِراج', 80, headerY + 54);

  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`ANNUAL WORSHIP & PRAYER JOURNAL REPORT — ${year}`, 80, headerY + 92);

  ctx.fillStyle = '#94A3B8';
  ctx.font = '14px sans-serif';
  ctx.fillText(`Comprehensive 12-Month Salah Consistency, Sunnah Rawatib & Fasting Audit`, 80, headerY + 124);

  // 4 Top KPI Pods
  const kpiY = 230;
  const kpiW = (width - 104 - 36) / 4;
  const kpiH = 100;

  const pods = [
    { label: 'ANNUAL COMPLETION', value: `${yearCompletionRate}%`, sub: `${totalPrayersCompleted} / ${totalPossibleYearPrayers}` },
    { label: 'ON-TIME STREAK', value: `${kpis.onTimeStreak} Days`, sub: 'Active Consistency' },
    { label: 'DAYS FASTED', value: `${totalFasts} Days`, sub: 'Sunnah & Obligatory' },
    { label: 'SUNNAH KEPT', value: `${kpis.sunnahKeptPercent}%`, sub: 'Rawatib Prayers' },
  ];

  pods.forEach((pod, idx) => {
    const x = 52 + idx * (kpiW + 12);
    ctx.fillStyle = '#162238';
    ctx.fillRect(x, kpiY, kpiW, kpiH);
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, kpiY, kpiW, kpiH);

    ctx.fillStyle = '#94A3B8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(pod.label, x + 16, kpiY + 28);

    ctx.fillStyle = '#F59E0B';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(pod.value, x + 16, kpiY + 62);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px sans-serif';
    ctx.fillText(pod.sub, x + 16, kpiY + 86);
  });

  // 12-Month Table
  const tableY = 360;
  const tableW = width - 104;
  const rowH = 78;

  // Table Header
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(52, tableY, tableW, 44);
  ctx.fillStyle = '#F59E0B';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('MONTH', 72, tableY + 28);
  ctx.fillText('PRAYERS COMPLETED', 340, tableY + 28);
  ctx.fillText('DAYS FASTED', 620, tableY + 28);
  ctx.fillText('CONSISTENCY BAR', 850, tableY + 28);

  // Table Rows
  monthlyStats.forEach((m, idx) => {
    const rY = tableY + 44 + idx * rowH;

    // Alternating row background
    ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(52, rY, tableW, rowH);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.strokeRect(52, rY, tableW, rowH);

    // Month Name & Days
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(m.monthName, 72, rY + 34);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${m.loggedDays} of ${m.daysInMonth} days logged`, 72, rY + 56);

    // Prayers Completed
    ctx.fillStyle = '#FCD34D';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${m.monthPrayers} / ${m.maxPrayers}`, 340, rY + 36);

    ctx.fillStyle = '#94A3B8';
    ctx.font = '12px sans-serif';
    ctx.fillText(`${m.completionRate}% of fard salah`, 340, rY + 56);

    // Fasting
    ctx.fillStyle = '#6EE7B7';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(`${m.monthFasts} Fast${m.monthFasts === 1 ? '' : 's'}`, 620, rY + 36);

    ctx.fillStyle = '#64748B';
    ctx.font = '12px sans-serif';
    ctx.fillText(m.monthFasts > 0 ? 'Logged in journal' : 'No fasts recorded', 620, rY + 56);

    // Progress Bar
    const barX = 850;
    const barY = rY + 26;
    const barW = 260;
    const barH = 16;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(barX, barY, barW, barH);

    const fillW = Math.max(0, Math.min(barW, Math.round((m.completionRate / 100) * barW)));
    ctx.fillStyle = m.completionRate >= 80 ? '#10B981' : m.completionRate >= 50 ? '#F59E0B' : '#EF4444';
    ctx.fillRect(barX, barY, fillW, barH);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`${m.completionRate}%`, barX + barW + 12, barY + 13);
  });

  // Footer
  const footerY = height - 120;
  ctx.fillStyle = '#64748B';
  ctx.font = '12px sans-serif';
  ctx.fillText(`Generated by Siraj (سِراج) • Your Sacred Islamic Companion`, 60, footerY);
  ctx.fillText(`Report Date: ${new Date().toLocaleDateString()} • Verified Single Source of Truth`, 60, footerY + 22);

  // Convert to JPEG bytes & Wrap in Spec-Compliant %PDF-1.4
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.93);
  const jpegBytes = dataUrlToUint8Array(jpegDataUrl);
  return jpegBytesToA4PdfBlob(jpegBytes, width, height);
}

export async function shareYearJournalPdf(
  year: number,
  onToast?: (msg: string) => void
): Promise<{ success: boolean; method: string }> {
  const fileName = `Siraj_Worship_Journal_${year}.pdf`;
  const pdfBlob = await generateYearJournalPdf(year);

  // Priority 1: Native AndroidBridge (via MainActivity.java)
  if (typeof window !== 'undefined') {
    const androidBridge = (window as unknown as { AndroidBridge?: { shareBase64Pdf?: (b64: string, name: string, title: string) => void } }).AndroidBridge;
    if (androidBridge && typeof androidBridge.shareBase64Pdf === 'function') {
      try {
        const base64 = await blobToBase64(pdfBlob);
        androidBridge.shareBase64Pdf(base64, fileName, `Siraj Worship Journal ${year} (PDF)`);
        onToast?.('Year PDF report shared successfully.');
        return { success: true, method: 'android-bridge' };
      } catch (err) {
        console.warn('[shareYearJournalPdf] AndroidBridge shareBase64Pdf failed:', err);
      }
    }
  }

  // Priority 2: Web Share Level 2 File Sharing
  if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && navigator.canShare) {
    try {
      const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `Siraj — Worship Journal ${year}`,
          text: `Annual Salah & Fasting Journal Report for ${year}`,
        });
        onToast?.('Year PDF report shared successfully.');
        return { success: true, method: 'web-share-file' };
      }
    } catch {
      // User cancelled share, fallback to download
    }
  }

  // Priority 3: Automatic .pdf Download Fallback
  try {
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
    onToast?.(`Downloaded ${fileName}`);
    return { success: true, method: 'download-fallback' };
  } catch (err) {
    console.error('[shareYearJournalPdf] Download failed:', err);
    throw err;
  }
}
