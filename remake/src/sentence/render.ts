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
 * - While the finding has no laterality and no sub-location, and the topic
 *   display already starts with the location display ("thumb pain"), the head
 *   is that pre-coordinated display. Laterality or a sub-location switches to
 *   the prepositional head ("Pain in right thumb").
 * - A numeric qualifier uses "<descriptor word> <number> <unit>" when the
 *   rule order is descriptor-first, which is how "for 2 weeks" is written.
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
  const qualifiers = qualifiersOf(finding, knowledge, missing);
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
  return name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
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
    list.push({ descriptor, value: finding.summary });
  }
  if (finding.summary && !knowledge.descriptors[descriptor]) {
    missing.push(`rules:${descriptor}`);
  }
  return list;
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
  const rule = descriptor?.rules.find((r) => r.value === q.value);
  if (!rule) {
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
  const descKind = descriptorKind(rule.descriptorForm);
  const valueWord = wordForValue(rule.valueForm, q.value, knowledge, missing);
  const descWord = wordForDescriptor(descKind, q.descriptor, knowledge, missing);
  const text = q.number != null
    ? numericPhrase(rule.order, descWord, q.number, unitWord(q.unit ?? q.value, q.number, knowledge, missing))
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

function numericPhrase(order: string, descriptorWord: string | null, n: number, unit: string): string {
  const num = String(n);
  return valueFirst(order) ? joinWords([unit, num, descriptorWord]) : joinWords([descriptorWord, num, unit]);
}

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
  const matches = Object.entries(knowledge.concepts).filter(([, c]) =>
    c.display.toLowerCase() === rest.toLowerCase()
  ).filter(([name]) => name !== topic);
  return matches.find(([name]) => supers.has(name))?.[0] ?? matches[0]?.[0];
}

function headOf(finding: Finding, knowledge: SentenceKnowledge, missing: string[]): string {
  const headName = grammaticalHead(finding, knowledge);
  const noun = nounWord(headName, knowledge, missing);
  if (!finding.location) return noun;
  const locDisplay = knowledge.concepts[finding.location]?.display ?? "";
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? "";
  const includes = locDisplay.length > 0 && topicDisplay.toLowerCase().startsWith(locDisplay.toLowerCase() + " ");
  const expanded = Boolean(finding.laterality || finding.subLocation || !includes);
  if (!expanded) return nounWord(finding.topic, knowledge, missing);
  const prep = locativePreposition(finding, knowledge, missing);
  const sub = finding.subLocation
    ? `${nounWord(finding.subLocation, knowledge, missing)} of`
    : "";
  const lat = finding.laterality ?? "";
  const locWord = nounWord(finding.location, knowledge, missing);
  return joinWords([noun, prep, sub, lat, locWord]);
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
  return pluralizeEn(displayOf(name, knowledge, missing), n);
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
