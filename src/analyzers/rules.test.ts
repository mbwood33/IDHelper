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

  it("handles named maritime platforms across recurring report styles", () => {
    const report = "The towing vessel Josset _____ met the bulk carrier Clara B _____ after M/V POMERENIA SKY _____ departed.";
    const candidates = analyzeWithRules(report);
    for (const name of ["Josset", "Clara B", "POMERENIA SKY"]) {
      expect(candidates.some((item) => item.text === name && item.possibleIdTypes[0].type === "SCONUM")).toBe(true);
    }
    expect(candidates.some((item) => item.text.includes("_") || item.text === "departed")).toBe(false);
  });

  it("separates a maritime class from its named instance", () => {
    const candidates = analyzeWithRules("The containership Erving entered port.");
    expect(candidates.some((item) => item.text === "Erving" && item.entityClass === "vessel")).toBe(true);
    expect(candidates.some((item) => item.text === "containership" && item.possibleIdTypes.some((type) => type.type === "EQPCODE" && type.eqpPrefix === "G"))).toBe(true);
  });

  it("finds aviation models and facilities without relying on blanks", () => {
    const report = "A Cessna 208B airplane _____ landed at Salt Lake City International Airport _____ while a Sikorsky UH-60L helicopter waited at Ketchikan Harbor Seaplane Base.";
    const candidates = analyzeWithRules(report);
    expect(candidates.some((item) => item.text === "Cessna 208B" && item.possibleIdTypes[0].eqpPrefix === "A")).toBe(true);
    expect(candidates.some((item) => item.text === "Sikorsky UH-60L" && item.possibleIdTypes[0].eqpPrefix === "B")).toBe(true);
    expect(candidates.some((item) => item.text === "Salt Lake City International Airport" && item.possibleIdTypes[0].type === "BE")).toBe(true);
    expect(candidates.some((item) => item.text === "Ketchikan Harbor Seaplane Base" && item.possibleIdTypes[0].type === "BE")).toBe(true);
  });

  it("finds bridges, bases, crossings, and transport models", () => {
    const report = "A 2004 International box truck struck the Vicksburg Highway 80 Bridge near US Coast Guard Base Galveston and the South Rice Avenue grade crossing.";
    const candidates = analyzeWithRules(report);
    expect(candidates.some((item) => item.text === "2004 International box truck" && item.possibleIdTypes[0].eqpPrefix === "Q")).toBe(true);
    for (const facility of ["Vicksburg Highway 80 Bridge", "US Coast Guard Base Galveston", "South Rice Avenue grade crossing"]) {
      expect(candidates.some((item) => item.text === facility && item.possibleIdTypes[0].type === "BE")).toBe(true);
    }
  });

  it("keeps generic unnamed instances and event words out", () => {
    const candidates = analyzeWithRules("A vessel _____ reported emissions while an aircraft landed near a facility.");
    expect(candidates.some((item) => ["vessel", "aircraft", "facility", "emissions"].includes(item.text.toLowerCase()))).toBe(false);
  });
});
