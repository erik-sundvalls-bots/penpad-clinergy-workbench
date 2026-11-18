import { describe, expect, it } from "vitest";
import { emptyState, gpVisitState, findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";
import { renderEnglishGp, englishBodySiteRedundant } from "../src/en/gp-sentence.ts";
import { renderSwedishGp, swedishBodySiteCompoundRedundant } from "../src/sv/gp-sentence.ts";
import { summaryLines } from "../src/summary.ts";
import { buildVisit } from "../src/openehr/compose.ts";

describe("English body-site wording", () => {
  it("does not duplicate thumb in compound plus explicit body site for GP visit lines", () => {
    const lines = summaryLines(findingsFromState(gpVisitState(), painForm.diagnoses), "en");
    for (const line of lines) {
      expect(englishBodySiteRedundant(line), line).toBe(false);
    }
    expect(lines.find((l) => /sprain/i.test(l))).toMatch(/Sprain of right thumb/i);
    expect(lines.join("\n")).not.toMatch(/\bpresent\b/i);
  });

  it("uses base noun for excluded fracture on a thumb", () => {
    const state = emptyState();
    state.selectedForms = ["ThumbFracture"];
    state.diagnoses.ThumbFracture = "excluded";
    const form = state.formAnswers.ThumbFracture ?? {
      laterality: [],
      choices: {},
      durationNumber: null,
      durationUnit: "day",
      sublocation: null,
      summary: null,
    };
    form.laterality = ["left"];
    state.formAnswers.ThumbFracture = form;
    const finding = findingsFromState(state, painForm.diagnoses).find((f) => f.topic === "ThumbFracture");
    expect(finding).toBeTruthy();
    const line = renderEnglishGp(finding!);
    expect(line).toMatch(/Fracture in left thumb excluded/i);
    expect(englishBodySiteRedundant(line)).toBe(false);
  });

  it("renders possible sprain without thumb doubling", () => {
    const state = emptyState();
    state.selectedForms = ["ThumbSprain"];
    state.diagnoses.ThumbSprain = "possible";
    const form = state.formAnswers.ThumbSprain ?? {
      laterality: [],
      choices: {},
      durationNumber: null,
      durationUnit: "day",
      sublocation: null,
      summary: null,
    };
    form.laterality = ["right"];
    state.formAnswers.ThumbSprain = form;
    const finding = findingsFromState(state, painForm.diagnoses).find((f) => f.topic === "ThumbSprain");
    expect(renderEnglishGp(finding!)).toBe("Possible sprain of right thumb.");
  });

  it("drops present from swelling while keeping sub-location phrasing", () => {
    const state = emptyState();
    state.selectedForms = ["ThumbPainSymptom", "ThumbSwellingSymptom"];
    state.swelling.laterality = ["left"];
    state.swelling.sublocation = "distalPhalanx";
    state.swelling.summary = "presence";
    state.swelling.choices.AbsoluteOnset = "gradual";
    state.swelling.choices.AbsoluteSeverity = "moderate";
    state.swelling.durationNumber = 2;
    state.swelling.durationUnit = "week";
    const finding = findingsFromState(state, painForm.diagnoses).find((f) => f.topic === "ThumbSwellingSymptom");
    const line = renderEnglishGp(finding!);
    expect(line).toMatch(/swelling of distal phalanx of left thumb/i);
    expect(line).not.toMatch(/\bpresent\b/i);
    expect(englishBodySiteRedundant(line)).toBe(false);
  });

  it("keeps Swedish wording unchanged", () => {
    const enLines = summaryLines(findingsFromState(gpVisitState(), painForm.diagnoses), "en");
    const svLines = summaryLines(findingsFromState(gpVisitState(), painForm.diagnoses), "sv");
    expect(svLines[svLines.length - 1]).toBe("Stukning av höger tumme.");
    for (const line of svLines) {
      expect(swedishBodySiteCompoundRedundant(line), line).toBe(false);
    }
    expect(enLines[enLines.length - 1]).toBe("Sprain of right thumb.");
  });

  it("writes deduplicated diagnosis text into openEHR clinical description", () => {
    const state = gpVisitState();
    const built = buildVisit(state, summaryLines(findingsFromState(state, painForm.diagnoses), "en").join("\n"));
    const blob = JSON.stringify(built.canonical);
    expect(blob).toContain("Sprain of right thumb.");
    expect(blob).not.toMatch(/Thumb sprain in right thumb/i);
    expect(blob).not.toMatch(/thumb present/i);
  });
});