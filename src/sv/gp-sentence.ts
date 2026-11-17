import { knowledge, swedish } from "../knowledge.ts";
import type { Finding } from "../../vendor/sentence.ts";

const INDEFINITE = { gender: "en" as const, definite: false, plural: false };

/**
 * Swedish GP-note line for one finding.
 * Presence is unmarked (no trailing "föreligger"). Severity agrees with the
 * head noun. A sub-location is definite ("ytterfalangen"). Swelling sits
 * "på" the thumb; pain and a diagnosis sit "i". Duration is "sedan".
 */
export function renderSwedishGp(finding: Finding): string {
  const head = headKey(finding);
  const headAgree = agreementFor(head);
  const headNoun = swedish.noun(head, { ...headAgree, definite: false, plural: false });
  const severity = qualifier(finding, "AbsoluteSeverity") ?? qualifier(finding, "Severity");
  const onset = qualifier(finding, "AbsoluteOnset") ?? qualifier(finding, "Onset");
  const duration = finding.qualifiers.find((item) => item.descriptor === "QuantityDuration" || item.descriptor === "Duration");
  const severityWord = severity ? swedish.adjective(severity.value, headAgree) : "";
  const sub = finding.subLocation
    ? `av ${swedish.noun(finding.subLocation, { ...agreementFor(finding.subLocation), definite: true, plural: false })}`
    : "";
  const place = placePhrase(finding);
  const since = duration?.number != null
    ? `sedan ${duration.number} ${swedish.unit(duration.unit ?? "day", duration.number)}`
    : "";
  const debut = onset ? `${swedish.noun(onset.value, INDEFINITE)} debut` : "";
  const disease = knowledge.concepts[finding.topic]?.category === "disease" || knowledge.concepts[head]?.category === "disease";

  if (disease) return diagnosisLine(headNoun, headAgree.gender, finding.summary, place);
  if (finding.summary === "absence") {
    return capitalise(join(["Ingen", headNoun, sub, place, since])) + ".";
  }
  const core = join([severityWord, headNoun, sub, place, since]);
  const sentence = debut ? `${core}, ${debut}` : core;
  return capitalise(sentence) + ".";
}

function diagnosisLine(headNoun: string, gender: "en" | "ett", summary: string | undefined, place: string): string {
  if (summary === "possible") return capitalise(join(["Misstänkt", headNoun, place])) + ".";
  if (summary === "excluded") {
    const word = gender === "ett" ? "uteslutet" : "utesluten";
    return capitalise(join([headNoun, place, word])) + ".";
  }
  return capitalise(join([headNoun, place])) + ".";
}

function placePhrase(finding: Finding): string {
  if (!finding.location && !finding.laterality) return "";
  const prep = /pain/i.test(finding.topic) ? "i" : /swelling/i.test(finding.topic) ? "på" : "i";
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
  if (!(finding.laterality || finding.subLocation) || !includes) return finding.topic;
  const rest = topicDisplay.slice(locDisplay.length).trim().toLowerCase();
  const match = Object.entries(knowledge.concepts).find(([name, concept]) =>
    name !== finding.topic && concept.display.toLowerCase() === rest
  );
  return match?.[0] ?? finding.topic;
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
