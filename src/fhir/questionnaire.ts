import { painForm, swellingForm, type FormRow } from "../knowledge.ts";
import type { ExamSide, FindingForm, WorkbenchState } from "../model.ts";
import {
  DEMO_PATIENT_ID,
  DURATION_UNITS,
  QUESTIONNAIRE_ID,
  QUESTIONNAIRE_URL,
  SDC_QUESTIONNAIRE_PROFILE,
  SDC_RESPONSE_PROFILE,
  codingFor,
  demoPatient,
  displayOf,
  escapeHtml,
  ucumOf,
} from "./coding.ts";

export interface QuestionnaireExport {
  questionnaire: Record<string, unknown>;
  response: Record<string, unknown>;
}

const ITEM_CONTROL = "http://hl7.org/fhir/StructureDefinition/questionnaire-itemControl";
const ITEM_CONTROL_VS = "http://hl7.org/fhir/questionnaire-item-control";

function itemControl(code: string, display: string): Record<string, unknown> {
  return {
    url: ITEM_CONTROL,
    valueCodeableConcept: {
      coding: [{ system: ITEM_CONTROL_VS, code, display }],
    },
  };
}

function choiceOptions(keys: string[]): Record<string, unknown>[] {
  return keys.map((key) => {
    const coding = codingFor(key);
    if (coding?.code && coding.system) {
      return { valueCoding: coding };
    }
    return { valueString: displayOf(key) };
  });
}

function choiceItem(
  linkId: string,
  text: string,
  keys: string[],
  opts: { repeats?: boolean; required?: boolean; enableWhen?: Record<string, unknown>[] } = {},
): Record<string, unknown> {
  const item: Record<string, unknown> = {
    linkId,
    text,
    type: "choice",
    repeats: !!opts.repeats,
    required: !!opts.required,
    answerOption: choiceOptions(keys),
  };
  if (opts.repeats) item.extension = [itemControl("check-box", "Check box")];
  else item.extension = [itemControl("radio-button", "Radio Button")];
  if (opts.enableWhen?.length) {
    item.enableWhen = opts.enableWhen;
    item.enableBehavior = "any";
  }
  return item;
}

function quantityItem(linkId: string, text: string): Record<string, unknown> {
  return {
    linkId,
    text,
    type: "quantity",
    extension: DURATION_UNITS.map((u) => ({
      url: "http://hl7.org/fhir/StructureDefinition/questionnaire-unitOption",
      valueCoding: { system: "http://unitsofmeasure.org", code: u.ucum, display: u.word },
    })),
  };
}

function featureItems(prefix: string, rows: FormRow[], enableWhen?: Record<string, unknown>[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (row.feature === "QuantityDuration") {
      items.push(quantityItem(`${prefix}.duration`, displayOf("QuantityDuration")));
      continue;
    }
    if (!row.feature) continue;
    const values = (row.values ?? []).filter((value): value is string => typeof value === "string");
    if (!values.length) continue;
    items.push(choiceItem(`${prefix}.${row.feature}`, displayOf(row.feature), values, {
      repeats: !!row.multiple,
      enableWhen,
    }));
  }
  return items;
}

function enableWhenCoding(linkId: string, key: string): Record<string, unknown> {
  const coding = codingFor(key);
  if (coding?.code && coding.system) {
    return { question: linkId, operator: "=", answerCoding: coding };
  }
  return { question: linkId, operator: "=", answerString: displayOf(key) };
}

