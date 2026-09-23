import { isEqpCodePrefix } from "./taxonomy";
import { ID_TYPES, type CandidateAnnotation, type IdType } from "./types";

/**
 * Complete-match format checks for synthetic values. They validate character
 * shape only; they do not prove a value exists, is allocated, or is valid in
 * any external intelligence system.
 */
const PATTERNS: Readonly<Record<IdType, RegExp>> = {
  SCONUM: /^[A-Z]\d{5}$/,
  BE: /^(?:\d{10}|\d{4}[A-Z]\d{5}|\d{4}[A-Z]{2}\d{4}|\d{4}-\d{5}|\d{4}-[A-Z]\d{4})$/,
  BE_OSUFFIX: /^(?:\d{10}|\d{4}[A-Z]\d{5}|\d{4}[A-Z]{2}\d{4}|\d{4}-\d{5}|\d{4}-[A-Z]\d{4})(?:[ /-]?)[A-Z]{2}\d{3}$/,
  SK: /^\d{14}$/,
  EQPCODE: /^(?:[A-HJ-Z]|9)(?:[A-Z]{4}|[A-Z]{3}\d|[A-Z]{2}\d{2})$/,
  CENOT: /^(?:[A-Z]{2}\d{3}|[A-Z]\d{3}[A-Z]|[A-Z]\d{4}|\d{5})$/,
  ELNOT: /^(?:[A-Z]\d{3}[A-Z]|[A-Z]\d{4}|\d{5})$/,
};

/** @returns whether an unknown value is a supported identifier-family name. */
export function isIdType(value: unknown): value is IdType {
  return typeof value === "string" && (ID_TYPES as readonly string[]).includes(value);
}

/**
 * Tests whether a generated or pasted value has the allowed synthetic shape.
 *
 * @param type Identifier family that determines the expected pattern.
 * @param value Raw identifier text, without a display label.
 * @returns `true` when its entire string matches the family format.
 */
export function isValidSyntheticId(type: IdType, value: string): boolean {
  if (!PATTERNS[type].test(value)) return false;
  return type !== "EQPCODE" || isEqpCodePrefix(value[0]);
}

/**
 * Validates untrusted analyzer/model output before it can be rendered.
 * The algorithm performs structural checks, verifies exact source offsets
 * against `report`, and validates nested recommendation fields. This prevents
 * invented text, invalid ranges, and unsupported ID labels from entering UI.
 *
 * @param value Unknown decoded JSON or other external candidate value.
 * @param report Original offset-compatible report text.
 * @returns `true` only when `value` satisfies the `CandidateAnnotation` contract.
 */
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
