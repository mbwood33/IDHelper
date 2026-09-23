import type { CandidateAnnotation, IdType } from "./types";

/** Allowed identifier values at the untrusted-data boundary. */
const knownIdTypes = new Set<IdType>([
  "SCONUM", "BE", "BE_OSUFFIX", "SK", "EQPCODE", "CENOT", "ELNOT",
]);
/** Provenance values permitted by the annotation schema. */
const knownSources = new Set(["rule", "model", "merged", "manual"]);

/**
 * Narrow an arbitrary JavaScript value to a non-null object record. Arrays
 * also satisfy this check, but later property-specific validation rejects them
 * unless they happen to meet the complete candidate contract.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Validate one candidate that crossed an analyzer/model boundary.
 *
 * The algorithm is deliberately fail-closed: every field is checked before a
 * `CandidateAnnotation` is constructed. In particular, the exact-slice check
 * prevents a model from inventing a phrase or supplying offsets for text other
 * than the original report. `null` means the item is unsafe or malformed and
 * callers must omit it rather than repairing or rendering it.
 *
 * @param report Original report whose UTF-16 offsets are authoritative.
 * @param value Arbitrary JSON-like value, commonly model output.
 * @returns A schema-valid annotation or `null`.
 */
export function validateCandidate(report: string, value: unknown): CandidateAnnotation | null {
  if (!isRecord(value)) return null;
  const { id, start, end, text, entityClass, possibleIdTypes, source } = value;
  if (
    typeof id !== "string" || !id ||
    typeof start !== "number" || typeof end !== "number" ||
    !Number.isInteger(start) || !Number.isInteger(end) ||
    start < 0 || end > report.length || start >= end ||
    typeof text !== "string" || report.slice(start, end) !== text ||
    typeof entityClass !== "string" || !entityClass ||
    !Array.isArray(possibleIdTypes) || possibleIdTypes.length === 0 ||
    typeof source !== "string" || !knownSources.has(source)
  ) return null;

  // Validate all nested recommendations before allowing any candidate through.
  const validatedTypes = possibleIdTypes.map((item) => {
    if (!isRecord(item) || typeof item.type !== "string" || !knownIdTypes.has(item.type as IdType)) return null;
    if (typeof item.confidence !== "number" || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1) return null;
    if (typeof item.rationale !== "string" || !item.rationale) return null;
    if (item.eqpPrefix !== undefined && (typeof item.eqpPrefix !== "string" || !/^[A-HJ-Z9]$/.test(item.eqpPrefix))) return null;
    return { type: item.type as IdType, confidence: item.confidence, rationale: item.rationale, ...(item.eqpPrefix ? { eqpPrefix: item.eqpPrefix } : {}) };
  });
  if (validatedTypes.some((item) => item === null)) return null;

  return { id, start, end, text, entityClass, possibleIdTypes: validatedTypes as CandidateAnnotation["possibleIdTypes"], source: source as CandidateAnnotation["source"] };
}

/**
 * Validate a batch while preserving the input order of safe candidates.
 * Invalid entries are intentionally discarded; this is an untrusted-output
 * security boundary, not a user-facing error recovery mechanism.
 */
export function validateCandidates(report: string, values: readonly unknown[]): CandidateAnnotation[] {
  return values.map((value) => validateCandidate(report, value)).filter((value): value is CandidateAnnotation => value !== null);
}
