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

describe("present/absent toggles", () => {
  it("marks pain absent in EN/SV notes and openEHR screening, not story cluster", () => {
    const state = emptyState();
    state.selectedForms = ["ThumbPainSymptom"];
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
    const commentItem = (response.item as { linkId: string }[]).find((row) => row.linkId === "comment");
    expect(commentItem).toBeTruthy();
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