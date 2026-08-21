import type { CandidateAnnotation, IdType } from "./types";
import type { EqpCodePrefix } from "../domain/types";
import { mergeCandidates } from "./merge";

type Option = CandidateAnnotation["possibleIdTypes"][number];

const vesselTerms = "vessel|ship|containership|barge|destroyer|frigate|craft|carrier";
const facilityTerms = "terminal|installation|facility|base|airfield|port|site|plant";

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function candidate(
  report: string,
  start: number,
  end: number,
  entityClass: string,
  possibleIdTypes: Option[],
  key: string,
): CandidateAnnotation {
  const text = report.slice(start, end);
  return { id: `rule-${key}-${start}-${end}-${slug(text)}`, start, end, text, entityClass, possibleIdTypes, source: "rule" };
}

function options(entries: Array<[IdType, number, string, EqpCodePrefix?]>): Option[] {
  return entries.map(([type, confidence, rationale, eqpPrefix]) => ({ type, confidence, rationale, ...(eqpPrefix ? { eqpPrefix } : {}) }));
}

/**
 * Low-cost, local-only candidate discovery. It intentionally prefers strong
 * linguistic context; it does not use blanks or classify generic "emissions"
 * as a signal.
 */
export function analyzeWithRules(report: string): CandidateAnnotation[] {
  const found: CandidateAnnotation[] = [];

  // Capture the proper-name portion following a maritime platform descriptor.
  const vesselName = new RegExp(`\\b(?:${vesselTerms})\\s+((?:[A-Z][A-Za-z0-9'-]*|[0-9]+)(?:\\s+(?:[A-Z][A-Za-z0-9'-]*|[0-9]+)){0,3})`, "g");
  for (const match of report.matchAll(vesselName)) {
    const text = match[1];
    if (!text || match.index === undefined) continue;
    const start = match.index + match[0].lastIndexOf(text);
    found.push(candidate(report, start, start + text.length, "named-vessel", options([
      ["SCONUM", 0.87, "Named platform follows a maritime descriptor."],
      ["SK", 0.62, "Named platform may be indexed in MIDB."],
    ]), "vessel"));
  }

  // Capitalized facility names ending in an explicit facility descriptor.
  const facilityDescriptors = facilityTerms
    .split("|")
    .map((term) => `[${term[0].toUpperCase()}${term[0]}]${term.slice(1)}`)
    .join("|");
  const facility = new RegExp(`\\b((?:[A-Z][A-Za-z0-9'&.-]*\\s+){1,7}(?:${facilityDescriptors}))\\b`, "g");
  const portOf = /\b(Port of (?:[A-Z][A-Za-z0-9'&.-]*(?:\s+|$)){1,5})/g;
  for (const match of [...report.matchAll(facility), ...report.matchAll(portOf)]) {
    const text = match[1];
    if (!text || match.index === undefined) continue;
    // A bare generic descriptor is too weak, except an explicitly named Port of X.
    const hasName = /\s/.test(text);
    if (!hasName) continue;
    found.push(candidate(report, match.index, match.index + text.length, "facility", options([
      ["BE", 0.83, "Named facility or site ending in a facility descriptor."],
      ["BE_OSUFFIX", 0.56, "Facility may use a BE Number with O-suffix."],
      ["SK", 0.48, "Facility may be indexed in MIDB."],
    ]), "facility"));
  }

  // Precise equipment phrases. Category inference is deliberately conservative.
  const equipment = /\b(?:ship-to-shore\s+)?(?:container\s+)?(?:gantry\s+)?crane\b|\b(?:radar|radio|communications?)\s+(?:system|set|suite)\b/gi;
  for (const match of report.matchAll(equipment)) {
    if (match.index === undefined) continue;
    const text = match[0];
    const prefix = /crane/i.test(text) ? "S" : /radar/i.test(text) ? "X" : "Y";
    found.push(candidate(report, match.index, match.index + text.length, "equipment", options([
      ["EQPCODE", 0.68, "Specific equipment phrase; category can be reviewed before generation.", prefix],
      ["SK", 0.36, "Specific equipment may be indexed in MIDB."],
    ]), "equipment"));
  }

  // Signal candidates require an identifiable signal/emitter/system, not a generic activity word.
  const signal = /\b(?:[A-Z][A-Za-z0-9-]*\s+)?(?:communications?\s+(?:emitter|signal|transmission)|(?:radar|electronic)\s+(?:emitter|signal))\b/g;
  for (const match of report.matchAll(signal)) {
    if (match.index === undefined) continue;
    const text = match[0];
    const communications = /communication/i.test(text);
    found.push(candidate(report, match.index, match.index + text.length, communications ? "communications-signal" : "electronic-signal", options(
      communications
        ? [["CENOT", 0.7, "Specific communications signal or emitter phrase."], ["SK", 0.3, "Signal entity may be indexed in MIDB."]]
        : [["ELNOT", 0.7, "Specific electronic signal or emitter phrase."], ["SK", 0.3, "Signal entity may be indexed in MIDB."]],
    ), "signal"));
  }

  return mergeCandidates(found);
}
