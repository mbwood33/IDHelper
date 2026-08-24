import { describe, expect, it } from "vitest";
import { createManualAnnotation } from "./manual";

describe("createManualAnnotation", () => {
  const report = "The missed platform Kestrel entered the terminal.";
  const start = report.indexOf("Kestrel");

  it("creates an exact manual span with user-selected ID types", () => {
    const annotation = createManualAnnotation(report, {
      id: "manual-1",
      start,
      end: start + "Kestrel".length,
      entityClass: "vessel",
      idTypes: ["SCONUM", "SK", "SCONUM"],
    });

    expect(annotation).toMatchObject({
      id: "manual-1",
      text: "Kestrel",
      start,
      end: start + 7,
      entityClass: "vessel",
      source: "manual",
    });
    expect(annotation?.possibleIdTypes.map((item) => item.type)).toEqual(["SCONUM", "SK"]);
    expect(report).toBe("The missed platform Kestrel entered the terminal.");
  });

  it("requires an approved EQPCODE prefix", () => {
    const base = { id: "manual-eqp", start, end: start + 7, entityClass: "equipment", idTypes: ["EQPCODE" as const] };
    expect(createManualAnnotation(report, { ...base, eqpPrefix: "X" })?.possibleIdTypes[0].eqpPrefix).toBe("X");
    expect(createManualAnnotation(report, { ...base, eqpPrefix: "I" })).toBeNull();
  });

  it("rejects invalid, blank, and underscore spans", () => {
    expect(createManualAnnotation(report, { id: "bad", start: -1, end: 2, entityClass: "vessel", idTypes: ["SK"] })).toBeNull();
    expect(createManualAnnotation("A _____ B", { id: "bad", start: 2, end: 7, entityClass: "vessel", idTypes: ["SK"] })).toBeNull();
    expect(createManualAnnotation(report, { id: "bad", start, end: start + 7, entityClass: "vessel", idTypes: [] })).toBeNull();
  });
});
