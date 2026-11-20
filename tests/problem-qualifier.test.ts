import { describe, expect, it } from "vitest";
import { emptyFinding, emptyState, gpVisitState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { buildFhirBundle } from "../src/fhir/bundle.ts";
import { validateFhirBundle } from "../src/fhir/validate.ts";
import { canonicalToZipehrHtml5 } from "../src/openehr/zipehr.ts";
import {
  buildQuietZipehrPreviewDocument,
  composeQuietStructureCss,
} from "../src/openehr/zipehr.ts";
import { applyZipQuietDomScript } from "../src/openehr/zipehr-preview.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { historyNarrativeText } from "../src/summary.ts";
import { findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";

const PROGRESS = ["better", "same", "worse"] as const;
const HEALING = ["healed", "partiallyHealed", "nonHealed"] as const;

function qualifierCluster(canonical: Record<string, unknown>): Record<string, unknown> | undefined {
  const walk = (node: unknown): Record<string, unknown> | undefined => {
    if (!node || typeof node !== "object") return undefined;
    if (Array.isArray(node)) {
      for (const child of node) {
        const hit = walk(child);
        if (hit) return hit;
      }
      return undefined;
    }
    const record = node as Record<string, unknown>;
    if (
      record._type === "CLUSTER" &&
      record.archetype_node_id === "at0046" &&
      JSON.stringify(record).includes("problem_qualifier")
    ) {
      return record;
    }
    for (const value of Object.values(record)) {
      const hit = walk(value);
      if (hit) return hit;
    }
    return undefined;
  };
  return walk(canonical);
}

function clinicalDescription(canonical: Record<string, unknown>): string {
  const walk = (node: unknown): string => {
    if (!node || typeof node !== "object") return "";
    if (Array.isArray(node)) return node.map(walk).join("");
    const record = node as Record<string, unknown>;
    if (record.archetype_node_id === "at0009" && record.value) {
      return String((record.value as { value?: string }).value ?? "");
    }
    return Object.values(record).map(walk).join("");
  };
  return walk(canonical);
}

async function quietText(html: string, lang: "en" | "sv"): Promise<string> {
  const base = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8");
  const quiet = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8");
  const css = await composeQuietStructureCss(base, quiet);
  const doc = await buildQuietZipehrPreviewDocument(html, css, {
    quietStructureTooltips: true,
    templateRenderLang: lang,
  });
  const win = new Window({ url: "https://example.test/" });
  win.document.write(doc.replace(/<script>[\s\S]*?<\/script>\s*(?=<\/body>)/g, ""));
  await applyZipQuietDomScript(win);
  return win.document.body.innerText.replace(/\s+/g, " ").trim();
}

describe("problem_qualifier.v2 on problem_diagnosis", () => {
  for (const progress of PROGRESS) {
    it(`maps sprain progress ${progress} (EN/SV)`, async () => {
      for (const lang of ["en", "sv"] as const) {
        const state = emptyState();
        state.diagnoses.ThumbSprain = "presence";
        const answer = emptyFinding();
        answer.laterality = ["right"];
        answer.choices.AbsoluteProgress = progress;
        state.formAnswers.ThumbSprain = answer;
        const built = buildVisit(state, "Thumb sprain", lang);
        const cluster = qualifierCluster(built.canonical);
        expect(cluster, `missing qualifier (${lang})`).toBeTruthy();
        const coded = JSON.stringify(cluster);
        const code = progress === "better" ? "at0103" : progress === "same" ? "at0104" : "at0105";
        expect(coded).toContain(`"code_string":"${code}"`);
        expect(coded).toContain("TERM_MAPPING");
        const desc = clinicalDescription(built.canonical);
        expect(desc).not.toMatch(/progress/i);
        expect(desc).not.toContain(";");
        const checked = await validateComposition(built.canonical);
        expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
      }
    });
  }

  for (const healing of HEALING) {
    it(`maps fracture healing ${healing} (EN/SV)`, async () => {
      for (const lang of ["en", "sv"] as const) {
        const state = emptyState();
        state.diagnoses.ThumbFracture = "presence";
        const answer = emptyFinding();
        answer.laterality = ["left"];
        answer.choices.AbsoluteHealingCharacter = healing;
        answer.durationNumber = 2;
        answer.durationUnit = "week";
        state.formAnswers.ThumbFracture = answer;
        const built = buildVisit(state, "Fracture", lang);
        const cluster = qualifierCluster(built.canonical);
        expect(cluster).toBeTruthy();
        const coded = JSON.stringify(cluster);
        const code =
          healing === "healed" ? "at0084" : healing === "partiallyHealed" ? "at0085" : "at0086";
        expect(coded).toContain(`"code_string":"${code}"`);
        expect(coded).toContain("TERM_MAPPING");
        expect(JSON.stringify(built.canonical)).toContain("at0077");
        expect(clinicalDescription(built.canonical)).not.toContain("partiallyHealed");
        const checked = await validateComposition(built.canonical);
        expect(checked.errors).toEqual([]);
      }
    });
  }

  it("does not duplicate sprain duration on problem_diagnosis when pain has episode duration", async () => {
    const state = emptyState();
    state.pain.durationNumber = 3;
    state.pain.durationUnit = "day";
    state.diagnoses.ThumbSprain = "presence";
    const answer = emptyFinding();
    answer.durationNumber = 5;
    answer.durationUnit = "week";
    answer.choices.AbsoluteProgress = "worse";
    state.formAnswers.ThumbSprain = answer;
    const built = buildVisit(state, "Sprain");
    const json = JSON.stringify(built.canonical);
    expect(json).toContain("at0105");
    expect(json).toMatch(/"archetype_node_id":"at0028"/);
    const onsetCount = (json.match(/"archetype_node_id":"at0077"/g) ?? []).length;
    expect(onsetCount).toBe(0);
  });

  it("writes typed plan text without topic or dictionary swap", async () => {
    const state = emptyState();
    state.plan = "Follow up in clinic next week.";
    const built = buildVisit(state, "Pain");
    const json = JSON.stringify(built.canonical);
    expect(json).toContain("Follow up in clinic next week.");
    expect(json).not.toContain("Clinical management");
    expect(json).not.toContain("Klinisk handläggning");
  });

  it("generates Story from historyNarrativeText in composition language", async () => {
    const state = gpVisitState();
    const findings = findingsFromState(state, painForm.diagnoses);
    const svStory = historyNarrativeText(findings, "sv");
    const built = buildVisit(state, undefined, "sv");
    expect(JSON.stringify(built.canonical)).toContain(svStory.split("\n")[0] ?? "");
  });

  it("mirrors qualifier on FHIR Condition extension", () => {
    const state = emptyState();
    state.diagnoses.ThumbSprain = "presence";
    const answer = emptyFinding();
    answer.choices.AbsoluteProgress = "better";
    state.formAnswers.ThumbSprain = answer;
    const built = buildVisit(state, "Sprain");
    const bundle = buildFhirBundle(state, built.canonical);
    expect(validateFhirBundle(bundle)).toEqual([]);
    const condition = (bundle.entry as { resource: Record<string, unknown> }[]).map((e) => e.resource)
      .find((r) => r.resourceType === "Condition" && JSON.stringify(r).includes("at0103"));
    const ext = condition?.extension as { url: string; extension: unknown[] }[] | undefined;
    expect(ext?.[0]?.url).toContain("problem-qualifier");
  });

  it("shows progression labels in quiet ZipEHR EN and SV", async () => {
    const state = emptyState();
    state.diagnoses.ThumbSprain = "presence";
    const answer = emptyFinding();
    answer.laterality = ["right"];
    answer.choices.AbsoluteProgress = "worse";
    state.formAnswers.ThumbSprain = answer;
    const enBuilt = buildVisit(state, "Sprain", "en");
    const svBuilt = buildVisit(state, "Stukning", "sv");
    const enHtml = await canonicalToZipehrHtml5(enBuilt.canonical, { templateRenderLang: "en" });
    const svHtml = await canonicalToZipehrHtml5(svBuilt.canonical, { templateRenderLang: "sv" });
    expect(svHtml).not.toEqual(enHtml);
    const enText = await quietText(enHtml, "en");
    const svText = await quietText(svHtml, "sv");
    expect(enText).toMatch(/Worsening|Progression/i);
    expect(svText).toContain("Försämras");
  });
});