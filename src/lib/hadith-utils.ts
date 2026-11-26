export function getGradeBadgeClass(grade?: string): string {
  switch ((grade || "").toLowerCase()) {
    case "sahih":
      return "bg-[var(--success)]/15 text-[var(--success)] border-[var(--success)]/30";
    case "hasan":
      return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
    case "daif":
    case "da'if":
      return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
    default:
      return "bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]";
  }
}

/**
 * Collapses duplicate scholar attribution / grading tokens like
 * "Sahih (Darussalam) (Darussalam)" -> "Sahih (Darussalam)" or
 * "Hasan Darussalam (Darussalam)" -> "Hasan (Darussalam)".
 */
export function dedupeHadithGrade(grade?: string): string {
  if (!grade) return '';
  let clean = grade.trim().replace(/\s{2,}/g, ' ');

  // Normalize "Hasan Darussalam (Darussalam)" / "Sahih Darussalam (Darussalam)" -> "Hasan (Darussalam)"
  clean = clean.replace(/\bDarussalam\s*\(\s*Darussalam\s*\)/gi, '(Darussalam)');

  // Remove consecutive duplicate parenthetical tags like "(Darussalam) (Darussalam)"
  clean = clean.replace(/\(\s*([^)]+?)\s*\)(?:\s*\(\s*\1\s*\))+/gi, '($1)');

  // If "(Darussalam)" already appears earlier in the grade, strip a redundant trailing "(Darussalam)"
  const firstIdx = clean.toLowerCase().indexOf('(darussalam)');
  const lastIdx = clean.toLowerCase().lastIndexOf('(darussalam)');
  if (firstIdx !== -1 && lastIdx > firstIdx) {
    const beforeLast = clean.slice(0, lastIdx);
    const afterLast = clean.slice(lastIdx + '(Darussalam)'.length);
    clean = `${beforeLast}${afterLast}`.replace(/\s{2,}/g, ' ').trim();
  }

  return clean;
}

export function getGradeLabel(grade?: string): string {
  const clean = dedupeHadithGrade(grade);
  switch (clean.toLowerCase()) {
    case "sahih":
      return "Sahih (Authentic)";
    case "hasan":
      return "Hasan (Good)";
    case "daif":
    case "da'if":
      return "Da'if (Weak)";
    default:
      return clean || "Unspecified";
  }
}

/**
 * Canonical Hadith collection counts formatting:
 * e.g. "7,277 ahadith (14,769 narrations incl. repeats)" when repeat count is distinct,
 * otherwise "1,217 ahadith".
 */
export function formatCollectionHadithCount(
  totalHadith: number,
  totalNarrations?: number
): string {
  const uniqueFormatted = Number(totalHadith || 0).toLocaleString();
  if (totalNarrations && totalNarrations > totalHadith) {
    return `${uniqueFormatted} ahadith (${totalNarrations.toLocaleString()} narrations incl. repeats)`;
  }
  return `${uniqueFormatted} ahadith`;
}

/**
 * Formats compiler death date cleanly: "256 AH / 870 CE" -> "Died: 256 AH".
 */
export function formatCompilerDeath(death?: string): string {
  const raw = (death || '').split('/')[0].trim();
  if (!raw) return '';
  if (/^died:/i.test(raw)) return raw;
  return `Died: ${raw}`;
}
