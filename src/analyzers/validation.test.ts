import { describe, expect, it } from "vitest";
import { mergeCandidates } from "./merge";
import { validateCandidate } from "./validation";

const report = "Erving alongside Erving";
const valid = {
  id: "model-1", start: 0, end: 6, text: "Erving", entityClass: "vessel",
  possibleIdTypes: [{ type: "SCONUM", confidence: 0.8, rationale: "Named vessel." }], source: "model",
} as const;

describe("candidate validation", () => {
  it("rejects invented text, out-of-bounds spans, and invalid model options", () => {
    expect(validateCandidate(report, valid)).not.toBeNull();
    expect(validateCandidate(report, { ...valid, text: "Invented" })).toBeNull();
    expect(validateCandidate(report, { ...valid, end: 100 })).toBeNull();
    expect(validateCandidate(report, { ...valid, possibleIdTypes: [{ ...valid.possibleIdTypes[0], confidence: 2 }] })).toBeNull();
  });

  it("merges only exact duplicate spans and preserves other repeated occurrences", () => {
    const first = validateCandidate(report, valid)!;
    const duplicate = { ...first, id: "rule-1", source: "rule" as const, possibleIdTypes: [{ type: "SK" as const, confidence: 0.4, rationale: "Indexed entity." }] };
    const repeated = { ...first, id: "rule-2", start: 17, end: 23, source: "rule" as const };
    const merged = mergeCandidates([first, duplicate, repeated]);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe("merged");
    expect(merged[0].possibleIdTypes.map((item) => item.type)).toEqual(["SCONUM", "SK"]);
    expect(merged[1].start).toBe(17);
  });
});
