/**
 * Closed runtime list of identifier families supported by IDHelper.
 *
 * This constant is deliberately the single source of truth used by validation,
 * generation, UI selection, and imported data. `as const` keeps its values as
 * string literals rather than widening them to `string`.
 */
export const ID_TYPES = [
  "SCONUM",
  "BE",
  "BE_OSUFFIX",
  "SK",
  "EQPCODE",
  "CENOT",
  "ELNOT",
] as const;

/** Union of the permitted identifier-family strings derived from `ID_TYPES`. */
export type IdType = (typeof ID_TYPES)[number];

/** Provenance values explaining how a candidate annotation was obtained. */
export const CANDIDATE_SOURCES = ["rule", "model", "merged", "manual"] as const;
/** Union of valid candidate provenance strings. */
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

/**
 * A single identifier-family recommendation for an annotated text span.
 * Analyzer-provided instances are untrusted until `isValidCandidateAnnotation`
 * checks the confidence, ID type, and optional equipment prefix.
 */
export interface PossibleIdType {
  /** Suggested identifier family. */
  type: IdType;
  confidence: number;
  rationale: string;
  /** Untrusted analyzer input is validated against the approved taxonomy. */
  eqpPrefix?: string;
}

/**
 * Exact, source-preserving candidate returned by an analyzer or created by a
 * user. `start` is inclusive and `end` is exclusive, matching `slice`.
 */
export interface CandidateAnnotation {
  /** Stable identifier used to select, merge, and persist this candidate. */
  id: string;
  start: number;
  end: number;
  text: string;
  entityClass: EntityClass;
  possibleIdTypes: PossibleIdType[];
  source: CandidateSource;
}

/** Configurable mapping from an entity class to its initial ID suggestions. */
export interface EntityIdPolicy {
  entityClass: EntityClass;
  possibleIdTypes: IdType[];
  description: string;
}

/** Approved leading EQPCODE category characters; notably excludes `I`. */
export const EQPCODE_PREFIXES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N",
  "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "9",
] as const;
export type EqpCodePrefix = (typeof EQPCODE_PREFIXES)[number];

/** Allowed CENOT templates, where X means A-Z and 0 means 0-9. */
export const SIGNOT_FORMS = ["XX000", "X000X", "X0000", "00000"] as const;
export type CenotForm = (typeof SIGNOT_FORMS)[number];
/** Allowed ELNOT templates, ordered independently from CENOT weighting. */
export const ELNOT_FORMS = ["X000X", "X0000", "00000"] as const;
export type ElnotForm = (typeof ELNOT_FORMS)[number];

/** Approved BE shapes implemented by the current reference-based generator. */
export type BeNumberForm = "ALPHANUMERIC" | "DASHED";
/** Approved EQPCODE suffix shapes, excluding the category prefix. */
export type EqpCodeBodyForm = "XXXX" | "XXX0" | "XX00";

/**
 * Optional constraints for synthetic generation. Omitted fields use the
 * reference-generator probability distributions; supplied fields force a
 * particular valid shape without consulting a real identifier registry.
 */
export interface GenerateIdOptions {
  beForm?: BeNumberForm;
  includeOsuffix?: boolean;
  eqpPrefix?: EqpCodePrefix;
  eqpBodyForm?: EqpCodeBodyForm;
  cenotForm?: CenotForm;
  elnotForm?: ElnotForm;
}
