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

const LOCAL_LABELS: Record<string, { en: string; sv: string }> = {
  at0006: { en: "Flexion", sv: "Flexion" },
  at0005: { en: "Extension", sv: "Extension" },
  at0003: { en: "Abduction", sv: "Abduktion" },
  at0004: { en: "Adduction", sv: "Adduktion" },
  at0024: { en: "Moderate", sv: "Måttlig" },
  at0023: { en: "Mild", sv: "Lätt" },
  at0025: { en: "Severe", sv: "Svår" },
  at0048: { en: "Moderate", sv: "Måttlig" },
  at0047: { en: "Mild", sv: "Lätt" },
  at0049: { en: "Severe", sv: "Svår" },
};

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

const CLUSTER_VALUE_KEYS = new Set([
  "infrequent", "occasional", "frequent",
  "soft", "firm", "hard", "fluctuant",
  "smooth", "rough", "nodular", "irregular",
  "full", "reduced", "limited", "minimal", "fixed",
]);

/** English rubrics for EN compositions; Swedish only for new cluster value sets. */
export function localCodedText(_at: string, text: string, language: NoteLanguage, clinergyKey?: string): string {
  if (language === "sv" && clinergyKey && CLUSTER_VALUE_KEYS.has(clinergyKey)) {
    return localValueRubric(clinergyKey, text, language);
  }
  return text;
}

export function durationDisplay(number: number, unit: string, language: NoteLanguage): string | undefined {
  if (language !== "sv") return undefined;
  const word = swedish.unit(unit, number);
  return `${number} ${word}`;
}