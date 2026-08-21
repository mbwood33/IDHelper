export type IdType = "SCONUM" | "BE" | "BE_OSUFFIX" | "SK" | "EQPCODE" | "CENOT" | "ELNOT";

export interface IdRecommendation {
  type: IdType;
  confidence: number;
  rationale: string;
  eqpPrefix?: string;
}

export interface Annotation {
  id: string;
  start: number;
  end: number;
  text: string;
  entityClass: string;
  possibleIdTypes: IdRecommendation[];
  source: "rule" | "model" | "merged" | "manual";
}

export interface AnalysisResult {
  annotations: Annotation[];
  mode?: "rules" | "local-ai";
  status?: string;
}

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
