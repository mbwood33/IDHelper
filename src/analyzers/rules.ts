import type { CandidateAnnotation, IdType } from "./types";
import type { EqpCodePrefix } from "../domain/types";
import { mergeCandidates } from "./merge";

type Option = CandidateAnnotation["possibleIdTypes"][number];

const PROPER_TOKEN = String.raw`[A-Z0-9][A-Za-z0-9'’&./-]*`;
const PROPER_NAME = String.raw`${PROPER_TOKEN}(?:\s+(?:(?:of|the|and)\s+)?${PROPER_TOKEN}){0,9}`;
const SHORT_PROPER_NAME = String.raw`${PROPER_TOKEN}(?:\s+(?:(?:of|the|and)\s+)?${PROPER_TOKEN}){0,4}`;
const MARITIME_DESCRIPTOR = String.raw`(?:motor\s+vessel|towing\s+vessel|offshore\s+supply\s+vessel|fishing\s+vessel|cargo\s+vessel|merchant\s+vessel|container\s+ship|cargo\s+ship|general\s+cargo\s+ship|cruise\s+ship|bulk\s+carrier|aircraft\s+carrier|product\s+tanker|chemical\s+tanker|oil\s+tanker|LNG\s+tanker|LPG\s+tanker|patrol\s+boat|fishing\s+(?:boat|dhow)|containership|pipelayer|towboat|tugboat|destroyer|frigate|cruiser|dredge|tanker|carrier|ferry|barge|vessel|ship|yacht|catamaran|dhow|tug|craft)`;

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function candidate(report: string, start: number, end: number, entityClass: string, possibleIdTypes: Option[], key: string): CandidateAnnotation {
  const text = report.slice(start, end);
  return { id: `rule-${key}-${start}-${end}-${slug(text)}`, start, end, text, entityClass, possibleIdTypes, source: "rule" };
}

function options(entries: Array<[IdType, number, string, EqpCodePrefix?]>): Option[] {
  return entries.map(([type, confidence, rationale, eqpPrefix]) => ({ type, confidence, rationale, ...(eqpPrefix ? { eqpPrefix } : {}) }));
}

function addCandidate(found: CandidateAnnotation[], report: string, start: number, end: number, entityClass: string, possibleIdTypes: Option[], key: string): void {
  if (start < 0 || end <= start) return;
  const text = report.slice(start, end);
  if (!text.trim() || /_/.test(text)) return;
  found.push(candidate(report, start, end, entityClass, possibleIdTypes, key));
}

function equipmentOptions(prefix: EqpCodePrefix, confidence: number, rationale: string): Option[] {
  return options([
    ["EQPCODE", confidence, rationale, prefix],
    ["SK", 0.34, "This specific equipment type or model may be indexed in MIDB."],
  ]);
}

function maritimePrefix(text: string): EqpCodePrefix {
  if (/\b(?:destroyer|frigate|cruiser|aircraft carrier)\b/i.test(text)) return "C";
  if (/\b(?:patrol boat|craft)\b/i.test(text)) return "D";
  if (/\b(?:offshore supply vessel|pipelayer|dredge)\b/i.test(text)) return "E";
  if (/\b(?:tug|towboat|barge|ferry)\b/i.test(text)) return "F";
  return "G";
}

/**
 * Low-cost, local-only candidate discovery. Vocabulary comes from recurring
 * report families, but underscore blanks are never used as labels. Replacing
 * them with equal-length spaces only preserves phrases and exact offsets.
 */
