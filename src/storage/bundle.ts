import { isIdType, isValidCandidateAnnotation } from "../domain/validation";
import type { CandidateAnnotation, EntityIdPolicy } from "../domain/types";
import {
  EMPTY_KNOWLEDGE_STATE,
  KNOWLEDGE_BUNDLE_SCHEMA,
  KNOWLEDGE_BUNDLE_VERSION,
  type ImportParseResult,
  type KnowledgeBundle,
  type KnowledgeState,
  type ReviewedDecision,
  type UserPolicyOverride,
} from "./types";

const DECISIONS = ["accepted", "rejected", "edited"] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function hasPolicyShape(value: unknown): value is EntityIdPolicy {
  if (!isPlainObject(value)) return false;
  return typeof value.entityClass === "string"
    && typeof value.description === "string"
    && Array.isArray(value.possibleIdTypes)
    && value.possibleIdTypes.length > 0
    && value.possibleIdTypes.every(isIdType);
}

export function isUserPolicyOverride(value: unknown): value is UserPolicyOverride {
  return isPlainObject(value) && hasPolicyShape(value) && isIsoDate(value.updatedAt);
}

export function isReviewedDecision(value: unknown): value is ReviewedDecision {
  if (!isPlainObject(value)) return false;
  const candidate = value.candidate;
  return typeof value.id === "string"
    && value.id.length > 0
    && typeof value.report === "string"
    && isValidCandidateAnnotation(candidate, value.report)
    && typeof value.decision === "string"
    && (DECISIONS as readonly string[]).includes(value.decision)
    && isIsoDate(value.reviewedAt)
    && (value.note === undefined || typeof value.note === "string");
}

/** Validates data safe to store locally, independent of a particular export. */
export function isKnowledgeState(value: unknown): value is KnowledgeState {
  return isPlainObject(value)
    && Array.isArray(value.policyOverrides)
    && value.policyOverrides.every(isUserPolicyOverride)
    && Array.isArray(value.reviewedDecisions)
    && value.reviewedDecisions.every(isReviewedDecision);
}

export function createKnowledgeBundle(
  state: KnowledgeState,
  exportedAt = new Date().toISOString(),
): KnowledgeBundle {
  if (!isKnowledgeState(state)) {
    throw new TypeError("Cannot export invalid knowledge state.");
  }
  return {
    schema: KNOWLEDGE_BUNDLE_SCHEMA,
    version: KNOWLEDGE_BUNDLE_VERSION,
    exportedAt,
    policyOverrides: structuredClone(state.policyOverrides),
    reviewedDecisions: structuredClone(state.reviewedDecisions),
  };
}

/** A readable, versioned JSON artifact; this function has no storage side effects. */
export function serializeKnowledgeBundle(state: KnowledgeState): string {
  return `${JSON.stringify(createKnowledgeBundle(state), null, 2)}\n`;
}

/**
 * Parse and validate an import without applying it. Callers can present the
 * returned preview and only then pass `preview.bundle` to persistence.
 */
export function parseKnowledgeBundle(input: string): ImportParseResult {
  let value: unknown;
  try {
    value = JSON.parse(input) as unknown;
  } catch {
    return { ok: false, errors: ["The selected file is not valid JSON."] };
  }
  if (!isPlainObject(value)) return { ok: false, errors: ["The bundle must be a JSON object."] };

  const errors: string[] = [];
  if (value.schema !== KNOWLEDGE_BUNDLE_SCHEMA) errors.push("Unrecognized bundle schema.");
  if (value.version !== KNOWLEDGE_BUNDLE_VERSION) errors.push(`Unsupported bundle version: ${String(value.version)}.`);
  if (!isIsoDate(value.exportedAt)) errors.push("Bundle exportedAt must be an ISO date.");
  if (!isKnowledgeState(value)) errors.push("Bundle contains invalid policy overrides or reviewed decisions.");
  if (errors.length > 0) return { ok: false, errors };

  const bundle = value as unknown as KnowledgeBundle;
  return {
    ok: true,
    preview: {
      bundle: structuredClone(bundle),
      policyOverrideCount: bundle.policyOverrides.length,
      reviewedDecisionCount: bundle.reviewedDecisions.length,
    },
  };
}

/** Defensive copy for UI state and storage boundaries. */
export function cloneKnowledgeState(state: KnowledgeState): KnowledgeState {
  return isKnowledgeState(state) ? structuredClone(state) : structuredClone(EMPTY_KNOWLEDGE_STATE);
}

export function createReviewedDecision(
  report: string,
  candidate: CandidateAnnotation,
  decision: ReviewedDecision["decision"],
  options: Pick<ReviewedDecision, "id" | "reviewedAt" | "note">,
): ReviewedDecision {
  const value: ReviewedDecision = { report, candidate, decision, ...options };
  if (!isReviewedDecision(value)) throw new TypeError("Cannot create an invalid reviewed decision.");
  return value;
}
