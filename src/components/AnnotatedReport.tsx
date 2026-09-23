import type { Annotation } from "./types";

/** Inputs necessary to render a report without ever editing its source text. */
interface Props {
  /** Original report, used as the sole source for displayed text and offsets. */
  report: string;
  /** Candidate spans to validate, sort, and render as selectable buttons. */
  annotations: Annotation[];
  /** Optional annotation ID currently open in the details panel. */
  selectedId?: string;
  /** Called with the exact candidate when keyboard or mouse selects a highlight. */
  onSelect: (annotation: Annotation) => void;
}

/**
 * Renders report text plus safe, exact-span annotation buttons.
 *
 * Algorithm: validate each span against the untouched report, sort by start
 * offset then longest span, discard intersections, and emit intervening source
 * slices with buttons at valid spans. This preserves whitespace/punctuation and
 * makes invalid model output harmless rather than allowing arbitrary markup.
 *
 * @param report Unchanged report source.
 * @param annotations Potentially unordered annotations from analyzers/users.
 * @param selectedId ID whose button exposes selected styling/pressed state.
 * @param onSelect Receives the selected annotation for the persistent panel.
 * @returns A keyboard-accessible, read-only annotated report.
 */
export function AnnotatedReport({ report, annotations, selectedId, onSelect }: Props) {
  /** Ordered candidates whose offsets and text have been verified locally. */
  const ordered = [...annotations]
    .filter((item) => item.start >= 0 && item.end <= report.length && item.start < item.end && report.slice(item.start, item.end) === item.text)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  /**
   * Flat rendering cannot nest crossing spans, so retain the first (longest
   * where starts tie) non-overlapping candidate and safely skip the rest.
   */
  const nonOverlapping = ordered.filter((item, index) => index === 0 || item.start >= ordered[index - 1].end);
  /** Current exclusive report offset already emitted into `segments`. */
  let cursor = 0;
  /** Interleaved raw text and buttons later returned as React children. */
  const segments: React.ReactNode[] = [];
  nonOverlapping.forEach((annotation) => {
    // Add untouched text between the previous candidate and this candidate.
    if (annotation.start > cursor) segments.push(report.slice(cursor, annotation.start));
    /** Concise accessible summary; color is never the only ID-type cue. */
    const labels = annotation.possibleIdTypes.map((item) => item.type).join(", ");
    segments.push(
      <button
        className={`annotation annotation--${annotation.entityClass.toLowerCase().replace(/[^a-z]+/g, "-")} ${selectedId === annotation.id ? "is-selected" : ""}`}
        key={annotation.id}
        type="button"
        onClick={() => onSelect(annotation)}
        aria-pressed={selectedId === annotation.id}
        aria-label={`Select ${annotation.text}; ${annotation.entityClass}; possible identifiers: ${labels}`}
      >
        {annotation.text}<span aria-hidden="true" className="annotation__dot" />
      </button>,
    );
    cursor = annotation.end;
  });
  if (cursor < report.length) segments.push(report.slice(cursor));
  return <div className="annotated-report" aria-label="Annotated report">{segments}</div>;
}