export function analyzeWithRules(report: string): CandidateAnnotation[] {
  const found: CandidateAnnotation[] = [];
  const analysisText = report.replace(/_+/g, (blank) => " ".repeat(blank.length));

  const vesselName = new RegExp(String.raw`\b(?:M\/?V|S\/?V|${MARITIME_DESCRIPTOR})\s+(${SHORT_PROPER_NAME}(?:,\s+(?:Jr|Sr)\.?)?)`, "g");
  const genericNames = /^(?:A|An|The|Unknown|Unidentified|Another|Multiple|Several)$/i;
  for (const match of analysisText.matchAll(vesselName)) {
    const text = match[1]?.trim();
    if (!text || match.index === undefined || genericNames.test(text)) continue;
    const start = match.index + match[0].lastIndexOf(text);
    addCandidate(found, report, start, start + text.length, "vessel", options([
      ["SCONUM", 0.88, "A proper name follows a maritime platform descriptor."],
      ["SK", 0.62, "A named maritime platform may be indexed in MIDB."],
    ]), "vessel");
  }

  const facilitySuffix = String.raw`(?:International\s+Airport|Regional\s+Airport|Municipal\s+Airport|Seaplane\s+Base|Air\s+Base|Naval\s+Base|Railroad\s+Bridge|Highway\s+Bridge|[Gg]rade\s+[Cc]rossing|Container\s+Terminal|Airport|Airfield|Base|Bridge|Terminal|Installation|Facility|Plant|Refinery|Shipyard|Arsenal|Station|Depot|Dam|Dock|Anchorage|Port|Site)`;
  const facility = new RegExp(String.raw`\b(${PROPER_NAME}\s+${facilitySuffix})\b`, "g");
  const facilityOptions = options([
    ["BE", 0.84, "A proper name ends in a facility or infrastructure descriptor."],
    ["BE_OSUFFIX", 0.57, "A facility may use a BE Number with an O-suffix for a sub-installation."],
    ["SK", 0.48, "A named facility may be indexed in MIDB."],
  ]);
  for (const match of analysisText.matchAll(facility)) {
    const rawText = match[1]?.trim();
    if (!rawText || match.index === undefined) continue;
    const text = rawText.replace(/^(?:The|the)\s+/, "");
    if (!/\s/.test(text)) continue;
    const start = match.index + match[0].indexOf(rawText) + (rawText.length - text.length);
    addCandidate(found, report, start, start + text.length, "facility", facilityOptions, "facility");
  }

  const descriptorLedFacility = /\b((?:Port\s+of|Base)\s+[A-Z0-9][A-Za-z0-9'’&.-]*(?:\s+(?:(?:of|the|and)\s+)?[A-Z0-9][A-Za-z0-9'’&.-]*){0,5})\b/g;
  for (const match of analysisText.matchAll(descriptorLedFacility)) {
    const text = match[1];
    if (!text || match.index === undefined) continue;
    addCandidate(found, report, match.index, match.index + text.length, "facility", facilityOptions, "facility-led");
  }

  const namedBaseLocation = new RegExp(String.raw`\b(${PROPER_NAME}\s+Base\s+${PROPER_TOKEN}(?:\s+${PROPER_TOKEN}){0,2})\b`, "g");
  for (const match of analysisText.matchAll(namedBaseLocation)) {
    const text = match[1]?.trim();
    if (!text || match.index === undefined) continue;
    addCandidate(found, report, match.index, match.index + text.length, "facility", facilityOptions, "base-location");
  }

  const aircraftModel = new RegExp(String.raw`\b((?:${PROPER_TOKEN}\s+){0,5}[A-Z0-9][A-Za-z0-9./-]*(?:\s+[A-Z0-9][A-Za-z0-9./-]*){0,2})\s+(airplane|aircraft|helicopter)\b`, "g");
  for (const match of analysisText.matchAll(aircraftModel)) {
    const rawText = match[1]?.trim();
    if (!rawText || match.index === undefined) continue;
    const text = rawText.replace(/^(?:A|An|The)\s+/, "");
    if (/^(?:former|military)$/i.test(text)) continue;
    const start = match.index + match[0].indexOf(rawText) + (rawText.length - text.length);
    const prefix: EqpCodePrefix = match[2].toLowerCase() === "helicopter" || /\b(?:UH-|HH-|AH-|CH-|SH-|AS350|EC\d|Sikorsky)\b/i.test(text) ? "B" : "A";
    addCandidate(found, report, start, start + text.length, "equipment", equipmentOptions(prefix, 0.84, `A specific ${match[2].toLowerCase()} model; suggested ${prefix} category.`), "aircraft-model");
  }

  const standaloneAircraft = /\b((?:Boeing|Airbus|Cessna|Embraer|Learjet|Gulfstream|Sikorsky|Bombardier|Beechcraft|Piper|Lockheed|McDonnell Douglas|de Havilland)\s+[A-Z0-9][A-Za-z0-9./-]*(?:\s+[A-Z0-9][A-Za-z0-9./-]*){0,2})\b/g;
  for (const match of analysisText.matchAll(standaloneAircraft)) {
    const text = match[1];
    if (!text || match.index === undefined) continue;
    const prefix: EqpCodePrefix = /^(?:Sikorsky)\b|\b(?:UH-|HH-|AH-|CH-|SH-|AS350|EC\d)\b/i.test(text) ? "B" : "A";
    addCandidate(found, report, match.index, match.index + text.length, "equipment", equipmentOptions(prefix, 0.82, `Recognized aircraft manufacturer and model; suggested ${prefix} category.`), "aircraft-known");
  }

  const transportModel = /\b((?:(?:19|20)\d{2}\s+)?(?:[A-Z][A-Za-z0-9-]*\s+){1,4}(?:truck-tractor|box\s+truck|service\s+truck|passenger\s+car|motorcoach|automobile|locomotive|train))\b/g;
  for (const match of analysisText.matchAll(transportModel)) {
    const text = match[1];
    if (!text || match.index === undefined) continue;
    const prefix: EqpCodePrefix = /locomotive|train/i.test(text) ? "L" : /service\s+truck|truck-tractor/i.test(text) ? "R" : "Q";
    addCandidate(found, report, match.index, match.index + text.length, "equipment", equipmentOptions(prefix, 0.72, `Specific transport equipment; suggested ${prefix} category.`), "transport-model");
  }

  const maritimeClass = new RegExp(String.raw`\b${MARITIME_DESCRIPTOR}\b`, "gi");
  for (const match of analysisText.matchAll(maritimeClass)) {
    if (match.index === undefined) continue;
    const text = match[0];
    if (/^(?:ship|vessel|craft|carrier|barge)$/i.test(text)) continue;
    const prefix = maritimePrefix(text);
    addCandidate(found, report, match.index, match.index + text.length, "equipment", equipmentOptions(prefix, 0.66, `Maritime platform class; suggested ${prefix} category.`), "maritime-class");
  }

  const typedEquipment: Array<{ pattern: RegExp; prefix: EqpCodePrefix; rationale: string }> = [
    { pattern: /\b(?:ship-to-shore\s+)?(?:container\s+)?(?:gantry\s+)?crane\b/gi, prefix: "S", rationale: "Engineering or material-handling equipment." },
    { pattern: /\b(?:[A-Z0-9][A-Za-z0-9/-]+\s+)?(?:radar|electronic\s+warfare)(?:\s+(?:system|set|suite))?\b/g, prefix: "X", rationale: "Radar, electronic-warfare, or remote-detection equipment." },
    { pattern: /\b(?:radio|communications?|data-processing)\s+(?:system|set|suite|equipment)\b/gi, prefix: "Y", rationale: "Communications or data-processing equipment." },
    { pattern: /\b(?:engine|propulsion\s+system|turbine)\b/gi, prefix: "J", rationale: "Engine or propulsion equipment." },
    { pattern: /\b(?:anti-ship\s+)?(?:ballistic\s+|cruise\s+)?missile(?:\s+launcher)?s?\b/gi, prefix: "Z", rationale: "Missile or ammunition equipment class." },
  ];
  for (const definition of typedEquipment) {
    for (const match of analysisText.matchAll(definition.pattern)) {
      if (match.index === undefined) continue;
      const prefix = /launcher/i.test(match[0]) ? "V" : definition.prefix;
      addCandidate(found, report, match.index, match.index + match[0].length, "equipment", equipmentOptions(prefix, 0.68, `${definition.rationale} Suggested ${prefix} category.`), "equipment");
    }
  }

  const signal = /\b(?:[A-Z0-9][A-Za-z0-9/-]*\s+)?(?:communications?\s+(?:emitter|signal|transmission)|(?:radar|electronic)\s+(?:emitter|signal))\b/g;
  for (const match of analysisText.matchAll(signal)) {
    if (match.index === undefined) continue;
    const communications = /communication/i.test(match[0]);
    addCandidate(found, report, match.index, match.index + match[0].length, communications ? "communications-signal" : "electronic-signal", options(
      communications
        ? [["CENOT", 0.7, "Specific communications signal or emitter phrase."], ["SK", 0.3, "Signal entity may be indexed in MIDB."]]
        : [["ELNOT", 0.7, "Specific electronic signal or emitter phrase."], ["SK", 0.3, "Signal entity may be indexed in MIDB."]],
    ), "signal");
  }

  return mergeCandidates(found);
}
