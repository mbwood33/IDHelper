import type { EntityIdPolicy } from "./types";

/**
 * Editable starting policy used by rule/model suggestions. It intentionally is
 * not authoritative doctrine: user feedback may override it, and no entry
 * represents a real-system lookup or assignment decision.
 */
export const DEFAULT_ENTITY_ID_POLICY: readonly EntityIdPolicy[] = [
  {
    entityClass: "vessel",
    possibleIdTypes: ["SCONUM", "SK"],
    description: "Named vessel or maritime platform.",
  },
  {
    entityClass: "facility",
    possibleIdTypes: ["BE", "BE_OSUFFIX", "SK"],
    description: "Facility, installation, terminal, base, airfield, or similar site.",
  },
  {
    entityClass: "equipment",
    possibleIdTypes: ["EQPCODE", "SK"],
    description: "Equipment class, model, or type.",
  },
  {
    entityClass: "communications-signal",
    possibleIdTypes: ["CENOT", "SK"],
    description: "Specific communications signal or emitter.",
  },
  {
    entityClass: "electronic-signal",
    possibleIdTypes: ["ELNOT", "SK"],
    description: "Specific noncommunications electronic signal or emitter.",
  },
  {
    entityClass: "indexed-entity",
    possibleIdTypes: ["SK"],
    description: "Unclear but plausibly indexed entity; use low confidence.",
  },
];
