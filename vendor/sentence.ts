/**
 * Summary-sentence generator.
 *
 * `render` is pure: a structured finding plus the knowledge the extractor
 * writes (`sentence-rules.yaml`, `concepts.yaml`, `concept-links.yaml`).
 * No file or network access.
 *
 * The language-neutral rules (precedence, position, order, which slot a value
 * fills) come from the extractor. Word forms come from the concept `display`
 * and from `lexicon`. A later language pack can replace the word forms; this
 * module's default is the English of the extracted lexicon.
 *
 * Decisions recorded for review (the 1998 engine's generator is not in this
 * repo; the rules below are what the public thumb-pain walkthrough shows):
 *   - A higher descriptor precedence sits closer to the topic. Before the
 *     topic that means a lower precedence is further left. After the topic a
 *     higher precedence comes first. Value precedence breaks ties the same way.
 *   - The summary value is rendered by the descriptor named in the topic's
 *     summary type (the extractor writes `AbsentPresent: { hasClinicalAbsence
 *     presence } ...`). If that row is missing, the descriptor is
 *     `hasClinicalAbsence`, as issue #2 specifies.
 *   - While the finding has no laterality and no sub-location, and the topic
 *     display already starts with the location display ("thumb pain"), the
 *     head is that display ("Thumb pain"). Laterality or a sub-location
 *     switches to the prepositional head ("Pain in right thumb",
 *     "Swelling of distal phalanx of left thumb").
 *   - A numeric qualifier (duration) is `<descriptor word> <number> <unit>`
 *     when the rule order is descriptor-first, which is how "for 2 weeks" is
 *     authored in the synthetic fixture.
 *   - The first character of the finished sentence is capitalised. Nothing
 *     else is.
 */
/**
 * Vendored from erik-sundvalls-bots/clinergy-extractor main @ f975528
 * (PRs #9, #10 and #11 merged). Apache-2.0.
 * LOCAL FIXES are marked below. Filesystem loaders were dropped so this
 * module bundles in a browser; call sentenceKnowledgeFromParsed instead.
 */

export interface Qualifier {
  descriptor: string;
  value: string;
  number?: number;
  unit?: string;
}

export interface Finding {
  topic: string;
  location?: string;
  /** "both" is a local extension: the form allows left and right together. */
  laterality?: "left" | "right" | "both";
  subLocation?: string;
  qualifiers: Qualifier[];
  /** Present/absent style value, e.g. "presence". Rendered via the summary descriptor. */
  summary?: string;
}

export interface LanguageRule {
  value: string;
  valueForm: string;
  descriptorForm: string;
  order: string;
  position: string;
  valuePrecedence?: number | null;
}

export interface DescriptorRules {
  precedence: number | null;
  rules: LanguageRule[];
}

export interface ConceptFact {
  display: string;
  category?: string | null;
  summaryType?: string | null;
  supers?: string[];
}

/** One locative link as stored on a concept, e.g. "in Thumb". */
export interface LocativeLink {
  preposition: string;
  location: string;
}

export interface SentenceKnowledge {
  descriptors: Record<string, DescriptorRules>;
  valuePrecedences: Record<string, number>;
  summaryTypes: string[];
  lexicon: {
    descriptors: Record<string, { noun: string | null; adjective: string | null; negative: string | null }>;
    valueAdverbs: Record<string, string>;
  };
  concepts: Record<string, ConceptFact>;
  locatives: Record<string, LocativeLink[]>;
}

export interface Agreement {
  gender: "en" | "ett";
  definite: boolean;
  plural: boolean;
}

const INDEFINITE: Agreement = { gender: "en", definite: false, plural: false };

/**
 * Word forms and the few bits of order that belong to a language.
 * The default implementation reads the extracted English lexicon.
 */
