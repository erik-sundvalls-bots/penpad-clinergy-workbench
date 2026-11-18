import { describe, expect, it } from "vitest";
import { gpVisitState, demoState, emptyState } from "../src/model.ts";
import { findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";
import { summaryLines, historyNarrativeText } from "../src/summary.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { buildFhirBundle } from "../src/fhir/bundle.ts";
import { buildQuestionnaireResponse } from "../src/fhir/questionnaire.ts";
import { renderSwedishGp } from "../src/sv/gp-sentence.ts";
import {
  hasScreeningQuestionnaire,
  hasStorySymptomCluster,
  screeningSymptomCode,
} from "./canonical-helpers.ts";

function fillPainQualifiers(state: ReturnType<typeof emptyState>) {
  state.pain.choices.AbsoluteOnset = "gradual";
  state.pain.choices.AbsoluteSeverity = "moderate";
  state.pain.choices.AbsolutePainDescriptor = "throbbingPain";
  state.pain.durationNumber = 2;
  state.pain.durationUnit = "week";
}

function fillSwellingQualifiers(state: ReturnType<typeof emptyState>) {
  state.swelling.choices.AbsoluteOnset = "sudden";
  state.swelling.choices.AbsoluteSeverity = "mild";
  state.swelling.durationNumber = 3;
  state.swelling.durationUnit = "day";
}

describe("present/absent toggles", () => {
  it("marks pain absent in EN/SV notes and openEHR screening, not story cluster", () => {
    const state = emptyState();
    state.pain.laterality = ["right"];
    state.pain.summary = "absence";
    const findings = findingsFromState(state, painForm.diagnoses);
    expect(findings[0].summary).toBe("absence");
    expect(summaryLines(findings, "en")[0]).toBe("No pain in right thumb.");
    expect(renderSwedishGp(findings[0])).toBe("Ingen smärta i höger tumme.");
    const built = buildVisit(state, historyNarrativeText(findings, "en"));
    expect(hasStorySymptomCluster(built.canonical)).toBe(false);
    expect(hasScreeningQuestionnaire(built.canonical)).toBe(true);
    expect(screeningSymptomCode(built.canonical)).toBe("ThumbPainSymptom");
    const bundle = buildFhirBundle(state, built.canonical);
    const screening = (bundle.entry as { resource: Record<string, unknown> }[])
      .map((row) => row.resource)
      .filter((resource) => String(resource.id).startsWith("screening-"));
    expect(screening.length).toBe(1);
    expect(JSON.stringify(screening[0].valueCodeableConcept)).toContain("2667000");
  });

  it("ignores qualifier answers on absent pain (EN/SV, story, symptom logical model)", () => {
    const state = emptyState();
    state.pain.laterality = ["right"];
    state.pain.summary = "absence";
    fillPainQualifiers(state);
    const findings = findingsFromState(state, painForm.diagnoses);
    expect(historyNarrativeText(findings, "en")).toBe("No pain in right thumb.");
    expect(historyNarrativeText(findings, "sv")).toBe("Ingen smärta i höger tumme.");
    const built = buildVisit(state, historyNarrativeText(findings, "en"));
    expect(JSON.stringify(built.canonical)).not.toMatch(/gradual/i);
    const bundle = buildFhirBundle(state, built.canonical);
    const exportJson = JSON.stringify(bundle);
    expect(exportJson).not.toMatch(/gradual/i);
    expect(exportJson).not.toMatch(/moderate/i);
  });

  it("ignores qualifier answers on absent swelling", () => {
    const state = emptyState();
    state.pain.laterality = ["right"];
    state.swelling.laterality = ["right"];
    state.swelling.summary = "absence";
    fillSwellingQualifiers(state);
    const findings = findingsFromState(state, painForm.diagnoses);
    const swelling = findings.find((row) => row.topic === "ThumbSwellingSymptom");
    expect(swelling).toBeTruthy();
    expect(summaryLines([swelling!], "en")[0]).toBe("No swelling of right thumb.");
    expect(renderSwedishGp(swelling!)).toBe("Ingen svullnad av höger tumme.");
    expect(historyNarrativeText(findings, "en")).not.toMatch(/sudden/i);
  });

  it("ignores stiffness qualifier context when marked absent", () => {
    const state = gpVisitState();
    state.stiffness = "absence";
    const findings = findingsFromState(state, painForm.diagnoses);
    const stiff = findings.find((row) => row.topic === "JointStiffnessSymptom");
    expect(stiff?.summary).toBe("absence");
    expect(summaryLines(findings, "en").join("\n")).toMatch(/No .*stiffness/i);
    expect(historyNarrativeText(findings, "en")).not.toMatch(/present/i);
  });
});

describe("comment field", () => {
  it("lands on exam CLUSTER.exam Comment and FHIR Observation.note", () => {
    const state = gpVisitState();
    state.comment = "Patient prefers email contact.";
    const built = buildVisit(state, "Pain in right thumb");
    expect(JSON.stringify(built.canonical)).toContain("Patient prefers email contact.");
    const bundle = buildFhirBundle(state, built.canonical);
    const exam = (bundle.entry as { resource: Record<string, unknown> }[])
      .map((row) => row.resource)
      .find((resource) => resource.id === "exam-right");
    const notes = (exam?.note as { text: string }[]) ?? [];
    expect(notes.some((row) => row.text === "Patient prefers email contact.")).toBe(true);
    const response = buildQuestionnaireResponse(state, "Pain in right thumb");
    const commentItem = (response.item as { linkId: string; answer?: { valueString: string }[] }[]).find(
      (row) => row.linkId === "comment",
    );
    expect(commentItem?.answer?.[0]?.valueString).toBe("Patient prefers email contact.");
  });

});

describe("GP visit without demo plan", () => {
  it("does not emit Plan section or CarePlan when plan is empty", () => {
    const state = gpVisitState();
    expect(state.plan).toBe("");
    const built = buildVisit(state, "Pain in right thumb");
    expect(JSON.stringify(built.canonical)).not.toMatch(/EVALUATION\.recommendation/);
    const bundle = buildFhirBundle(state, built.canonical);
    const carePlan = (bundle.entry as { resource: Record<string, unknown> }[])
      .map((row) => row.resource)
      .find((resource) => resource.resourceType === "CarePlan");
    expect(carePlan).toBeUndefined();
  });
});