/**
 * Vendored from erik-sundvalls-bots/clinergy-extractor main @ f975528. Apache-2.0.
 * The filesystem loader was dropped so this module bundles in a browser.
 *
 * Language packs for summary sentences.
 *
 * The language-neutral rules (precedence, position, order, value slot) stay in
 * the extractor YAML. A pack supplies the words, agreement, definiteness and
 * prepositions. A missing entry is reported and the concept key is used: the
 * pack does not guess a translation.
 *
 * English (`lang/en.yaml`) is our own wording for the synthetic fixture, the
 * same words the default renderer reads from concept displays. Swedish
 * (`lang/sv.yaml`) is our own translation. It has not had a native-speaker
 * review.
 */
import { type Agreement, type Language } from "./sentence.ts";

export interface AdjectiveForms {
  en?: string;
  ett?: string;
  plural?: string;
  definite?: string;
}

export interface PackEntry {
  noun?: string;
  gender?: "en" | "ett";
  definite?: string;
  plural?: string;
  definitePlural?: string;
  adjective?: string;
  adjectiveForms?: AdjectiveForms;
  adverb?: string;
  /** Does not take en/ett/plural endings (gradvis, förekommer). */
  indeclinable?: boolean;
  number?: "singular" | "plural";
}

export interface LanguagePack {
  id: string;
  prepositions: Record<string, string>;
  /** Concept key -> location type id (surface, cavity, part, ...). */
  locationTypes: Record<string, string>;
  prepositionByLocationType: Record<string, string>;
  subJoiner: string;
  locationOrder: Language["locationOrder"];
  definiteness: { topic: boolean; location: boolean; subLocation: boolean };
  /** "suffix-t": an adverb is the adjective plus -t when no adverb is listed. */
  adverbRule: "none" | "suffix-t";
  laterality: { left: PackEntry; right: PackEntry };
  entries: Record<string, PackEntry>;
}

type Yaml = Record<string, unknown>;

export function packFromParsed(doc: unknown): LanguagePack {
  const raw = asRecord(doc);
  const definiteness = asRecord(raw.definiteness);
  const order = raw.locationOrder === "lat-loc-sub" ? "lat-loc-sub" : "sub-lat-loc";
  return {
    id: typeof raw.id === "string" ? raw.id : "en",
    prepositions: stringMap(raw.prepositions),
    locationTypes: stringMap(raw.locationTypes),
    prepositionByLocationType: stringMap(raw.prepositionByLocationType),
    subJoiner: typeof raw.subJoiner === "string" ? raw.subJoiner : "of",
    locationOrder: order,
    definiteness: {
      topic: definiteness.topic === true,
      location: definiteness.location === true,
      subLocation: definiteness.subLocation === true,
    },
    adverbRule: raw.adverbRule === "suffix-t" ? "suffix-t" : "none",
    laterality: {
      left: entryFrom(asRecord(asRecord(raw.laterality).left)),
      right: entryFrom(asRecord(asRecord(raw.laterality).right)),
    },
    entries: entriesFrom(raw.entries),
  };
}

/** A `Language` whose words come only from the pack. */
export function languageFromPack(pack: LanguagePack): Language {
  const missing: string[] = [];
  const entry = (name: string): PackEntry | undefined => pack.entries[name];
  const miss = (name: string, field: string) => {
    missing.push(`${pack.id}:${name}.${field}`);
  };
  return {
    id: pack.id,
    missing,
    locationOrder: pack.locationOrder,
    preposition(source, location) {
      const type = location ? pack.locationTypes[location] : undefined;
      if (type) {
        const word = pack.prepositionByLocationType[type];
        if (word) return word;
        miss(type, "prepositionByLocationType");
      }
      const word = pack.prepositions[source];
      if (word) return word;
      miss(source, "preposition");
      return source;
    },
    subJoiner: () => pack.subJoiner,
    laterality(side, agree) {
      return adjectiveOf(pack.laterality[side], side, agree, pack, missing);
    },
    noun(name, agree) {
      return nounOf(entry(name), name, agree, pack, missing);
    },
    adjective(name, agree) {
      return adjectiveOf(entry(name), name, agree, pack, missing);
    },
    negative(name) {
      const word = entry(name)?.adjective;
      if (word) return word;
      miss(name, "negative");
      return name;
    },
    adverb(name) {
      return adverbOf(entry(name), name, pack, missing);
    },
    unit(name, n) {
      const e = entry(name);
      if (!e?.noun) {
        miss(name, "noun");
        return name;
      }
      if (n === 1) return e.noun;
      if (e.plural) return e.plural;
      miss(name, "plural");
      return e.noun;
    },
    agreement(name) {
      const e = entry(name);
      return {
        gender: e?.gender === "ett" ? "ett" : "en",
        definite: false,
        plural: e?.number === "plural",
      };
    },
    definiteSlot(slot) {
      return pack.definiteness[slot];
    },
  };
}

