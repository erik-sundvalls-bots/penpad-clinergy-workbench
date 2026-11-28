/**
 * Original-equivalent English summary sentences for the body-map remake.
 *
 * This module is a new implementation. It reads the extractor-authored rule
 * tables (precedence, position, value/descriptor word forms, locative
 * prepositions, concept displays) and composes a sentence. It does not import
 * or wrap the workbench's vendored renderer (that copy has local tweaks such
 * as a "both" laterality extension and a Swedish pack).
 *
 * The 1998 engine's source is not in this repository. Composition decisions
 * that the tables do not spell out are taken from the public walkthrough
 * (https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/) and are
 * listed below:
 *
 * - Higher descriptor precedence sits closer to the topic. Before the topic,
 *   lower precedence is further left. After the topic, higher precedence
 *   comes first. Value precedence breaks ties the same way.
 * - The topic's summary value (presence/absence/…) is rendered with the
 *   descriptor named in the topic's summary type (e.g. AbsentPresent maps
 *   presence to hasClinicalAbsence). If that row is missing, hasClinicalAbsence
 *   is used.
 * - If the topic has a single locative site (its usual location) and the
 *   finding has no laterality and no sub-location, the head is the
 *   pre-coordinated topic display ("abdominal pain", "thumb pain",
 *   "acoustic neuroma"). Laterality, a sub-location, or a location that is
 *   not that unique site switches to the prepositional head ("Pain in right
 *   thumb", "Subcutaneous infection on thumb"). The generic noun is the
 *   remainder after a leading location word, or else the last word of the
 *   display ("Lump in left anterior ribs region", "Dislocation of left ankle");
 *   "absent …" nominalises to "Absence of …". A selected sublocation replaces
 *   the parent site ("Swelling of right hypochondrium"). Laterality attaches to
 *   a site already named in the display ("Adenoma of nipple of left nipple",
 *   "Cold left arm") when there is no generic head to lift out. typ=5
 *   ConseqPain uses "painful" / "painless".
 * - PresentPossibleExcluded does not say "present" (just the topic, or
 *   "? topic", or "topic excluded"). YesNoPMH does not say "yes". ActionDoneSummary
 *   does not say "done". AbsentPresent still says "present" or prefixes "no"
 *   for absence. FamilyHistorySummary "none" is "no" in front of the topic.
 * - hasAggravatingFactor uses "aggravated by <value>", matching the original
 *   field caption, rather than the humanized descriptor name.
 * - A few value words are taken from the original engine's sentence forms
 *   when the extract lexicon has no adverb: possible → "?", absence → "no",
 *   same → "unchanging". Extract rule values "intermittant"/"persistant"
 *   also match intermittent/persistent.
 * - typ=5 consequence signs (ConseqTendernessSign, LocatInflammationSign)
 *   use the engine's short phrases (tender / non tender, inflamed / non
 *   inflamed) rather than descriptor adjective + "presently".
 * - A numeric qualifier uses "<descriptor word> <number> <unit>" when the
 *   rule order is descriptor-first ("for 3 days") and "<number> <unit>
 *   <descriptor word>" when value-first ("2 weeks ago"). typ=2 consequence
 *   nouns ("ago", "for") are used when the adjective form is missing.
 *   Systolic and diastolic blood pressure join as "120/80 mmHg".
 * - The first character of the finished sentence is capitalised; nothing else
 *   is forced to a case.
 * - Engine tokens in the YAML (valueAdj, valueNoun, descAdj, NoDescriptor,
 *   valFirst, …) are compared case-insensitively. valueAdj is the adverb of
 *   the value (lexicon.valueAdverbs, else +ly). valueNoun uses the concept
 *   display or lexicon noun ("presence" → "present").
 */
import type { Finding, Qualifier, Rendered, SentenceKnowledge } from "./types.ts";

export function renderSentence(finding: Finding, knowledge: SentenceKnowledge): string {
  return renderSentenceReport(finding, knowledge).sentence;
}

