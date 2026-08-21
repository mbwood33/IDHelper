import { describe, expect, it } from "vitest";
import { compareLegacyBlanks, normalizeReport } from "./normalize";

describe("normalizeReport", () => {
  it("preserves source offsets while hiding variable underscore blanks", () => {
    const original = "vessel ____ Erving __";
    const result = normalizeReport(original);
    expect(result.analysisText).toBe("vessel      Erving   ");
    expect(result.analysisText).toHaveLength(original.length);
    expect(result.legacyBlanks).toEqual([
      { start: 7, end: 11, text: "____" },
      { start: 19, end: 21, text: "__" },
    ]);
  });

  it("does not use blanks as annotation evidence", () => {
    const blanks = normalizeReport("__ text ____").legacyBlanks;
    expect(compareLegacyBlanks(blanks, [{ id: "a", start: 3, end: 7 }])).toEqual([
      { blank: blanks[0], status: "possibly-misplaced", candidateIds: ["a"] },
      { blank: blanks[1], status: "possibly-misplaced", candidateIds: ["a"] },
    ]);
  });
});
