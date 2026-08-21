import { describe, expect, it } from "vitest";
import {
  createKnowledgeBundle,
  createReviewedDecision,
  parseKnowledgeBundle,
  serializeKnowledgeBundle,
} from "./bundle";
import { KNOWLEDGE_BUNDLE_SCHEMA, KNOWLEDGE_BUNDLE_VERSION, type KnowledgeState } from "./types";

const report = "The containership Erving arrived.";
const candidate = {
  id: "candidate-1", start: 18, end: 24, text: "Erving", entityClass: "vessel",
  source: "rule" as const,
  possibleIdTypes: [{ type: "SCONUM" as const, confidence: 0.8, rationale: "Named after containership." }],
};

function state(): KnowledgeState {
  return {
    policyOverrides: [{ entityClass: "vessel", possibleIdTypes: ["SCONUM", "SK"], description: "Local policy.", updatedAt: "2026-08-21T12:00:00.000Z" }],
    reviewedDecisions: [createReviewedDecision(report, candidate, "accepted", { id: "review-1", reviewedAt: "2026-08-21T12:00:00.000Z" })],
  };
}

describe("knowledge bundle", () => {
  it("exports a documented versioned JSON bundle", () => {
    const bundle = createKnowledgeBundle(state(), "2026-08-21T12:00:00.000Z");
    expect(bundle.schema).toBe(KNOWLEDGE_BUNDLE_SCHEMA);
    expect(bundle.version).toBe(KNOWLEDGE_BUNDLE_VERSION);
    expect(JSON.parse(serializeKnowledgeBundle(state())).reviewedDecisions).toHaveLength(1);
  });

  it("parses valid imports into a preview without applying them", () => {
    const result = parseKnowledgeBundle(serializeKnowledgeBundle(state()));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.policyOverrideCount).toBe(1);
      expect(result.preview.reviewedDecisionCount).toBe(1);
    }
  });

  it("rejects invalid JSON, versions, and candidate offsets", () => {
    expect(parseKnowledgeBundle("not json").ok).toBe(false);
    const wrongVersion = createKnowledgeBundle(state());
    const unsupported = { ...wrongVersion, version: 99 };
    expect(parseKnowledgeBundle(JSON.stringify(unsupported)).ok).toBe(false);
    const invalidCandidate = structuredClone(wrongVersion);
    invalidCandidate.reviewedDecisions[0].candidate.end = 200;
    expect(parseKnowledgeBundle(JSON.stringify(invalidCandidate)).ok).toBe(false);
  });
});
