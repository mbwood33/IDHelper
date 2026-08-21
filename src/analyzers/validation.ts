import type { CandidateAnnotation, IdType } from "./types";

const knownIdTypes = new Set<IdType>([
  "SCONUM", "BE", "BE_OSUFFIX", "SK", "EQPCODE", "CENOT", "ELNOT",
]);
const knownSources = new Set(["rule", "model", "merged", "manual"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Return a safe candidate or null. Model output is always treated as untrusted. */
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

export function validateCandidates(report: string, values: readonly unknown[]): CandidateAnnotation[] {
  return values.map((value) => validateCandidate(report, value)).filter((value): value is CandidateAnnotation => value !== null);
}
