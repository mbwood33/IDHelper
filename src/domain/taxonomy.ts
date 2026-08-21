import { EQPCODE_PREFIXES, type EqpCodePrefix } from "./types";

export const EQPCODE_PREFIX_TAXONOMY: Readonly<Record<EqpCodePrefix, string>> = {
  A: "Aircraft - Fixed Wing",
  B: "Aircraft - Rotary Wing",
  C: "Naval Ships - Combatant Ship Category",
  D: "Naval Ships - Combatant Craft Category",
  E: "Naval Ships - Auxiliary Ship Category",
  F: "Naval Ships - Support Craft Category",
  G: "Merchant/Fishing/Research/Special Purpose and Other Non-Military Ships",
  H: "Optics",
  J: "Engines & Propulsion Systems",
  K: "Space Objects Equipment & Launch Vehicles",
  L: "Associated/Miscellaneous Equipment",
  M: "Antitank Weapons",
  N: "Armored Vehicles",
  O: "Mortars",
  P: "Tanks",
  Q: "General Purpose Vehicles",
  R: "Special Purpose Vehicles",
  S: "Engineering Equipment",
  T: "Air Defense Weapons",
  U: "Field Artillery/Surface Bombardment Weapons/Torpedo Tubes",
  V: "Surface-to-Surface Missile Launchers",
  W: "Small Arms",
  X: "Radars/Electronic Warfare Equipment & Other Remote Detection Devices",
  Y: "Communications and Automatic Data Processing (ADP) Equipment",
  Z: "Missiles/Ammunition",
  9: "File Administrative Entries",
};

export function isEqpCodePrefix(value: unknown): value is EqpCodePrefix {
  return typeof value === "string" && (EQPCODE_PREFIXES as readonly string[]).includes(value);
}
