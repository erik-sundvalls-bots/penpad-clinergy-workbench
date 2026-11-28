import { describe, expect, it } from "vitest";
import { formOf, summaryOptions } from "../remake/src/knowledge-data.ts";
import { applyFormFieldLayout } from "../remake/src/form/form-layout.ts";

describe("vaccination field layout", () => {
  it("puts dose stage and status on the form, not on the summary chips", () => {
    const form = formOf("AnthraxVaccination");
    expect(form, "AnthraxVaccination").toBeTruthy();
    expect(form!.summaryType).toBe("VaccinationStatus");
    expect(form!.firstLayer.map((row) => [row.caption, row.feature])).toEqual([
      ["stage", "AbsoluteVaccinationStage"],
    ]);
    expect(form!.firstLayer[0]!.values).toEqual(["firstStage", "secondStage", "thirdStage", "fourthStage", "booster"]);
    expect(summaryOptions(form!.summaryType).map((row) => row.value)).toEqual([
      "given", "required", "notRequired", "postponed", "refused",
    ]);
  });

  it("keeps the shorter stage lists for cholera and MMR", () => {
    expect(formOf("CholeraVaccination")?.firstLayer[0]?.values).toEqual(["firstStage", "secondStage", "booster"]);
    expect(formOf("MMRVaccination")?.firstLayer[0]?.values).toEqual(["firstStage", "booster"]);
  });
});

describe("family-history field layout", () => {
  it("splits strength and relation into two first-layer rows", () => {
    const form = formOf("FHOfAlcoholism");
    expect(form, "FHOfAlcoholism").toBeTruthy();
    expect(form!.summaryType).toBe("No Summary");
    expect(form!.firstLayer.map((row) => [row.caption, row.feature])).toEqual([
      ["strength", "AbsoluteStrength"],
      ["relation", "isWithReferenceTo"],
    ]);
    expect(form!.firstLayer[0]!.values).toEqual(["nonePresent", "weak", "moderateLevel", "strong"]);
    expect(form!.firstLayer[1]!.values).toContain("Father");
    expect(form!.firstLayer[1]!.values).toContain("Aunt");
  });

  it("is a no-op for ordinary symptom forms", () => {
    const form = formOf("AbdominalPainSymptom");
    expect(form?.summaryType).not.toBe("No Summary");
    const again = applyFormFieldLayout(form!, { FamilyHistorySummary: summaryOptions("FamilyHistorySummary") });
    expect(again).toBe(form);
  });
});
