import { parse } from "yaml";
import painRaw from "../../data/ThumbPainSymptom.yaml?raw";
import swellingRaw from "../../data/ThumbSwellingSymptom.yaml?raw";
import fractureRaw from "../../data/forms/ThumbFracture.yaml?raw";
import dislocationRaw from "../../data/forms/ThumbJointDislocation.yaml?raw";
import jointSignRaw from "../../data/forms/ThumbJointSign.yaml?raw";
import movementRaw from "../../data/forms/ThumbMovementSign.yaml?raw";
import thumbSignRaw from "../../data/forms/ThumbSign.yaml?raw";
import sprainRaw from "../../data/forms/ThumbSprain.yaml?raw";
import examsRaw from "../../data/forms/thumb-exams.yaml?raw";
import { conceptLabel, type ClinergyForm, type FormExam, type FormRow } from "../knowledge.ts";

/**
 * Forms already extracted into this repository. Generation is keyed by
 * `category` (symptom, sign, disease) and by `examinations`, not by topic name.
 */
export const extractedForms: ClinergyForm[] = [
  painRaw,
  swellingRaw,
  sprainRaw,
  fractureRaw,
  dislocationRaw,
  movementRaw,
  jointSignRaw,
  thumbSignRaw,
].map((raw) => parse(raw) as ClinergyForm);

export const formsByTopic: Record<string, ClinergyForm> = Object.fromEntries(
  extractedForms.map((form) => [form.topic, form]),
);

export interface ExamDefinition {
  name: string;
  group: string;
  lateral: boolean;
  baseSign: string;
  baseLocation: string;
  signs0: string[];
  signs1: string[];
  subExams: string[];
}

const examDoc = parse(examsRaw) as Record<string, ExamDefinition>;
export const examsByName: Record<string, ExamDefinition> = examDoc;

/** A form the visit picker can turn on. Kinds are the YAML category, or exam. */
export interface VisitPick {
  id: string;
  label: string;
  kind: "symptom" | "sign" | "disease" | "exam";
}

export const visitPicks: VisitPick[] = [
  { id: "ThumbPainSymptom", label: "Thumb pain", kind: "symptom" },
  { id: "ThumbSwellingSymptom", label: "Thumb swelling", kind: "symptom" },
  { id: "ThumbExam", label: "Examination", kind: "exam" },
  { id: "ThumbSprain", label: "Thumb sprain", kind: "disease" },
  { id: "ThumbFracture", label: "Thumb fracture", kind: "disease" },
];

export const defaultSelectedForms = ["ThumbPainSymptom", "ThumbSwellingSymptom", "ThumbExam"];

export function formOf(topic: string): ClinergyForm | undefined {
  return formsByTopic[topic];
}

export function displayOf(key: string): string {
  return formsByTopic[key]?.display || conceptLabel(key);
}

export function rowsOf(form: ClinergyForm): FormRow[] {
  return [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])];
}

/** Examinations declared on the given forms, in first-seen order, de-duplicated. */
export function examinationsOf(topics: string[]): FormExam[] {
  const seen = new Set<string>();
  const out: FormExam[] = [];
  for (const topic of topics) {
    const form = formsByTopic[topic];
    for (const exam of form?.examinations ?? []) {
      if (seen.has(exam.exam)) continue;
      seen.add(exam.exam);
      out.push(exam);
    }
  }
  return out;
}

export function diseaseForms(topics: string[]): ClinergyForm[] {
  return topics
    .map((topic) => formsByTopic[topic])
    .filter((form): form is ClinergyForm => form?.category === "disease");
}
