import { knowledge } from "../knowledge.ts";
import type { Finding } from "../../vendor/sentence.ts";
import { englishFromKnowledge, render } from "../../vendor/sentence.ts";

const INDEFINITE = { gender: "en" as const, definite: false, plural: false };

/**
 * English GP-note line with the same body-site deduplication rules as {@link renderSwedishGp}:
 * pre-coordinated topics ("thumb sprain") with laterality use the base noun ("sprain of right thumb").
 * Presence is unmarked (no trailing "present").
 */
export function renderEnglishGp(finding: Finding): string {
  const category = knowledge.concepts[finding.topic]?.category;
  if (category === "disease") {
    return finishEnglishLine(englishDiseaseLine(finding));
  }
  return finishEnglishLine(render(finding, knowledge));
}

function finishEnglishLine(line: string): string {
  const trimmed = line.replace(/,?\s*present\s*$/i, "").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function englishDiseaseLine(finding: Finding): string {
  const lang = englishFromKnowledge(knowledge);
  const head = englishHeadPhrase(finding);
  const prep = englishLocativePreposition(finding, head);
  const place = englishPlacePhrase(finding, prep, lang);
  if (finding.summary === "possible") return capitalise(joinParts(["Possible", head, place]));
  if (finding.summary === "excluded") return capitalise(joinParts([head, place, "excluded"]));
  if (finding.summary === "absence") return capitalise(joinParts(["No", head, place]));
  return capitalise(joinParts([head, place]));
}

function englishHeadPhrase(finding: Finding): string {
  const topicDisplay = knowledge.concepts[finding.topic]?.display ?? finding.topic;
  if (!finding.location) return topicDisplay;
  const locDisplay = knowledge.concepts[finding.location]?.display ?? "";
  const includes =
    locDisplay.length > 0 && topicDisplay.toLowerCase().startsWith(`${locDisplay.toLowerCase()} `);
  if (includes && (finding.laterality || finding.subLocation)) {
    return topicDisplay.slice(locDisplay.length).trim();
  }
  if (finding.location === "Thumb" && finding.topic.startsWith("Thumb")) {
    const tail = finding.topic.slice(5);
    if (tail && knowledge.concepts[tail]) {
      return knowledge.concepts[tail].display;
    }
    if (includes) return topicDisplay.slice(locDisplay.length).trim();
  }
  return topicDisplay;
}

function englishLocativePreposition(finding: Finding, headPhrase: string): string {
  const links = knowledge.locatives[finding.topic] ?? [];
  const match = finding.location ? links.find((l) => l.location === finding.location) : undefined;
  const link = match ?? links[links.length - 1];
  if (link) return link.preposition;
  const head = headPhrase.toLowerCase();
  if (/sprain|dislocation|swelling|osteoarthritis|rheumatoid/.test(head)) return "of";
  if (/fracture|pain/.test(head)) return "in";
  if (/infection|paronychia|whitlow/.test(head)) return "on";
  return "in";
}

function englishPlacePhrase(
  finding: Finding,
  prep: string,
  lang: ReturnType<typeof englishFromKnowledge>,
): string {
  if (!finding.location && !finding.laterality) return "";
  const sub = finding.subLocation
    ? `${lang.noun(finding.subLocation, agreementFor(finding.subLocation, lang))} ${lang.subJoiner()} `
    : "";
  const locAgree = agreementFor(finding.location ?? "Thumb", lang);
  const side = finding.laterality;
  const both = side === "both";
  const sideAgree = both ? { ...locAgree, plural: true } : locAgree;
  const lat = both
    ? `${lang.laterality("left", sideAgree)} and ${lang.laterality("right", sideAgree)}`
    : side
      ? lang.laterality(side, locAgree)
      : "";
  const locWord = finding.location
    ? lang.noun(finding.location, both ? { ...locAgree, plural: true } : locAgree)
    : "";
  const slots = lang.locationOrder === "lat-loc-sub" ? [lat, locWord, sub.trimEnd()] : [sub, lat, locWord];
  return joinParts([prep, ...slots.filter((p) => p.length > 0)]);
}

function agreementFor(name: string, lang: ReturnType<typeof englishFromKnowledge>) {
  return lang.agreement?.(name) ?? INDEFINITE;
}

function joinParts(parts: string[]): string {
  return parts.filter((part) => part.length > 0).join(" ");
}

function capitalise(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/** True when a location-prefixed topic co-occurs with the same body-site word (e.g. "thumb sprain … thumb"). */
export function englishBodySiteRedundant(sentence: string): boolean {
  const lower = sentence.toLowerCase();
  const sitePattern = /\b(thumb|finger|hand|wrist)\b/g;
  const sites = [...lower.matchAll(sitePattern)].map((m) => m.index ?? 0);
  if (sites.length < 2) return false;
  return /\b(thumb|finger|hand|wrist) (?:pain|swelling|sprain|fracture|dislocation)\b/.test(lower)
    && /\b(?:left |right )?(?:thumb|finger|hand|wrist)\b/.test(lower);
}