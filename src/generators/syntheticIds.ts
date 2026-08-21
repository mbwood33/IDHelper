import {
  ELNOT_FORMS,
  EQPCODE_PREFIXES,
  SIGNOT_FORMS,
  type CenotForm,
  type ElnotForm,
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

export function generateSconum(): string {
  return `${letters(1)}${digits(5)}`;
}

export function generateBeNumber(form: GenerateIdOptions["beForm"] = "ALPHANUMERIC"): string {
  return form === "DASHED" ? `${digits(4)}-${digits(5)}` : `${digits(4)}${letters(2)}${digits(4)}`;
}

export function generateOsuffix(): string {
  return `${letters(2)}${digits(3)}`;
}

export function generateBeNumberWithOsuffix(form: GenerateIdOptions["beForm"] = "ALPHANUMERIC"): string {
  return `${generateBeNumber(form)} ${generateOsuffix()}`;
}

export function generateSk(): string {
  return digits(14);
}

export function generateEqpCode(prefix?: EqpCodePrefix): string {
  return `${prefix ?? EQPCODE_PREFIXES[secureIndex(EQPCODE_PREFIXES.length)]}${digits(4)}`;
}

export function generateCenot(form: CenotForm = SIGNOT_FORMS[0]): string {
  return signot(form);
}

export function generateElnot(form: ElnotForm = ELNOT_FORMS[0]): string {
  return signot(form);
}

/** Generates a raw synthetic identifier and never adds a presentation label. */
export function generateSyntheticId(type: IdType, options: GenerateIdOptions = {}): string {
  switch (type) {
    case "SCONUM": return generateSconum();
    case "BE": return generateBeNumber(options.beForm);
    case "BE_OSUFFIX": return generateBeNumberWithOsuffix(options.beForm);
    case "SK": return generateSk();
    case "EQPCODE": return generateEqpCode(options.eqpPrefix);
    case "CENOT": return generateCenot(options.cenotForm);
    case "ELNOT": return generateElnot(options.elnotForm);
  }
}