export function buildQuestionnaire(): Record<string, unknown> {
  const swellingWhen = [enableWhenCoding("swelling.summary", "presence")];
  const painItems = [
    choiceItem("pain.summary", "Thumb pain", ["presence", "absence"]),
    ...featureItems("pain", [...painForm.firstLayer, ...painForm.moreLayer]),
  ];
  const swellingItems = [
    choiceItem("swelling.summary", "Thumb swelling", ["presence", "absence"]),
    ...featureItems("swelling", swellingForm.firstLayer),
    ...featureItems("swelling", swellingForm.moreLayer, swellingWhen),
    choiceItem("swelling.stiffness", "Joint stiffness", ["presence", "absence"], { enableWhen: swellingWhen }),
    choiceItem("swelling.ConseqPain", displayOf("ConseqPain"), ["presence", "absence"], { enableWhen: swellingWhen }),
    choiceItem("swelling.ConseqTendernessSign", displayOf("ConseqTendernessSign"), ["presence", "absence"], { enableWhen: swellingWhen }),
    choiceItem("swelling.ConseqErythemaSign", displayOf("ConseqErythemaSign"), ["presence", "absence"], { enableWhen: swellingWhen }),
  ];

  const examSide = (side: "left" | "right"): Record<string, unknown> => ({
    linkId: `exam.${side}`,
    text: `${side === "left" ? "Left" : "Right"} thumb examination`,
    type: "group",
    item: [
      choiceItem(`exam.${side}.status`, "Status", ["normal", "notExamined"]),
      choiceItem(`exam.${side}.tenderness`, "Tenderness", ["absence", "presence"]),
      ...(["flexion", "extension", "abduction", "adduction"] as const).flatMap((move) => [
        choiceItem(`exam.${side}.${move}Range`, `${move} range`, ["full", "reduced", "limited", "minimal"]),
        choiceItem(`exam.${side}.${move}Pain`, `${move} pain on movement`, ["absence", "mild", "moderate", "severe"]),
      ]),
    ],
  });

  const diagnosisItems = painForm.diagnoses.map((link) =>
    choiceItem(`diagnosis.${link.item}`, displayOf(link.item), ["presence", "possible", "excluded"]),
  );

  return {
    resourceType: "Questionnaire",
    id: QUESTIONNAIRE_ID,
    meta: { profile: [SDC_QUESTIONNAIRE_PROFILE] },
    url: QUESTIONNAIRE_URL,
    version: "0.1.0",
    name: "ThumbPain",
    title: "Thumb pain (Clinergy extract)",
    status: "draft",
    experimental: true,
    subjectType: ["Patient"],
    description:
      "Generated at runtime from the approved public Clinergy thumb-pain extract in this workbench. See clinergy-extractor issue #7. Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester.",
    item: [
      {
        linkId: "pain",
        text: "Thumb pain",
        type: "group",
        item: painItems,
      },
      {
        linkId: "swelling",
        text: "Associated symptoms",
        type: "group",
        item: swellingItems,
      },
      {
        linkId: "exam",
        text: "Examinations",
        type: "group",
        item: [examSide("left"), examSide("right")],
      },
      {
        linkId: "diagnosis",
        text: "Diagnoses",
        type: "group",
        item: diagnosisItems,
      },
      {
        linkId: "comment",
        text: "Comment",
        type: "text",
      },
    ],
  };
}

function answerForKey(key: string): Record<string, unknown> {
  const coding = codingFor(key);
  if (coding?.code && coding.system) return { valueCoding: coding };
  return { valueString: displayOf(key) };
}

function choiceAnswer(linkId: string, keys: string | string[] | null | undefined): Record<string, unknown> | null {
  if (keys == null) return null;
  const list = Array.isArray(keys) ? keys.filter(Boolean) : [keys];
  if (!list.length) return null;
  return { linkId, answer: list.map(answerForKey) };
}

function durationAnswer(linkId: string, form: FindingForm): Record<string, unknown> | null {
  if (form.durationNumber == null || form.durationNumber <= 0) return null;
  const ucum = ucumOf(form.durationUnit);
  return {
    linkId,
    answer: [{
      valueQuantity: {
        value: form.durationNumber,
        unit: ucum.unit,
        system: ucum.system,
        code: ucum.code,
      },
    }],
  };
}

