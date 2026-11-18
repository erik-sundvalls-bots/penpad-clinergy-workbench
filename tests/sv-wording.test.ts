import { describe, expect, it } from "vitest";
import { emptyState, gpVisitState, findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";
import { renderSwedishGp, swedishBodySiteCompoundRedundant } from "../src/sv/gp-sentence.ts";

describe("Swedish body-site wording", () => {
  it("does not duplicate thumb in compound plus body site for GP visit lines", () => {
    const lines = findingsFromState(gpVisitState(), painForm.diagnoses).map((f) => renderSwedishGp(f));
    for (const line of lines) {
      expect(swedishBodySiteCompoundRedundant(line), line).toBe(false);
    }
  });

  it("uses base nouns for excluded fracture on a thumb", () => {
    const state = emptyState();
    state.diagnoses.ThumbFracture = "excluded";
    const form = state.formAnswers.ThumbFracture ?? { laterality: [], choices: {}, durationNumber: null, durationUnit: "day", sublocation: null, summary: null };
    form.laterality = ["left"];
    state.formAnswers.ThumbFracture = form;
    const finding = findingsFromState(state, painForm.diagnoses).find((f) => f.topic === "ThumbFracture");
    expect(finding).toBeTruthy();
    const line = renderSwedishGp(finding!);
    expect(line).toMatch(/utesluten/i);
    expect(swedishBodySiteCompoundRedundant(line)).toBe(false);
  });
});