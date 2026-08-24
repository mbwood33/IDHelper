import { ID_TYPES, isEqpCodePrefix, type CandidateAnnotation, type IdType } from "../domain";

export interface ManualAnnotationInput {
  id: string;
  start: number;
  end: number;
  entityClass: string;
  idTypes: readonly IdType[];
  eqpPrefix?: string;
  rationale?: string;
}

/** Build a validated exact-span annotation from an explicit user selection. */
export function createManualAnnotation(report: string, input: ManualAnnotationInput): CandidateAnnotation | null {
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end)) return null;
  if (input.start < 0 || input.end > report.length || input.start >= input.end) return null;
  const text = report.slice(input.start, input.end);
  if (!text.trim() || /_/.test(text)) return null;

  const knownTypes = new Set<IdType>(ID_TYPES);
  const idTypes = [...new Set(input.idTypes)].filter((type) => knownTypes.has(type));
  if (!idTypes.length || !input.entityClass.trim()) return null;
  if (idTypes.includes("EQPCODE") && !isEqpCodePrefix(input.eqpPrefix)) return null;

  const rationale = input.rationale?.trim() || "Added manually by the user after reviewing the report.";
  return {
    id: input.id,
    start: input.start,
    end: input.end,
    text,
    entityClass: input.entityClass.trim(),
    possibleIdTypes: idTypes.map((type) => ({
      type,
      confidence: 1,
      rationale,
      ...(type === "EQPCODE" ? { eqpPrefix: input.eqpPrefix } : {}),
    })),
    source: "manual",
  };
}
