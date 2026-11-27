import { parse } from "yaml";
import bodymap from "../data/bodymap-onelist.json";
import topicsIndex from "../data/topics-index.json";
import locationTopics from "../data/location-topics.json";
import topicSystems from "../data/topic-systems.json";
import topicLists from "../data/topic-lists.json";
import manifest from "../data/images-manifest.json";
import rulesRaw from "../../data/sentence-rules.yaml?raw";
import conceptsRaw from "../../data/concepts.yaml?raw";
import linksRaw from "../../data/concept-links.yaml?raw";
import { knowledgeFromExtract } from "./sentence/knowledge.ts";
import type { SentenceKnowledge } from "./sentence/types.ts";
import type { ExamDefinition, GeneratedExamsCatalog } from "./form/exams.ts";
import { sentenceKnowledgeFromGenerated, type GeneratedSentenceKnowledge } from "./sentence/generate.ts";

export interface MapSublocation {
  label: string | null;
  concept: string;
  hotspot: [number, number, number, number];
}

export interface MapRegion {
  label: string | null;
  concept: string;
  hotspot: [number, number, number, number];
  inset: string | null;
  insetRect: [number, number, number, number] | null;
  insetImageId: string | null;
  root: boolean;
  sublocations: MapSublocation[];
}

export interface BodyMapData {
  selectors: Array<{
    label: string;
    style: string;
    tsFlagType: string;
    settings: Record<string, string[]>;
    options: Array<{
      n: string;
      sex: string;
      label: string;
      system: string;
      anatomyMap: string;
      bitmaps: string[];
      buttonIds: string[];
    }>;
  }>;
  mainGraphics: Record<string, {
    concept: string;
    hotspot: [number, number, number, number];
    picture: string;
    imageId: string | null;
    rect: [number, number, number, number];
  }>;
  maps: Record<string, MapRegion[]>;
  defaultMaps?: { male: string; female: string };
}

export interface FormRow {
  feature?: string;
  criterialLink?: string;
  values: unknown[];
  multiple?: boolean;
  inheritance?: string;
  /** Applied when the form is first opened. */
  default?: unknown;
  /** Hide this row unless the named feature (or laterality) has one of these values. */
  visibleWhen?: { feature: string; values: string[] };
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
  perSide?: string[] | null;
  signs?: string[];
  subExams?: string[];
}

export interface RemakeForm {
  topic: string;
  display: string;
  category?: string;
  summaryType: string;
  location: string | null;
  firstLayer: FormRow[];
  moreLayer: FormRow[];
  associatedSymptomsAndSigns: FormLink[];
  diagnoses: FormLink[];
  otherLinks?: FormLink[];
  examinations: FormExam[];
}

export interface TopicInfo {
  display: string;
  category: string | null;
  file: string | null;
}

export const bodyMap = bodymap as unknown as BodyMapData;
const fallbackSentenceKnowledge: SentenceKnowledge = knowledgeFromExtract(
  parse(rulesRaw),
  parse(conceptsRaw),
  parse(linksRaw),
);

let sentenceKnowledgeState: SentenceKnowledge = fallbackSentenceKnowledge;

/** Live binding used by the remake; replaced when the generated catalogue loads. */
export let sentenceKnowledge: SentenceKnowledge = sentenceKnowledgeState;

export function getSentenceKnowledge(): SentenceKnowledge {
  return sentenceKnowledgeState;
}

export function setSentenceKnowledge(next: SentenceKnowledge | null): void {
  sentenceKnowledgeState = next ?? fallbackSentenceKnowledge;
  sentenceKnowledge = sentenceKnowledgeState;
}

export function applyGeneratedSentenceKnowledge(doc: GeneratedSentenceKnowledge | null): void {
  if (!doc) {
    setSentenceKnowledge(null);
    return;
  }
  setSentenceKnowledge(sentenceKnowledgeFromGenerated(doc));
}

export const topics: Record<string, TopicInfo> = (topicsIndex as { topics: Record<string, TopicInfo> }).topics;
export const locationTopicIndex = locationTopics as Record<string, { tsLinks: string[]; exams: string[]; systemLinks: string[] }>;
export const topicSystemIndex = topicSystems as Record<string, string[]>;
export const quickLists = topicLists as Record<string, Array<{ label: string; topicPermId: number; locationPermId: number }>>;
export const imageManifest = manifest as {
  version: number;
  images: Record<string, { id: string; originalRel: string; placeholder: string; folder: string; width: number | null; height: number | null }>;
};

