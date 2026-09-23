/**
 * Compatibility-only entry point for analyzer and worker contracts.
 * Keeping these type re-exports separate lets consumers depend on a stable
 * path while the domain module remains the owner of the actual definitions.
 */
export type {
  CandidateAnnotation,
  CandidateSource,
  DefaultEntityClass,
  EntityClass,
  EntityIdPolicy,
  IdType,
  PossibleIdType,
} from "./types";
