import { describe, expect, it } from "vitest";
import { codingFor, QUESTIONNAIRE_URL, SNOMED } from "../src/fhir/coding.ts";
import { buildQuestionnaire, buildQuestionnaireResponse, buildQuestionnaireExport } from "../src/fhir/questionnaire.ts";
import { buildSymptomExport } from "../src/fhir/symptoms.ts";
import {
  validateQuestionnaire,
  validateQuestionnaireResponse,
  validateSymptomExport,
} from "../src/fhir/validate.ts";
import { demoState, emptyState } from "../src/model.ts";
import { render } from "../vendor/sentence.ts";
import { knowledge } from "../src/knowledge.ts";
import { findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";

function narrative(state = demoState()): string {
  return findingsFromState(state, painForm.diagnoses).map((finding) => render(finding, knowledge)).join("\n");
}

function flattenAnswers(items: unknown, into: Record<string, unknown[]> = {}): Record<string, unknown[]> {
  if (!Array.isArray(items)) return into;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as { linkId?: string; answer?: unknown[]; item?: unknown };
    if (typeof row.linkId === "string" && Array.isArray(row.answer)) into[row.linkId] = row.answer;
    flattenAnswers(row.item, into);
  }
  return into;
}

function flattenLinkIds(items: unknown, into: string[] = []): string[] {
  if (!Array.isArray(items)) return into;
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const row = item as { linkId?: string; item?: unknown };
    if (typeof row.linkId === "string") into.push(row.linkId);
    flattenLinkIds(row.item, into);
  }
  return into;
}

describe("FHIR Questionnaire (extractor #7)", () => {
  const questionnaire = buildQuestionnaire();

  it("is a draft SDC-style Questionnaire generated from the published thumb form", () => {
    expect(questionnaire.resourceType).toBe("Questionnaire");
    expect(questionnaire.url).toBe(QUESTIONNAIRE_URL);
    expect(questionnaire.status).toBe("draft");
    expect((questionnaire.meta as { profile: string[] }).profile[0]).toContain("sdc-questionnaire");
    const ids = flattenLinkIds(questionnaire.item);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      "pain", "pain.summary", "pain.laterality", "pain.duration", "pain.AbsolutePainDescriptor",
      "pain.AbsoluteSeverity", "swelling.summary", "swelling.sublocation", "swelling.stiffness",
      "exam.left.status", "exam.right.tenderness", "diagnosis.ThumbSprain",
    ]));
    const report = validateQuestionnaire(questionnaire);
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it("codes only verified bindings and leaves others as display text", () => {
    expect(codingFor("mild")?.system).toBe(SNOMED);
    expect(codingFor("mild")?.code).toBe("255604002");
    expect(codingFor("piercingPain")).toBeNull();
    const ids = new Map<string, Record<string, unknown>>();
    const walk = (items: unknown) => {
      if (!Array.isArray(items)) return;
      for (const item of items as Record<string, unknown>[]) {
        if (typeof item.linkId === "string") ids.set(item.linkId, item);
        walk(item.item);
      }
    };
    walk(questionnaire.item);
    const character = ids.get("pain.AbsolutePainDescriptor") as { answerOption: Record<string, unknown>[] };
    const options = character.answerOption;
    const piercing = options.find((opt) => JSON.stringify(opt).includes("piercing") || JSON.stringify(opt).includes("Piercing"));
    const mildItem = (ids.get("pain.AbsoluteSeverity") as { answerOption: Record<string, unknown>[] })
      .answerOption.find((opt) => JSON.stringify(opt).includes("255604002"));
    expect(piercing).toEqual({ valueString: "piercing" });
    expect(mildItem).toMatchObject({ valueCoding: { system: SNOMED, code: "255604002" } });
  });
});

