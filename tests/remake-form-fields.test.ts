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

describe("normality on standalone Normal forms", () => {
  it("is a first-layer row, not the form summary", () => {
    const form = formOf("AsthmaCheckSign");
    expect(form?.summaryType).toBe("No Summary");
    expect(form?.firstLayer[0]).toMatchObject({
      caption: "normality",
      feature: "hasAbnormalityStatus",
      values: ["normal"],
    });
  });

  it("retitles menstrual regularity and keeps the other quantity rows", () => {
    const form = formOf("MenstrualDataSymptom");
    expect(form?.summaryType).toBe("No Summary");
    expect(form?.firstLayer.map((row) => [row.caption, row.feature])).toEqual([
      ["normality", "hasAbnormalityStatus"],
      ["menses duration", "QuantityMensesDuration"],
      ["cycle length", "QuantityMensesFrequency"],
      ["regularity", "AbsoluteMensesRegularity"],
      ["relative volume", "RelativeVolume"],
    ]);
    expect(form?.firstLayer.find((row) => row.feature === "AbsoluteMensesRegularity")?.values)
      .toEqual(["regular", "irregular", "chaotic"]);
  });
});

describe("alcohol and tobacco level lists", () => {
  it("are first-layer drinking and smoking rows", () => {
    const drink = formOf("CurrentLevelOfDrinking");
    expect(drink?.summaryType).toBe("No Summary");
    expect(drink?.firstLayer[0]).toMatchObject({
      caption: "drinking",
      feature: "AbsoluteDrinkingLevel",
    });
    expect(drink?.firstLayer[0]?.values).toEqual([
      "nilAlcohol", "trivialAlcohol", "lightAlcohol", "moderateAlcohol", "heavyAlcohol", "veryHeavyAlcohol",
    ]);
    const smoke = formOf("PreviousLevelOfSmoking");
    expect(smoke?.summaryType).toBe("No Summary");
    expect(smoke?.firstLayer[0]).toMatchObject({
      caption: "smoking",
      feature: "AbsoluteSmokingLevel",
    });
    expect(smoke?.firstLayer[0]?.values).toEqual([
      "nilTobacco", "trivialTobacco", "lightTobacco", "moderateTobacco", "heavyTobacco", "veryHeavyTobacco",
    ]);
  });
});

describe("sided symptoms that lack a generated laterality row", () => {
  it("get an explicit left/right field", () => {
    const form = formOf("ColdArmSymptom");
    expect(form?.firstLayer[0]).toMatchObject({
      caption: "laterality",
      feature: "laterality",
      multiple: true,
      values: ["leftSelection", "rightSelection"],
    });
    expect(formOf("EyeDrynessSymptom")?.firstLayer[0]?.feature).toBe("laterality");
    expect(formOf("TMJDysfunction")?.firstLayer[0]?.feature).toBe("laterality");
  });
});

describe("Sciatica sublocation", () => {
  it("offers the back-region list on the form", () => {
    const form = formOf("Sciatica");
    expect(form?.firstLayer[0]).toMatchObject({
      caption: "Sublocation",
      feature: "sublocation",
    });
    expect(form?.firstLayer[0]?.values).toEqual([
      "PosteriorRibsRegion",
      "ScapularRegion",
      "CervicalRegion",
      "ThoracicRegion",
      "LumbarRegion",
      "SacralRegion",
      "CoccygealRegion",
      "Loin",
      "LowBackRegion",
    ]);
  });
});
