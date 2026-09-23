/**
 * A legacy run of underscores in the unmodified source report. Offsets use an
 * inclusive `start` and exclusive `end` boundary so `text === original.slice(start, end)`.
 */
export interface LegacyBlank {
  start: number;
  end: number;
  text: string;
}

/**
 * Offset-preserving report representation. `analysisText` hides unreliable
 * legacy blanks while retaining one character per original character, meaning
 * analyzers can return offsets directly usable against `original`.
 */
export interface NormalizedReport {
  original: string;
  analysisText: string;
  legacyBlanks: LegacyBlank[];
}

/**
 * Locates each `_+` run and replaces it with the same number of spaces for
 * analysis only. Equal-length replacement preserves all later offsets; the
 * original string is stored unchanged for display and exact-span validation.
 *
 * @param original User-provided report text, including any legacy placeholders.
 * @returns The untouched original, offset-compatible analysis copy, and blanks.
 */
export function normalizeReport(original: string): NormalizedReport {
  const legacyBlanks: LegacyBlank[] = [];
  const analysisText = original.replace(/_+/g, (text, start: number) => {
    legacyBlanks.push({ start, end: start + text.length, text });
    return " ".repeat(text.length);
  });

  return { original, analysisText, legacyBlanks };
}

export type LegacyBlankStatus =
  | "aligned"
  | "possibly-misplaced"
  | "unsupported";

/** Result of comparing one legacy blank to independently found candidate spans. */
export interface LegacyBlankComparison {
  blank: LegacyBlank;
  status: LegacyBlankStatus;
  candidateIds: string[];
}

/**
 * Minimal candidate span contract. It intentionally avoids analyzer/domain
 * dependencies while retaining the only fields blank comparison needs.
 */
export interface SpanCandidate {
  id: string;
  start: number;
  end: number;
}

/**
 * Compares independently discovered candidate spans with legacy blanks.
 * First it identifies overlap/touching spans as `aligned`; if none exist, it
 * computes the nearest non-overlapping distance and classifies candidates
 * within `nearbyDistance` as `possibly-misplaced`. Otherwise it is unsupported.
 * Crucially, blanks are evidence for review only and never create candidates.
 *
 * @param blanks Placeholders captured from the original report.
 * @param candidates Independently discovered annotation spans.
 * @param nearbyDistance Maximum non-overlapping character distance, default 24.
 * @returns One comparison result per blank, preserving input blank order.
 */
export function compareLegacyBlanks(
  blanks: readonly LegacyBlank[],
  candidates: readonly SpanCandidate[],
  nearbyDistance = 24,
): LegacyBlankComparison[] {
  return blanks.map((blank) => {
    const aligned = candidates.filter(
      (candidate) => candidate.start <= blank.end && candidate.end >= blank.start,
    );
    if (aligned.length > 0) {
      return { blank, status: "aligned", candidateIds: aligned.map((candidate) => candidate.id) };
    }

    const nearby = candidates.filter((candidate) => {
      const distance = candidate.end < blank.start
        ? blank.start - candidate.end
        : candidate.start - blank.end;
      return distance >= 0 && distance <= nearbyDistance;
    });
    return {
      blank,
      status: nearby.length > 0 ? "possibly-misplaced" : "unsupported",
      candidateIds: nearby.map((candidate) => candidate.id),
    };
  });
}
