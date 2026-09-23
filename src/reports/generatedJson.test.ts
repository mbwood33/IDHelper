import { describe, expect, it } from "vitest";
import type { CandidateAnnotation, IdType } from "../domain";
import {
  buildGeneratedEntityRecords,
  buildGeneratedIdJsonObject,
  countIncludedGeneratedIds,
  serializeGeneratedIdJson,
  type GeneratedIdentifiersByAnnotation,
} from "./generatedJson";

/** Creates the smallest valid annotation needed by serializer tests. */
function annotation(id: string, text: string, start: number, types: IdType[]): CandidateAnnotation {
  return {
    id,
    start,
    end: start + text.length,
    text,
    entityClass: types.includes("SCONUM") ? "vessel" : "facility",
    possibleIdTypes: types.map((type) => ({ type, confidence: 1, rationale: "test" })),
    source: "manual",
  };
}

describe("generated ID JSON", () => {
  it("always emits the exact legacy keys and placeholder arrays", () => {
    expect(buildGeneratedIdJsonObject([], {})).toEqual({
      SCONUM: [""],
      BE: [""],
      EQP_CODE: [""],
    });
    expect(serializeGeneratedIdJson([], {}, "legacy")).toBe(
      '{"SCONUM":[""],"BE":[""],"EQP_CODE":[""]}',
    );
  });

  it("groups BE+OSUFFIX under BE and renames EQPCODE in legacy output", () => {
    const annotations = [
      annotation("ship", "Erving", 0, ["SCONUM"]),
      annotation("site", "Fenix Terminal", 20, ["BE_OSUFFIX", "EQPCODE"]),
    ];
    const generated: GeneratedIdentifiersByAnnotation = {
      ship: { SCONUM: { value: "A12345", included: true } },
      site: {
        BE_OSUFFIX: { value: "1234AB5678 CD901", included: true },
        EQPCODE: { value: "GABCD", included: true },
      },
    };

    expect(buildGeneratedIdJsonObject(annotations, generated)).toEqual({
      SCONUM: ["A12345"],
      BE: ["1234AB5678 CD901"],
      EQP_CODE: ["GABCD"],
    });
  });

  it("combines multiple ID families into one entity record in report order", () => {
    const annotations = [
      annotation("second", "test 2", 20, ["EQPCODE"]),
      annotation("first", "test 1", 0, ["SCONUM", "SK"]),
    ];
    const generated: GeneratedIdentifiersByAnnotation = {
      first: {
        SCONUM: { value: "A12345", included: true },
        SK: { value: "00000000001000", included: true },
      },
      second: { EQPCODE: { value: "GABCD", included: true } },
    };

    expect(buildGeneratedEntityRecords(annotations, generated)).toEqual([
      { name: "test 1", sconum: "A12345", sk: "00000000001000" },
      { name: "test 2", eqpcode: "GABCD" },
    ]);
  });

  it("escapes record JSON for insertion inside an outer JSON string", () => {
    const annotations = [annotation("quoted", 'test "1"', 0, ["SCONUM"])];
    const generated: GeneratedIdentifiersByAnnotation = {
      quoted: { SCONUM: { value: "A12345", included: true } },
    };

    expect(serializeGeneratedIdJson(annotations, generated, "records")).toBe(
      '[{\\"name\\":\\"test \\\\\\"1\\\\\\"\\",\\"sconum\\":\\"A12345\\"}]',
    );
  });

  it("excludes unchecked and stale generated values", () => {
    const annotations = [annotation("ship", "Erving", 0, ["SCONUM"]), annotation("site", "Site", 10, ["BE"])];
    const generated: GeneratedIdentifiersByAnnotation = {
      ship: { SCONUM: { value: "A12345", included: false } },
      site: {
        BE: { value: "1234AB5678", included: true },
        SK: { value: "00000000001000", included: true },
      },
    };

    expect(buildGeneratedEntityRecords(annotations, generated)).toEqual([{ name: "Site", be: "1234AB5678" }]);
    expect(countIncludedGeneratedIds(annotations, generated)).toBe(1);
  });
});