function formAnswers(prefix: string, form: FindingForm, features: string[]): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  const summary = choiceAnswer(`${prefix}.summary`, form.summary);
  if (summary) items.push(summary);
  const laterality = form.laterality.map((side) => side === "left" ? "leftSelection" : "rightSelection");
  const sides = choiceAnswer(`${prefix}.laterality`, laterality);
  if (sides) items.push(sides);
  const sub = choiceAnswer(`${prefix}.sublocation`, form.sublocation);
  if (sub) items.push(sub);
  const duration = durationAnswer(`${prefix}.duration`, form);
  if (duration) items.push(duration);
  for (const feature of features) {
    const row = choiceAnswer(`${prefix}.${feature}`, form.choices[feature]);
    if (row) items.push(row);
  }
  return items;
}

function examAnswers(side: "left" | "right", exam: ExamSide): Record<string, unknown> | null {
  const items: Record<string, unknown>[] = [];
  const fields: Array<keyof ExamSide> = [
    "status", "tenderness",
    "flexionRange", "flexionPain",
    "extensionRange", "extensionPain",
    "abductionRange", "abductionPain",
    "adductionRange", "adductionPain",
  ];
  for (const field of fields) {
    const row = choiceAnswer(`exam.${side}.${field}`, exam[field]);
    if (row) items.push(row);
  }
  if (!items.length) return null;
  return { linkId: `exam.${side}`, item: items };
}

const PAIN_FEATURES = [
  "AbsolutePainDescriptor", "AbsoluteSeverity", "AbsoluteFrequency",
  "AbsoluteOnset", "AbsoluteProgress", "AbsoluteProcessPattern",
];
const SWELLING_FEATURES = [
  "AbsoluteOnset", "AbsoluteSeverity", "AbsoluteConsistency",
  "AbsoluteProgress", "AbsoluteTexture",
];

export function buildQuestionnaireResponse(
  state: WorkbenchState,
  narrative: string,
  authored = "2021-10-21T14:21:00+01:00",
): Record<string, unknown> {
  const painItems = formAnswers("pain", state.pain, PAIN_FEATURES);
  const swellingItems = formAnswers("swelling", state.swelling, SWELLING_FEATURES);
  const stiffness = choiceAnswer("swelling.stiffness", state.stiffness);
  if (stiffness) swellingItems.push(stiffness);
  for (const key of ["ConseqPain", "ConseqTendernessSign", "ConseqErythemaSign"]) {
    const row = choiceAnswer(`swelling.${key}`, state.consequences[key]);
    if (row) swellingItems.push(row);
  }

  const groups: Record<string, unknown>[] = [];
  if (painItems.length) groups.push({ linkId: "pain", item: painItems });
  if (swellingItems.length) groups.push({ linkId: "swelling", item: swellingItems });

  const examSides = (["left", "right"] as const)
    .map((side) => examAnswers(side, state.exam[side]))
    .filter((row): row is Record<string, unknown> => !!row);
  if (examSides.length) groups.push({ linkId: "exam", item: examSides });

  const diagnoses: Record<string, unknown>[] = [];
  for (const [item, value] of Object.entries(state.diagnoses)) {
    const row = choiceAnswer(`diagnosis.${item}`, value);
    if (row) diagnoses.push(row);
  }
  if (diagnoses.length) groups.push({ linkId: "diagnosis", item: diagnoses });

  const comment = state.comment?.trim();
  if (comment) {
    groups.push({
      linkId: "comment",
      answer: [{ valueString: comment }],
    });
  }

  const xhtml = escapeHtml(narrative).replace(/\n/g, "<br/>");
  return {
    resourceType: "QuestionnaireResponse",
    id: "thumb-pain-response",
    meta: { profile: [SDC_RESPONSE_PROFILE] },
    contained: [demoPatient()],
    questionnaire: QUESTIONNAIRE_URL,
    status: "in-progress",
    subject: { reference: `#${DEMO_PATIENT_ID}`, display: "John Parsons" },
    authored,
    text: {
      status: "generated",
      div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>${xhtml || "No summary yet."}</p></div>`,
    },
    item: groups,
  };
}

export function buildQuestionnaireExport(
  state: WorkbenchState,
  narrative: string,
  authored?: string,
): QuestionnaireExport {
  return {
    questionnaire: buildQuestionnaire(),
    response: buildQuestionnaireResponse(state, narrative, authored),
  };
}
