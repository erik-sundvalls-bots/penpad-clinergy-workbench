/**
 * Regression: repeated signs on a multi-site examination must keep per-site
 * state, and On Examination / finding sentences must match the original
 * engine strings in the fixture (strings and catalogue concept ids only).
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { applyGeneratedSentenceKnowledge, examOf, formOf, setGeneratedExams, setGeneratedForms } from "../remake/src/knowledge-data.ts";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog } from "../remake/src/form/generate.ts";
import { GENERATED_EXAMS_SCHEMA, type GeneratedExamsCatalog } from "../remake/src/form/exams.ts";
import { GENERATED_SENTENCES_SCHEMA, type GeneratedSentenceKnowledge } from "../remake/src/sentence/generate.ts";
import {
  emptyFormState,
  findingsFromForm,
  setExamSign,
  setExamSiteStatus,
  setFeatureValue,
  setFormSummary,
} from "../remake/src/form/engine.ts";
import { onExamination } from "../remake/src/exam/prose.ts";
import { renderSentence } from "../remake/src/sentence/render.ts";
import { getSentenceKnowledge } from "../remake/src/knowledge-data.ts";

const root = dirname(fileURLToPath(import.meta.url));

interface ExamOracle {
  schema: string;
  cases: Record<string, { finding?: string; exam?: string }>;
}

const oracle = JSON.parse(
  readFileSync(join(root, "fixtures/remake-exam-site-scope/oracle.json"), "utf8"),
) as ExamOracle;

function reloadGeneratedCatalogs(): void {
  const formsPath = resolve(root, "../public/remake/generated/forms.json");
  const examsPath = resolve(root, "../public/remake/generated/exams.json");
  const sentencesPath = resolve(root, "../public/remake/generated/sentences.json");
  if (existsSync(formsPath)) {
    const catalog = JSON.parse(readFileSync(formsPath, "utf8")) as GeneratedCatalog;
    if (catalog.schema !== GENERATED_FORMS_SCHEMA || !catalog.forms) {
      throw new Error(`invalid generated catalogue at ${formsPath}`);
    }
    setGeneratedForms(catalog.forms);
  }
  if (existsSync(examsPath)) {
    const catalog = JSON.parse(readFileSync(examsPath, "utf8")) as GeneratedExamsCatalog;
    if (catalog.schema !== GENERATED_EXAMS_SCHEMA || !catalog.exams) {
      throw new Error(`invalid generated exam catalogue at ${examsPath}`);
    }
    setGeneratedExams(catalog);
  }
  if (existsSync(sentencesPath)) {
    const catalog = JSON.parse(readFileSync(sentencesPath, "utf8")) as GeneratedSentenceKnowledge;
    if (catalog.schema !== GENERATED_SENTENCES_SCHEMA || !catalog.rules) {
      throw new Error(`invalid generated sentence knowledge at ${sentencesPath}`);
    }
    applyGeneratedSentenceKnowledge(catalog);
  }
}

function lumpState(location: string, summary: string) {
  const form = formOf("LumpSign")!;
  return setFormSummary(emptyFormState(form, { location }), summary);
}

function qualifiedLump(location: string, opts?: { tender?: "presence" | "absence"; inflamed?: "presence" | "absence"; size?: string }) {
  const form = formOf("LumpSign")!;
  let state = setFormSummary(emptyFormState(form, { location }), "presence");
  state = setFeatureValue(state, "AbsoluteSize", opts?.size ?? "moderateSize", false);
  state = setFeatureValue(state, "AbsoluteConsistency", "firm", false);
  state = setFeatureValue(state, "AbsoluteTexture", "nodular", false);
  state = setFeatureValue(state, "AbsoluteStructuralMobilityLump", "fixed", false);
  if (opts?.tender) state = setFeatureValue(state, "criterial:ConseqTendernessSign", opts.tender, false);
  if (opts?.inflamed) state = setFeatureValue(state, "criterial:LocatInflammationSign", opts.inflamed, false);
  return state;
}

function dysuriaState() {
  return emptyFormState(formOf("DysuriaSymptom")!);
}

function findingSentence(formTopic: string, state: ReturnType<typeof emptyFormState>): string {
  const form = formOf(formTopic)!;
  const findings = findingsFromForm(form, state, { includeExams: true });
  const sign = findings.find((f) => f.topic === "LumpSign" || f.topic === "TendernessSign") ?? findings[findings.length - 1];
  return renderSentence(sign, getSentenceKnowledge());
}

describe("exam sign state is scoped per site", () => {
  beforeEach(() => {
    reloadGeneratedCatalogs();
  });

  it("keeps a right-kidney lump from filling left kidney, pelvis, or prostate", () => {
    const form = formOf("DysuriaSymptom")!;
    let state = dysuriaState();
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", lumpState("RightKidney", "presence"), "MaleGURightKidneyExam");
    const findings = findingsFromForm(form, state);
    const lumps = findings.filter((f) => f.topic === "LumpSign");
    expect(lumps).toHaveLength(1);
    expect(lumps[0]?.location).toBe("RightKidney");
    expect(lumps[0]?.summary).toBe("presence");
    const prose = onExamination(form, state);
    expect(prose).toBe(oracle.cases.rightKidneyLumpPresent.exam);
    expect(prose).not.toMatch(/prostate/i);
    expect(prose).not.toContain("lump present; lump present");
  });

  it("records independent lump findings on two sites", () => {
    const form = formOf("DysuriaSymptom")!;
    let state = dysuriaState();
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", lumpState("RightKidney", "presence"), "MaleGURightKidneyExam");
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", lumpState("LeftKidney", "absence"), "MaleGULeftKidneyExam");
    const findings = findingsFromForm(form, state).filter((f) => f.topic === "LumpSign");
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ location: "RightKidney", summary: "presence" }),
      expect.objectContaining({ location: "LeftKidney", summary: "absence" }),
    ]));
    expect(onExamination(form, state)).toBe(oracle.cases.rightKidneyPresentLeftAbsent.exam);
  });

  it("does not put a kidney lump under prostate, and keeps a prostate tenderness finding on its own line", () => {
    const form = formOf("DysuriaSymptom")!;
    expect(examOf("GUProstateExam")?.signs).not.toContain("LumpSign");
    const tenderness = setFormSummary(emptyFormState(formOf("TendernessSign")!, { location: "ProstateGland" }), "presence");
    let state = dysuriaState();
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", lumpState("RightKidney", "presence"), "MaleGURightKidneyExam");
    state = setExamSign(state, "MaleGUExam", "all", "TendernessSign", tenderness, "GUProstateExam");
    expect(onExamination(form, state)).toBe(oracle.cases.rightKidneyLumpAndProstateTenderness.exam);
  });

  it("keeps different qualifier values on two LumpSign sites", () => {
    const form = formOf("DysuriaSymptom")!;
    let right = setFormSummary(emptyFormState(formOf("LumpSign")!, { location: "RightKidney" }), "presence");
    right = setFeatureValue(right, "AbsoluteSize", "moderateSize", false);
    let pelvic = setFormSummary(emptyFormState(formOf("LumpSign")!, { location: "Pelvis" }), "presence");
    pelvic = setFeatureValue(pelvic, "AbsoluteSize", "large", false);
    let state = dysuriaState();
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", right, "MaleGURightKidneyExam");
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", pelvic, "MalePelvisExam");
    expect(onExamination(form, state)).toBe(oracle.cases.rightKidneyMediumAndPelvicLarge.exam);
  });

  it("matches original finding and OE wording for a qualified tender lump at the right kidney", () => {
    const form = formOf("DysuriaSymptom")!;
    const lump = qualifiedLump("RightKidney", { tender: "presence" });
    let state = dysuriaState();
    state = setExamSign(state, "MaleGUExam", "all", "LumpSign", lump, "MaleGURightKidneyExam");
    expect(findingSentence("DysuriaSymptom", state)).toBe(oracle.cases.rightKidneyLumpTenderQualified.finding);
    expect(onExamination(form, state)).toBe(oracle.cases.rightKidneyLumpTenderQualified.exam);
  });

  it("matches original wording for present, absent, qualified, inflamed, and non-tender lumps, and for prostate tenderness", () => {
    const form = formOf("DysuriaSymptom")!;
    const run = (signState: ReturnType<typeof lumpState>, site: string, key: string) => {
      let state = dysuriaState();
      state = setExamSign(state, "MaleGUExam", "all", signState.topic, signState, site);
      expect(onExamination(form, state)).toBe(oracle.cases[key].exam);
      expect(findingSentence("DysuriaSymptom", state)).toBe(oracle.cases[key].finding);
    };
    run(lumpState("RightKidney", "presence"), "MaleGURightKidneyExam", "rightKidneyLumpPresent");
    run(lumpState("RightKidney", "absence"), "MaleGURightKidneyExam", "rightKidneyLumpAbsent");
    run(qualifiedLump("RightKidney"), "MaleGURightKidneyExam", "rightKidneyLumpQualified");
    run(
      setFeatureValue(lumpState("RightKidney", "presence"), "criterial:LocatInflammationSign", "presence", false),
      "MaleGURightKidneyExam",
      "rightKidneyLumpInflamed",
    );
    run(
      setFeatureValue(lumpState("RightKidney", "presence"), "criterial:ConseqTendernessSign", "absence", false),
      "MaleGURightKidneyExam",
      "rightKidneyLumpNonTender",
    );
    run(
      setFormSummary(emptyFormState(formOf("TendernessSign")!, { location: "ProstateGland" }), "presence"),
      "GUProstateExam",
      "prostateTendernessPresent",
    );
  });

  it("emits a per-site normal status line under the parent exam", () => {
    const form = formOf("DysuriaSymptom")!;
    let state = dysuriaState();
    state = setExamSiteStatus(state, "MaleGUExam", "all", "MaleGURightKidneyExam", "normal");
    expect(onExamination(form, state)).toBe(oracle.cases.rightKidneyNormal.exam);
  });

  it("keeps both genitourinary system exam rows on the dysuria form, matching the original tree", () => {
    const form = formOf("DysuriaSymptom")!;
    const exams = (form.examinations ?? []).map((e) => ({ exam: e.exam, display: examOf(e.exam)?.display }));
    expect(exams).toEqual([
      { exam: "MaleGUExam", display: "genitourinary system" },
      { exam: "FemaleGUExam", display: "genitourinary system" },
      { exam: "UrineExam", display: "urine" },
    ]);
    expect(examOf("MaleGUExam")?.subExams).toEqual([
      "MaleGURightKidneyExam",
      "MaleGULeftKidneyExam",
      "MalePelvisExam",
      "GUPenisExam",
      "GUScrotumExam",
      "GUProstateExam",
    ]);
    expect(examOf("MaleGURightKidneyExam")?.signs).toContain("LumpSign");
    expect(examOf("MaleGULeftKidneyExam")?.signs).toContain("LumpSign");
    expect(examOf("MalePelvisExam")?.signs).toContain("LumpSign");
    expect(examOf("GUProstateExam")?.signs).not.toContain("LumpSign");
    expect(examOf("GUScrotumExam")?.signs).toContain("ScrotalLumpSign");
  });

  it("scopes every reused sign on every parent exam that repeats a sign across sites", () => {
    const catalog = JSON.parse(readFileSync(resolve(root, "../public/remake/generated/exams.json"), "utf8")) as GeneratedExamsCatalog;
    const parents: Array<{ exam: string; sign: string; first: string; second: string }> = [];
    for (const [name, def] of Object.entries(catalog.exams)) {
      const counts = new Map<string, string[]>();
      for (const subName of def.subExams) {
        const sub = catalog.exams[subName];
        if (!sub) continue;
        for (const sign of sub.signs) {
          const list = counts.get(sign) ?? [];
          list.push(subName);
          counts.set(sign, list);
        }
      }
      for (const [sign, sites] of counts) {
        if (sites.length > 1) parents.push({ exam: name, sign, first: sites[0]!, second: sites[1]! });
      }
    }
    expect(new Set(parents.map((p) => p.exam)).size).toBe(16);

    const base = formOf("DysuriaSymptom")!;
    for (const row of parents) {
      const signForm = formOf(row.sign);
      if (!signForm) continue;
      const firstLoc = examOf(row.first)?.baseLocation ?? null;
      const secondLoc = examOf(row.second)?.baseLocation;
      const filled = setFormSummary(emptyFormState(signForm, { location: firstLoc }), "presence");
      const form = {
        ...base,
        examinations: [{ exam: row.exam, display: examOf(row.exam)?.display ?? row.exam }],
      };
      let state = emptyFormState(form);
      state = setExamSign(state, row.exam, "all", row.sign, filled, row.first);
      const findings = findingsFromForm(form, state).filter((f) => f.topic === row.sign || f.topic === signForm.topic);
      expect(
        findings.some((f) => f.location === secondLoc && secondLoc && secondLoc !== firstLoc),
        `${row.exam} ${row.sign} leaked onto ${row.second}`,
      ).toBe(false);
      expect(findings.length, `${row.exam} ${row.sign} produced no finding`).toBeGreaterThan(0);
      const prose = onExamination(form, state);
      const secondLabel = examOf(row.second)?.display ?? "";
      if (secondLabel && examOf(row.first)?.display !== secondLabel) {
        expect(prose.toLowerCase(), `${row.exam} ${row.sign} OE mentions ${row.second}`).not.toContain(secondLabel.toLowerCase());
      }
    }
  });
});