export interface Language {
  id: string;
  preposition(source: string, location: string | undefined): string;
  /** The word between a sub-location and the location phrase ("of" in English). */
  subJoiner(): string;
  laterality(side: "left" | "right", agree: Agreement): string;
  /** Descriptor or concept used as a noun. `name` is the concept or descriptor key. */
  noun(name: string, agree: Agreement): string;
  adjective(name: string, agree: Agreement): string;
  /** Negative descriptor form from the lexicon (`absence` and similar). */
  negative(name: string): string;
  adverb(name: string): string;
  unit(name: string, n: number): string;
  /** Gender and number of a concept. English has none, so the default is indefinite common gender. */
  agreement?(name: string): Agreement;
  /** Whether nouns in this slot are definite. English is indefinite. */
  definiteSlot?(slot: "topic" | "location" | "subLocation"): boolean;
  /**
   * Order of the location slots inside the prepositional head.
   * "sub-lat-loc" is "distal phalanx of left thumb".
   */
  locationOrder: "sub-lat-loc" | "lat-loc-sub";
  missing: string[];
}

export interface Rendered {
  sentence: string;
  /** Lexicon entries, rules or displays that were missing. The sentence uses a fallback. */
  missing: string[];
}

type Yaml = Record<string, unknown>;

/** Build knowledge from the parsed extractor documents. Pure. */
export function sentenceKnowledgeFromParsed(
  rulesDoc: unknown,
  conceptsDoc: unknown,
  linksDoc: unknown = {},
): SentenceKnowledge {
  const rules = asRecord(rulesDoc);
  const conceptsRaw = asRecord(conceptsDoc);
  const linksRaw = asRecord(linksDoc);
  const descriptors: SentenceKnowledge["descriptors"] = {};
  for (const [name, raw] of Object.entries(asRecord(rules.descriptors))) {
    const d = asRecord(raw);
    const list = Array.isArray(d.rules) ? d.rules : [];
    descriptors[name] = {
      precedence: typeof d.precedence === "number" ? d.precedence : null,
      rules: list.map((r) => {
        const row = asRecord(r);
        return {
          value: String(row.value ?? ""),
          valueForm: String(row.valueForm ?? ""),
          descriptorForm: String(row.descriptorForm ?? ""),
          order: String(row.order ?? ""),
          position: String(row.position ?? ""),
          valuePrecedence: typeof row.valuePrecedence === "number" ? row.valuePrecedence : null,
        };
      }),
    };
  }
  const concepts: SentenceKnowledge["concepts"] = {};
  for (const [name, raw] of Object.entries(conceptsRaw)) {
    const c = asRecord(raw);
    concepts[name] = {
      display: typeof c.display === "string" ? c.display : "",
      category: typeof c.category === "string" ? c.category : null,
      summaryType: typeof c.summaryType === "string" ? c.summaryType : null,
      supers: stringList(c.supers),
    };
  }
  const locatives: SentenceKnowledge["locatives"] = {};
  for (const [name, raw] of Object.entries(linksRaw)) {
    const links = stringList(asRecord(raw).locativeLinks);
    const parsed = links.map(parseLocative).filter((x): x is LocativeLink => x !== null);
    if (parsed.length) locatives[name] = parsed;
  }
  const lexDescRaw = asRecord(asRecord(rules.lexicon).descriptors);
  const descriptorsLex: SentenceKnowledge["lexicon"]["descriptors"] = {};
  for (const [name, raw] of Object.entries(lexDescRaw)) {
    const w = asRecord(raw);
    descriptorsLex[name] = {
      noun: typeof w.noun === "string" ? w.noun : null,
      adjective: typeof w.adjective === "string" ? w.adjective : null,
      negative: typeof w.negative === "string" ? w.negative : null,
    };
  }
  const adverbs: Record<string, string> = {};
  for (const [name, raw] of Object.entries(asRecord(asRecord(rules.lexicon).valueAdverbs))) {
    if (typeof raw === "string") adverbs[name] = raw;
  }
  const valuePrecedences: Record<string, number> = {};
  for (const [name, raw] of Object.entries(asRecord(rules.valuePrecedences))) {
    if (typeof raw === "number") valuePrecedences[name] = raw;
  }
  return {
    descriptors,
    valuePrecedences,
    summaryTypes: stringList(rules.summaryTypes),
    lexicon: { descriptors: descriptorsLex, valueAdverbs: adverbs },
    concepts,
    locatives,
  };
}

