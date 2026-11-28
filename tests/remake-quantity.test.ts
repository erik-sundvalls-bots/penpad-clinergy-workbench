/**
 * Quantity / unit / many-valued (blood pressure) wording and form captions.
 * Expected strings were observed from the original engine.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderSentence } from "../remake/src/sentence/render.ts";
import { getSentenceKnowledge, formOf, conceptDisplay } from "../remake/src/knowledge-data.ts";
import {
  emptyFormState,
  featureLabel,
  findingsFromForm,
  setQuantity,
  setQuantityPart,
  setFormSummary,
} from "../remake/src/form/engine.ts";
import { isQuantityRow } from "../remake/src/form/generate.ts";
import { featureCaption, quantitySpec } from "../remake/src/form/quantities.ts";
import type { Finding } from "../remake/src/sentence/types.ts";

interface OracleCase {
  id: string;
  finding: Finding;
  expected: string;
}

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/remake-quantity/oracle.json");
const oracle = JSON.parse(readFileSync(fixturePath, "utf8")) as { cases: OracleCase[] };

describe("quantity captions and unit defaults", () => {
  it("uses the original field captions, not raw token names", () => {
    expect(featureCaption("QuantityStartTime")).toBe("how long ago?");
    expect(featureCaption("QuantityLengthOfHistory")).toBe("lasting how long?");
    expect(featureCaption("AbsoluteHistoricalPattern")).toBe("pattern");
    expect(featureCaption("hasQuantity")).toBe("");
    expect(featureCaption("hasManyValuedQuantity")).toBe("");
    expect(featureLabel("QuantityStartTime")).toBe("how long ago?");
    expect(featureLabel("hasQuantity")).toBe("");
  });

  it("preselects per minute for pulse/heart rate and mmHg for blood pressure", () => {
    expect(quantitySpec("hasQuantity", ["PulseRateValue"]).defaultUnit).toBe("perMinute");
    expect(quantitySpec("hasQuantity", ["HeartRateValue"]).defaultUnit).toBe("perMinute");
    expect(quantitySpec("hasManyValuedQuantity", ["SystolicBPValue", "DiastolicBPValue"]).defaultUnit).toBe("millimetresOfMercury");
    expect(quantitySpec("hasQuantity", ["PulseRateValue"]).units.map((u) => u.display)).toContain("per minute");
    expect(quantitySpec("hasManyValuedQuantity", ["SystolicBPValue", "DiastolicBPValue"]).units.map((u) => u.display)).toContain("mmHg");
  });

  it("treats blood pressure as a many-valued quantity, not a pair of 'value' chips", () => {
    const form = formOf("BloodPressureSign")!;
    const row = form.firstLayer.find((r) => r.feature === "hasManyValuedQuantity")!;
    expect(isQuantityRow(row)).toBe(true);
    expect(row.values).toEqual(["SystolicBPValue", "DiastolicBPValue"]);
    expect(conceptDisplay("SystolicBPValue")).toBe("systolic BP");
    expect(conceptDisplay("DiastolicBPValue")).toBe("diastolic BP");
  });

  it("builds a blood-pressure finding from two numeric fields", () => {
    const form = formOf("BloodPressureSign")!;
    let state = emptyFormState(form);
    state = setFormSummary(state, "normal");
    state = setQuantityPart(state, "hasManyValuedQuantity", "SystolicBPValue", 120, "millimetresOfMercury", ["SystolicBPValue", "DiastolicBPValue"]);
    state = setQuantityPart(state, "hasManyValuedQuantity", "DiastolicBPValue", 80, "millimetresOfMercury", ["SystolicBPValue", "DiastolicBPValue"]);
    const findings = findingsFromForm(form, { ...state, summary: undefined });
    const bp = findings.find((f) => f.topic === "BloodPressureSign")!;
    expect(renderSentence(bp, getSentenceKnowledge())).toBe("Blood pressure 120/80 mmHg");
  });

  it("builds a pulse-rate finding with the default unit", () => {
    const form = formOf("PulseRateSign")!;
    let state = emptyFormState(form);
    state = setQuantity(state, "hasQuantity", "PulseRateValue", 90, "perMinute");
    const finding = findingsFromForm(form, state).find((f) => f.topic === "PulseRateSign")!;
    expect(renderSentence(finding, getSentenceKnowledge())).toBe("Pulse rate 90 per minute");
  });
});

describe("quantity oracle (original-engine strings)", () => {
  const knowledge = getSentenceKnowledge();

  it("covers the malaria, pulse, blood pressure, JVP, and oedema cases", () => {
    expect(oracle.cases.map((c) => c.id)).toEqual(expect.arrayContaining([
      "pmh-malaria-start-and-length",
      "pulse-rate-90",
      "blood-pressure-120-80",
      "jvp-slightly-raised",
      "pitting-oedema-left-mild",
    ]));
  });

  it("matches every expected sentence", () => {
    const mismatches: string[] = [];
    for (const row of oracle.cases) {
      const actual = renderSentence(row.finding, knowledge);
      if (actual !== row.expected) mismatches.push(`${row.id}: expected ${JSON.stringify(row.expected)} actual ${JSON.stringify(actual)}`);
    }
    expect(mismatches, mismatches.join("\n")).toEqual([]);
  });
});
