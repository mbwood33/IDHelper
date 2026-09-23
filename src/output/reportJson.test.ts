import { describe, expect, it } from "vitest";
import {
  createEntityReportOutput,
  createLegacyReportOutput,
  escapeJsonForEmbedding,
  serializeReportOutput,
  type GeneratedIdentifier,
} from "./reportJson";

/** Representative generated values shared by the schema tests below. */
const identifiers: GeneratedIdentifier[] = [
  { annotationId: "one", name: "test 1", type: "SCONUM", value: "A12345" },
  { annotationId: "two", name: "test 2", type: "EQPCODE", value: "GABC1" },
  { annotationId: "three", name: "test 3", type: "SCONUM", value: "B54321" },
];

describe("report JSON output", () => {
  it("preserves the exact empty legacy placeholder contract", () => {
    expect(serializeReportOutput([], "legacy")).toBe(
      '{"SCONUM":[""],"BE":[""],"EQP_CODE":[""]}',
    );
  });

  it("creates the legacy grouped object and uses EQP_CODE spelling", () => {
    expect(createLegacyReportOutput(identifiers)).toEqual({
      SCONUM: ["A12345", "B54321"],
      BE: [""],
      EQP_CODE: ["GABC1"],
    });
  });

  it("omits identifier families that the legacy schema cannot represent", () => {
    expect(createLegacyReportOutput([
      { annotationId: "one", name: "test 1", type: "SK", value: "00000000001000" },
    ])).toEqual({ SCONUM: [""], BE: [""], EQP_CODE: [""] });
  });

  it("groups identifiers for the same annotation into one entity record", () => {
    expect(createEntityReportOutput([
      ...identifiers,
      { annotationId: "one", name: "test 1", type: "SK", value: "00000000001000" },
    ])).toEqual([
      { name: "test 1", sconum: "A12345", sk: "00000000001000" },
      { name: "test 2", eqpcode: "GABC1" },
      { name: "test 3", sconum: "B54321" },
    ]);
  });

  it("escapes record JSON for insertion inside another JSON string", () => {
    expect(serializeReportOutput(identifiers, "records")).toBe(
      '[{\\"name\\":\\"test 1\\",\\"sconum\\":\\"A12345\\"},{\\"name\\":\\"test 2\\",\\"eqpcode\\":\\"GABC1\\"},{\\"name\\":\\"test 3\\",\\"sconum\\":\\"B54321\\"}]',
    );
  });

  it("escapes embedded quotes and backslashes without corrupting JSON", () => {
    const plain = JSON.stringify([{ name: 'A "quoted" \\ name', sconum: "A12345" }]);
    const escaped = escapeJsonForEmbedding(plain);
    expect(JSON.parse(`"${escaped}"`)).toBe(plain);
  });
});
