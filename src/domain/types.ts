/** Identifier families supported by IDHelper. */
export const ID_TYPES = [
  "SCONUM",
  "BE",
  "BE_OSUFFIX",
  "SK",
  "EQPCODE",
  "CENOT",
  "ELNOT",
] as const;

export type IdType = (typeof ID_TYPES)[number];

export const CANDIDATE_SOURCES = ["rule", "model", "merged", "manual"] as const;
export type CandidateSource = (typeof CANDIDATE_SOURCES)[number];

/**
 * These are application-provided labels. Custom policy may use another string
 * so that feedback can evolve without a code release.
 */
export type DefaultEntityClass =
  | "vessel"
  | "facility"
  | "equipment"
  | "communications-signal"
  | "electronic-signal"
  | "indexed-entity";
export type EntityClass = DefaultEntityClass | (string & {});

export interface PossibleIdType {
  type: IdType;
  confidence: number;
  rationale: string;
  /** Untrusted analyzer input is validated against the approved taxonomy. */
  eqpPrefix?: string;
}

export interface CandidateAnnotation {
  id: string;
  start: number;
  end: number;
  text: string;
  entityClass: EntityClass;
  possibleIdTypes: PossibleIdType[];
  source: CandidateSource;
}

export interface EntityIdPolicy {
  entityClass: EntityClass;
  possibleIdTypes: IdType[];
  description: string;
}

export const EQPCODE_PREFIXES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "9",
] as const;
export type EqpCodePrefix = (typeof EQPCODE_PREFIXES)[number];

export const SIGNOT_FORMS = ["XX000", "X000X", "X0000", "00000"] as const;
export type CenotForm = (typeof SIGNOT_FORMS)[number];
export const ELNOT_FORMS = ["X000X", "X0000", "00000"] as const;
export type ElnotForm = (typeof ELNOT_FORMS)[number];

export type BeNumberForm = "ALPHANUMERIC" | "DASHED";
export type BeOsuffixJoiner = "" | "/" | "-" | " ";
export type EqpCodeBodyForm = "XXXX" | "XXX0" | "XX00";

export interface GenerateIdOptions {
  beForm?: BeNumberForm;
  beOsuffixJoiner?: BeOsuffixJoiner;
  includeOsuffix?: boolean;
  eqpPrefix?: EqpCodePrefix;
  eqpBodyForm?: EqpCodeBodyForm;
  cenotForm?: CenotForm;
  elnotForm?: ElnotForm;
}
