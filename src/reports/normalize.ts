/** A legacy underscore placeholder in the original report. */
export interface LegacyBlank {
  start: number;
  end: number;
  text: string;
}

/**
 * The analysis text has exactly the same length as the displayed source, so
 * offsets returned by an analyzer can always be used against `original`.
 */
export interface NormalizedReport {
  original: string;
  analysisText: string;
  legacyBlanks: LegacyBlank[];
}

/**
 * Hide unreliable underscore placeholders from analyzers while preserving all
 * character positions. The original report is never changed.
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

export interface LegacyBlankComparison {
  blank: LegacyBlank;
  status: LegacyBlankStatus;
  candidateIds: string[];
}

/** Minimal span contract used to avoid coupling normalization to analyzers. */
export interface SpanCandidate {
  id: string;
  start: number;
  end: number;
}

/**
 * Compare independently discovered candidates to legacy blanks. A candidate
 * touching a blank is aligned; one within the supplied distance is only a
 * possible placement hint. Blank locations never create annotations.
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
