import type { IdType } from "../domain/types";

/** Selects the downstream JSON schema displayed by the output panel. */
export type ReportJsonFormat = "legacy" | "records";

/**
 * A generated identifier attached to the exact annotation that produced it.
 *
 * `annotationId` is the stable grouping key. `name` is presentation data copied
 * from the report, while `type` and `value` describe the synthetic identifier.
 * Keeping this intermediate representation independent of either output schema
 * lets the UI switch formats without regenerating identifiers.
 */
export interface GeneratedIdentifier {
  annotationId: string;
  name: string;
  type: IdType;
  value: string;
}
/** Legacy object keys expected by the earlier grouped-array integration. */
export const LEGACY_OUTPUT_KEYS = [
  "SCONUM",
  "BE",
  "EQP_CODE",
] as const;

export type LegacyOutputKey = (typeof LEGACY_OUTPUT_KEYS)[number];
export type LegacyReportOutput = Record<LegacyOutputKey, string[]>;

/**
 * One entity-centric record. Identifier properties are optional because a
 * report entity may have only one generated identifier. Coordinates are part
 * of the agreed future-compatible schema but are omitted until supplied by a
 * later coordinate-entry/extraction feature.
 */
export interface EntityReportRecord {
  name: string;
  sconum?: string;
  be?: string;
  be_osuffix?: string;
  sk?: string;
  eqpcode?: string;
  cenot?: string;
  elnot?: string;
  latitude?: string;
  longitude?: string;
}

/** Converts the application's ID spelling to the legacy integration spelling. */
const LEGACY_KEY_BY_TYPE: Readonly<Partial<Record<IdType, LegacyOutputKey>>> = {
  SCONUM: "SCONUM",
  BE: "BE",
  EQPCODE: "EQP_CODE",
};

/** Converts each ID type to the lower-case property used by entity records. */
const RECORD_KEY_BY_TYPE: Readonly<Record<IdType, keyof Omit<EntityReportRecord, "name">>> = {
  SCONUM: "sconum",
  BE: "be",
  BE_OSUFFIX: "be_osuffix",
  SK: "sk",
  EQPCODE: "eqpcode",
  CENOT: "cenot",
  ELNOT: "elnot",
};

/**
 * Creates the old object-of-arrays payload.
 *
 * Input order is retained, duplicate values are removed within each ID type,
 * and all three keys in the supervisor-provided legacy contract are emitted.
 * A key with no generated value receives the legacy `[""]` placeholder rather
 * than an empty array. Types absent from that older schema are skipped.
 * A fresh object is returned so callers cannot mutate state accidentally.
 */
export function createLegacyReportOutput(
  identifiers: readonly GeneratedIdentifier[],
): LegacyReportOutput {
  const output = Object.fromEntries(
    LEGACY_OUTPUT_KEYS.map((key) => [key, [] as string[]]),
  ) as LegacyReportOutput;

  for (const identifier of identifiers) {
    const key = LEGACY_KEY_BY_TYPE[identifier.type];
    if (!key) continue;
    const values = output[key];
    if (!values.includes(identifier.value)) values.push(identifier.value);
  }

  for (const key of LEGACY_OUTPUT_KEYS) {
    if (output[key].length === 0) output[key].push("");
  }

  return output;
}

/**
 * Creates one record per annotation and combines multiple generated IDs for
 * the same entity. Regenerating an ID replaces that field before this function
 * is called, so a record contains at most one value for each identifier type.
 */
export function createEntityReportOutput(
  identifiers: readonly GeneratedIdentifier[],
): EntityReportRecord[] {
  const records = new Map<string, EntityReportRecord>();

  for (const identifier of identifiers) {
    const record = records.get(identifier.annotationId) ?? { name: identifier.name };
    record[RECORD_KEY_BY_TYPE[identifier.type]] = identifier.value;
    records.set(identifier.annotationId, record);
  }

  return [...records.values()];
}

/**
 * Escapes a complete JSON document so it can be inserted inside another JSON
 * string. JSON.stringify performs correct escaping for quotes, backslashes,
 * and control characters; slicing removes only the new outer string quotes to
 * match the downstream fragment convention: `[{\"name\":\"example\"}]`.
 */
export function escapeJsonForEmbedding(json: string): string {
  return JSON.stringify(json).slice(1, -1);
}

/**
 * Serializes generated identifiers for display and copying.
 *
 * Legacy output is ordinary compact JSON. Record output is intentionally an
 * escaped JSON fragment because the target system places it inside another
 * JSON string rather than consuming the array directly.
 */
export function serializeReportOutput(
  identifiers: readonly GeneratedIdentifier[],
  format: ReportJsonFormat,
): string {
  if (format === "legacy") {
    return JSON.stringify(createLegacyReportOutput(identifiers));
  }

  return escapeJsonForEmbedding(JSON.stringify(createEntityReportOutput(identifiers)));
}
