import type { CandidateAnnotation, IdType } from "../domain";

export interface GeneratedIdentifierState {
  value: string;
  included: boolean;
}

export type GeneratedIdentifiersByAnnotation = Record<
  string,
  Partial<Record<IdType, GeneratedIdentifierState>>
>;

type JsonValue = string | string[];
export type GeneratedIdJsonObject = Record<string, JsonValue>;

const JSON_TYPE_GROUPS: ReadonlyArray<{ key: string; sourceTypes: readonly IdType[] }> = [
  { key: "SCONUM", sourceTypes: ["SCONUM"] },
  { key: "BE", sourceTypes: ["BE", "BE_OSUFFIX"] },
  { key: "SK", sourceTypes: ["SK"] },
  { key: "EQPCODE", sourceTypes: ["EQPCODE"] },
  { key: "CENOT", sourceTypes: ["CENOT"] },
  { key: "ELNOT", sourceTypes: ["ELNOT"] },
];

/** Aggregate included generated values in report order and canonical type order. */
export function buildGeneratedIdJsonObject(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): GeneratedIdJsonObject {
  const values = new Map<string, string[]>();
  const orderedAnnotations = [...annotations].sort((a, b) => a.start - b.start || a.end - b.end);

  for (const group of JSON_TYPE_GROUPS) {
    for (const annotation of orderedAnnotations) {
      for (const type of group.sourceTypes) {
        if (!annotation.possibleIdTypes.some((option) => option.type === type)) continue;
        const item = generated[annotation.id]?.[type];
        if (!item?.included || !item.value) continue;
        values.set(group.key, [...(values.get(group.key) ?? []), item.value]);
      }
    }
  }

  const result: GeneratedIdJsonObject = {};
  for (const [key, items] of values) result[key] = items.length === 1 ? items[0] : items;
  return result;
}

export function serializeGeneratedIdJson(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): string {
  const entries = Object.entries(buildGeneratedIdJsonObject(annotations, generated));
  return `{${entries.map(([key, value]) => {
    const serializedValue = Array.isArray(value)
      ? `[${value.map((item) => JSON.stringify(item)).join(", ")}]`
      : JSON.stringify(value);
    return `${JSON.stringify(key)}: ${serializedValue}`;
  }).join(", ")}}`;
}

export function countIncludedGeneratedIds(
  annotations: readonly CandidateAnnotation[],
  generated: GeneratedIdentifiersByAnnotation,
): number {
  return Object.values(buildGeneratedIdJsonObject(annotations, generated))
    .reduce((count, value) => count + (Array.isArray(value) ? value.length : 1), 0);
}
