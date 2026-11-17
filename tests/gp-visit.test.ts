import { describe, expect, it } from "vitest";
import { onExamination } from "../src/exam/prose.ts";
import { buildFhirBundle } from "../src/fhir/bundle.ts";
import { validateFhirBundle } from "../src/fhir/validate.ts";
import { gpVisitState, demoState, emptyFinding, emptyState } from "../src/model.ts";
import { buildThumbEncounter, buildVisit } from "../src/openehr/compose.ts";
import { canonicalToXml, xmlToCanonicalRecord } from "../src/openehr/serialization-views.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { knowledge } from "../src/knowledge.ts";
import { render } from "../vendor/sentence.ts";
import { findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";

const WALKTHROUGH_EXAM = [
  "On Examination",
  "Right thumb:",
  " Right thumb joint: flexion full range, mildly painful; extension reduced range; abduction reduced range",
].join("\n");

function assertValid(canonical: Record<string, unknown>, label: string): void {
  const checked = validateComposition(canonical);
  expect(checked.errors, `${label} errors ${JSON.stringify(checked.errors, null, 2)}`).toEqual([]);
  expect(checked.warnings, `${label} warnings ${JSON.stringify(checked.warnings, null, 2)}`).toEqual([]);
  expect(checked.valid).toBe(true);
}

describe("On Examination prose", () => {
  it("matches the 1998 walkthrough block", () => {
    expect(onExamination(gpVisitState())).toBe(WALKTHROUGH_EXAM);
  });

  it("stays empty when the examination form is not selected", () => {
    const state = gpVisitState();
    state.selectedForms = state.selectedForms.filter((topic) => topic !== "ThumbExam");
    expect(onExamination(state)).toBe("");
  });
});

describe("general practice visit", () => {
  it("keeps the 1998 demo composition identical when no extra answers are set", () => {
    const narrative = "Pain in right thumb";
    expect(buildVisit(demoState(), narrative).canonical).toEqual(buildThumbEncounter(demoState(), narrative).canonical);
  });

  it("records the examination prose on the exam cluster and in the story", () => {
    const state = gpVisitState();
    const findings = findingsFromState(state, painForm.diagnoses);
    const sentences = findings.map((finding) => render(finding, knowledge));
    const narrative = [sentences.join("\n"), onExamination(state)].join("\n\n");
    const built = buildVisit(state, narrative);
    expect(JSON.stringify(built.canonical)).toContain("flexion full range, mildly painful");
    expect(JSON.stringify(built.canonical)).toContain("openEHR-EHR-OBSERVATION.exam.v1");
    expect(JSON.stringify(built.canonical)).toContain("openEHR-EHR-EVALUATION.recommendation.v2");
    assertValid(built.canonical, "gp visit");
  });

  it("round-trips the visit through canonical XML", async () => {
    const state = gpVisitState();
    const narrative = ["Pain in right thumb", onExamination(state)].join("\n\n");
    const built = buildVisit(state, narrative);
    const xml = await canonicalToXml(built.canonical);
    expect(xml).toContain("composition");
    expect(await xmlToCanonicalRecord(xml)).toEqual(built.canonical);
  });

  it("validates a fracture recorded only through the disease form", () => {
    const state = emptyState();
    state.selectedForms = ["ThumbPainSymptom", "ThumbFracture"];
    state.diagnoses.ThumbFracture = "presence";
    const fracture = emptyFinding();
    fracture.choices.AbsoluteHealingCharacter = "partiallyHealed";
    fracture.choices.AbsoluteSeverity = "mild";
    state.formAnswers.ThumbFracture = fracture;
    const built = buildVisit(state, "Thumb fracture");
    expect(JSON.stringify(built.canonical)).toContain("ThumbFracture");
    expect(JSON.stringify(built.canonical)).toContain("partiallyHealed");
    expect(JSON.stringify(built.canonical)).toContain("at0047");
    assertValid(built.canonical, "fracture");
  });

  it("stores a comment on the examination cluster", () => {
    const state = emptyState();
    state.exam.right.status = "normal";
    state.comment = "Patient is right-handed.";
    const built = buildVisit(state, onExamination(state));
    expect(JSON.stringify(built.canonical)).toContain("Patient is right-handed.");
    assertValid(built.canonical, "comment");
  });

  it("records joint stiffness and a swelling consequence with the symptom generator", () => {
    const state = emptyState();
    state.stiffness = "presence";
    state.consequences.ConseqErythemaSign = "absence";
    const built = buildVisit(state, "Joint stiffness");
    const coded = JSON.stringify(built.canonical);
    expect(coded).toContain("JointStiffnessSymptom");
    expect(coded).toContain("ConseqErythemaSign");
    assertValid(built.canonical, "stiffness");
  });

  it("validates swelling, a movement examination and a sprain on their own", () => {
    const swelling = emptyState();
    swelling.swelling.summary = "presence";
    swelling.swelling.laterality = ["left"];
    assertValid(buildVisit(swelling, "Swelling of left thumb present").canonical, "swelling");

    const exam = emptyState();
    exam.exam.left.status = "normal";
    exam.exam.left.tenderness = "absence";
    assertValid(buildVisit(exam, onExamination(exam)).canonical, "exam");

    const sprain = emptyState();
    sprain.selectedForms = ["ThumbPainSymptom", "ThumbSprain"];
    sprain.diagnoses.ThumbSprain = "possible";
    assertValid(buildVisit(sprain, "Possible thumb sprain").canonical, "sprain");
  });
});

describe("FHIR visit bundle", () => {
  it("is valid and keeps examination observations in category exam", () => {
    const state = gpVisitState();
    const narrative = ["Pain in right thumb", onExamination(state)].join("\n\n");
    const built = buildVisit(state, narrative);
    const bundle = buildFhirBundle(state, built.canonical);
    const issues = validateFhirBundle(bundle);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
    const resources = (bundle.entry as { resource: Record<string, unknown> }[]).map((entry) => entry.resource);
    const exams = resources.filter((resource) => resource.resourceType === "Observation" && String(resource.id).startsWith("exam-"));
    expect(exams.length).toBeGreaterThan(0);
    for (const exam of exams) {
      const category = JSON.stringify(exam.category);
      expect(category).toContain('"code":"exam"');
      expect(String(exam.valueString)).toContain("flexion full range, mildly painful");
    }
    const plan = resources.find((resource) => resource.resourceType === "CarePlan");
    expect(plan?.description).toBe(state.plan);
    const conditions = resources.filter((resource) => resource.resourceType === "Condition");
    expect(conditions.length).toBeGreaterThan(0);
    for (const condition of conditions) {
      const text = (condition.code as { text?: string }).text ?? "";
      expect(text.length).toBeGreaterThan(0);
      expect(JSON.stringify(built.canonical)).toContain(text);
    }
    expect(JSON.stringify(built.canonical)).toContain("ThumbSprain");
    expect(JSON.stringify(built.canonical)).toContain(String(plan?.description));
  });
});
