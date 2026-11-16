import type { FormLink } from "./knowledge.ts";
import type { Finding, Qualifier } from "../vendor/sentence.ts";

export interface FindingForm {
  laterality: Array<"left" | "right">;
  sublocation: string | null;
  durationNumber: number | null;
  durationUnit: string;
  choices: Record<string, string | null>;
  summary: string | null;
}

export interface ExamSide {
  status: string | null;
  tenderness: string | null;
  flexionRange: string | null;
  flexionPain: string | null;
  extensionRange: string | null;
  extensionPain: string | null;
  abductionRange: string | null;
  abductionPain: string | null;
  adductionRange: string | null;
  adductionPain: string | null;
}

export interface WorkbenchState {
  painMore: boolean;
  pain: FindingForm;
  swellingOpen: boolean;
  swelling: FindingForm;
  /** Consequence links on the swelling form. Not rendered by the sentence generator. */
  consequences: Record<string, string | null>;
  stiffness: string | null;
  diagnoses: Record<string, string | null>;
  exam: { left: ExamSide; right: ExamSide };
  examOpen: "left" | "right" | null;
}

const PAIN_FEATURES = [
  "AbsolutePainDescriptor",
  "AbsoluteSeverity",
  "AbsoluteFrequency",
  "AbsoluteOnset",
  "AbsoluteProgress",
  "AbsoluteProcessPattern",
];
const SWELLING_FEATURES = [
  "AbsoluteOnset",
  "AbsoluteSeverity",
  "AbsoluteConsistency",
  "AbsoluteProgress",
  "AbsoluteTexture",
];

export function emptyExam(): ExamSide {
  return {
    status: null,
    tenderness: null,
    flexionRange: null,
    flexionPain: null,
    extensionRange: null,
    extensionPain: null,
    abductionRange: null,
    abductionPain: null,
    adductionRange: null,
    adductionPain: null,
  };
}

export function emptyFinding(): FindingForm {
  return {
    laterality: [],
    sublocation: null,
    durationNumber: null,
    durationUnit: "day",
    choices: {},
    summary: null,
  };
}

export function emptyState(): WorkbenchState {
  return {
    painMore: false,
    pain: emptyFinding(),
    swellingOpen: false,
    swelling: emptyFinding(),
    consequences: {},
    stiffness: null,
    diagnoses: {},
    exam: { left: emptyExam(), right: emptyExam() },
    examOpen: null,
  };
}

/** The state at the end of the public thumb-pain walkthrough (laterality right, swelling filled in). */
export function demoState(): WorkbenchState {
  const state = emptyState();
  state.pain.laterality = ["right"];
  state.swelling.summary = "presence";
  state.swelling.laterality = ["left"];
  state.swelling.sublocation = "distalPhalanx";
  state.swelling.durationNumber = 2;
  state.swelling.durationUnit = "week";
  state.swelling.choices.AbsoluteOnset = "gradual";
  state.swelling.choices.AbsoluteSeverity = "moderate";
  return state;
}

function lateralityOf(sides: Array<"left" | "right">): Finding["laterality"] {
  if (sides.length === 1) return sides[0];
  if (sides.length > 1) return "both";
  return undefined;
}

function qualifiersOf(form: FindingForm, features: string[]): Qualifier[] {
  const list: Qualifier[] = [];
  for (const feature of features) {
    const value = form.choices[feature];
    if (value) list.push({ descriptor: feature, value });
  }
  if (form.durationNumber != null && form.durationNumber > 0) {
    list.push({
      descriptor: "QuantityDuration",
      value: "TemporalValue",
      number: form.durationNumber,
      unit: form.durationUnit,
    });
  }
  return list;
}

function swellingActive(form: FindingForm): boolean {
  return Boolean(
    form.summary ||
      form.laterality.length ||
      form.sublocation ||
      (form.durationNumber != null && form.durationNumber > 0) ||
      Object.values(form.choices).some((value) => value),
  );
}

