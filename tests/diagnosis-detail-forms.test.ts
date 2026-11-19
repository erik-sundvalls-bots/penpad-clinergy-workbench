import { describe, expect, it } from "vitest";
import { emptyFinding, emptyState, findingsFromState, gpVisitState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { buildFhirBundle } from "../src/fhir/bundle.ts";
import { summaryLines, historyNarrativeText } from "../src/summary.ts";
import { syncDiseaseFormAnswers, showsDiseaseDetail, visibleDiseaseDetailTopics } from "../src/visit-forms.ts";
import { renderEnglishGp } from "../src/en/gp-sentence.ts";
import { renderSwedishGp } from "../src/sv/gp-sentence.ts";

const DISEASES = ["ThumbSprain", "ThumbFracture"] as const;

function fillDiseaseDetail(topic: string) {
  const form = emptyFinding();
  form.laterality = ["right"];
  form.choices.AbsoluteSeverity = "moderate";
  if (topic === "ThumbFracture") {
    form.choices.AbsoluteHealingCharacter = "partiallyHealed";
  } else {
    form.choices.AbsoluteProgress = "worse";
  }
  return form;
}

describe("diagnosis drives disease detail forms", () => {
  for (const topic of DISEASES) {
    for (const mode of ["presence", "possible"] as const) {
      it(`${topic} ${mode} keeps detail in EN/SV and exports`, () => {
        const state = emptyState();
        state.diagnoses[topic] = mode;
        state.formAnswers[topic] = fillDiseaseDetail(topic);
        expect(visibleDiseaseDetailTopics(state)).toContain(topic);
        const findings = findingsFromState(state, painForm.diagnoses);
        const en = summaryLines(findings, "en").join("\n");
        const sv = summaryLines(findings, "sv").join("\n");
        expect(en.length).toBeGreaterThan(0);
        expect(sv.length).toBeGreaterThan(0);
        const built = buildVisit(state, historyNarrativeText(findings, "en"));
        const coded = JSON.stringify(built.canonical);
        expect(coded).toContain(topic);
        expect(coded).toMatch(/at0105|at0085/);
        const bundle = buildFhirBundle(state, built.canonical);
        expect(JSON.stringify(bundle)).toMatch(/Condition|Sprain of thumb|Fracture of thumb/i);
      });
    }

    it(`${topic} excluded drops stale detail from openEHR`, () => {
      const state = emptyState();
      state.diagnoses[topic] = "excluded";
      state.formAnswers[topic] = fillDiseaseDetail(topic);
      syncDiseaseFormAnswers(state, topic);
      expect(state.formAnswers[topic]).toBeUndefined();
      const built = buildVisit(state, "visit");
      expect(JSON.stringify(built.canonical)).not.toMatch(/at0085|at0105/);
      const finding = findingsFromState(state, painForm.diagnoses).find((f) => f.topic === topic);
      expect(finding?.laterality).toBeUndefined();
      if (topic === "ThumbFracture") {
        expect(renderEnglishGp(finding!)).toMatch(/excluded/i);
        expect(renderSwedishGp(finding!)).toMatch(/utesl/i);
      }
    });

    it(`${topic} cleared removes diagnosis and detail`, () => {
      const state = emptyState();
      state.diagnoses[topic] = null;
      state.formAnswers[topic] = fillDiseaseDetail(topic);
      syncDiseaseFormAnswers(state, topic);
      expect(visibleDiseaseDetailTopics(state)).not.toContain(topic);
      expect(findingsFromState(state, painForm.diagnoses).some((f) => f.topic === topic)).toBe(false);
      const built = buildVisit(state, "visit");
      expect(JSON.stringify(built.canonical)).not.toMatch(/at0085|at0105/);
    });
  }

  it("GP preset still matches sprain detail without topic bar", () => {
    const state = gpVisitState();
    expect(state.diagnoses.ThumbSprain).toBe("presence");
    expect(showsDiseaseDetail(state.diagnoses.ThumbSprain)).toBe(true);
    expect(visibleDiseaseDetailTopics(state)).toContain("ThumbSprain");
    const built = buildVisit(state, historyNarrativeText(findingsFromState(state, painForm.diagnoses), "en"));
    expect(JSON.stringify(built.canonical)).toContain("ThumbSprain");
  });
});