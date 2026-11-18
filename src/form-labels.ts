import { knowledge, swedish } from "./knowledge.ts";
import { formOf, displayOf } from "./forms/catalog.ts";
import type { FormLink } from "./knowledge.ts";

export type UiLang = "en" | "sv";

const SV_HEAD = { gender: "en" as const, definite: false, plural: false };

const DURATION_UNIT_KEYS = ["second", "minute", "hour", "day", "week", "month", "year"] as const;

const DURATION_UNIT_EN: Record<string, string> = {
  second: "seconds",
  minute: "minutes",
  hour: "hours",
  day: "days",
  week: "weeks",
  month: "months",
  year: "years",
};

const UI: Record<string, { en: string; sv: string }> = {
  diagnosesHeading: { en: "Diagnoses", sv: "Diagnoser" },
  commentPlaceholder: { en: "Free-text comment", sv: "Fritextkommentar" },
  commentAria: { en: "Comment", sv: "Kommentar" },
  durationUnitAria: { en: "Duration unit", sv: "Varaktighetsenhet" },
  decreaseDuration: { en: "Decrease duration", sv: "Minska varaktighet" },
  increaseDuration: { en: "Increase duration", sv: "Öka varaktighet" },
};

const FEATURE: Record<string, { en: string; sv: string }> = {
  laterality: { en: "Laterality", sv: "Lateralitet" },
  sublocation: { en: "Sublocation", sv: "Subläge" },
  QuantityDuration: { en: "Duration", sv: "Varaktighet" },
  AbsolutePainDescriptor: { en: "Character", sv: "Karakter" },
  AbsoluteSeverity: { en: "Severity", sv: "Svårighetsgrad" },
  AbsoluteFrequency: { en: "Frequency", sv: "Frekvens" },
  AbsoluteOnset: { en: "Onset", sv: "Debut" },
  AbsoluteProgress: { en: "Progress", sv: "Förlopp" },
  AbsoluteProcessPattern: { en: "Pattern", sv: "Mönster" },
  AbsoluteConsistency: { en: "Consistency", sv: "Konsistens" },
  AbsoluteTexture: { en: "Texture", sv: "Textur" },
  AbsoluteHealingCharacter: { en: "Healing", sv: "Läkning" },
};

const CHOICE: Record<string, { en: string; sv: string }> = {
  healed: { en: "healed", sv: "läkt" },
  partiallyHealed: { en: "partially healed", sv: "delvis läkt" },
  nonHealed: { en: "not healed", sv: "inte läkt" },
  leftSelection: { en: "left", sv: "vänster" },
  rightSelection: { en: "right", sv: "höger" },
  presence: { en: "present", sv: "närvarande" },
  absence: { en: "absent", sv: "frånvarande" },
  possible: { en: "possible", sv: "möjlig" },
  excluded: { en: "excluded", sv: "utesluten" },
  mild: { en: "mild", sv: "lindrig" },
  moderate: { en: "moderate", sv: "måttlig" },
  severe: { en: "severe", sv: "svår" },
  gradual: { en: "gradual", sv: "gradvis" },
  rapid: { en: "rapid", sv: "snabb" },
  sudden: { en: "sudden", sv: "plötslig" },
  better: { en: "better", sv: "bättre" },
  same: { en: "same", sv: "oförändrat" },
  worse: { en: "worse", sv: "sämre" },
  achingPain: { en: "aching", sv: "värkande" },
  piercingPain: { en: "piercing", sv: "genomborrande" },
  dullPain: { en: "dull", sv: "trubbig" },
  throbbingPain: { en: "throbbing", sv: "pulserande" },
  pressingPain: { en: "pressing", sv: "tryckande" },
  burningPain: { en: "burning", sv: "brännande" },
  soft: { en: "soft", sv: "mjuk" },
  firm: { en: "firm", sv: "fast" },
  hard: { en: "hard", sv: "hård" },
  fluctuant: { en: "fluctuant", sv: "fluktuerande" },
  rough: { en: "rough", sv: "grov" },
  smooth: { en: "smooth", sv: "slät" },
  nodular: { en: "nodular", sv: "knölig" },
  irregular: { en: "irregular", sv: "oregelbunden" },
  distalPhalanx: { en: "distal phalanx", sv: "ytterfalang" },
  proximalPhalanx: { en: "proximal phalanx", sv: "grundfalang" },
  InterphalangealJoint: { en: "I-P joint", sv: "fingrled" },
  MetacarpoPhalangealJoint: { en: "MCP joint", sv: "MCP-led" },
  ThenarEminence: { en: "thenar eminence", sv: "thenarmuskulatur" },
  ThumbNail: { en: "thumb nail", sv: "tumnagel" },
};

function capitalizeSentence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function featureLabel(feature: string, lang: UiLang): string {
  const hit = FEATURE[feature];
  if (hit) return hit[lang];
  const display = knowledge.concepts[feature]?.display;
  if (display) return capitalizeSentence(display);
  return feature.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

/** Skip rows that exist in the extract but are not persisted in this workbench. */
export function skipFeatureRow(feature: string): boolean {
  return feature === "QuantityTimeOcc";
}

export function choiceButtonLabel(value: string, lang: UiLang): string {
  const hit = CHOICE[value];
  if (hit) return hit[lang];
  const display = knowledge.concepts[value]?.display;
  if (display) return display;
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}

export function diagnosisRowLabel(link: FormLink, lang: UiLang): string {
  const topic = link.preCoordinated ?? link.concept;
  if (lang === "sv") {
    return capitalizeSentence(swedish.noun(topic, SV_HEAD));
  }
  const display = formOf(topic)?.display ?? displayOf(topic);
  return capitalizeSentence(display);
}

export function diseaseFormHeading(topic: string, lang: UiLang): string {
  if (lang === "sv") {
    return capitalizeSentence(swedish.noun(topic, SV_HEAD));
  }
  return capitalizeSentence(formOf(topic)?.display ?? displayOf(topic));
}

export function durationUnitLabel(key: string, lang: UiLang): string {
  if (lang === "en") return DURATION_UNIT_EN[key] ?? key;
  return swedish.unit(key, 2);
}

export function durationUnitKeys(): readonly string[] {
  return DURATION_UNIT_KEYS;
}

export function uiString(key: string, lang: UiLang): string {
  const row = UI[key as keyof typeof UI];
  return row?.[lang] ?? key;
}