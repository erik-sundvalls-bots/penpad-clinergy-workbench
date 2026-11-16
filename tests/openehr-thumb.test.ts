import { describe, expect, it } from "vitest";
import { serialization, validation } from "../vendor/ehrtslib/ehrtslib-0.12.0.min.js";
import ckmNote from "../docs/ckm-change-requests.md?raw";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { terms } from "../src/openehr/terms.ts";
import { validateFlat } from "../src/openehr/validate.ts";
import { demoState, emptyState } from "../src/model.ts";

const flatValue = (flat: Record<string, string>, suffix: string) =>
  Object.entries(flat).filter(([key]) => key.endsWith(suffix)).map(([, value]) => value);

describe("thumb encounter composition", () => {
  it("puts only the English narrative in the story and records present symptoms", () => {
    const result = buildThumbEncounter(demoState(), "Pain in right thumb\nGradual onset swelling");
    expect(result.canonical._type).toBe("COMPOSITION");
    const category = result.canonical.category as { defining_code: { code_string: string } };
    expect(category.defining_code.code_string).toBe("433");
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/story_text|value"]).toBe(
      "Pain in right thumb\nGradual onset swelling",
    );
    expect(flatValue(result.flat, "/symptom:0/name|code")).toEqual(["ThumbPainSymptom"]);
    expect(flatValue(result.flat, "/symptom:1/name|code")).toEqual(["ThumbSwellingSymptom"]);
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/symptom:0/body_site/laterality|code"]).toBe("at0004");
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/symptom:1/body_site/laterality|code"]).toBe("at0003");
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/symptom:1/severity|code"]).toBe("at0024");
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/symptom:1/duration|value"]).toBe("P2W");
    expect(JSON.stringify(result.canonical)).not.toContain("föreligger");
    expect(JSON.stringify(result.canonical)).not.toContain("Symptom/Sign description");
  });

  it("leaves an untouched pain control out of both the symptom cluster and the screening questionnaire", () => {
    const result = buildThumbEncounter(emptyState(), "Thumb pain");
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom:"))).toBe(false);
    expect(Object.keys(result.flat).some((key) => key.includes("/screening/"))).toBe(false);
  });

  it("records an explicit absent answer only as screening", () => {
    const state = emptyState();
    state.pain.summary = "absence";
    state.pain.choices.AbsoluteSeverity = "severe";
    const result = buildThumbEncounter(state, "Absent thumb pain");
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom:"))).toBe(false);
    expect(result.flat["thumb-pain-encounter.v2/history/screening/any_event/screened:0/name|code"]).toBe("ThumbPainSymptom");
    expect(result.flat["thumb-pain-encounter.v2/history/screening/any_event/screened:0/presence|code"]).toBe("at0024");
    expect(result.flat["thumb-pain-encounter.v2/history/screening/any_event/screened:0/presence|value"]).toBe("No");
  });

  it("records both thumbs as one symptom with laterality right and left", () => {
    const state = emptyState();
    state.pain.summary = "presence";
    state.pain.laterality = ["left", "right"];
    const result = buildThumbEncounter(state, "Pain in left and right thumbs");
    const names = flatValue(result.flat, "/symptom:0/name|code");
    expect(names).toEqual(["ThumbPainSymptom"]);
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom:1/"))).toBe(false);
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/symptom:0/body_site/laterality|code"]).toBe("at0083");
    expect(result.flat["thumb-pain-encounter.v2/history/story/any_event/symptom:0/body_site/laterality|value"]).toBe("Right and left");
  });

  it("maps possible to suspected and excluded to exclusion-specific", () => {
    const state = emptyState();
    state.diagnoses["ThumbSprain"] = "possible";
    state.diagnoses["ThumbFracture"] = "excluded";
    const result = buildThumbEncounter(state, "Thumb pain");
    expect(result.flat["thumb-pain-encounter.v2/assessment/problem:0/name|code"]).toBe("ThumbSprain");
    expect(result.flat["thumb-pain-encounter.v2/assessment/problem:0/certainty|code"]).toBe("at0074");
    expect(result.flat["thumb-pain-encounter.v2/assessment/problem:0/certainty|value"]).toBe("Suspected");
    expect(result.flat["thumb-pain-encounter.v2/assessment/exclusion:0/concept|code"]).toBe("ThumbFracture");
    expect(Object.keys(result.flat).some((key) => key.includes("problem:1"))).toBe(false);
  });

  it("accepts the demo flat payload in ehrtslib", () => {
    const result = buildThumbEncounter(demoState(), "Pain in right thumb");
    const checked = validateFlat(result.flat);
    expect(checked.errors, JSON.stringify(checked.errors, null, 2)).toEqual([]);
    expect(checked.valid).toBe(true);
    const typed = serialization.toTypedRm(result.canonical);
    const rm = new validation.RMSpecificationValidator().validate(typed) as { errors?: unknown[]; warnings?: unknown[] };
    expect(rm.errors ?? [], JSON.stringify(rm.errors ?? [], null, 2)).toEqual([]);
  });
});

describe("reviewed terminology file", () => {
  const required = [
    "ThumbPainSymptom", "ThumbSwellingSymptom", "Thumb", "distalPhalanx", "proximalPhalanx", "ThumbNail",
    "InterphalangealJoint", "MetacarpoPhalangealJoint", "ThenarEminence", "ThumbJoint",
    "leftSelection", "rightSelection", "bilateral",
    "achingPain", "piercingPain", "dullPain", "throbbingPain", "pressingPain", "burningPain",
    "mild", "moderate", "severe", "infrequent", "occasional", "frequent",
    "gradual", "rapid", "sudden", "better", "same", "worse",
    "single", "intermittant", "persistant", "continuous",
    "second", "minute", "hour", "day", "week", "month", "year",
    "soft", "firm", "hard", "fluctuant", "rough", "smooth", "nodular", "irregular",
    "presence", "absence",
    "ThumbSprain", "ThumbJointDislocation", "ThumbFracture", "SubcutaneousInfection", "Whitlow",
    "Paronychia", "Osteoarthritis", "RheumatoidArthritis",
    "TendernessSign", "FlexionSign", "ExtensionSign", "AbductionSign", "AdductionSign",
    "full", "reduced", "limited", "minimal", "painOnMovement",
  ];

  it("has a reviewed row for every thumb-form value", () => {
    const missing = required.filter((key) => !terms[key]);
    expect(missing).toEqual([]);
  });

  it("does not mark an unverified binding as verified", () => {
    for (const row of Object.values(terms)) {
      for (const side of [row.opengalen, row.snomed]) {
        if (side.verified) {
          expect(side.code || side.name, row.clinergy).toBeTruthy();
          expect(side.note || side.source, row.clinergy).toBeTruthy();
          expect(["=", "~", ">", "<"]).toContain(side.match);
        }
      }
    }
  });

  it("keeps the archetype list in the design note", () => {
    expect(ckmNote).toContain("openEHR-EHR-CLUSTER.problem_qualifier.v2");
    expect(ckmNote).toContain("openEHR-EHR-CLUSTER.symptom_sign.v2");
  });
});