/** English words from the extracted lexicon and concept displays. */
export function englishFromKnowledge(knowledge: SentenceKnowledge): Language {
  const missing: string[] = [];
  const displayOf = (name: string): string => {
    const d = knowledge.concepts[name]?.display;
    if (d) return d;
    missing.push(`concepts:${name}.display`);
    return humanize(name);
  };
  return {
    id: "en",
    missing,
    locationOrder: "sub-lat-loc",
    preposition(source) {
      return source;
    },
    subJoiner: () => "of",
    laterality: (side) => side,
    noun(name, agree) {
      const lex = knowledge.lexicon.descriptors[name]?.noun;
      const word = lex || displayOf(name);
      return agree.plural ? pluralizeEn(word, 2) : word;
    },
    adjective(name, _agree) {
      const lex = knowledge.lexicon.descriptors[name]?.adjective;
      if (lex) return lex;
      if (knowledge.concepts[name]?.display) return knowledge.concepts[name].display;
      missing.push(`lexicon:${name}.adjective`);
      return humanize(name);
    },
    negative(name) {
      const word = knowledge.lexicon.descriptors[name]?.negative;
      if (word) return word;
      missing.push(`lexicon:${name}.negative`);
      return humanize(name);
    },
    adverb(name) {
      const a = knowledge.lexicon.valueAdverbs[name];
      if (a) return a;
      missing.push(`lexicon:valueAdverbs.${name}`);
      return adverbFallback(displayOf(name));
    },
    unit(name, n) {
      return pluralizeEn(displayOf(name), n);
    },
  };
}

export function render(finding: Finding, knowledge: SentenceKnowledge, lang?: Language): string {
  return renderReport(finding, knowledge, lang).sentence;
}

export function renderReport(finding: Finding, knowledge: SentenceKnowledge, lang?: Language): Rendered {
  const language = lang ?? englishFromKnowledge(knowledge);
  const missing = language.missing;
  const headName = grammaticalHead(finding, knowledge);
  const qualifiers = qualifiersOf(finding, knowledge, missing);
  const phrases = qualifiers.flatMap((q, index) => phraseOf(q, index, headName, knowledge, language, missing));
  const before = phrases.filter((p) => p.before).sort(closerLast).map((p) => p.text);
  const after = phrases.filter((p) => !p.before).sort(closerFirst).map((p) => p.text);
  const head = headOf(finding, knowledge, language, missing);
  const parts = [before.join(", "), head, after.join(", ")].filter((p) => p.length > 0);
  return { sentence: capitalise(parts.join(" ")), missing: [...new Set(missing)] };
}

/** A finding object, a list of them, or `{ finding }` wrappers from a YAML file. */
export function findingsFromParsed(doc: unknown): Finding[] {
  const rows = Array.isArray(doc) ? doc : [doc];
  return rows.map((row) => {
    const rec = asRecord(row);
    const inner = rec.finding && typeof rec.finding === "object" ? asRecord(rec.finding) : rec;
    const laterality = inner.laterality;
    if (
      laterality !== undefined && laterality !== "left" && laterality !== "right" && laterality !== "both"
    ) {
      throw new Error(`laterality must be "left", "right" or "both", got ${JSON.stringify(laterality)}`);
    }
    const qualifiers = Array.isArray(inner.qualifiers) ? inner.qualifiers.map(qualifierFrom) : [];
    return {
      topic: String(inner.topic ?? ""),
      location: optionalString(inner.location),
      laterality: laterality as Finding["laterality"],
      subLocation: optionalString(inner.subLocation ?? inner.sublocation),
      qualifiers,
      summary: optionalString(inner.summary),
    };
  });
}

// --- phrase building -------------------------------------------------------

