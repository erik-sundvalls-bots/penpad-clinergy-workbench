import { findingForSentence } from "../finding-render.ts";
import { knowledge, swedish } from "../knowledge.ts";
import type { Finding } from "../../vendor/sentence.ts";

const INDEFINITE = { gender: "en" as const, definite: false, plural: false };

/** Mirrors English descriptor precedence (character closest to the head noun). */
const DESCRIPTOR_ORDER = [
  "AbsolutePainDescriptor",
  "AbsoluteSeverity",
  "AbsoluteFrequency",
  "AbsoluteConsistency",
  "AbsoluteTexture",
  "AbsoluteProgress",
  "AbsoluteProcessPattern",
] as const;

/**
 * Swedish GP-note line for one finding.
 * Presence is unmarked (no trailing "föreligger"). Severity agrees with the
 * head noun. A sub-location is definite ("ytterfalangen"). Swelling sits
 * "på" the thumb; pain and a diagnosis sit "i". Duration is "sedan".
 */
export function renderSwedishGp(input: Finding): string {
  const finding = findingForSentence(input);
  const head = headKey(finding);
  const headAgree = agreementFor(head);
  const headNoun = swedish.noun(head, { ...headAgree, definite: false, plural: false });
  const onset = qualifier(finding, "AbsoluteOnset") ?? qualifier(finding, "Onset");
  const duration = finding.qualifiers.find((item) => item.descriptor === "QuantityDuration" || item.descriptor === "Duration");
  const descriptorWords = descriptorPhrase(finding, headAgree);
  const sub = finding.subLocation
    ? `av ${swedish.noun(finding.subLocation, { ...agreementFor(finding.subLocation), definite: true, plural: false })}`
    : "";
  const place = placePhrase(finding, head);
  const since = duration?.number != null
    ? `sedan ${duration.number} ${swedish.unit(duration.unit ?? "day", duration.number)}`
    : "";
  const debut = onset ? `${swedish.noun(onset.value, INDEFINITE)} debut` : "";
  const disease = knowledge.concepts[finding.topic]?.category === "disease" || knowledge.concepts[head]?.category === "disease";

  if (disease) return diagnosisLine(headNoun, headAgree.gender, finding.summary, place);
  if (finding.summary === "absence") {
    return capitalise(join(["Ingen", headNoun, place])) + ".";
  }
  const core = join([...descriptorWords, headNoun, sub, place, since]);
  const sentence = debut ? `${core}, ${debut}` : core;
  return capitalise(sentence) + ".";
}

function descriptorPhrase(
  finding: Finding,
  headAgree: { gender: "en" | "ett"; definite: boolean; plural: boolean },
): string[] {
  const words: string[] = [];
  for (const descriptor of DESCRIPTOR_ORDER) {
    const q = qualifier(finding, descriptor);
    if (!q) continue;
    if (descriptor === "AbsoluteSeverity") {
      words.push(swedish.adjective(q.value, headAgree));
      continue;
    }
    const bag = swedish.agreement?.(q.value) as { adjective?: string; indeclinable?: boolean } | undefined;
    if (bag?.adjective && !bag.indeclinable) {
      words.push(swedish.adjective(q.value, headAgree));
    } else {
      words.push(swedish.noun(q.value, { ...headAgree, definite: false, plural: false }));
    }
  }
  return words;
}

function diagnosisLine(headNoun: string, gender: "en" | "ett", summary: string | undefined, place: string): string {
  if (summary === "possible") return capitalise(join(["Misstänkt", headNoun, place])) + ".";
  if (summary === "excluded") {
    const word = gender === "ett" ? "uteslutet" : "utesluten";
    return capitalise(join([headNoun, place, word])) + ".";
  }
  return capitalise(join([headNoun, place])) + ".";
}

function placePhrase(finding: Finding, head: string): string {
  if (!finding.location && !finding.laterality) return "";
  const prep = locationPreposition(finding, head);
  const agree = finding.location ? agreementFor(finding.location) : INDEFINITE;
  const side = finding.laterality === "both"
    ? "vänster och höger"
    : finding.laterality
      ? swedish.laterality(finding.laterality, { ...agree, definite: false, plural: false })
      : "";
  const loc = finding.location
    ? swedish.noun(finding.location, { ...agree, definite: false, plural: false })
    : "";
  return `${prep} ${join([side, loc])}`;
}

function headKey(finding: Finding): string {
  if (!finding.location) return finding.topic;
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? "";
  const locDisplay = knowledge.concepts[finding.location]?.display ?? "";
  const includes = locDisplay.length > 0 && topicDisplay.toLowerCase().startsWith(`${locDisplay.toLowerCase()} `);
  if (includes) {
    const rest = topicDisplay.slice(locDisplay.length).trim().toLowerCase();
    const match = Object.entries(knowledge.concepts).find(([name, concept]) =>
      name !== finding.topic && concept.display.toLowerCase() === rest
    );
    if (match) return match[0];
  }
  if (finding.location === "Thumb" && finding.topic.startsWith("Thumb")) {
    const tail = finding.topic.slice(5);
    if (tail && swedish.agreement?.(tail)) return tail;
  }
  if (!(finding.laterality || finding.subLocation) || !includes) return finding.topic;
  const rest = topicDisplay.slice(locDisplay.length).trim().toLowerCase();
  const match = Object.entries(knowledge.concepts).find(([name, concept]) =>
    name !== finding.topic && concept.display.toLowerCase() === rest
  );
  return match?.[0] ?? finding.topic;
}

function locationPreposition(finding: Finding, head: string): string {
  if (/sprain/i.test(finding.topic) || head === "Sprain") return "av";
  if (/swelling/i.test(finding.topic) || head === "SwellingSymptom") return finding.subLocation ? "på" : "av";
  if (/pain/i.test(finding.topic) || head === "PainSymptom") return "i";
  if (/fracture/i.test(finding.topic) || head === "Fracture") return "i";
  return "i";
}

/** True when a location-specific compound (e.g. tumsvullnad) co-occurs with an explicit body-site word. */
export function swedishBodySiteCompoundRedundant(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  const hasThumbSite = /\b(tumme|tummen|tummar)\b/.test(lower)
    || /\b(höger|vänster) tumme\b/.test(lower);
  if (!hasThumbSite) return false;
  return /\btum(?:smärta|svullnad|stukning|fraktur|led|nagel)/.test(lower);
}

function agreementFor(name: string): { gender: "en" | "ett"; definite: boolean; plural: boolean } {
  return {
    gender: swedish.agreement?.(name)?.gender === "ett" ? "ett" : "en",
    definite: false,
    plural: false,
  };
}

function qualifier(finding: Finding, descriptor: string): Finding["qualifiers"][number] | undefined {
  return finding.qualifiers.find((item) => item.descriptor === descriptor);
}

function join(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(" ");
}

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}