export function renderSentenceReport(finding: Finding, knowledge: SentenceKnowledge): Rendered {
  const missing: string[] = [];
  const qualifiers = foldBloodPressure(qualifiersOf(finding, knowledge, missing), knowledge, missing);
  const phrases = qualifiers.flatMap((q, index) => phraseOf(q, index, knowledge, missing));
  const before = phrases.filter((p) => p.before).sort(closerLast).map((p) => p.text);
  const after = phrases.filter((p) => !p.before).sort(closerFirst).map((p) => p.text);
  const head = headOf(finding, knowledge, missing);
  const parts = [before.join(", "), head, after.join(", ")].filter((p) => p.length > 0);
  return { sentence: capitalise(parts.join(" ")), missing: [...new Set(missing)] };
}

export function findingsFromParsed(doc: unknown): Finding[] {
  const rows = Array.isArray(doc) ? doc : [doc];
  return rows.map((row) => {
    const rec = asRecord(row);
    const inner = rec.finding && typeof rec.finding === "object" ? asRecord(rec.finding) : rec;
    const laterality = inner.laterality;
    if (laterality !== undefined && laterality !== "left" && laterality !== "right") {
      throw new Error(`laterality must be "left" or "right", got ${JSON.stringify(laterality)}`);
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

export function humanize(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/([A-Za-z])-+([A-Za-z])/g, "$1 $2")
    .toLowerCase();
}

export function pluralizeEn(word: string, n: number): string {
  if (n === 1) return word;
  if (/(?:s|x|z|ch|sh)$/i.test(word)) return word + "es";
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies";
  if (/s$/i.test(word)) return word;
  return word + "s";
}

interface BuiltPhrase {
  text: string;
  before: boolean;
  precedence: number;
  valuePrecedence: number;
  index: number;
}

function qualifiersOf(finding: Finding, knowledge: SentenceKnowledge, missing: string[]): Qualifier[] {
  const list = [...(finding.qualifiers ?? [])];
  const descriptor = summaryDescriptor(finding, knowledge);
  if (finding.summary && !list.some((q) => q.value === finding.summary && q.descriptor === descriptor)) {
    const summaryType = knowledge.concepts[finding.topic]?.summaryType;
    if (!isImplicitDefaultSummary(finding.summary, summaryType)) {
      list.push({ descriptor, value: finding.summary });
    }
  }
  if (finding.summary && !knowledge.descriptors[descriptor]) {
    missing.push(`rules:${descriptor}`);
  }
  return list;
}


function isImplicitDefaultSummary(summary: string | undefined, summaryType: string | null | undefined): boolean {
  if (summary === "presence" && summaryType === "PresentPossibleExcluded") return true;
  if (summary === "yesPMH" && summaryType === "YesNoPMH") return true;
  if (summary === "done" && summaryType === "ActionDoneSummary") return true;
  return false;
}

function summaryDescriptor(finding: Finding, knowledge: SentenceKnowledge): string {
  const summaryType = knowledge.concepts[finding.topic]?.summaryType;
  if (summaryType && finding.summary) {
    const row = knowledge.summaryTypes.find((s) => s.startsWith(`${summaryType}:`));
    const hit = row?.match(new RegExp(`\\{\\s*(\\S+)\\s+${escapeRe(finding.summary)}\\s*\\}`));
    if (hit) return hit[1];
  }
  return "hasClinicalAbsence";
}

function phraseOf(q: Qualifier, index: number, knowledge: SentenceKnowledge, missing: string[]): BuiltPhrase[] {
  const descriptor = knowledge.descriptors[q.descriptor];
  const rule = descriptor?.rules.find((r) => ruleValueMatches(r.value, q.value));
  if (!rule) {
    if (q.number == null && q.unit && /^\d/.test(q.unit.trim())) {
      return [{
        text: q.unit,
        before: false,
        precedence: descriptor?.precedence ?? 0,
        valuePrecedence: knowledge.valuePrecedences[q.value] ?? 0,
        index,
      }];
    }
    missing.push(`rules:${q.descriptor}.${q.value}`);
    const text = q.number != null
      ? [String(q.number), unitWord(q.unit ?? q.value, q.number, knowledge, missing)].join(" ")
      : adjectiveWord(q.value, knowledge, missing);
    return [{
      text,
      before: false,
      precedence: descriptor?.precedence ?? 0,
      valuePrecedence: knowledge.valuePrecedences[q.value] ?? 0,
      index,
    }];
  }
  if (q.number == null && q.unit && /\d/.test(q.unit) && (q.value === "BloodPressureValue" || q.descriptor === "hasManyValuedQuantity")) {
    return [{
      text: q.unit,
      before: isBefore(rule.position),
      precedence: descriptor?.precedence ?? 0,
      valuePrecedence: rule.valuePrecedence ?? knowledge.valuePrecedences[q.value] ?? 0,
      index,
    }];
  }
  const consequence = CONSEQUENCE_PHRASES[q.descriptor]?.[q.value];
  const prefix = DESCRIPTOR_PHRASE_PREFIX[q.descriptor];
  const descKind = descriptorKind(rule.descriptorForm);
  const valueWord = wordForValue(rule.valueForm, q.value, knowledge, missing);
  const descWord = q.number != null
    ? numericDescriptorWord(q.descriptor, descKind, knowledge, missing)
    : wordForDescriptor(descKind, q.descriptor, knowledge, missing);
  const text = q.number != null
    ? numericPhrase(rule.order, descWord, q.number, unitWord(q.unit ?? q.value, q.number, knowledge, missing))
    : consequence
      ? consequence
      : prefix
        ? joinWords([prefix, valueWord])
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

function wordForValue(valueForm: string, value: string, knowledge: SentenceKnowledge, missing: string[]): string {
  const engineWord = ENGINE_VALUE_WORDS[value];
  if (engineWord) return engineWord;
  switch (valueKind(valueForm)) {
    case "adverb":
      return adverbWord(value, knowledge, missing);
    case "noun":
      return nounWord(value, knowledge, missing);
    case "adjective":
    default:
      return adjectiveWord(value, knowledge, missing);
  }
}

function wordForDescriptor(
  kind: "none" | "noun" | "adj" | "negative",
  descriptor: string,
  knowledge: SentenceKnowledge,
  missing: string[],
): string | null {
  if (kind === "none") return null;
  if (kind === "noun") return nounWord(descriptor, knowledge, missing);
  if (kind === "negative") {
    const word = knowledge.lexicon.descriptors[descriptor]?.negative;
    if (word) return word;
    missing.push(`lexicon:${descriptor}.negative`);
    return humanize(descriptor);
  }
  return adjectiveWord(descriptor, knowledge, missing);
}

function numericDescriptorWord(
  descriptor: string,
  kind: "none" | "noun" | "adj" | "negative",
  knowledge: SentenceKnowledge,
  missing: string[],
): string | null {
  const lex = knowledge.lexicon.descriptors[descriptor];
  if (kind === "adj" && lex?.adjective) return lex.adjective;
  if (lex?.noun) return lex.noun;
  if (lex?.adjective) return lex.adjective;
  if (kind === "none") return null;
  return wordForDescriptor(kind, descriptor, knowledge, missing);
}

function foldBloodPressure(qualifiers: Qualifier[], knowledge: SentenceKnowledge, missing: string[]): Qualifier[] {
  const sys = qualifiers.find((q) => q.value === "SystolicBPValue" && q.number != null);
  const dia = qualifiers.find((q) => q.value === "DiastolicBPValue" && q.number != null);
  if (!sys || !dia) return qualifiers;
  const unit = unitWord(sys.unit ?? dia.unit ?? "millimetresOfMercury", sys.number ?? 1, knowledge, missing);
  return [
    ...qualifiers.filter((q) => q !== sys && q !== dia),
    {
      descriptor: "hasManyValuedQuantity",
      value: "BloodPressureValue",
      number: undefined,
      unit: `${sys.number}/${dia.number} ${unit}`,
    },
  ];
}

function numericPhrase(order: string, descriptorWord: string | null, n: number, unit: string): string {
  const num = String(n);
  return valueFirst(order) ? joinWords([num, unit, descriptorWord]) : joinWords([descriptorWord, num, unit]);
}

function uniqueLocative(finding: Finding, knowledge: SentenceKnowledge) {
  const links = knowledge.locatives[finding.topic] ?? [];
  return links.length === 1 ? links[0] : undefined;
}

/** True when location is the topic's only locative site (the usual place). */
function isInherentLocation(finding: Finding, knowledge: SentenceKnowledge): boolean {
  return Boolean(finding.location && uniqueLocative(finding, knowledge)?.location === finding.location);
}

function displayAlreadyLocated(display: string): boolean {
  return /\b(of|in|on|from)\b/i.test(display);
}

function shouldExpandHead(finding: Finding, knowledge: SentenceKnowledge): boolean {
  if (finding.laterality || finding.subLocation) return true;
  if (!finding.location || isInherentLocation(finding, knowledge)) return false;
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? "";
  // "adenoma of nipple" is already a locative display; do not append a second site.
  if (displayAlreadyLocated(topicDisplay)) return false;
  return true;
}

const GENERIC_HEADS = new Set([
  "pain", "swelling", "lump", "ache", "stiffness", "weakness", "tenderness", "rash",
  "oedema", "edema", "dislocation", "fracture", "sprain", "tear", "rupture",
  "ulcer", "wound", "lesion", "infection", "haemorrhage", "hemorrhage", "bleeding",
]);

function isGenericHead(rest: string, finding: Finding, knowledge: SentenceKnowledge): boolean {
  const key = rest.trim().toLowerCase();
  if (GENERIC_HEADS.has(key)) return true;
  // Diagnoses say "Foreign body in left eye"; the matching symptom keeps
  // the pre-coordinated name ("Eye foreign body in left eye").
  if (key === "foreign body") {
    const category = knowledge.concepts[finding.topic]?.category ?? "";
    return /disease|diagnosis/i.test(category) || /Diagnosis$/.test(finding.topic);
  }
  return false;
}

function grammaticalHead(finding: Finding, knowledge: SentenceKnowledge): string {
  if (!finding.location || !shouldExpandHead(finding, knowledge)) return finding.topic;
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? "";
  const locDisplay = knowledge.concepts[finding.location]?.display ?? "";
  const rewrite = Boolean(finding.laterality || finding.subLocation);
  // Attaching a non-inherent location without laterality keeps the full topic
  // display ("subcutaneous infection on thumb", "adenoma of nipple").
  if (!rewrite) return finding.topic;
  if (topicDisplay.toLowerCase().startsWith("absent ")) return "=absence";
  if (locDisplay && topicDisplay.toLowerCase().startsWith(locDisplay.toLowerCase() + " ")) {
    const rest = topicDisplay.slice(locDisplay.length).trim();
    if (isGenericHead(rest, finding, knowledge)) {
      return baseConcept(finding.topic, rest, knowledge) ?? rest;
    }
    // "ear discharge", "eye foreign body" (symptom): keep the pre-coordinated
    // name and still attach laterality on the locative.
    return finding.topic;
  }
  // "pitting ankle oedema" + laterality at Ankle → "pitting oedema of left ankle"
  // (only drop an exact single-word site that is already in the display, and
  // only when a generic finding word remains).
  if (rewrite && locDisplay && !/\s/.test(locDisplay.trim())) {
    const site = locDisplay.trim().toLowerCase();
    const words = topicDisplay.trim().split(/\s+/);
    const filtered = words.filter((w) => w.toLowerCase() !== site);
    if (filtered.length > 0 && filtered.length < words.length && filtered.some((w) => GENERIC_HEADS.has(w.toLowerCase()))) {
      return filtered.join(" ");
    }
  }
  const last = topicDisplay.trim().split(/\s+/).pop() ?? "";
  const prefix = topicDisplay.trim().slice(0, Math.max(0, topicDisplay.trim().length - last.length)).trim().toLowerCase();
  const locNorm = locDisplay.toLowerCase();
  const prefixOverlaps = prefix.length > 0 && prefix.split(/\s+/).some((w) => {
    const stem = (s: string) => s.replace(/s$/, "").slice(0, 4);
    return w.length >= 4 && locNorm.split(/\s+/).some((lw) => stem(lw) === stem(w));
  });
  if (prefixOverlaps && isGenericHead(last, finding, knowledge)) return last;
  return finding.topic;
}

function baseConcept(topic: string, rest: string, knowledge: SentenceKnowledge): string | undefined {
  const supers = new Set(knowledge.concepts[topic]?.supers ?? []);
  const matches = Object.entries(knowledge.concepts).filter(([, c]) =>
    c.display.toLowerCase() === rest.toLowerCase()
  ).filter(([name]) => name !== topic);
  return matches.find(([name]) => supers.has(name))?.[0] ?? matches[0]?.[0];
}

/** Prefer a locative site that is already named in the topic display (nipple over breast). */
function resolveLocation(finding: Finding, knowledge: SentenceKnowledge): string | undefined {
  const topicDisplay = (knowledge.concepts[finding.topic]?.display ?? "").toLowerCase();
  const links = knowledge.locatives[finding.topic] ?? [];
  if (topicDisplay && (finding.laterality || finding.subLocation)) {
    const named = links.find((link) => {
      const display = (knowledge.concepts[link.location]?.display ?? link.location).toLowerCase();
      return display.length > 1 && topicDisplay.includes(display);
    });
    if (named) return named.location;
  }
  return finding.location;
}

function insertLaterality(display: string, side: string): string {
  if (new RegExp(`\\b${side}\\b`, "i").test(display)) return display;
  const words = display.trim().split(/\s+/);
  if (words.length <= 1) return joinWords([side, display]);
  return [...words.slice(0, -1), side, words[words.length - 1]].join(" ");
}


function isRelativeSublocation(subWord: string): boolean {
  return /\b(quadrant|phalanx|pole|aspect|lobe|surface|margin|third|half|segment|part|border|commissure|pulp)\b/i.test(subWord);
}

function hasLocativePrep(finding: Finding, knowledge: SentenceKnowledge): boolean {
  const links = knowledge.locatives[finding.topic] ?? [];
  if (!links.length) return false;
  if (finding.location && links.some((link) => link.location === finding.location)) return true;
  return links.length === 1;
}

function headOf(finding: Finding, knowledge: SentenceKnowledge, missing: string[]): string {
  const location = resolveLocation(finding, knowledge);
  const located: Finding = location && location !== finding.location ? { ...finding, location } : finding;
  const topicNoun = nounWord(finding.topic, knowledge, missing);

  if (finding.subLocation) {
    const headName = grammaticalHead(located, knowledge);
    const noun = headName.startsWith("=") ? headName.slice(1) : nounWord(headName, knowledge, missing);
    const prep = locativePreposition(located, knowledge, missing);
    const subWord = nounWord(finding.subLocation, knowledge, missing);
    // Named regions stand alone ("Swelling of right hypochondrium").
    // Relative parts keep the parent site ("Lump in upper outer quadrant of breast",
    // "Swelling of distal phalanx of left thumb").
    const keepParent = Boolean(located.location) && (Boolean(finding.laterality) || isRelativeSublocation(subWord));
    if (keepParent && located.location) {
      const locWord = nounWord(located.location, knowledge, missing);
      const lat = finding.laterality ?? "";
      return joinWords([noun, prep, subWord, "of", lat, locWord]);
    }
    return joinWords([noun, prep, subWord]);
  }

  if (!shouldExpandHead(located, knowledge)) return topicNoun;

  const headName = grammaticalHead(located, knowledge);
  const rewritten = headName !== finding.topic;
  const canAttach = hasLocativePrep(located, knowledge) && Boolean(located.location);
  if (finding.laterality && !rewritten && !canAttach) {
    // "cold arm" → "cold left arm" when the locative table has no preposition.
    return insertLaterality(topicNoun, finding.laterality);
  }
  if (!located.location) return rewritten ? nounWord(headName, knowledge, missing) : topicNoun;
  const noun = headName.startsWith("=") ? headName.slice(1) : nounWord(headName, knowledge, missing);
  const prep = locativePreposition(located, knowledge, missing);
  const lat = finding.laterality ?? "";
  const locWord = nounWord(located.location, knowledge, missing);
  return joinWords([noun, prep, lat, locWord]);
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

function displayOf(name: string, knowledge: SentenceKnowledge, missing: string[]): string {
  const d = knowledge.concepts[name]?.display;
  if (d) return d;
  missing.push(`concepts:${name}.display`);
  return humanize(name);
}

function nounWord(name: string, knowledge: SentenceKnowledge, missing: string[]): string {
  return knowledge.lexicon.descriptors[name]?.noun || displayOf(name, knowledge, missing);
}

function adjectiveWord(name: string, knowledge: SentenceKnowledge, missing: string[]): string {
  const lex = knowledge.lexicon.descriptors[name]?.adjective;
  if (lex) return lex;
  if (knowledge.concepts[name]?.display) return knowledge.concepts[name].display;
  missing.push(`lexicon:${name}.adjective`);
  return humanize(name);
}

function adverbWord(name: string, knowledge: SentenceKnowledge, missing: string[]): string {
  const a = knowledge.lexicon.valueAdverbs[name];
  if (a) return a;
  missing.push(`lexicon:valueAdverbs.${name}`);
  return adverbFallback(displayOf(name, knowledge, missing));
}

function unitWord(name: string, n: number, knowledge: SentenceKnowledge, missing: string[]): string {
  const display = displayOf(name, knowledge, missing);
  if (/\s/.test(display) || /^(mmHg|mm|cm|kg|mls)$/i.test(display)) return display;
  return pluralizeEn(display, n);
}

function adverbFallback(display: string): string {
  if (/ly$/i.test(display)) return display;
  if (/[^aeiou]y$/i.test(display)) return display.slice(0, -1) + "ily";
  return display + "ly";
}

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
  return true;
}

function isBefore(position: string): boolean {
  const s = norm(position);
  return s === "beforetopic" || s === "before";
}

const norm = (s: string) => s.toLowerCase().replace(/[_-\s]/g, "");

/** Observed original-engine linking phrases for typ=1 factor lists. */
const DESCRIPTOR_PHRASE_PREFIX: Record<string, string> = {
  hasAggravatingFactor: "aggravated by",
};

/** typ=5 consequence phrases (engine s17) used in place of adjective + "presently". */
const CONSEQUENCE_PHRASES: Record<string, Record<string, string>> = {
  ConseqTendernessSign: { presence: "tender", absence: "non tender" },
  LocatInflammationSign: { presence: "inflamed", absence: "non inflamed" },
  ConseqPain: { presence: "painful", absence: "painless" },
};

/** Original-engine word forms observed in NatLanguageForConcept, used when the extract lexicon has no adverb. */
const ENGINE_VALUE_WORDS: Record<string, string> = {
  possible: "?",
  absence: "no",
  same: "unchanging",
  none: "no",
  nonePresent: "no",
  noDiurnalPattern: "no",
  DepotContraceptiveInjection: "depot injection",
};

/** Extract tables misspell two process-pattern values; accept both spellings. */
const RULE_VALUE_ALIASES: Record<string, string> = {
  intermittant: "intermittent",
  intermittent: "intermittant",
  persistant: "persistent",
  persistent: "persistant",
};

function ruleValueMatches(ruleValue: string, value: string): boolean {
  return ruleValue === value || RULE_VALUE_ALIASES[ruleValue] === value;
}


function closerLast(a: BuiltPhrase, b: BuiltPhrase): number {
  return a.precedence - b.precedence || a.valuePrecedence - b.valuePrecedence || a.index - b.index;
}
function closerFirst(a: BuiltPhrase, b: BuiltPhrase): number {
  return b.precedence - a.precedence || b.valuePrecedence - a.valuePrecedence || a.index - b.index;
}

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const joinWords = (parts: (string | null | undefined)[]) => parts.filter((p) => p && p.length).join(" ");

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

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