interface BuiltPhrase {
  text: string;
  before: boolean;
  /** Higher sits closer to the topic. */
  precedence: number;
  valuePrecedence: number;
  index: number;
}

function qualifiersOf(finding: Finding, knowledge: SentenceKnowledge, missing: string[]): Qualifier[] {
  const list = [...(finding.qualifiers ?? [])];
  if (
    finding.summary &&
    !list.some((q) => q.value === finding.summary && q.descriptor === summaryDescriptor(finding, knowledge))
  ) {
    list.push({ descriptor: summaryDescriptor(finding, knowledge), value: finding.summary });
  }
  if (finding.summary && !knowledge.descriptors[summaryDescriptor(finding, knowledge)]) {
    missing.push(`rules:${summaryDescriptor(finding, knowledge)}`);
  }
  return list;
}

/** Descriptor that renders the topic's present/absent summary value. */
function summaryDescriptor(finding: Finding, knowledge: SentenceKnowledge): string {
  const summaryType = knowledge.concepts[finding.topic]?.summaryType;
  if (summaryType && finding.summary) {
    const row = knowledge.summaryTypes.find((s) => s.startsWith(`${summaryType}:`));
    const hit = row?.match(new RegExp(`\\{\\s*(\\S+)\\s+${escapeRe(finding.summary)}\\s*\\}`));
    if (hit) return hit[1];
  }
  return "hasClinicalAbsence";
}

function phraseOf(
  q: Qualifier,
  index: number,
  headName: string,
  knowledge: SentenceKnowledge,
  lang: Language,
  missing: string[],
): BuiltPhrase[] {
  const descriptor = knowledge.descriptors[q.descriptor];
  const rule = descriptor?.rules.find((r) => r.value === q.value);
  if (!rule) {
    missing.push(`rules:${q.descriptor}.${q.value}`);
    const text = q.number != null
      ? [String(q.number), lang.unit(q.unit ?? q.value, q.number)].join(" ")
      : lang.adjective(q.value, INDEFINITE);
    return [{
      text,
      before: false,
      precedence: descriptor?.precedence ?? 0,
      valuePrecedence: knowledge.valuePrecedences[q.value] ?? 0,
      index,
    }];
  }
  const topicAgree = agreementFor(headName, lang, "topic");
  const descKind = descriptorKind(rule.descriptorForm);
  const descAgree = descKind === "noun" ? agreementFor(q.descriptor, lang) : topicAgree;
  const valueAgree = descKind === "noun" ? agreementFor(q.descriptor, lang) : topicAgree;
  const valueWord = wordForValue(rule.valueForm, q.value, valueAgree, lang, rule.descriptorForm);
  const descWord = wordForDescriptor(descKind, q.descriptor, descAgree, lang);
  const text = q.number != null
    ? numericPhrase(rule.order, descWord, q.number, lang.unit(q.unit ?? q.value, q.number))
    : joinWords(valueFirst(rule.order) ? [valueWord, descWord] : [descWord, valueWord]);
  if (!text) return [];
  return [{
    text,
    before: isBefore(rule.position),
    precedence: descriptor?.precedence ?? 0,
    valuePrecedence: rule.valuePrecedence ?? knowledge.valuePrecedences[q.value] ?? 0,
    index,
  }];
}

function wordForValue(
  valueForm: string,
  value: string,
  agree: Agreement,
  lang: Language,
  descriptorForm: string,
): string {
  // LOCAL FIX. The real rules use the engine token valueAdj with NoDescriptor
  // for polarity words (absence, possible, same). Those are not in
  // valueAdverbs, and the +ly fallback renders "absently". valueAdj together
  // with a descriptor adjective stays an adverb ("moderately" + "severe"),
  // and the long name valueAdverb is unchanged.
  if (norm(valueForm) === "valueadj" && descriptorKind(descriptorForm) === "none") {
    return lang.adjective(value, agree);
  }
  switch (valueKind(valueForm)) {
    case "adverb":
      return lang.adverb(value);
    case "noun":
      return lang.noun(value, agree);
    case "adjective":
      return lang.adjective(value, agree);
    default:
      return lang.adjective(value, agree);
  }
}

