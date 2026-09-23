/** All identifier families the UI can display, generate, and export. */
export type IdType = "SCONUM" | "BE" | "BE_OSUFFIX" | "SK" | "EQPCODE" | "CENOT" | "ELNOT";

/** A proposed identifier family for one exact annotation span. */
export interface IdRecommendation {
  /** Identifier family selected by the analyzer or a human reviewer. */
  type: IdType;
  /** Analyzer confidence in the closed range 0–1; manual edits use 1. */
  confidence: number;
  /** Human-readable evidence explaining why this type was suggested. */
  rationale: string;
  /** Optional EQPCODE category prefix recommended for equipment only. */
  eqpPrefix?: string;
}

/**
 * A read-only substring of a report with one or more possible identifier
 * families. `start` and `end` use JavaScript string offsets, with `end`
 * exclusive, so the UI can verify `report.slice(start, end) === text`.
 */
export interface Annotation {
  /** Stable identity used for React keys and currently selected state. */
  id: string;
  /** Inclusive starting offset of `text` in the original report. */
  start: number;
  /** Exclusive ending offset of `text` in the original report. */
  end: number;
  /** Exact report substring; never rewritten by presentation components. */
  text: string;
  /** Analyzer/user label describing the entity represented by `text`. */
  entityClass: string;
  /** One or more possible IDs shown in the review panel. */
  possibleIdTypes: IdRecommendation[];
  /** Provenance, exposed to users so automated suggestions remain inspectable. */
  source: "rule" | "model" | "merged" | "manual";
}

/** Result returned by either the deterministic rules or local-AI analyzer. */
export interface AnalysisResult {
  /** Candidates validated against the source report before UI rendering. */
  annotations: Annotation[];
  /** Optional implementation mode that produced the annotations. */
  mode?: "rules" | "local-ai";
  /** Optional status message suitable for a non-blocking UI update. */
  status?: string;
}

/**
 * Approved EQPCODE prefix/description pairs. Components render these instead
 * of accepting arbitrary user-entered prefixes, avoiding invalid `I` prefixes.
 */
export const EQP_PREFIXES: Array<[string, string]> = [
  ["A", "Aircraft - Fixed Wing"], ["B", "Aircraft - Rotary Wing"],
  ["C", "Naval Ships - Combatant Ship"], ["D", "Naval Ships - Combatant Craft"],
  ["E", "Naval Ships - Auxiliary Ship"], ["F", "Naval Ships - Support Craft"],
  ["G", "Merchant / Fishing / Research / Special-purpose Ships"], ["H", "Optics"],
  ["J", "Engines & Propulsion Systems"], ["K", "Space Objects & Launch Vehicles"],
  ["L", "Associated / Miscellaneous Equipment"], ["M", "Antitank Weapons"],
  ["N", "Armored Vehicles"], ["O", "Mortars"], ["P", "Tanks"],
  ["Q", "General Purpose Vehicles"], ["R", "Special Purpose Vehicles"],
  ["S", "Engineering Equipment"], ["T", "Air Defense Weapons"],
  ["U", "Field Artillery / Torpedo Tubes"], ["V", "Surface-to-Surface Missile Launchers"],
  ["W", "Small Arms"], ["X", "Radars / Electronic Warfare / Remote Detection"],
  ["Y", "Communications & ADP Equipment"], ["Z", "Missiles / Ammunition"],
  ["9", "File Administrative Entries"],
];
