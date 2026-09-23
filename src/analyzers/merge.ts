import type { CandidateAnnotation, IdType } from "./types";

/**
 * Merge only exact duplicate spans. Overlapping and adjacent spans are kept so
 * the review UI can present both a platform type and its named instance.
 */
export function mergeCandidates(candidates: readonly CandidateAnnotation[]): CandidateAnnotation[] {
  // The key includes text as a defensive tie-breaker even though valid spans
  // normally imply it. Only identical spans merge; overlaps remain reviewable.
  const bySpan = new Map<string, CandidateAnnotation>();
  for (const candidate of candidates) {
    const key = `${candidate.start}:${candidate.end}:${candidate.text}`;
    const current = bySpan.get(key);
    if (!current) {
      bySpan.set(key, { ...candidate, possibleIdTypes: [...candidate.possibleIdTypes] });
      continue;
    }

    // Deduplicate ID types and retain the highest-confidence explanation.
    const types = new Map<IdType, CandidateAnnotation["possibleIdTypes"][number]>();
    for (const option of [...current.possibleIdTypes, ...candidate.possibleIdTypes]) {
      const previous = types.get(option.type);
      if (!previous || option.confidence > previous.confidence) types.set(option.type, option);
    }
    bySpan.set(key, {
      ...current,
      entityClass: current.entityClass === candidate.entityClass ? current.entityClass : "mixed",
      possibleIdTypes: [...types.values()],
      source: current.source === candidate.source ? current.source : "merged",
    });
  }
  // Stable positional ordering lets the renderer walk report offsets safely.
  return [...bySpan.values()].sort((a, b) => a.start - b.start || a.end - b.end);
}
