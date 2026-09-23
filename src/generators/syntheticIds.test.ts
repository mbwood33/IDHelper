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

  it("generates only the two approved BE Number forms", () => {
    expect(generateBeNumber("ALPHANUMERIC")).toMatch(/^\d{4}[A-Z]{2}\d{4}$/);
    expect(generateBeNumber("DASHED")).toMatch(/^\d{4}-\d{5}$/);
    for (let index = 0; index < 100; index += 1) {
      expect(generateBeNumber()).toMatch(/^(?:\d{4}[A-Z]{2}\d{4}|\d{4}-\d{5})$/);
    }
  });

  it("never emits previously allowed BE Number shapes", () => {
    for (let index = 0; index < 100; index += 1) {
      const value = generateBeNumber();
      expect(value).not.toMatch(/^\d{10}$/);
      expect(value).not.toMatch(/^\d{4}[A-Z]\d{5}$/);
      expect(value).not.toMatch(/^\d{4}-[A-Z]\d{4}$/);
    }
  });

  it("always separates a BE Number and OSUFFIX with one space", () => {
    const alphanumeric = generateBeNumberWithOsuffix("ALPHANUMERIC");
    const dashed = generateBeNumberWithOsuffix("DASHED");
    expect(alphanumeric).toMatch(/^\d{4}[A-Z]{2}\d{4} [A-Z]{2}\d{3}$/);
    expect(dashed).toMatch(/^\d{4}-\d{5} [A-Z]{2}\d{3}$/);
    expect(isValidSyntheticId("BE_OSUFFIX", alphanumeric)).toBe(true);
    expect(isValidSyntheticId("BE_OSUFFIX", dashed)).toBe(true);
  });

  it("honors every selected EQPCODE prefix", () => {
    EQPCODE_PREFIXES.forEach((prefix) => {
      const code = generateEqpCode(prefix);
      expect(code.startsWith(prefix)).toBe(true);
      expect(isValidSyntheticId("EQPCODE", code)).toBe(true);
    });
  });

  it("matches every weighted EQPCODE body form from generator-eqp.py", () => {
    expect(generateEqpCode("X", "XXXX")).toMatch(/^X[A-Z]{4}$/);
    expect(generateEqpCode("X", "XXX0")).toMatch(/^X[A-Z]{3}\d$/);
    expect(generateEqpCode("X", "XX00")).toMatch(/^X[A-Z]{2}\d{2}$/);
  });

  it("supports every CENOT and ELNOT form from the reference generators", () => {
    (["XX000", "X000X", "X0000", "00000"] as const).forEach((form) => {
      expect(isValidSyntheticId("CENOT", generateCenot(form))).toBe(true);
    });
    (["X000X", "X0000", "00000"] as const).forEach((form) => {
      expect(isValidSyntheticId("ELNOT", generateElnot(form))).toBe(true);
    });
  });

  it("does not decorate generic output", () => {
    const value = generateSyntheticId("SCONUM");
    expect(value).toMatch(/^[A-Z]\d{5}$/);
  });
});
