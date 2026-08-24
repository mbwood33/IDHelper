import { describe, expect, it } from "vitest";
import { EQPCODE_PREFIXES, isValidCandidateAnnotation, isValidSyntheticId } from "./index";

describe("synthetic identifier validation", () => {
  it("accepts each allowed identifier shape", () => {
    expect(isValidSyntheticId("SCONUM", "A48217")).toBe(true);
    expect(isValidSyntheticId("BE", "4821QP7390")).toBe(true);
    expect(isValidSyntheticId("BE", "4821-73904")).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821QP7390 RT204")).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821QP7390RT204")).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821QP7390/RT204")).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821QP7390-RT204")).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821-73904RT204")).toBe(true);
    expect(isValidSyntheticId("SK", "00001234567890")).toBe(true);
    expect(isValidSyntheticId("CENOT", "RT204")).toBe(true);
    expect(isValidSyntheticId("ELNOT", "R204T")).toBe(true);
    expect(isValidSyntheticId("EQPCODE", "XMAXQ")).toBe(true);
    expect(isValidSyntheticId("EQPCODE", "DJT93")).toBe(true);
  });

  it("accepts every approved EQPCODE prefix and rejects I", () => {
    EQPCODE_PREFIXES.forEach((prefix) => expect(isValidSyntheticId("EQPCODE", `${prefix}AAAA`)).toBe(true));
    expect(isValidSyntheticId("EQPCODE", "IAAAA")).toBe(false);
  });

  it("rejects prohibited formats", () => {
    expect(isValidSyntheticId("SK", "1234567890123")).toBe(false);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821QP7390_RT204")).toBe(false);
    expect(isValidSyntheticId("ELNOT", "RT204")).toBe(false);
    expect(isValidSyntheticId("EQPCODE", "X0000")).toBe(false);
    expect(isValidSyntheticId("BE", "4821123456")).toBe(false);
    expect(isValidSyntheticId("BE", "4821Q73904")).toBe(false);
    expect(isValidSyntheticId("BE", "4821-Q7390")).toBe(false);
    expect(isValidSyntheticId("BE_OSUFFIX", "4821123456RT204")).toBe(false);
  });
});

describe("candidate validation", () => {
  const report = "The vessel Erving departed.";
  const candidate = {
    id: "vessel-erving",
    start: 11,
    end: 17,
    text: "Erving",
    entityClass: "vessel",
    possibleIdTypes: [{ type: "SCONUM", confidence: 0.8, rationale: "named vessel" }],
    source: "rule",
  };

  it("accepts exact, in-bounds candidate spans", () => {
    expect(isValidCandidateAnnotation(candidate, report)).toBe(true);
  });

  it("rejects invented text and invalid confidence", () => {
    expect(isValidCandidateAnnotation({ ...candidate, text: "Other" }, report)).toBe(false);
    expect(isValidCandidateAnnotation({ ...candidate, possibleIdTypes: [{ ...candidate.possibleIdTypes[0], confidence: 2 }] }, report)).toBe(false);
  });
});