describe("FHIR QuestionnaireResponse (extractor #7)", () => {
  it("fills answers from the 1998 demo state and uses the English sentence as narrative", () => {
    const state = demoState();
    const text = narrative(state);
    const questionnaire = buildQuestionnaire();
    const response = buildQuestionnaireResponse(state, text);
    expect(response.resourceType).toBe("QuestionnaireResponse");
    expect(response.questionnaire).toBe(QUESTIONNAIRE_URL);
    const div = (response.text as { div: string }).div;
    expect(div).toContain("http://www.w3.org/1999/xhtml");
    expect(div).toContain("right thumb");
    expect(div).toMatch(/[Ss]well/);
    const answers = flattenAnswers(response.item);
    expect(JSON.stringify(answers["pain.laterality"])).toContain("24028007"); // right, verified SNOMED
    expect(JSON.stringify(answers["swelling.summary"])).toContain("52101004"); // presence
    expect(answers["swelling.duration"][0]).toMatchObject({
      valueQuantity: { value: 2, code: "wk", system: "http://unitsofmeasure.org" },
    });
    expect(JSON.stringify(answers["swelling.AbsoluteOnset"])).toContain("61751001"); // gradual
    expect(JSON.stringify(answers["swelling.AbsoluteSeverity"])).toContain("6736007"); // moderate
    expect(JSON.stringify(answers["swelling.sublocation"])).toContain("182007006"); // distal phalanx
    expect(answers["pain.summary"]).toBeUndefined();
    const report = validateQuestionnaireResponse(response, questionnaire);
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
  });

  it("omits unanswered groups on an empty form and still validates", () => {
    const exportDoc = buildQuestionnaireExport(emptyState(), "Thumb pain");
    const answers = flattenAnswers(exportDoc.response.item);
    expect(answers["swelling.summary"]).toBeUndefined();
    expect(answers["swelling.duration"]).toBeUndefined();
    expect(answers["diagnosis.ThumbSprain"]).toBeUndefined();
    const report = validateQuestionnaireResponse(exportDoc.response, exportDoc.questionnaire);
    expect(report.errors).toEqual([]);
    expect((exportDoc.response.text as { div: string }).div).toContain("Thumb pain");
  });

  it("records an explicit absent pain answer and a possible diagnosis", () => {
    const state = emptyState();
    state.pain.summary = "absence";
    state.diagnoses.ThumbSprain = "possible";
    const response = buildQuestionnaireResponse(state, "Absent thumb pain");
    const answers = flattenAnswers(response.item);
    expect(JSON.stringify(answers["pain.summary"])).toContain("2667000"); // absence
    expect(JSON.stringify(answers["diagnosis.ThumbSprain"]).toLowerCase()).toMatch(/possible/);
  });
});

describe("FHIR Symptoms IG Symptom Logical Model (extractor #8)", () => {
  it("maps the demo finding to required elements, location, severity, onset and duration", () => {
    const state = demoState();
    const text = narrative(state);
    const doc = buildSymptomExport(state, text);
    const report = validateSymptomExport(doc);
    expect(report.errors).toEqual([]);
    expect(report.valid).toBe(true);
    expect(doc.profile).toContain("SymptomLogicalModel");
    const pain = doc.symptoms[0];
    expect(pain.identifier).toBe("thumb-pain");
    expect(pain.presentFlag).toBe(true);
    expect(pain.symptomCode).toBe("300955002");
    expect((pain.symptomDescription as { text: string }[])[0].text).toMatch(/right thumb/i);
    const location = (pain.keyFeatures as { location: { code: string; qualifier?: string[] }[] }).location[0];
    expect(location.code).toBe("76505004"); // Thumb, verified
    expect(location.qualifier).toEqual(["right"]);
    const swelling = doc.symptoms.find((row) => row.identifier === "thumb-swelling") as Record<string, unknown>;
    expect(swelling).toBeTruthy();
    expect(swelling.presentFlag).toBe(true);
    expect((swelling.keyFeatures as { severity: { value: string } }).severity.value).toBe("6736007");
    const timing = swelling.timing as { speedOfOnset: string; duration: { value: number; code: string } };
    expect(timing.speedOfOnset).toBe("61751001");
    expect(timing.duration).toMatchObject({ value: 2, code: "wk" });
    const loc = (swelling.keyFeatures as { location: { qualifier: string[] }[] }).location[0];
    expect(loc.qualifier).toEqual(expect.arrayContaining(["left", "distal phalanx"]));
    expect(pain.associatedSymptoms).toEqual(expect.arrayContaining([expect.objectContaining({ identifier: "thumb-swelling" })]));
  });

  it("sets presentFlag false when pain is explicitly absent and notes unmapped exam findings", () => {
    const state = emptyState();
    state.pain.summary = "absence";
    state.exam.left.status = "normal";
    state.exam.left.tenderness = "presence";
    state.diagnoses.ThumbSprain = "presence";
    state.consequences.ConseqErythemaSign = "presence";
    const doc = buildSymptomExport(state, "Absent thumb pain");
    expect(doc.symptoms[0].presentFlag).toBe(false);
    const conditions = doc.symptoms[0].associatedConditions as { id: string }[];
    expect(conditions.some((row) => row.id === "dx-ThumbSprain")).toBe(true);
    expect(doc.gaps.some((gap) => gap.path === "examination")).toBe(true);
    expect(doc.gaps.some((gap) => gap.clinergy === "ConseqErythemaSign")).toBe(true);
    expect(doc.gaps.some((gap) => gap.path === "reporter[x]")).toBe(true);
    expect(validateSymptomExport(doc).valid).toBe(true);
  });

  it("does not invent a swelling model when swelling was not answered", () => {
    const doc = buildSymptomExport(emptyState(), "Thumb pain");
    expect(doc.symptoms.map((row) => row.identifier)).toEqual(["thumb-pain"]);
  });
});
