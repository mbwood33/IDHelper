import type { CandidateAnnotation, IdType } from "../domain";

/** Selects the downstream JSON contract produced by the export panel. */
export type GeneratedJsonFormat = "legacy" | "records";

/** One generated synthetic identifier plus its explicit export opt-in state. */
export interface GeneratedIdentifierState {
  value: string;
  included: boolean;
}

/** Generated values keyed first by annotation ID and then by identifier family. */
export type GeneratedIdentifiersByAnnotation = Record<
  string,
  Partial<Record<IdType, GeneratedIdentifierState>>
>;

/** Exact legacy schema expected by the existing downstream integration. */
export interface LegacyGeneratedIdJson {
  SCONUM: string[];
  BE: string[];
  EQP_CODE: string[];
}

/** Required legacy property order; downstream examples and snapshots rely on it. */
const LEGACY_JSON_KEYS: readonly (keyof LegacyGeneratedIdJson)[] = ["SCONUM", "BE", "EQP_CODE"];

/** One entity-centric record used by the proposed supervisor output contract. */
export interface GeneratedEntityRecord {
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

/** Internal normalized value retaining the source annotation and ID family. */
interface IncludedIdentifier {
  annotation: CandidateAnnotation;
  type: IdType;
  value: string;
}

/** Maps application ID names to the lower-case entity-record property names. */
const RECORD_KEY_BY_TYPE: Readonly<Record<IdType, keyof Omit<GeneratedEntityRecord, "name">>> = {
  SCONUM: "sconum",
  BE: "be",
  BE_OSUFFIX: "be_osuffix",
  SK: "sk",
  EQPCODE: "eqpcode",
  CENOT: "cenot",
  ELNOT: "elnot",
};

/**
 * Collect included, non-empty generated values in report and recommendation
 * order. Stale values are ignored if their type is no longer recommended by
 * the annotation, preventing old review state from leaking into an export.
 */
function collectIncludedIdentifiers(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): IncludedIdentifier[] {
  const result: IncludedIdentifier[] = [];
  const ordered = [...annotations].sort((left, right) => left.start - right.start || left.end - right.end);

  for (const annotation of ordered) {
    for (const recommendation of annotation.possibleIdTypes) {
      const item = generated[annotation.id]?.[recommendation.type];
      if (!item?.included || !item.value) continue;
      result.push({ annotation, type: recommendation.type, value: item.value });
    }
  }

  return result;
}

/**
 * Builds the prior object-of-arrays contract. BE+OSUFFIX is grouped under BE,
 * EQPCODE is renamed to EQP_CODE, and unsupported legacy families are skipped.
 * Every required key receives `[""]` when it has no generated value.
 */
export function buildGeneratedIdJsonObject(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): LegacyGeneratedIdJson {
  const result: LegacyGeneratedIdJson = { SCONUM: [], BE: [], EQP_CODE: [] };

  for (const item of collectIncludedIdentifiers(annotations, generated)) {
    if (item.type === "SCONUM") result.SCONUM.push(item.value);
    else if (item.type === "BE" || item.type === "BE_OSUFFIX") result.BE.push(item.value);
    else if (item.type === "EQPCODE") result.EQP_CODE.push(item.value);
  }

  if (!result.SCONUM.length) result.SCONUM.push("");
  if (!result.BE.length) result.BE.push("");
  if (!result.EQP_CODE.length) result.EQP_CODE.push("");
  return result;
}

/**
 * Builds one output record per annotation. Multiple generated families for the
 * same highlighted name become properties on that record. Coordinates remain
 * optional and are omitted until a future extraction or entry feature supplies
 * real values rather than inventing location data.
 */
export function buildGeneratedEntityRecords(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): GeneratedEntityRecord[] {
  const records = new Map<string, GeneratedEntityRecord>();

  for (const item of collectIncludedIdentifiers(annotations, generated)) {
    const record = records.get(item.annotation.id) ?? { name: item.annotation.text };
    record[RECORD_KEY_BY_TYPE[item.type]] = item.value;
    records.set(item.annotation.id, record);
  }

  return [...records.values()];
}

/**
 * Escapes a complete JSON document for insertion inside an outer JSON string.
 * JSON.stringify handles quotes, slashes, and control characters correctly;
 * slicing removes only the temporary outer quotes.
 */
export function escapeJsonForEmbedding(json: string): string {
  return JSON.stringify(json).slice(1, -1);
}

/**
 * Serializes the legacy object without indentation while retaining spaces after
 * separators. Building from JSON.stringify-ed keys and values avoids corrupting
 * any JSON-sensitive characters that may appear in future identifier formats.
 */
function serializeLegacyGeneratedIds(value: LegacyGeneratedIdJson): string {
  const entries = LEGACY_JSON_KEYS.map((key) => {
    const identifiers = value[key];
    const serializedIdentifiers = identifiers.map((identifier) => JSON.stringify(identifier)).join(", ");
    return `${JSON.stringify(key)}: [${serializedIdentifiers}]`;
  });
  return `{${entries.join(", ")}}`;
}

/**
 * Serializes entity records on one line with readable structural spacing.
 * Stringifying each property independently preserves valid escaping without a
 * regex pass that could accidentally alter commas or colons inside a value.
 */
function serializeGeneratedEntityRecords(records: readonly GeneratedEntityRecord[]): string {
  const serializedRecords = records.map((record) => {
    const properties = Object.entries(record)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`);
    return `{${properties.join(", ")}}`;
  });
  return `[${serializedRecords.join(", ")}]`;
}

/**
 * Serializes the selected downstream contract. Both modes are escaped fragments
 * intended for an outer JSON string. Both retain readable spaces after colons
 * and commas while preserving their distinct grouped and entity schemas.
 */
export function serializeGeneratedIdJson(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
  format: GeneratedJsonFormat = "legacy",
): string {
  if (format === "legacy") {
    const readableJson = serializeLegacyGeneratedIds(buildGeneratedIdJsonObject(annotations, generated));
    return escapeJsonForEmbedding(readableJson);
  }

  const readableJson = serializeGeneratedEntityRecords(buildGeneratedEntityRecords(annotations, generated));
  return escapeJsonForEmbedding(readableJson);
}

/** Returns the number of included values across every supported ID family. */
export function countIncludedGeneratedIds(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): number {
  return collectIncludedIdentifiers(annotations, generated).length;
}
