import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gpVisitState, findingsFromState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { painForm } from "../src/knowledge.ts";
import { historyNarrativeText, summaryLines } from "../src/summary.ts";
import { buildFhirBundle } from "../src/fhir/bundle.ts";
import { loadEhrtslib } from "../src/openehr/ehrtslib-loader.ts";
import { validateComposition } from "../src/openehr/validate.ts";

describe("ehrtslib lazy loading", () => {
  it("keeps compose, summary, and FHIR paths free of ehrtslib imports", () => {
    for (const rel of ["src/openehr/compose.ts", "src/summary.ts", "src/fhir/bundle.ts"]) {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      expect(src, rel).not.toMatch(/ehrtslib/);
    }
  });

  it("builds EN/SV notes and FHIR without calling validateComposition", () => {
    const state = gpVisitState();
    const findings = findingsFromState(state, painForm.diagnoses);
    const en = summaryLines(findings, "en");
    const sv = summaryLines(findings, "sv");
    expect(en.join("\n")).toMatch(/Pain in right thumb/i);
    expect(sv.join("\n")).toMatch(/Smärta i höger tumme/i);
    const narrative = historyNarrativeText(findings, "en");
    const built = buildVisit(state, narrative);
    expect(JSON.stringify(built.canonical)).toContain("COMPOSITION");
    const bundle = buildFhirBundle(state, built.canonical);
    expect(JSON.stringify(bundle)).toContain("Bundle");
  });

  it("validates once loadEhrtslib resolves", async () => {
    const state = gpVisitState();
    const built = buildVisit(state, "Pain in right thumb");
    await loadEhrtslib();
    const checked = await validateComposition(built.canonical);
    expect(checked.valid).toBe(true);
    expect(checked.errors).toEqual([]);
  });
});