import type { Annotation } from "./types";

interface Props {
  report: string;
  annotations: Annotation[];
  selectedId?: string;
  onSelect: (annotation: Annotation) => void;
}

/** Read-only rendering keeps source offsets stable; invalid/overlapping spans are skipped safely. */
export function AnnotatedReport({ report, annotations, selectedId, onSelect }: Props) {
  const ordered = [...annotations]
    .filter((item) => item.start >= 0 && item.end <= report.length && item.start < item.end && report.slice(item.start, item.end) === item.text)
    .sort((a, b) => a.start - b.start || b.end - a.end);
  const nonOverlapping = ordered.filter((item, index) => index === 0 || item.start >= ordered[index - 1].end);
  let cursor = 0;
  const segments: React.ReactNode[] = [];
  nonOverlapping.forEach((annotation) => {
    if (annotation.start > cursor) segments.push(report.slice(cursor, annotation.start));
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