function wordForDescriptor(
  kind: "none" | "noun" | "adj" | "negative",
  descriptor: string,
  agree: Agreement,
  lang: Language,
): string | null {
  if (kind === "none") return null;
  if (kind === "noun") return lang.noun(descriptor, { ...agree, plural: false });
  if (kind === "negative") return lang.negative(descriptor);
  return lang.adjective(descriptor, agree);
}

function numericPhrase(order: string, descriptorWord: string | null, n: number, unit: string): string {
  const num = String(n);
  return valueFirst(order) ? joinWords([unit, num, descriptorWord]) : joinWords([descriptorWord, num, unit]);
}

/**
 * Concept whose noun is the grammatical head.
 * "ThumbPainSymptom" with laterality is headed by "PainSymptom" ("pain"),
 * because the topic display "thumb pain" only pre-coordinates the location.
 */
function grammaticalHead(finding: Finding, knowledge: SentenceKnowledge): string {
  if (!finding.location) return finding.topic;
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? "";
  const locDisplay = knowledge.concepts[finding.location]?.display ?? "";
  const includes = locDisplay.length > 0 && topicDisplay.toLowerCase().startsWith(locDisplay.toLowerCase() + " ");
  const expanded = Boolean(finding.laterality || finding.subLocation || !includes);
  if (!expanded || !includes) return finding.topic;
  const rest = topicDisplay.slice(locDisplay.length).trim();
  return baseConcept(finding.topic, rest, knowledge) ?? finding.topic;
}

function baseConcept(topic: string, rest: string, knowledge: SentenceKnowledge): string | undefined {
  const supers = new Set(knowledge.concepts[topic]?.supers ?? []);
  const matches = Object.entries(knowledge.concepts).filter(([name, c]) =>
    name !== topic && c.display.toLowerCase() === rest.toLowerCase()
  );
  return matches.find(([name]) => supers.has(name))?.[0] ?? matches[0]?.[0];
}

function headOf(finding: Finding, knowledge: SentenceKnowledge, lang: Language, missing: string[]): string {
  const headName = grammaticalHead(finding, knowledge);
  const noun = lang.noun(headName, agreementFor(headName, lang, "topic"));
  if (!finding.location) return noun;
  const locDisplay = knowledge.concepts[finding.location]?.display ?? "";
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? "";
  const includes = locDisplay.length > 0 && topicDisplay.toLowerCase().startsWith(locDisplay.toLowerCase() + " ");
  const expanded = Boolean(finding.laterality || finding.subLocation || !includes);
  // Unexpanded pre-coordinated topic: "thumb pain", not "pain in thumb".
  if (!expanded) return lang.noun(finding.topic, agreementFor(finding.topic, lang, "topic"));
  const prep = lang.preposition(locativePreposition(finding, knowledge, missing), finding.location);
  const sub = finding.subLocation
    ? `${lang.noun(finding.subLocation, agreementFor(finding.subLocation, lang, "subLocation"))} ${lang.subJoiner()}`
    : "";
  const locAgree = agreementFor(finding.location, lang, "location");
  // LOCAL FIX. The thumb form's laterality row is multiple: true.
  const side = finding.laterality;
  const both = side === "both";
  const sideAgree = both ? { ...locAgree, plural: true } : locAgree;
  const lat = both
    ? `${lang.laterality("left", sideAgree)} and ${lang.laterality("right", sideAgree)}`
    : side
    ? lang.laterality(side, locAgree)
    : "";
  const locWord = lang.noun(finding.location, both ? { ...locAgree, plural: true } : locAgree);
  const slots = lang.locationOrder === "lat-loc-sub" ? [lat, locWord, sub] : [sub, lat, locWord];
  return joinWords([noun, prep, ...slots]);
}

