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
  it("always emits escaped, spaced legacy keys and placeholder arrays", () => {
    expect(buildGeneratedIdJsonObject([], {})).toEqual({
      SCONUM: [""],
      BE: [""],
      EQP_CODE: [""],
    });
    expect(serializeGeneratedIdJson([], {}, "legacy")).toBe(
      '{\\"SCONUM\\": [\\"\\"], \\"BE\\": [\\"\\"], \\"EQP_CODE\\": [\\"\\"]}',
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
      SCONUM: "A12345",
      BE: "1234AB5678 CD901",
      EQP_CODE: "GABCD",
    });
    // This exact text is pasted into an outer prompt/completion JSON string.
    expect(serializeGeneratedIdJson(annotations, generated, "legacy")).toBe(
      '{\\"SCONUM\\": \\"A12345\\", \\"BE\\": \\"1234AB5678 CD901\\", \\"EQP_CODE\\": \\"GABCD\\"}',
    );
  });

  it("uses arrays for repeated legacy IDs and a scalar for a single ID", () => {
    const annotations = [
      annotation("ship-1", "First ship", 0, ["SCONUM"]),
      annotation("ship-2", "Second ship", 20, ["SCONUM"]),
      annotation("site-1", "First site", 40, ["BE"]),
      annotation("site-2", "Second site", 60, ["BE"]),
      annotation("equipment-1", "First equipment", 80, ["EQPCODE"]),
    ];
    const generated: GeneratedIdentifiersByAnnotation = {
      "ship-1": { SCONUM: { value: "N97587", included: true } },
      "ship-2": { SCONUM: { value: "J15843", included: true } },
      "site-1": { BE: { value: "6750-51560", included: true } },
      "site-2": { BE: { value: "5027-89450", included: true } },
      "equipment-1": { EQPCODE: { value: "GDHVD", included: true } },
    };

    expect(serializeGeneratedIdJson(annotations, generated, "legacy")).toBe(
      '{\\"SCONUM\\": [\\"N97587\\", \\"J15843\\"], \\"BE\\": [\\"6750-51560\\", \\"5027-89450\\"], \\"EQP_CODE\\": \\"GDHVD\\"}',
    );
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

  it("escapes and spaces record JSON for insertion inside an outer JSON string", () => {
    const annotations = [annotation("quoted", 'test "1"', 0, ["SCONUM"])];
    const generated: GeneratedIdentifiersByAnnotation = {
      quoted: { SCONUM: { value: "A12345", included: true } },
    };

    expect(serializeGeneratedIdJson(annotations, generated, "records")).toBe(
      '[{\\"name\\": \\"test \\\\\\"1\\\\\\"\\", \\"sconum\\": \\"A12345\\"}]',
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
