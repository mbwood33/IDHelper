import { isEqpCodePrefix } from "./taxonomy";
import { ID_TYPES, type CandidateAnnotation, type IdType } from "./types";

const PATTERNS: Readonly<Record<IdType, RegExp>> = {
  SCONUM: /^[A-Z]\d{5}$/,
  BE: /^(?:\d{4}[A-Z]{2}\d{4}|\d{4}-\d{5})$/,
  BE_OSUFFIX: /^(?:\d{4}[A-Z]{2}\d{4}|\d{4}-\d{5})(?:[ /-]?)[A-Z]{2}\d{3}$/,
  SK: /^\d{14}$/,
  EQPCODE: /^(?:[A-HJ-Z]|9)(?:[A-Z]{4}|[A-Z]{3}\d|[A-Z]{2}\d{2})$/,
  CENOT: /^(?:[A-Z]{2}\d{3}|[A-Z]\d{3}[A-Z]|[A-Z]\d{4}|\d{5})$/,
  ELNOT: /^(?:[A-Z]\d{3}[A-Z]|[A-Z]\d{4}|\d{5})$/,
};

export function isIdType(value: unknown): value is IdType {
  return typeof value === "string" && (ID_TYPES as readonly string[]).includes(value);
}

export function isValidSyntheticId(type: IdType, value: string): boolean {
  if (!PATTERNS[type].test(value)) return false;
  return type !== "EQPCODE" || isEqpCodePrefix(value[0]);
}

/** Validates untrusted analyzer output before it is rendered. */
export function isValidCandidateAnnotation(value: unknown, report: string): value is CandidateAnnotation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CandidateAnnotation>;
  const start = candidate.start;
  const end = candidate.end;
  if (
    typeof candidate.id !== "string" ||
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end > report.length ||
    start >= end ||
    typeof candidate.text !== "string" ||
    report.slice(start, end) !== candidate.text ||
    typeof candidate.entityClass !== "string" ||
    !["rule", "model", "merged", "manual"].includes(candidate.source ?? "") ||
    !Array.isArray(candidate.possibleIdTypes) ||
    candidate.possibleIdTypes.length === 0
  ) return false;

  return candidate.possibleIdTypes.every((option) => {
    if (!option || typeof option !== "object") return false;
    const proposed = option as CandidateAnnotation["possibleIdTypes"][number];
    return (
      isIdType(proposed.type) &&
      typeof proposed.rationale === "string" &&
      Number.isFinite(proposed.confidence) &&
      proposed.confidence >= 0 &&
      proposed.confidence <= 1 &&
      (proposed.eqpPrefix === undefined || isEqpCodePrefix(proposed.eqpPrefix))
    );
  });
}
