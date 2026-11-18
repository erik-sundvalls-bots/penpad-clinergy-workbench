import { defaultSelectedForms } from "./forms/catalog.ts";
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
  /** Consequence links on the swelling form (criterialLink rows). */
  consequences: Record<string, string | null>;
  stiffness: string | null;
  diagnoses: Record<string, string | null>;
  exam: { left: ExamSide; right: ExamSide };
  examOpen: "left" | "right" | null;
  /** Free-text comment from the 1998 form. Not part of the generated sentence. */
  comment: string;
  /** Recommendation narrative for the visit plan. */
  plan: string;
  /**
   * Forms included in this visit. Symptom, exam and disease ids from the
   * extracted YAML. Empty is treated as the thumb-pain shell.
   */
  selectedForms: string[];
  /** Descriptor answers for a disease (or other) form addressed by topic. */
  formAnswers: Record<string, FindingForm>;
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
    comment: "",
    plan: "",
    selectedForms: [...defaultSelectedForms],
    formAnswers: {},
  };
}

/**
 * A general-practice visit about one thumb. The 1998 demo leaves swelling on
 * the left because that control is separate from the pain laterality clicked
 * afterwards. Here swelling follows the painful side, which is the right thumb,
 * together with the examination and the sprain.
 */
export function gpVisitState(): WorkbenchState {
  const state = demoState();
  state.swelling.laterality = ["right"];
  state.exam.right.flexionRange = "full";
  state.exam.right.flexionPain = "mild";
  state.exam.right.extensionRange = "reduced";
  state.exam.right.abductionRange = "reduced";
  state.diagnoses.ThumbSprain = "presence";
  state.selectedForms = [
    "ThumbPainSymptom",
    "ThumbSwellingSymptom",
    "ThumbExam",
    "ThumbSprain",
    "ThumbFracture",
  ];
  const sprain = emptyFinding();
  sprain.laterality = ["right"];
  sprain.choices.AbsoluteSeverity = "moderate";
  state.formAnswers.ThumbSprain = sprain;
  return state;
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
    summary: state.pain.summary ?? undefined,
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
    const topic = link.preCoordinated ?? link.concept;
    const answer = state.formAnswers?.[topic] ?? state.formAnswers?.[link.item];
    const laterality = lateralityOf(answer?.laterality ?? []);
    findings.push({
      topic,
      location: link.location ?? (laterality ? "Thumb" : undefined),
      laterality,
      summary,
      qualifiers: [],
    });
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
