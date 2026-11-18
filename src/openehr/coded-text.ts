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
  full: "Full",
  reduced: "Nedsatt",
  limited: "Begränsad",
  minimal: "Minimal",
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
};

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

/** Local terminology rubrics must stay English so the GP OPT validator matches. */
export function localCodedText(_at: string, text: string, _language: NoteLanguage): string {
  return text;
}

export function durationDisplay(number: number, unit: string, language: NoteLanguage): string | undefined {
  if (language !== "sv") return undefined;
  const word = swedish.unit(unit, number);
  return `${number} ${word}`;
}