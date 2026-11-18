import { describe, expect, it } from "vitest";
import { painForm } from "../src/knowledge.ts";
import {
  choiceButtonLabel,
  diagnosisRowLabel,
  diseaseFormHeading,
  durationUnitLabel,
  featureLabel,
  skipFeatureRow,
  uiString,
} from "../src/form-labels.ts";

describe("form labels", () => {
  it("labels healing and values in EN/SV", () => {
    expect(featureLabel("AbsoluteHealingCharacter", "en")).toBe("Healing");
    expect(featureLabel("AbsoluteHealingCharacter", "sv")).toBe("Läkning");
    expect(choiceButtonLabel("partiallyHealed", "en")).toBe("partially healed");
    expect(choiceButtonLabel("nonHealed", "en")).toBe("not healed");
    expect(choiceButtonLabel("partiallyHealed", "sv")).toBe("delvis läkt");
    expect(choiceButtonLabel("nonHealed", "sv")).toBe("inte läkt");
  });

  it("uses sentence-case titles for disease forms and diagnoses", () => {
    expect(diseaseFormHeading("ThumbFracture", "en")).toBe("Thumb fracture");
    expect(diseaseFormHeading("ThumbSprain", "en")).toBe("Thumb sprain");
    const fracture = painForm.diagnoses.find((row) => row.item === "ThumbFracture");
    expect(fracture).toBeTruthy();
    expect(diagnosisRowLabel(fracture!, "en")).toBe("Thumb fracture");
    expect(diseaseFormHeading("ThumbFracture", "sv")).toBe("Tumfraktur");
  });

  it("skips undeclared time-of-occurrence row", () => {
    expect(skipFeatureRow("QuantityTimeOcc")).toBe(true);
    expect(skipFeatureRow("AbsoluteSeverity")).toBe(false);
  });

  it("translates duration unit labels for SV mode", () => {
    expect(durationUnitLabel("day", "en")).toBe("days");
    expect(durationUnitLabel("week", "en")).toBe("weeks");
    expect(durationUnitLabel("day", "sv")).toBe("dagar");
    expect(durationUnitLabel("week", "sv")).toBe("veckor");
    expect(durationUnitLabel("month", "sv")).toBe("månader");
    expect(uiString("diagnosesHeading", "sv")).toBe("Diagnoser");
    expect(uiString("commentPlaceholder", "sv")).toBe("Fritextkommentar");
  });
});