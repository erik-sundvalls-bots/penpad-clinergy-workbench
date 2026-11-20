import { swedish } from "../knowledge.ts";
import type { NoteLanguage } from "../exam/phrases.ts";
import { term } from "./terms.ts";

const CLINERGY_SV: Record<string, string> = {
  Thumb: "Tumme",
  distalPhalanx: "ytterfalang",
  ThumbPainSymptom: "Smärta i tumme",
  ThumbSwellingSymptom: "Svullnad av tumme",
  ThumbSprain: "Stukning av tumme",
  gradual: "Gradvis",
  moderate: "Måttlig",
  mild: "Lätt",
  severe: "Svår",
  full: "Fullt",
  reduced: "Nedsatt",
  limited: "Begränsad",
  fixed: "Fixerad",
  week: "vecka",
  day: "dag",
  FlexionSign: "Flexion",
  ExtensionSign: "Extension",
  AbductionSign: "Abduktion",
  AdductionSign: "Adduktion",
  normal: "utan anmärkning",
  throbbingPain: "Bultande",
  rightSelection: "Höger",
  leftSelection: "Vänster",
  infrequent: "Sällan",
  occasional: "Ibland",
  frequent: "Ofta",
  soft: "Mjuk",
  firm: "Fast",
  hard: "Hård",
  fluctuant: "Fluktuerande",
  smooth: "Slät",
  rough: "Grov",
  nodular: "Knölig",
  irregular: "Oregelbunden",
};

const PAIN_MOVEMENT_SV: Record<string, string> = {
  absence: "Ingen smärta",
  mild: "Lätt smärta",
  moderate: "Måttlig smärta",
  severe: "Svår smärta",
};

export function localValueRubric(key: string, english: string, language: NoteLanguage): string {
  if (language !== "sv") return english;
  return CLINERGY_SV[key] ?? english;
}

export function painOnMovementRubric(key: string, english: string, language: NoteLanguage): string {
  if (language !== "sv") return english;
  return PAIN_MOVEMENT_SV[key] ?? english;
}

export function clinergyCodedText(key: string, language: NoteLanguage): string {
  if (language === "sv") {
    const mapped = CLINERGY_SV[key];
    if (mapped) return mapped;
    try {
      return swedish.noun(key, { gender: "en", definite: false, plural: false });
    } catch {
      /* fall through */
    }
  }
  return term(key)?.preferred ?? key;
}

const LOCAL_SV_OVERRIDES: Record<string, string> = {
  better: "Förbättras",
  same: "Stabil",
  worse: "Försämras",
  healed: "Gått tillbaka",
  partiallyHealed: "Resolution",
  nonHealed: "Ej resolution",
  absence: "Nej",
  possible: "Misstänkt",
  bilateral: "Höger och vänster",
};

/** Local archetype coded-text rubric matching the OPT term_definitions for `language`. */
export function localCodedText(at: string, text: string, language: NoteLanguage, clinergyKey?: string): string {
  if (language !== "sv" || !clinergyKey) return text;
  if (at === "at0182" && clinergyKey === "same") return "Oförändrad";
  if (LOCAL_SV_OVERRIDES[clinergyKey]) return LOCAL_SV_OVERRIDES[clinergyKey];
  return localValueRubric(clinergyKey, text, language);
}

export function durationDisplay(number: number, unit: string, language: NoteLanguage): string | undefined {
  if (language !== "sv") return undefined;
  const word = swedish.unit(unit, number);
  return `${number} ${word}`;
}