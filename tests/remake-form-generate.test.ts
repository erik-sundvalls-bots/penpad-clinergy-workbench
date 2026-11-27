import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import {
  assessCoverage,
  generateRemakeForms,
  loadExtractFromDir,
  stableStringify,
  type DirReader,
} from "../remake/src/form/generate.ts";
import { emptyFormState, findingsFromForm, rowIsVisible, rowsOf, setFeatureValue } from "../remake/src/form/engine.ts";

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), "fixtures/remake-form-generate");
const EXTRACT = join(FIXTURE, "extract");
const GOLDEN = join(FIXTURE, "golden/forms.json");

function nodeReader(): DirReader {
  return {
    read: (path) => readFileSync(path, "utf8"),
    exists: (path) => existsSync(path),
    listFiles: (dir) => readdirSync(dir),
  };
}

function catalogFromFixture() {
  const input = loadExtractFromDir(EXTRACT, nodeReader(), (text) => parse(text));
  return generateRemakeForms(input);
}

describe("remake form generator", () => {
  it("is deterministic: two runs produce byte-identical output", () => {
    const a = stableStringify(catalogFromFixture());
    const b = stableStringify(catalogFromFixture());
    expect(a).toBe(b);
  });

  it("matches the golden snapshot", () => {
    const actual = stableStringify(catalogFromFixture());
    const expected = readFileSync(GOLDEN, "utf8");
    expect(actual).toBe(expected);
  });

  it("drops timestamps, Read codes, and mapping blocks", () => {
    const { forms } = catalogFromFixture();
    const json = stableStringify(forms.DemoAlphaSymptom);
    expect(json).not.toMatch(/extractedAt|1999-01-01|SHOULD-NOT-APPEAR|opengalen|readCode/i);
    expect(forms.DemoAlphaSymptom.display).toBe("demo alpha symptom");
    expect(forms.DemoAlphaSymptom.firstLayer.some((r) => r.default === "moderate")).toBe(true);
    expect(forms.DemoAlphaSymptom.firstLayer.some((r) => r.visibleWhen?.feature === "AbsoluteSeverity")).toBe(true);
  });

  it("ignores forms/index.yaml and keys the catalogue by topic", () => {
    const { forms } = catalogFromFixture();
    expect(Object.keys(forms).sort()).toEqual(["DemoAlphaSymptom", "DemoBetaSign", "DemoEmptyAction"]);
    expect(forms.DemoBetaSign.otherLinks?.[0]?.concept).toBe("DemoFollowUpAction");
  });


  it("classifies coverage: empty is full, examinations are partial", () => {
    const report = assessCoverage(catalogFromFixture().forms);
    expect(report.total).toBe(3);
    expect(report.full).toBe(2);
    expect(report.partial).toBe(1);
    expect(report.none).toBe(0);
    expect(report.empty).toBe(1);
    expect(report.constructs.examinations.examples).toContain("DemoBetaSign");
    expect(report.forms.find((f) => f.topic === "DemoBetaSign")?.level).toBe("partial");
    expect(report.forms.find((f) => f.topic === "DemoEmptyAction")?.empty).toBe(true);
  });

  it("applies defaults and hides rows until visibleWhen is satisfied", () => {
    const form = catalogFromFixture().forms.DemoAlphaSymptom;
    const state = emptyFormState(form);
    expect(state.features.AbsoluteSeverity?.values).toEqual(["moderate"]);
    const visible = rowsOf(form, true, state).map((r) => r.feature);
    expect(visible).toContain("AbsoluteSeverity");
    expect(visible).not.toContain("AbsoluteOnset");
    const severe = setFeatureValue(state, "AbsoluteSeverity", "severe", false);
    expect(rowIsVisible(form.firstLayer.find((r) => r.feature === "AbsoluteOnset")!, severe)).toBe(true);
  });

  it("records criterial attribute/value chips as findings", () => {
    const form = catalogFromFixture().forms.DemoBetaSign;
    let state = emptyFormState(form);
    state = setFeatureValue(state, "criterial:ConseqDemoFinding", "presence", false);
    const findings = findingsFromForm(form, state);
    expect(findings[0].qualifiers.some((q) => q.descriptor === "ConseqDemoFinding" && q.value === "presence")).toBe(true);
  });
});
