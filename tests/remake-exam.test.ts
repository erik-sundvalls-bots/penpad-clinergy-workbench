import { describe, expect, it, beforeEach } from "vitest";
import { examOf, formOf, setGeneratedExams, setGeneratedForms } from "../remake/src/knowledge-data.ts";
import { generateRemakeExams } from "../remake/src/form/exams.ts";
import { generateRemakeForms, loadExtractFromDir, type DirReader } from "../remake/src/form/generate.ts";
import {
  emptyFormState,
  findingsFromForm,
  setExamSign,
  setExamStatus,
  setFeatureValue,
  setFormSummary,
} from "../remake/src/form/engine.ts";
import { onExamination } from "../remake/src/exam/prose.ts";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

const EXTRACT = join(dirname(fileURLToPath(import.meta.url)), "fixtures/remake-form-generate/extract");

function nodeReader(): DirReader {
  return {
    read: (path) => readFileSync(path, "utf8"),
    exists: (path) => existsSync(path),
    listFiles: (dir) => readdirSync(dir),
  };
}

describe("examination entry and On Examination prose", () => {
  beforeEach(() => {
    const extract = loadExtractFromDir(EXTRACT, nodeReader(), (text) => parse(text));
    const forms = generateRemakeForms(extract);
    const exams = generateRemakeExams({
      exams: extract.exams ?? {},
      concepts: extract.concepts ?? {},
      completeForms: forms.forms,
      summaryTypes: (extract.sentenceRules as { summaryTypes?: string[] } | undefined)?.summaryTypes ?? [],
    });
    setGeneratedForms(forms.forms);
    setGeneratedExams(exams);
  });

  it("records per-side status and sign findings", () => {
    const form = formOf("DemoBetaSign")!;
    let state = emptyFormState(form);
    state = setExamStatus(state, "DemoRegionExam", "left", "normal");
    const findings = findingsFromForm(form, state);
    expect(findings.some((f) => f.summary === "normal" && f.laterality === "left")).toBe(true);
  });

  it("composes a walkthrough-shaped examination block", () => {
    const form = formOf("DemoBetaSign")!;
    const tenderness = formOf("DemoTendernessSign")!;
    const flexion = formOf("DemoFlexionSign")!;
    let state = emptyFormState(form);
    let tender = setFormSummary(emptyFormState(tenderness, { location: "DemoRegion" }), "presence");
    let flex = setFeatureValue(emptyFormState(flexion, { location: "DemoJoint" }), "RelativeRangeJointArticulation", "fullRange", false);
    flex = setFeatureValue(flex, "criterial:ConseqPainOnMovement", "mild", false);
    state = setExamSign(state, "DemoRegionExam", "left", "DemoTendernessSign", tender);
    state = setExamSign(state, "DemoRegionExam", "left", "DemoFlexionSign", flex);
    const prose = onExamination(form, state);
    expect(prose).toContain("On Examination");
    expect(prose).toContain("Left demo region: tenderness present");
    expect(prose).toContain("Left demo joint: flexion full range, mildly painful");
  });

  it("matches original engine exam wording for status, absence, and painless movement", () => {
    const form = formOf("DemoBetaSign")!;
    const tenderness = formOf("DemoTendernessSign")!;
    const flexion = formOf("DemoFlexionSign")!;

    let normal = emptyFormState(form);
    normal = setExamStatus(normal, "DemoRegionExam", "left", "normal");
    expect(onExamination(form, normal)).toContain("Left demo region normal");
    expect(onExamination(form, normal)).not.toContain("Left demo region: normal");

    let absent = emptyFormState(form);
    const tenderAbs = setFormSummary(emptyFormState(tenderness, { location: "DemoRegion" }), "absence");
    absent = setExamSign(absent, "DemoRegionExam", "left", "DemoTendernessSign", tenderAbs);
    expect(onExamination(form, absent)).toContain("Left demo region: no tenderness");

    let painless = emptyFormState(form);
    let flex = setFeatureValue(emptyFormState(flexion, { location: "DemoJoint" }), "RelativeRangeJointArticulation", "reducedRange", false);
    flex = setFeatureValue(flex, "criterial:ConseqPainOnMovement", "absence", false);
    painless = setExamSign(painless, "DemoRegionExam", "left", "DemoFlexionSign", flex);
    expect(onExamination(form, painless)).toContain("Left demo joint: flexion reduced range, painless");
  });

  it("resolves the fixture exam tree", () => {
    expect(examOf("DemoRegionExam")?.signs).toEqual(["DemoTendernessSign"]);
    expect(examOf("DemoMovementExam")?.signs).toEqual(["DemoFlexionSign"]);
    expect(formOf("DemoTendernessSign")?.summaryType).toBe("AbsentPresent");
  });
});
