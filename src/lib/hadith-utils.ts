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

/**
 * Formats single concise compiler lifespan string (e.g. "194-256 AH").
 * Falls back to formatted death year only when lifespan range is unavailable.
 */
export function formatCompilerLifespan(compilerPeriod?: string, death?: string): string {
  const period = (compilerPeriod || '').trim();
  if (period) return period;
  return formatCompilerDeath(death);
}

/**
 * Sanitizes broken parser book numbers such as "(more)" or non-numeric labels.
 */
export function sanitizeHadithBookNumber(bookNumber?: string, index = 0): string {
  const raw = (bookNumber || '').trim();
  if (!raw || /^\(?more\)?$/i.test(raw)) {
    return String(index + 1);
  }
  if (/^merits$/i.test(raw)) {
    return '1';
  }
  return raw;
}

/**
 * Maps broken parser book titles such as "(more)" or fragmented "Merits / of Dhikr"
 * into readable canonical titles or "Book N" without ever rendering literal "(more)".
 */
export function sanitizeHadithBookTitle(
  bookNumber?: string,
  bookName?: string,
  index = 0
): string {
  const cleanNum = sanitizeHadithBookNumber(bookNumber, index);
  const rawNum = (bookNumber || '').trim();
  const rawName = (bookName || '').trim();

  if (
    /^merits$/i.test(rawNum) &&
    /^of\s+dhikr$/i.test(rawName)
  ) {
    return 'Merits of Dhikr';
  }

  if (
    !rawName ||
    /^\(?more\)?$/i.test(rawName) ||
    /^chapter$/i.test(rawName)
  ) {
    return /^\d+$/.test(cleanNum) ? `Book ${cleanNum}` : `Book ${index + 1}`;
  }

  // Strip stray "(more)" tokens embedded in titles cleanly
  const cleaned = rawName.replace(/\(\s*more\s*\)/gi, '').trim();
  if (!cleaned) {
    return /^\d+$/.test(cleanNum) ? `Book ${cleanNum}` : `Book ${index + 1}`;
  }
  return cleaned;
}

export interface ParsedHadithTextResult {
  paragraphs: string[];
  footnotes: string[];
  cleanGrade: string;
}

/**
 * Recovers misclassified wall-of-text grades (such as Hisnul Muslim entries where prose was
 * dumped into `grade`), extracts trailing numbered footnote citations into a compact footnote
 * list, and splits long numbered walls of text into breathable paragraphs.
 */
export function parseHadithBodyAndFootnotes(input: {
  englishTranslation?: string;
  translatedOverride?: string;
  grade?: string;
  references?: string;
}): ParsedHadithTextResult {
  const rawGrade = (input.grade || '').trim();
  const hasExplicitTranslation = Boolean((input.translatedOverride || input.englishTranslation || '').trim());
  const gradeIsMisplacedBody = !hasExplicitTranslation && rawGrade.length > 120;

  const cleanGrade = gradeIsMisplacedBody ? '' : dedupeHadithGrade(rawGrade);
  let body = (
    input.translatedOverride ||
    input.englishTranslation ||
    (gradeIsMisplacedBody ? rawGrade : '')
  ).trim();

  const footnotes: string[] = [];

  if (body) {
    // Detect trailing numbered citation block: e.g. " 1 : Al-Baqarah 2:152 2 : Al-Ahzab 33:41 ..."
    const footnoteBlockMatch = body.match(/\s+(1\s+:\s+[^\n]+(?:\s+2\s+:\s+.+))$/s);
    if (footnoteBlockMatch && typeof footnoteBlockMatch.index === 'number') {
      const refTail = footnoteBlockMatch[1].trim();
      body = body.slice(0, footnoteBlockMatch.index).trim();
      const splitRefs = refTail
        .split(/(?=(?:^|\s)\d{1,2}\s+:\s+)/g)
        .map((r) => r.trim())
        .filter(Boolean);
      footnotes.push(...splitRefs);
    }

    // Split wall-of-text body at numbered inline reference markers (" 1 And He said:", " 2 ...", etc.)
    const hasNumberedBreaks = /\s+\d{1,2}\s+(?:\.\s*)?(?:And |The |Abdullah |Uqbah |Allah |[A-Z"“])/.test(body);
    if (hasNumberedBreaks && body.length > 260 && !body.includes('\n\n')) {
      body = body.replace(
        /(["”'.?!])\s+(\d{1,2})\s+(?:\.\s*)?(?=[A-Z"“])/g,
        '$1 [$2]\n\n'
      );
      body = body.replace(/\s+(\d{1,2})\s*$/g, ' [$1]');
    }
  }

  if (input.references && input.references.trim()) {
    const existingRefs = input.references
      .split(/\n+|(?=(?:^|\s)\d{1,2}\s+:\s+)/g)
      .map((r) => r.trim())
      .filter(Boolean);
    for (const ref of existingRefs) {
      if (!footnotes.includes(ref)) {
        footnotes.push(ref);
      }
    }
  }

  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return {
    paragraphs,
    footnotes,
    cleanGrade,
  };
}