/** Every remake form comes from the generated catalogue (loaded at startup). Hand-built YAML in data/ is for the separate thumb-pain demo only. */
let generatedForms: Record<string, RemakeForm> = {};
let generatedSignForms: Record<string, RemakeForm> = {};
let generatedExams: Record<string, ExamDefinition> = {};
let generatedSummaryTypes: GeneratedExamsCatalog["summaryTypes"] = {};

export function setGeneratedForms(forms: Record<string, RemakeForm> | null): void {
  generatedForms = forms ?? {};
}

export function setGeneratedExams(catalog: GeneratedExamsCatalog | null): void {
  generatedExams = catalog?.exams ?? {};
  generatedSignForms = catalog?.signs ?? {};
  generatedSummaryTypes = catalog?.summaryTypes ?? {};
}

export function examOf(name: string): ExamDefinition | null {
  return generatedExams[name] ?? null;
}

export function summaryOptions(summaryType: string | null | undefined): Array<{ attribute: string; value: string }> {
  if (!summaryType) return [];
  return generatedSummaryTypes[summaryType] ?? [];
}

export function formOf(topic: string): RemakeForm | null {
  return generatedForms[topic] ?? generatedSignForms[topic] ?? null;
}

export function topicDisplay(topic: string): string {
  return topics[topic]?.display || sentenceKnowledge.concepts[topic]?.display || topic.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

export function conceptDisplay(name: string): string {
  return sentenceKnowledge.concepts[name]?.display || name.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

export const symptomTopics: string[] = Object.entries(topics)
  .filter(([, t]) => t.category === "symptom")
  .map(([id]) => id)
  .sort((a, b) => topicDisplay(a).localeCompare(topicDisplay(b)));

export const diseaseTopics: string[] = Object.entries(topics)
  .filter(([, t]) => t.category === "disease")
  .map(([id]) => id)
  .sort((a, b) => topicDisplay(a).localeCompare(topicDisplay(b)));

export function topicsForSelector(kind: SelectorKind, location: string | null, system: string | null): string[] {
  let pool: string[];
  if (kind === "SYM") pool = symptomTopics;
  else if (kind === "DIS") pool = diseaseTopics;
  else if (kind === "QDE") {
    const labels = new Set((quickLists["Comtopic.ini"] ?? []).map((r) => r.label.toLowerCase()));
    pool = Object.keys(topics).filter((id) => labels.has(topicDisplay(id).toLowerCase()) || labels.has(id.toLowerCase()));
    if (!pool.length) pool = symptomTopics.slice(0, 40);
  } else {
    pool = Object.keys(topics).filter((id) => topics[id].category === categoryOf(kind));
  }
  if (location && locationTopicIndex[location]) {
    const allowed = new Set(locationTopicIndex[location].tsLinks);
    pool = pool.filter((id) => allowed.has(id) || formMatchesLocation(id, location));
  }
  if (system && system !== "FunctionalSystem" && system !== "DisabledSystem") {
    pool = pool.filter((id) => (topicSystemIndex[id] ?? []).includes(system));
  }
  return pool;
}

function formMatchesLocation(topic: string, location: string): boolean {
  const form = formOf(topic);
  return form?.location === location;
}

export type SelectorKind = "QDE" | "SYM" | "DIS" | "CHK" | "FH" | "PMH" | "INT";

function categoryOf(kind: SelectorKind): string | null {
  switch (kind) {
    case "SYM": return "symptom";
    case "DIS": return "disease";
    case "CHK": return "healthcheck";
    case "FH": return "familyhistory";
    case "PMH": return "pastmedicalhistory";
    case "INT": return "procedure";
    default: return null;
  }
}

export const selectorTitles: Record<SelectorKind, string> = {
  QDE: "Quick data entry — common topics",
  SYM: "Symptom selector",
  DIS: "Disease selector",
  CHK: "Health-check selector",
  FH: "Family-history selector",
  PMH: "Past-history selector",
  INT: "Intervention selector",
};
