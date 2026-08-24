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

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

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

function digits(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) value += secureIndex(10);
  return value;
}

function letters(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) value += LETTERS[secureIndex(LETTERS.length)];
  return value;
}

function signot(form: CenotForm | ElnotForm): string {
  return [...form].map((character) => (character === "X" ? letters(1) : digits(1))).join("");
}

function weightedIndex(weights: readonly number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let choice = secureIndex(total);
  for (let index = 0; index < weights.length; index += 1) {
    if (choice < weights[index]) return index;
    choice -= weights[index];
  }
  return weights.length - 1;
}

export function generateSconum(): string {
  return `${letters(1)}${digits(5)}`;
}

export function generateBeNumber(form?: GenerateIdOptions["beForm"]): string {
  if (form === "DASHED") return `${digits(4)}-${digits(5)}`;
  if (form === "ALPHANUMERIC") return `${digits(4)}${letters(2)}${digits(4)}`;
  return secureIndex(2) === 0
    ? `${digits(4)}${letters(2)}${digits(4)}`
    : `${digits(4)}-${digits(5)}`;
}

export function generateOsuffix(): string {
  return `${letters(2)}${digits(3)}`;
}

export function generateBeNumberWithOsuffix(
  form?: GenerateIdOptions["beForm"],
  joiner?: BeOsuffixJoiner,
): string {
  const selectedJoiner = joiner ?? (["/", "-", " ", ""] as const)[weightedIndex([1, 1, 1, 7])];
  return `${generateBeNumber(form)}${selectedJoiner}${generateOsuffix()}`;
}

export function generateSk(): string {
  return digits(14);
}

export function generateEqpCode(prefix?: EqpCodePrefix, bodyForm?: EqpCodeBodyForm): string {
  const selectedForm = bodyForm ?? (["XXXX", "XXX0", "XX00"] as const)[weightedIndex([3, 1, 1])];
  const body = selectedForm === "XXXX"
    ? letters(4)
    : selectedForm === "XXX0"
      ? `${letters(3)}${digits(1)}`
      : `${letters(2)}${digits(2)}`;
  return `${prefix ?? EQPCODE_PREFIXES[secureIndex(EQPCODE_PREFIXES.length)]}${body}`;
}

export function generateCenot(form?: CenotForm): string {
  return signot(form ?? SIGNOT_FORMS[weightedIndex([5, 2, 1, 1])]);
}

export function generateElnot(form?: ElnotForm): string {
  return signot(form ?? ELNOT_FORMS[weightedIndex([3, 1, 1])]);
}

/** Generates a raw synthetic identifier and never adds a presentation label. */
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
