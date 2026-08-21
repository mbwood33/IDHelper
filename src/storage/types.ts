import type { CandidateAnnotation, EntityIdPolicy } from "../domain/types";

/** The stable on-disk/export format. Increment when a breaking migration is needed. */
export const KNOWLEDGE_BUNDLE_SCHEMA = "idhelper-knowledge-bundle";
export const KNOWLEDGE_BUNDLE_VERSION = 1 as const;

export type ReviewDecision = "accepted" | "rejected" | "edited";

/**
 * A user-reviewed candidate. `report` is deliberately retained: it is useful
 * feedback evidence, but remains local unless the user explicitly exports it.
 */
export interface ReviewedDecision {
  id: string;
  report: string;
  candidate: CandidateAnnotation;
  decision: ReviewDecision;
  reviewedAt: string;
  note?: string;
}

/** A policy entry supplied by the user, replacing the matching default class. */
export interface UserPolicyOverride extends EntityIdPolicy {
  updatedAt: string;
}

export interface KnowledgeState {
  policyOverrides: UserPolicyOverride[];
  reviewedDecisions: ReviewedDecision[];
}

export interface KnowledgeBundle extends KnowledgeState {
  schema: typeof KNOWLEDGE_BUNDLE_SCHEMA;
  version: typeof KNOWLEDGE_BUNDLE_VERSION;
  exportedAt: string;
}

export interface ImportPreview {
  bundle: KnowledgeBundle;
  policyOverrideCount: number;
  reviewedDecisionCount: number;
}

export type ImportParseResult =
  | { ok: true; preview: ImportPreview }
  | { ok: false; errors: string[] };

export const EMPTY_KNOWLEDGE_STATE: KnowledgeState = {
  policyOverrides: [],
  reviewedDecisions: [],
};
