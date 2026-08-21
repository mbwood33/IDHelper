import { describe, expect, it } from "vitest";
import { analyzeWithRules } from "./rules";

const EXAMPLE = "On June 2, 2024, about 1649 local time, the emissions control barge STAX 1 was capturing emissions from the containership Erving at the Fenix Marine Services Container Terminal in the Port of Los Angeles, Los Angeles, California, when a ship-to-shore container crane struck the barge's capture and control articulated arm.";

describe("analyzeWithRules", () => {
  it("finds documented plausible candidates while excluding generic emissions", () => {
    const candidates = analyzeWithRules(EXAMPLE);
    const byText = new Map(candidates.map((item) => [item.text, item]));
    expect(byText.get("STAX 1")?.possibleIdTypes.map((item) => item.type)).toEqual(["SCONUM", "SK"]);
    expect(byText.get("Erving")?.possibleIdTypes.map((item) => item.type)).toEqual(["SCONUM", "SK"]);
    expect([...byText.keys()].some((text) => text.toLowerCase() === "emissions")).toBe(false);
    expect(candidates.some((item) => item.text === "Fenix Marine Services Container Terminal" && item.possibleIdTypes[0].type === "BE")).toBe(true);
    expect(candidates.some((item) => item.text === "ship-to-shore container crane" && item.possibleIdTypes.some((type) => type.type === "EQPCODE" && type.eqpPrefix === "S"))).toBe(true);
  });
});