function locativePreposition(finding: Finding, knowledge: SentenceKnowledge, missing: string[]): string {
  const links = knowledge.locatives[finding.topic] ?? [];
  const match = finding.location ? links.find((l) => l.location === finding.location) : undefined;
  const link = match ?? links[links.length - 1];
  if (!link) {
    missing.push(`locative:${finding.topic}`);
    return "in";
  }
  return link.preposition;
}

function agreementFor(
  name: string,
  lang: Language,
  slot?: "topic" | "location" | "subLocation",
): Agreement {
  const base = lang.agreement?.(name) ?? INDEFINITE;
  if (slot && lang.definiteSlot?.(slot)) return { ...base, definite: true };
  return base;
}

// --- token vocabulary ------------------------------------------------------
// The extractor stores the engine's tokens as strings, compared case-insensitively.
// The 1998 engine abbreviates them: valueAdj, valueNoun, descAdj, descNoun,
// NoDescriptor, valFirst. valueAdj is the adverb (lexicon.valueAdverbs, else +ly)
// followed by the descriptor adjective, not an adjective of the value.
// The long names (valueAdverb, valueAdjective, valueNoun, valueFirst) are accepted too.
// Unknown tokens fall back rather than throw.

function valueKind(form: string): "adjective" | "adverb" | "noun" | "raw" {
  switch (norm(form)) {
    case "valueadj":
    case "valueadverb":
    case "adverb":
      return "adverb";
    case "valueadjective":
    case "adjective":
      return "adjective";
    case "valuenoun":
    case "noun":
      return "noun";
    default:
      return "raw";
  }
}

function descriptorKind(form: string): "none" | "noun" | "adj" | "negative" {
  switch (norm(form)) {
    case "nodescriptor":
    case "none":
    case "":
      return "none";
    case "descnoun":
    case "descriptornoun":
      return "noun";
    case "descadj":
    case "descadjective":
    case "descriptoradjective":
    case "descriptoradj":
      return "adj";
    case "descnegative":
    case "negative":
      return "negative";
    default:
      return "none";
  }
}

function valueFirst(order: string): boolean {
  const s = norm(order);
  if (s === "descfirst" || s === "descriptorfirst") return false;
  // valueFirst and the engine's abbreviation valFirst. Anything else stays value-first.
  return true;
}

function isBefore(position: string): boolean {
  const s = norm(position);
  return s === "beforetopic" || s === "before";
}

const norm = (s: string) => s.toLowerCase().replace(/[_-\s]/g, "");

// --- small helpers ---------------------------------------------------------

function closerLast(a: BuiltPhrase, b: BuiltPhrase): number {
  return a.precedence - b.precedence || a.valuePrecedence - b.valuePrecedence || a.index - b.index;
}
function closerFirst(a: BuiltPhrase, b: BuiltPhrase): number {
  return b.precedence - a.precedence || b.valuePrecedence - a.valuePrecedence || a.index - b.index;
}

const capitalise = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const joinWords = (parts: (string | null | undefined)[]) => parts.filter((p) => p && p.length).join(" ");

export function humanize(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
}

/** English plural used when the lexicon has no explicit plural. 1 keeps the singular. */
export function pluralizeEn(word: string, n: number): string {
  if (n === 1) return word;
  if (/(?:s|x|z|ch|sh)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/s$/i.test(word)) return word;
  return word + "s";
}

function adverbFallback(display: string): string {
  if (/ly$/i.test(display)) return display;
  if (/[^aeiou]y$/i.test(display)) return display.slice(0, -1) + "ily";
  return display + "ly";
}

function parseLocative(link: string): LocativeLink | null {
  const i = link.indexOf(" ");
  if (i <= 0) return null;
  return { preposition: link.slice(0, i), location: link.slice(i + 1) };
}

function qualifierFrom(raw: unknown): Qualifier {
  const q = asRecord(raw);
  return {
    descriptor: String(q.descriptor ?? ""),
    value: String(q.value ?? ""),
    number: typeof q.number === "number" ? q.number : undefined,
    unit: optionalString(q.unit),
  };
}

function optionalString(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asRecord(v: unknown): Yaml {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Yaml : {};
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