function nounOf(
  entry: PackEntry | undefined,
  name: string,
  agree: Agreement,
  pack: LanguagePack,
  missing: string[],
): string {
  if (!entry?.noun && !entry?.definite && !entry?.plural) {
    missing.push(`${pack.id}:${name}.noun`);
    return name;
  }
  if (agree.plural && agree.definite) {
    return entry.definitePlural ?? entry.plural ?? entry.definite ?? entry.noun ?? name;
  }
  if (agree.definite) {
    if (!entry.definite) missing.push(`${pack.id}:${name}.definite`);
    return entry.definite ?? entry.noun ?? name;
  }
  if (agree.plural) {
    if (!entry.plural) missing.push(`${pack.id}:${name}.plural`);
    return entry.plural ?? entry.noun ?? name;
  }
  if (!entry.noun) {
    missing.push(`${pack.id}:${name}.noun`);
    return name;
  }
  return entry.noun;
}

function adjectiveOf(
  entry: PackEntry | undefined,
  name: string,
  agree: Agreement,
  pack: LanguagePack,
  missing: string[],
): string {
  if (!entry || (entry.adjective == null && !entry.adjectiveForms)) {
    missing.push(`${pack.id}:${name}.adjective`);
    return name;
  }
  if (entry.indeclinable) return entry.adjective ?? name;
  const forms = entry.adjectiveForms ?? {};
  const base = forms.en ?? entry.adjective;
  if (agree.definite) return forms.definite ?? base ?? name;
  if (agree.plural) return forms.plural ?? base ?? name;
  if (agree.gender === "ett") return forms.ett ?? base ?? name;
  return base ?? name;
}

function adverbOf(
  entry: PackEntry | undefined,
  name: string,
  pack: LanguagePack,
  missing: string[],
): string {
  if (entry?.adverb) return entry.adverb;
  if (entry?.indeclinable && entry.adjective) return entry.adjective;
  if (pack.adverbRule === "suffix-t" && entry?.adjective && !entry.indeclinable) {
    if (entry.adjectiveForms?.ett) return entry.adjectiveForms.ett;
    if (/[dt]$/i.test(entry.adjective)) return entry.adjective;
    return entry.adjective + "t";
  }
  missing.push(`${pack.id}:${name}.adverb`);
  return name;
}

function entriesFrom(raw: unknown): Record<string, PackEntry> {
  const out: Record<string, PackEntry> = {};
  for (const [name, value] of Object.entries(asRecord(raw))) out[name] = entryFrom(asRecord(value));
  return out;
}

function entryFrom(raw: Yaml): PackEntry {
  const forms = asRecord(raw.adjectiveForms);
  const adjectiveForms = Object.keys(forms).length
    ? {
      en: optionalString(forms.en),
      ett: optionalString(forms.ett),
      plural: optionalString(forms.plural),
      definite: optionalString(forms.definite),
    }
    : undefined;
  return {
    noun: optionalString(raw.noun),
    gender: raw.gender === "ett" ? "ett" : raw.gender === "en" ? "en" : undefined,
    definite: optionalString(raw.definite),
    plural: optionalString(raw.plural),
    definitePlural: optionalString(raw.definitePlural),
    adjective: optionalString(raw.adjective),
    adjectiveForms,
    adverb: optionalString(raw.adverb),
    indeclinable: raw.indeclinable === true,
    number: raw.number === "plural" ? "plural" : undefined,
  };
}

function stringMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(asRecord(raw))) if (typeof v === "string") out[k] = v;
  return out;
}

function optionalString(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function asRecord(v: unknown): Yaml {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Yaml : {};
}
