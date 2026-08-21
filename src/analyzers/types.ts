import type { CandidateAnnotation, IdType } from "../domain/types";

export type { CandidateAnnotation, IdType };

export interface Analyzer {
  analyze(report: string): CandidateAnnotation[];
}
