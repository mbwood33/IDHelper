import { describe, expect, it } from "vitest";
import { EQPCODE_PREFIXES, isValidSyntheticId } from "../domain";
import {
  generateBeNumber,
  generateBeNumberWithOsuffix,
  generateCenot,
  generateElnot,
  generateEqpCode,
  generateSconum,
  generateSk,
  generateSyntheticId,
} from "./syntheticIds";

describe("synthetic ID generators", () => {
  it("generates each supported raw identifier type", () => {
    expect(isValidSyntheticId("SCONUM", generateSconum())).toBe(true);
    expect(isValidSyntheticId("BE", generateBeNumber())).toBe(true);
    expect(isValidSyntheticId("BE", generateBeNumber("DASHED"))).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", generateBeNumberWithOsuffix())).toBe(true);
    expect(isValidSyntheticId("SK", generateSk())).toBe(true);
    expect(isValidSyntheticId("CENOT", generateCenot("00000"))).toBe(true);
    expect(isValidSyntheticId("ELNOT", generateElnot("X000X"))).toBe(true);
  });

  it("honors every selected EQPCODE prefix", () => {
    EQPCODE_PREFIXES.forEach((prefix) => {
      const code = generateEqpCode(prefix);
      expect(code.startsWith(prefix)).toBe(true);
      expect(isValidSyntheticId("EQPCODE", code)).toBe(true);
    });
  });

  it("does not decorate generic output", () => {
    const value = generateSyntheticId("SCONUM");
    expect(value).toMatch(/^[A-Z]\d{5}$/);
  });
});
