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

  it("matches every BE installation form emitted by generator-be.py", () => {
    expect(generateBeNumber("NUMERIC")).toMatch(/^\d{10}$/);
    expect(generateBeNumber("SINGLE_ALPHA")).toMatch(/^\d{4}[A-Z]\d{5}$/);
    expect(generateBeNumber("ALPHANUMERIC")).toMatch(/^\d{4}[A-Z]{2}\d{4}$/);
    expect(generateBeNumber("DASHED")).toMatch(/^\d{4}-\d{5}$/);
    expect(generateBeNumber("DASHED_ALPHA")).toMatch(/^\d{4}-[A-Z]\d{4}$/);
  });

  it("matches every BE/OSUFFIX joiner emitted by generator-be.py", () => {
    (["", "/", "-", " "] as const).forEach((joiner) => {
      const value = generateBeNumberWithOsuffix("ALPHANUMERIC", joiner);
      expect(value).toMatch(new RegExp(`^\\d{4}[A-Z]{2}\\d{4}${joiner === "" ? "" : `\\${joiner}`}[A-Z]{2}\\d{3}$`));
      expect(isValidSyntheticId("BE_OSUFFIX", value)).toBe(true);
    });
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
