import { describe, expect, it } from "vitest";
import { onExamination } from "../src/exam/prose.ts";
import { buildFhirBundle } from "../src/fhir/bundle.ts";
import { validateFhirBundle } from "../src/fhir/validate.ts";
import { gpVisitState, demoState, emptyFinding, emptyState } from "../src/model.ts";
import { buildThumbEncounter, buildVisit } from "../src/openehr/compose.ts";
import { canonicalToXml, xmlToCanonicalRecord } from "../src/openehr/serialization-views.ts";
import { canonicalToZipehrHtml5, zipehrHtml5ToCanonicalRecord } from "../src/openehr/zipehr.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { knowledge, painForm, swedish } from "../src/knowledge.ts";
import { render, renderReport } from "../vendor/sentence.ts";
import { localizePlan } from "../src/exam/phrases.ts";
import { findingsFromState } from "../src/model.ts";
import { historyStoryText } from "./canonical-helpers.ts";

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

  it("keeps Story to the history narrative", () => {
    const state = gpVisitState();
    const findings = findingsFromState(state, painForm.diagnoses);
    const history = findings
      .filter((finding) => finding.topic === "ThumbPainSymptom" || finding.topic === "ThumbSwellingSymptom")
      .map((finding) => render(finding, knowledge))
      .join("\n");
    const built = buildVisit(state, history);
    const story = historyStoryText(built.canonical) ?? "";
    expect(story).toContain("Pain in right thumb");
    expect(story).toContain("swelling");
    expect(story).not.toContain("On Examination");
    expect(story).not.toContain("flexion");
    expect(story).not.toContain("Thumb sprain");
    expect(story).not.toContain("sprain");
    const coded = JSON.stringify(built.canonical);
    expect(coded).toContain("flexion full range, mildly painful");
    expect(coded).toContain("Thumb sprain present");
    expect(coded).toContain("openEHR-EHR-OBSERVATION.exam.v1");
    expect(coded).toContain("openEHR-EHR-CLUSTER.range_of_motion.v1");
    expect(coded).toContain("openEHR-EHR-EVALUATION.problem_diagnosis.v1");
    expect(coded).toContain("openEHR-EHR-EVALUATION.recommendation.v2");
    assertValid(built.canonical, "gp visit");
  });

  it("round-trips the visit through ZipEHR html5 with no validation warnings", async () => {
    const state = gpVisitState();
    const built = buildVisit(state, "Pain in right thumb");
    assertValid(built.canonical, "gp zipehr");
    const html = await canonicalToZipehrHtml5(built.canonical);
    expect(html).toMatch(/<o-co[\s>]/);
    expect(html).toContain("gp-encounter.v1");
    expect(zipehrHtml5ToCanonicalRecord(html)).toEqual(built.canonical);
  });

  it("round-trips the visit through canonical XML", async () => {
    const state = gpVisitState();
    const narrative = "Pain in right thumb";
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
    const built = buildVisit(state, "Thumb pain");
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
    const examined = buildVisit(exam, "Thumb pain");
    expect(historyStoryText(examined.canonical)).toBe("Thumb pain");
    expect(historyStoryText(examined.canonical)).not.toContain("normal");
    assertValid(examined.canonical, "exam");

    const sprain = emptyState();
    sprain.selectedForms = ["ThumbPainSymptom", "ThumbSprain"];
    sprain.diagnoses.ThumbSprain = "possible";
    assertValid(buildVisit(sprain, "Possible thumb sprain").canonical, "sprain");
  });
});

const SWEDISH_NOTE = [
  "Smärta i höger tumme",
  "Gradvis debut, måttligt svår svullnad av ytterfalang av vänster tumme i 2 veckor, föreligger",
  "Tumstukning föreligger",
  "",
  "Status",
  "Höger tumme:",
  " Höger tumled: flexion full rörlighet, lätt smärtsam; extension nedsatt rörlighet; abduktion nedsatt rörlighet",
  "",
  "Återbesök om en vecka om smärtan i höger tumme inte är bättre.",
].join("\n");

const ENGLISH_LEAK = [
  "On Examination",
  "Right thumb",
  "full range",
  "mildly painful",
  "Thumb sprain",
  "Review the right thumb",
  "not examined",
  "not painful",
];

function swedishGpNote(state: ReturnType<typeof gpVisitState>): string {
  swedish.missing.length = 0;
  const lines = findingsFromState(state, painForm.diagnoses).map((finding) =>
    renderReport(finding, knowledge, swedish).sentence
  );
  const exam = onExamination(state, "sv");
  const plan = localizePlan(state.plan, "sv");
  return [lines.join("\n"), exam, plan].filter((part) => part.length > 0).join("\n\n");
}

