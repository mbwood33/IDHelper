import {
  ELNOT_FORMS,
  EQPCODE_PREFIXES,
  SIGNOT_FORMS,
  type CenotForm,
  type BeOsuffixJoiner,
  type ElnotForm,
  type EqpCodeBodyForm,
  type EqpCodePrefix,
  type GenerateIdOptions,
  type IdType,
} from "../domain";

/** Uppercase alphabet used by every `X` position in the documented formats. */
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Returns one unbiased cryptographically secure integer in `[0, upperBound)`.
 * Rejection sampling discards values in the incomplete tail of the 32-bit
 * range, avoiding modulo bias that would otherwise favor early characters.
 *
 * @param upperBound Exclusive integer upper bound, from 1 through 2^32.
 * @throws RangeError when the bound cannot be represented safely by this API.
 */
function secureIndex(upperBound: number): number {
  if (!Number.isInteger(upperBound) || upperBound < 1 || upperBound > 0x1_0000_0000) {
    throw new RangeError("upperBound must be an integer between 1 and 2^32");
  }
  const limit = Math.floor(0x1_0000_0000 / upperBound) * upperBound;
  const values = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % upperBound;
}

/** Builds a `length`-character string containing independently sampled digits. */
function digits(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) value += secureIndex(10);
  return value;
}

/** Builds a `length`-character string containing independently sampled A-Z letters. */
function letters(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) value += LETTERS[secureIndex(LETTERS.length)];
  return value;
}

/**
 * Expands a SIGNOT template: `X` becomes an uppercase letter and every `0`
 * becomes a digit. Templates are compile-time restricted to allowed forms.
 */
function signot(form: CenotForm | ElnotForm): string {
  return [...form].map((character) => (character === "X" ? letters(1) : digits(1))).join("");
}

/**
 * Selects an index with integer relative weights. Each weight occupies that
 * many adjacent positions in a uniformly selected integer interval.
 *
 * @param weights Positive relative weights in the same order as candidate values.
 * @returns Index of the selected candidate, or the last index as a defensive fallback.
 */
function weightedIndex(weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let choice = secureIndex(total);
  for (let index = 0; index < weights.length; index += 1) {
    if (choice < weights[index]) return index;
    choice -= weights[index];
  }
  return weights.length - 1;
}

/** @returns A raw synthetic SCONUM in the `X00000` form. */
export function generateSconum(): string {
  return `${letters(1)}${digits(5)}`;
}

/**
 * Generates a synthetic BE Number. An explicit form is deterministic in shape;
 * otherwise the algorithm mirrors `reference/generator-be.py`: three base
 * installation forms have equal probability, then a 3.3% dash replacement is
 * applied at the fifth character position.
 *
 * @param form Optional permitted BE shape to force.
 * @returns A raw BE Number with no presentation text.
 */
export function generateBeNumber(form?: GenerateIdOptions["beForm"]): string {
  if (form === "NUMERIC") return `${digits(4)}${digits(6)}`;
  if (form === "SINGLE_ALPHA") return `${digits(4)}${letters(1)}${digits(5)}`;
  if (form === "ALPHANUMERIC") return `${digits(4)}${letters(2)}${digits(4)}`;
  if (form === "DASHED") return `${digits(4)}-${digits(5)}`;
  if (form === "DASHED_ALPHA") return `${digits(4)}-${letters(1)}${digits(4)}`;

  const installation = [
    digits(6),
    `${letters(1)}${digits(5)}`,
    `${letters(2)}${digits(4)}`,
  ][secureIndex(3)];
  const ben = `${digits(4)}${installation}`;
  return secureIndex(1_000) < 33 ? `${ben.slice(0, 4)}-${ben.slice(5)}` : ben;
}

/** @returns A raw O-suffix matching `XX000`. */
export function generateOsuffix(): string {
  return `${letters(2)}${digits(3)}`;
}

/**
 * Generates a BE Number followed by a synthetic O-suffix. Without a requested
 * joiner, `/`, `-`, and space each receive weight 1 while no separator receives
 * weight 7, matching the project reference behavior.
 *
 * @param form Optional BE Number shape.
 * @param joiner Optional separator; omit to use the weighted distribution.
 * @returns One raw combined BE/O-suffix identifier.
 */
export function generateBeNumberWithOsuffix(
  form?: GenerateIdOptions["beForm"],
  joiner?: BeOsuffixJoiner,
): string {
  const selectedJoiner = joiner ?? (["/", "-", " ", ""] as const)[weightedIndex([1, 1, 1, 7])];
  return `${generateBeNumber(form)}${selectedJoiner}${generateOsuffix()}`;
}

/** @returns A 14-digit synthetic SK (five conceptual server digits plus nine sequence digits). */
export function generateSk(): string {
  return digits(14);
}

/**
 * Generates an EQPCODE from an approved category prefix and a four-character
 * body. Default body weights are 3:1:1 for `XXXX`, `XXX0`, and `XX00`.
 *
 * @param prefix Optional approved prefix; omit to choose one uniformly.
 * @param bodyForm Optional body shape; omit to use the reference weighting.
 * @returns A raw five-character EQPCODE.
 */
export function generateEqpCode(prefix?: EqpCodePrefix, bodyForm?: EqpCodeBodyForm): string {
  const selectedForm = bodyForm ?? (["XXXX", "XXX0", "XX00"] as const)[weightedIndex([3, 1, 1])];
  const body = selectedForm === "XXXX"
    ? letters(4)
    : selectedForm === "XXX0"
      ? `${letters(3)}${digits(1)}`
      : `${letters(2)}${digits(2)}`;
  return `${prefix ?? EQPCODE_PREFIXES[secureIndex(EQPCODE_PREFIXES.length)]}${body}`;
}

/**
 * Generates CENOT using an explicit form or reference weights 5:2:1:1 for
 * `XX000`, `X000X`, `X0000`, and `00000`.
 */
export function generateCenot(form?: CenotForm): string {
  return signot(form ?? SIGNOT_FORMS[weightedIndex([5, 2, 1, 1])]);
}

/**
 * Generates ELNOT using an explicit form or reference weights 3:1:1 for
 * `X000X`, `X0000`, and `00000`.
 */
export function generateElnot(form?: ElnotForm): string {
  return signot(form ?? ELNOT_FORMS[weightedIndex([3, 1, 1])]);
}

/**
 * Dispatches to the appropriate pure synthetic generator. The returned string
 * is intentionally raw: callers may copy it directly without labels, brackets,
 * warning text, or whitespace added by this module.
 *
 * @param type Target identifier family.
 * @param options Optional valid shape/category constraints for that family.
 * @returns Format-conforming synthetic identifier text.
 */
export function generateSyntheticId(type: IdType, options: GenerateIdOptions = {}): string {
  switch (type) {
    case "SCONUM": return generateSconum();
    case "BE": return generateBeNumber(options.beForm);
    case "BE_OSUFFIX": return generateBeNumberWithOsuffix(options.beForm, options.beOsuffixJoiner);
    case "SK": return generateSk();
    case "EQPCODE": return generateEqpCode(options.eqpPrefix, options.eqpBodyForm);
    case "CENOT": return generateCenot(options.cenotForm);
    case "ELNOT": return generateElnot(options.elnotForm);
  }
}
