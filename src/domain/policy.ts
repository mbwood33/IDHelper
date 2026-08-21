import type { EntityIdPolicy } from "./types";

/** Editable starting policy; it is intentionally not an authoritative doctrine. */
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