describe("Swedish GP visit note", () => {
  it("matches the walkthrough wording and does not leak English", () => {
    const state = gpVisitState();
    swedish.missing.length = 0;
    const note = swedishGpNote(state);
    expect(swedish.missing, swedish.missing.join(", ")).toEqual([]);
    expect(note).toBe(SWEDISH_NOTE);
    for (const fragment of ENGLISH_LEAK) {
      expect(note, fragment).not.toContain(fragment);
    }
  });

  it("stores Swedish narrative in openEHR and FHIR together", async () => {
    const state = gpVisitState();
    swedish.missing.length = 0;
    const findings = findingsFromState(state, painForm.diagnoses);
    const history = findings
      .filter((finding) => finding.topic === "ThumbPainSymptom" || finding.topic === "ThumbSwellingSymptom")
      .map((finding) => render(finding, knowledge, swedish))
      .join("\n");
    const built = buildVisit(state, history, "sv");
    assertValid(built.canonical, "swedish visit");
    const story = historyStoryText(built.canonical) ?? "";
    expect(story).toContain("Smärta i höger tumme");
    expect(story).not.toContain("On Examination");
    expect(story).not.toContain("Status");
    expect(story).not.toContain("Tumstukning");
    const coded = JSON.stringify(built.canonical);
    expect(coded).toContain("Höger tumled: flexion full rörlighet, lätt smärtsam");
    expect(coded).toContain("Tumstukning föreligger");
    expect(coded).toContain("Återbesök om en vecka om smärtan i höger tumme inte är bättre.");
    expect((built.canonical.language as { code_string: string }).code_string).toBe("sv");
    for (const fragment of ENGLISH_LEAK) {
      expect(story, fragment).not.toContain(fragment);
    }
    const bundle = buildFhirBundle(state, built.canonical);
    expect(validateFhirBundle(bundle)).toEqual([]);
    const resources = (bundle.entry as { resource: Record<string, unknown> }[]).map((entry) => entry.resource);
    const exam = resources.find((resource) => resource.id === "exam-right");
    const note = (exam?.note as { text: string }[])[0]?.text ?? "";
    expect(note).toContain("lätt smärtsam");
    expect(note).not.toContain("mildly painful");
    const plan = resources.find((resource) => resource.resourceType === "CarePlan");
    expect(plan?.description).toBe("Återbesök om en vecka om smärtan i höger tumme inte är bättre.");
    const joined = [story, note, String(plan?.description ?? ""), coded.match(/Tumstukning föreligger/)?.[0] ?? ""].join("\n");
    for (const fragment of ENGLISH_LEAK) {
      expect(joined, fragment).not.toContain(fragment);
    }
    const html = await canonicalToZipehrHtml5(built.canonical);
    expect(zipehrHtml5ToCanonicalRecord(html)).toEqual(built.canonical);
  });
});

describe("FHIR visit bundle", () => {
  it("is valid and keeps examination observations in category exam", () => {
    const state = gpVisitState();
    const built = buildVisit(state, "Pain in right thumb");
    const bundle = buildFhirBundle(state, built.canonical);
    const issues = validateFhirBundle(bundle);
    expect(issues, JSON.stringify(issues, null, 2)).toEqual([]);
    const resources = (bundle.entry as { resource: Record<string, unknown> }[]).map((entry) => entry.resource);
    const exams = resources.filter((resource) => resource.resourceType === "Observation" && String(resource.id).startsWith("exam-"));
    expect(exams.length).toBeGreaterThan(0);
    for (const exam of exams) {
      expect(JSON.stringify(exam.category)).toContain('"code":"exam"');
      expect(exam.valueString).toBeUndefined();
      const note = (exam.note as { text: string }[])[0]?.text ?? "";
      expect(note).toContain("flexion full range, mildly painful");
      const components = exam.component as { code: { text?: string }; valueCodeableConcept: { text?: string } }[];
      expect(components.some((row) => row.code.text === "Flexion" && row.valueCodeableConcept.text === "full range")).toBe(true);
      expect(components.some((row) => row.code.text === "Extension" && row.valueCodeableConcept.text === "reduced range")).toBe(true);
      expect(components.some((row) => row.code.text === "Flexion pain on movement")).toBe(true);
      expect((exam.bodySite as { text?: string }).text).toContain("thumb");
    }
    expect(historyStoryText(built.canonical)).not.toContain("On Examination");
    expect(historyStoryText(built.canonical)).not.toContain("sprain");
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
