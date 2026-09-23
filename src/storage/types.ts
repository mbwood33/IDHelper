import type { CandidateAnnotation, EntityIdPolicy } from "../domain/types";

/**
 * Stable discriminator for every knowledge export. Import code uses this value
 * to reject unrelated JSON files before any local data can be replaced.
 */
export const KNOWLEDGE_BUNDLE_SCHEMA = "idhelper-knowledge-bundle";

/**
 * Version of the serialized knowledge schema. Increment this only for a
 * breaking shape change and add a migration/compatibility path at that time.
 */
export const KNOWLEDGE_BUNDLE_VERSION = 1 as const;

/** The three outcomes a reviewer can record for a suggested annotation. */
export type ReviewDecision = "accepted" | "rejected" | "edited";

/**
 * A user-reviewed candidate and the evidence needed to understand it later.
 * `report` intentionally remains part of the record so the decision can be
 * audited in context. It stays in browser storage unless the user exports it.
 */
export interface ReviewedDecision {
  /** Stable per-decision identifier, supplied by the caller. */
  id: string;
  /** Unmodified source report from which `candidate` was selected. */
  report: string;
  /** Validated, exact-offset candidate reviewed by the user. */
  candidate: CandidateAnnotation;
  /** The user's accept, reject, or correction outcome. */
  decision: ReviewDecision;
  /** ISO-8601 timestamp marking when the decision was recorded. */
  reviewedAt: string;
  /** Optional free-text explanation, often supervisor feedback. */
  note?: string;
}

/**
 * A user-created replacement for the built-in policy of one entity class.
 * The application applies it deliberately; one reviewed decision never
 * silently creates a broad policy rule.
 */
export interface UserPolicyOverride extends EntityIdPolicy {
  /** ISO-8601 timestamp marking when the override was last edited. */
  updatedAt: string;
}

/** Complete locally persisted knowledge, without export metadata. */
export interface KnowledgeState {
  /** User policy changes keyed conceptually by their entity class. */
  policyOverrides: UserPolicyOverride[];
  /** Historical reviewed examples retained as local feedback evidence. */
  reviewedDecisions: ReviewedDecision[];
}

/** Versioned, portable wrapper written to and read from JSON files. */
export interface KnowledgeBundle extends KnowledgeState {
  /** Fixed schema discriminator used during import validation. */
  schema: typeof KNOWLEDGE_BUNDLE_SCHEMA;
  /** Fixed schema version used during import validation. */
  version: typeof KNOWLEDGE_BUNDLE_VERSION;
  /** ISO-8601 timestamp generated when this export was created. */
  exportedAt: string;
}

/** Safe import summary shown to the user before persistence is changed. */
export interface ImportPreview {
  /** Fully validated deep copy ready to save only after confirmation. */
  bundle: KnowledgeBundle;
  /** Number of policy overrides contained in `bundle`. */
  policyOverrideCount: number;
  /** Number of reviewed decisions contained in `bundle`. */
  reviewedDecisionCount: number;
}

/** Discriminated result of parsing untrusted import text. */
export type ImportParseResult =
  /** Successful validation provides a non-mutating preview. */
  | { ok: true; preview: ImportPreview }
  /** Failed validation provides human-readable reasons and no bundle. */
  | { ok: false; errors: string[] };

/** Fresh-state value used for first run, invalid reads, and explicit reset. */
export const EMPTY_KNOWLEDGE_STATE: KnowledgeState = {
  policyOverrides: [],
  reviewedDecisions: [],
};
