import { describe, expect, it } from "vitest";
import type { CandidateAnnotation } from "../domain";
import { buildGeneratedIdJsonObject, countIncludedGeneratedIds, serializeGeneratedIdJson, type GeneratedIdentifiersByAnnotation } from "./generatedJson";

function annotation(id: string, start: number, type: CandidateAnnotation["possibleIdTypes"][number]["type"]): CandidateAnnotation {
  return {
    id,
    start,
    end: start + id.length,
    text: id,
    entityClass: type === "SCONUM" ? "vessel" : "facility",
    possibleIdTypes: [{ type, confidence: 1, rationale: "test" }],
    source: "manual",
  };
}

describe("generated ID JSON", () => {
  it("uses strings for one value and arrays for repeated types", () => {
    const annotations = [annotation("ship", 0, "SCONUM"), annotation("site-a", 20, "BE"), annotation("site-b", 40, "BE_OSUFFIX")];
    const generated: GeneratedIdentifiersByAnnotation = {
      ship: { SCONUM: { value: "X99999", included: true } },
      "site-a": { BE: { value: "9999XX9999", included: true } },
      "site-b": { BE_OSUFFIX: { value: "9999-99999 XX999", included: true } },
    };

    expect(buildGeneratedIdJsonObject(annotations, generated)).toEqual({
      SCONUM: "X99999",
      BE: ["9999XX9999", "9999-99999 XX999"],
    });
    expect(serializeGeneratedIdJson(annotations, generated)).toBe(
      '{\\"SCONUM\\": \\"X99999\\", \\"BE\\": [\\"9999XX9999\\", \\"9999-99999 XX999\\"]}',
    );
    expect(countIncludedGeneratedIds(annotations, generated)).toBe(3);
  });

  it("excludes values independently of review decisions or suggestion source", () => {
    const annotations = [annotation("one", 0, "SK"), { ...annotation("two", 10, "SK"), source: "rule" as const }];
    const generated: GeneratedIdentifiersByAnnotation = {
      one: { SK: { value: "00000000000001", included: false } },
      two: { SK: { value: "00000000000002", included: true } },
    };
    expect(buildGeneratedIdJsonObject(annotations, generated)).toEqual({ SK: "00000000000002" });
  });

  it("preserves report order when BE and BE+OSUFFIX share the BE key", () => {
    const annotations = [annotation("suffix-first", 0, "BE_OSUFFIX"), annotation("plain-second", 20, "BE")];
    const generated: GeneratedIdentifiersByAnnotation = {
      "suffix-first": { BE_OSUFFIX: { value: "1111AA1111 BB111", included: true } },
      "plain-second": { BE: { value: "2222-22222", included: true } },
    };
    expect(buildGeneratedIdJsonObject(annotations, generated)).toEqual({
      BE: ["1111AA1111 BB111", "2222-22222"],
    });
  });

  it("ignores stale values for ID types no longer present on an annotation", () => {
    const annotations = [annotation("ship", 0, "SCONUM")];
    const generated: GeneratedIdentifiersByAnnotation = { ship: { BE: { value: "9999XX9999", included: true } } };
    expect(serializeGeneratedIdJson(annotations, generated)).toBe("{}");
  });
});
