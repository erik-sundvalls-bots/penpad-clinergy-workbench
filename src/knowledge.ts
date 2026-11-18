import { parse } from "yaml";
import rulesRaw from "../data/sentence-rules.yaml?raw";
import conceptsRaw from "../data/concepts.yaml?raw";
import linksRaw from "../data/concept-links.yaml?raw";
import mappingsRaw from "../data/mappings.yaml?raw";
import painRaw from "../data/ThumbPainSymptom.yaml?raw";
import swellingRaw from "../data/ThumbSwellingSymptom.yaml?raw";
import svRaw from "../lang/sv.yaml?raw";
import openehrRaw from "../mappings/openehr.yaml?raw";
import snomedRaw from "../mappings/snomed.yaml?raw";
import { languageFromPack, packFromParsed } from "../vendor/language.ts";
import { descriptorMapFromParsed, openGalenFromParsed, type DescriptorMap } from "../vendor/openehr.ts";
import { snomedMapFromParsed, type SnomedMap } from "../vendor/snomed.ts";
import { sentenceKnowledgeFromParsed, type SentenceKnowledge } from "../vendor/sentence.ts";

export interface FormRow {
  feature?: string;
  /** Consequence-style link (hasClinicalAbsence), not a descriptor row. */
  criterialLink?: string;
  values: unknown[];
  multiple?: boolean;
}
export interface FormLink {
  item: string;
  concept: string;
  preposition: string | null;
  location: string | null;
  preCoordinated: string | null;
  summaryType: string | null;
  category: string | null;
}
export interface FormExam {
  exam: string;
  perSide: string[] | null;
  signs: string[];
  subExams: string[];
}
export interface ClinergyForm {
  topic: string;
  display: string;
  /** symptom, sign or disease, as written by the extractor. */
  category?: string;
  summaryType: string;
  location: string | null;
  firstLayer: FormRow[];
  moreLayer: FormRow[];
  associatedSymptomsAndSigns: FormLink[];
  diagnoses: FormLink[];
  examinations: FormExam[];
}
export interface GalenRow {
  opengalen: string | null;
  kind?: string;
  iri?: string;
  method: string;
  needsHumanReview?: boolean;
}

export const knowledge: SentenceKnowledge = sentenceKnowledgeFromParsed(
  parse(rulesRaw),
  parse(conceptsRaw),
  parse(linksRaw),
);
export const swedish = languageFromPack(packFromParsed(parse(svRaw)));
export const descriptorMap: DescriptorMap = descriptorMapFromParsed(parse(openehrRaw));
export const snomedMap: SnomedMap = snomedMapFromParsed(parse(snomedRaw));
export const openGalenBindings = openGalenFromParsed(parse(mappingsRaw));
export const galenRows = parse(mappingsRaw) as Record<string, GalenRow>;
export const painForm = parse(painRaw) as ClinergyForm;
export const swellingForm = parse(swellingRaw) as ClinergyForm;

export function conceptLabel(key: string): string {
  return knowledge.concepts[key]?.display || key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
}