export function findingsFromState(state: WorkbenchState, diagnoses: FormLink[]): Finding[] {
  const findings: Finding[] = [{
    topic: "ThumbPainSymptom",
    location: "Thumb",
    laterality: lateralityOf(state.pain.laterality),
    qualifiers: qualifiersOf(state.pain, PAIN_FEATURES),
  }];
  if (swellingActive(state.swelling)) {
    findings.push({
      topic: "ThumbSwellingSymptom",
      location: "Thumb",
      laterality: lateralityOf(state.swelling.laterality),
      subLocation: state.swelling.sublocation ?? undefined,
      summary: state.swelling.summary ?? undefined,
      qualifiers: qualifiersOf(state.swelling, SWELLING_FEATURES),
    });
  }
  if (state.stiffness) {
    findings.push({ topic: "JointStiffnessSymptom", summary: state.stiffness, qualifiers: [] });
  }
  for (const link of diagnoses) {
    const summary = state.diagnoses[link.item];
    if (!summary) continue;
    findings.push(link.preCoordinated
      ? { topic: link.preCoordinated, summary, qualifiers: [] }
      : { topic: link.concept, location: link.location ?? undefined, summary, qualifiers: [] });
  }
  return findings;
}

/** Clinergy keys to look up in the OpenGALEN mapping file. */
export function selectedConceptKeys(findings: Finding[]): string[] {
  const keys: string[] = [];
  for (const finding of findings) {
    keys.push(finding.topic);
    if (finding.location) keys.push(finding.location);
    if (finding.subLocation) keys.push(finding.subLocation);
    if (finding.laterality === "left" || finding.laterality === "both") keys.push("leftSelection");
    if (finding.laterality === "right" || finding.laterality === "both") keys.push("rightSelection");
    if (finding.summary) keys.push(finding.summary);
    for (const qualifier of finding.qualifiers) {
      if (qualifier.unit) keys.push(qualifier.unit);
      if (qualifier.value && qualifier.value !== "TemporalValue") keys.push(qualifier.value);
    }
  }
  return [...new Set(keys)];
}

export function toggleChoice(current: string | null, value: string): string | null {
  return current === value ? null : value;
}

export function toggleSide(sides: Array<"left" | "right">, side: "left" | "right"): Array<"left" | "right"> {
  return sides.includes(side) ? sides.filter((item) => item !== side) : [...sides, side];
}

/** The OpenGALEN browser does the mapping. This is only the address of that tool. */
export const MAPPER_BASE = "https://erik-sundvalls-bots.github.io/opengalen-browser/";

export interface MapperContext {
  kind: "formTopic" | "exam" | "descriptor" | "criterialLink" | "value" | "concept";
  display?: string;
  feature?: string;
  siblings?: string[];
  forms?: string[];
}

interface MapperForm {
  topic: string;
  firstLayer: { feature?: string; values?: unknown[] }[];
  moreLayer: { feature?: string; values?: unknown[] }[];
  diagnoses?: FormLink[];
  associatedSymptomsAndSigns?: FormLink[];
}

/** Enough context for the browser to open one unmapped Clinergy name. */
export function mapperContext(key: string, forms: MapperForm[], display: string): MapperContext {
  const topics = new Set<string>();
  const valueHits: { feature: string; siblings: string[]; form: string }[] = [];
  const descriptorForms: string[] = [];
  for (const form of forms) {
    topics.add(form.topic);
    for (const link of [...(form.diagnoses ?? []), ...(form.associatedSymptomsAndSigns ?? [])]) {
      if (link.preCoordinated) topics.add(link.preCoordinated);
      if (link.concept) topics.add(link.concept);
    }
    for (const row of [...form.firstLayer, ...form.moreLayer]) {
      if (!row.feature) continue;
      const values = (row.values ?? []).filter((value): value is string => typeof value === "string");
      if (row.feature === key && !descriptorForms.includes(form.topic)) descriptorForms.push(form.topic);
      if (values.includes(key)) {
        valueHits.push({ feature: row.feature, siblings: values.filter((value) => value !== key), form: form.topic });
      }
    }
  }
  if (valueHits.length) {
    return {
      kind: "value",
      display,
      feature: valueHits[0].feature,
      siblings: [...new Set(valueHits.flatMap((hit) => hit.siblings))],
      forms: [...new Set(valueHits.map((hit) => hit.form))],
    };
  }
  if (descriptorForms.length) return { kind: "descriptor", display, forms: descriptorForms };
  if (topics.has(key)) return { kind: "formTopic", display };
  return { kind: "concept", display };
}

export function mapperHref(name: string, ctx: MapperContext): string {
  const url = new URL(MAPPER_BASE);
  url.searchParams.set("map", ctx.kind + "/" + name);
  if (ctx.display) url.searchParams.set("display", ctx.display);
  if (ctx.feature) url.searchParams.set("feature", ctx.feature);
  if (ctx.siblings?.length) url.searchParams.set("siblings", ctx.siblings.join(","));
  if (ctx.forms?.length) url.searchParams.set("forms", ctx.forms.join(","));
  return url.href;
}
