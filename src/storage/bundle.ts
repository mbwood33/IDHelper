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

/** Closed runtime allow-list corresponding to the `ReviewDecision` union. */
const DECISIONS = ["accepted", "rejected", "edited"] as const;

/**
 * Narrows unknown JSON data to an object with ordinary string keys. Arrays and
 * null are rejected because neither can safely represent a bundle record.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Returns true only for strings accepted by JavaScript's date parser. */
function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/**
 * Verifies the serializable fields inherited from `EntityIdPolicy`. This is a
 * shape check; `isUserPolicyOverride` additionally checks audit metadata.
 */
function hasPolicyShape(value: unknown): value is EntityIdPolicy {
  if (!isPlainObject(value)) return false;
  return typeof value.entityClass === "string"
    && typeof value.description === "string"
    && Array.isArray(value.possibleIdTypes)
    && value.possibleIdTypes.length > 0
    && value.possibleIdTypes.every(isIdType);
}

/** Validates untrusted JSON as a timestamped user policy override. */
export function isUserPolicyOverride(value: unknown): value is UserPolicyOverride {
  return isPlainObject(value) && hasPolicyShape(value) && isIsoDate(value.updatedAt);
}

/**
 * Validates a reviewed decision and the candidate's exact source-report span.
 * The candidate validation prevents imported offsets from rendering arbitrary
 * or out-of-bounds text in the review UI.
 */
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

/**
 * Wraps valid local state in the versioned, portable export envelope.
 *
 * @param state State already validated for storage.
 * @param exportedAt Optional injectable ISO timestamp, useful for deterministic tests.
 * @returns A deep-copied export object with schema metadata.
 * @throws {TypeError} When `state` does not satisfy the storage schema.
 */
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

/**
 * Produces readable, versioned JSON without any persistence side effect.
 * @returns Pretty-printed JSON ending in a newline for friendly file diffs.
 */
export function serializeKnowledgeBundle(state: KnowledgeState): string {
  return `${JSON.stringify(createKnowledgeBundle(state), null, 2)}\n`;
}

/**
 * Parse and validate an import without applying it. Callers can present the
 * returned preview and only then pass `preview.bundle` to persistence.
 */
/**
 * Parses untrusted JSON text and validates the full bundle before applying it.
 *
 * @param input Text read from an import file.
 * @returns A preview on success, or all detected schema errors on failure.
 * The function deliberately never reads or writes IndexedDB.
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

/**
 * Creates a defensive deep copy at UI/storage boundaries. Invalid input yields
 * a separate empty state, ensuring malformed data is never propagated.
 */
export function cloneKnowledgeState(state: KnowledgeState): KnowledgeState {
  return isKnowledgeState(state) ? structuredClone(state) : structuredClone(EMPTY_KNOWLEDGE_STATE);
}

/**
 * Constructs and validates one auditable review record.
 *
 * @param report Original, unchanged source report.
 * @param candidate Exact candidate selected in that report.
 * @param decision Reviewer outcome.
 * @param options Caller-generated ID, timestamp, and optional rationale.
 * @returns A schema-valid `ReviewedDecision` ready for local persistence.
 * @throws {TypeError} When any supplied field fails validation.
 */
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
