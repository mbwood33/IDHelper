import type { CandidateAnnotation, IdType } from "../domain/types";

/**
 * Re-export the analyzer-facing domain contract from one module. This keeps
 * analyzer callers independent of the domain folder layout while ensuring
 * every analyzer produces the same validated annotation shape.
 */
export type { CandidateAnnotation, IdType };

/**
 * Contract implemented by deterministic and optional semantic analyzers.
 *
 * `report` is the original, displayable report text. Implementations must not
 * mutate it and must return offsets that address this exact string. The result
 * is a possibly empty list of suggestions; it is never an authoritative ID
 * assignment and is intended for subsequent validation and human review.
 */
export interface Analyzer {
  analyze(report: string): CandidateAnnotation[];
}
