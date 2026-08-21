import { describe, expect, it } from "vitest";
import { buildCorrectionContext, CandidateLineParser, mapRawCandidateToAnnotations } from "./localModel";
import type { ReviewedDecision } from "../storage";

describe("CandidateLineParser", () => {
  it("emits complete candidates incrementally across arbitrary stream chunks", () => {
    const parser = new CandidateLineParser();
    expect(parser.push('{"text":"Erv').candidates).toEqual([]);
    const first = parser.push('ing","entityClass":"named-vessel","types":["SCONUM","SK"],"rationale":"Named ship."}\n');
    expect(first.candidates).toHaveLength(1);
    expect(first.candidates[0].text).toBe("Erving");

    const done = parser.push('{"done":true}\n');
    expect(done.done).toBe(true);
  });

  it("ignores prose, unknown ID types, and duplicate candidate lines", () => {
    const parser = new CandidateLineParser();
    const line = '{"text":"Erving","entityClass":"named-vessel","types":["SCONUM","UNKNOWN"],"rationale":"Named ship."}\n';
    const result = parser.push(`Here are results:\n${line}${line}`);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].types).toEqual(["SCONUM"]);
  });
});

describe("mapRawCandidateToAnnotations", () => {
  it("maps model text to every exact source occurrence and never trusts offsets", () => {
    const report = "The Erving arrived. Later, Erving departed.";
    const result = mapRawCandidateToAnnotations(report, report, {
      text: "Erving",
      entityClass: "named-vessel",
      types: ["SCONUM", "SK"],
      rationale: "Named vessel.",
    });
    expect(result).toHaveLength(2);
    expect(result.map((candidate) => report.slice(candidate.start, candidate.end))).toEqual(["Erving", "Erving"]);
  });

  it("rejects a suggestion that crosses a legacy underscore blank", () => {
    const report = "Fenix____Terminal";
    const analysisText = "Fenix    Terminal";
    const result = mapRawCandidateToAnnotations(report, analysisText, {
      text: "Fenix    Terminal",
      entityClass: "facility",
      types: ["BE"],
      rationale: "Named facility.",
    });
    expect(result).toEqual([]);
  });
});

describe("buildCorrectionContext", () => {
  const decision = (kind: ReviewedDecision["decision"], type: "SCONUM" | "BE"): ReviewedDecision => ({
    id: `${kind}-${type}`,
    report: "The vessel Erving entered the terminal.",
    candidate: {
      id: `candidate-${kind}-${type}`,
      start: 11,
      end: 17,
      text: "Erving",
      entityClass: type === "SCONUM" ? "named-vessel" : "facility",
      possibleIdTypes: [{ type, confidence: 1, rationale: "Reviewed correction." }],
      source: "manual",
    },
    decision: kind,
    reviewedAt: "2026-08-21T12:00:00.000Z",
  });

  it("uses edited decisions as bounded in-context examples and excludes bare rejections", () => {
    const context = buildCorrectionContext([decision("rejected", "BE"), decision("edited", "SCONUM")]);
    expect(context).toContain("USER-REVIEWED CORRECTIONS");
    expect(context).toContain('"correctedTypes":["SCONUM"]');
    expect(context).not.toContain('"correctedTypes":["BE"]');
  });
});
