import type { CandidateAnnotation, IdType } from "./types";
import type { EqpCodePrefix } from "../domain/types";
import { mergeCandidates } from "./merge";

/** One possible identifier recommendation attached to a candidate span. */
type Option = CandidateAnnotation["possibleIdTypes"][number];

/** Maritime descriptors used as high-precision context for a following name. */
const vesselTerms = "vessel|ship|containership|barge|destroyer|frigate|craft|carrier";
/** Explicit facility endings used to avoid treating arbitrary capitalized text as a site. */
const facilityTerms = "terminal|installation|facility|base|airfield|port|site|plant";

/**
 * Build a safe, readable component for a deterministic candidate identifier.
 * This is not a security identifier: positions in the report make the full ID
 * unique within one analysis pass, and the slug only aids debugging/UI traces.
 */
function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Create one rule-origin candidate from an already-calculated exact span.
 * `start` and `end` are UTF-16 offsets into `report`; callers must maintain
 * the invariant that `report.slice(start, end)` is the intended visible text.
 */
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

/**
 * Convert compact rule-table tuples into the public recommendation schema.
 * The optional fourth value is used only for an EQPCODE prefix suggestion.
 */
function options(entries: Array<[IdType, number, string, EqpCodePrefix?]>): Option[] {
  return entries.map(([type, confidence, rationale, eqpPrefix]) => ({ type, confidence, rationale, ...(eqpPrefix ? { eqpPrefix } : {}) }));
}

/**
 * Low-cost, local-only candidate discovery. It intentionally prefers strong
 * linguistic context; it does not use blanks or classify generic "emissions"
 * as a signal.
 */
export function analyzeWithRules(report: string): CandidateAnnotation[] {
  // `found` may intentionally contain overlaps. `mergeCandidates` removes only
  // exact duplicates so a named vessel and a nearby platform descriptor can
  // both remain available for human review.
  const found: CandidateAnnotation[] = [];

  // Capture the proper-name portion following a maritime platform descriptor.
  // Group 1 is the candidate name, rather than the preceding generic noun.
  // It permits one to four title-cased/number tokens to cover names like STAX 1.
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
  // Make descriptor initials case-flexible while requiring the remainder to
  // match a known word. This supports normal prose without widening matches
  // to unrelated capitalized noun phrases.
  const facilityDescriptors = facilityTerms
    .split("|")
    .map((term) => `[${term[0].toUpperCase()}${term[0]}]${term.slice(1)}`)
    .join("|");
  const facility = new RegExp(`\\b((?:[A-Z][A-Za-z0-9'&.-]*\\s+){1,7}(?:${facilityDescriptors}))\\b`, "g");
  // "Port of X" is a special named-site construction that need not end in a
  // descriptor from `facilityTerms`.
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
  // This deliberately small dictionary favors reviewable precision over broad
  // noun extraction. The inferred prefix is only a starting UI selection.
  const equipment = /\b(?:ship-to-shore\s+)?(?:container\s+)?(?:gantry\s+)?crane\b|\b(?:radar|radio|communications?)\s+(?:system|set|suite)\b/gi;
  for (const match of report.matchAll(equipment)) {
    if (match.index === undefined) continue;
    const text = match[0];
    // Engineering (S), detection/radar (X), and communications (Y) are the
    // only deliberately inferred categories. The review panel can override it.
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

  // Merge rule duplicates before returning a deterministic, position-sorted
  // list. No network access, model invocation, report rewriting, or mutation
  // occurs anywhere in this rules-only path.
  return mergeCandidates(found);
}
