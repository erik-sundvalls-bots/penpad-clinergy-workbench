import { describe, expect, it } from "vitest";
import ckmNote from "../docs/ckm-change-requests.md?raw";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { terms } from "../src/openehr/terms.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { demoState, emptyState } from "../src/model.ts";

const flatValue = (flat: Record<string, string | boolean>, suffix: string) =>
  Object.entries(flat).filter(([key]) => key.endsWith(suffix)).map(([, value]) => value);

function firstMapping(value: unknown): { match: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstMapping(item);
      if (found) return found;
    }
    return undefined;
  }
  const record = value as Record<string, unknown>;
  if (record._type === "TERM_MAPPING") return record as { match: string };
  for (const child of Object.values(record)) {
    const found = firstMapping(child);
    if (found) return found;
  }
  return undefined;
}

describe("thumb encounter composition", () => {
  it("puts only the English narrative in the story and records present symptoms", () => {
    const result = buildThumbEncounter(demoState(), "Pain in right thumb\nGradual onset swelling");
    expect(result.canonical._type).toBe("COMPOSITION");
    const category = result.canonical.category as { defining_code: { code_string: string } };
    expect(category.defining_code.code_string).toBe("433");
    expect(result.flat["encounter/history/story_history/any_event:0/story:0"]).toBe(
      "Pain in right thumb\nGradual onset swelling",
    );
    expect(flatValue(result.flat, "/symptom_sign:0/symptom_sign_name|code")).toEqual(["ThumbPainSymptom"]);
    expect(flatValue(result.flat, "/symptom_sign:1/symptom_sign_name|code")).toEqual(["ThumbSwellingSymptom"]);
    expect(result.flat["encounter/history/story_history/any_event:0/symptom_sign:0/anatomical_location/laterality|code"]).toBe("at0004");
    expect(result.flat["encounter/history/story_history/any_event:0/symptom_sign:1/anatomical_location/laterality|code"]).toBe("at0003");
    expect(result.flat["encounter/history/story_history/any_event:0/symptom_sign:1/severity_category|code"]).toBe("at0024");
    expect(result.flat["encounter/history/story_history/any_event:0/symptom_sign:1/episode_duration/duration_value"]).toBe("P2W");
    const content = result.canonical.content as { name: { value: string } }[];
    expect(content.map((item) => item.name.value)).toEqual(["History"]);
    expect(JSON.stringify(result.canonical)).not.toContain("föreligger");
    expect(JSON.stringify(result.canonical)).not.toContain("Symptom/Sign description");
  });

  it("leaves an untouched pain control out of both the symptom cluster and the screening questionnaire", () => {
    const result = buildThumbEncounter(emptyState(), "Thumb pain");
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom_sign:"))).toBe(false);
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom_sign_screening_questionnaire/"))).toBe(false);
    const content = result.canonical.content as unknown[];
    expect(content).toHaveLength(1);
  });

  it("records an explicit absent answer only as screening", () => {
    const state = emptyState();
    state.pain.summary = "absence";
    state.pain.choices.AbsoluteSeverity = "severe";
    const result = buildThumbEncounter(state, "Absent thumb pain");
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom_sign:"))).toBe(false);
    expect(result.flat["encounter/history/symptom_sign_screening_questionnaire/any_event:0/specific_symptom_sign:0/symptom_sign_name|code"]).toBe("ThumbPainSymptom");
    expect(result.flat["encounter/history/symptom_sign_screening_questionnaire/any_event:0/specific_symptom_sign:0/presence/coded_text_value|code"]).toBe("at0024");
    expect(result.flat["encounter/history/symptom_sign_screening_questionnaire/any_event:0/specific_symptom_sign:0/presence/coded_text_value|value"]).toBe("No");
  });

  it("records both thumbs as one symptom with laterality right and left", () => {
    const state = emptyState();
    state.pain.summary = "presence";
    state.pain.laterality = ["left", "right"];
    const result = buildThumbEncounter(state, "Pain in left and right thumbs");
    const names = flatValue(result.flat, "/symptom_sign:0/symptom_sign_name|code");
    expect(names).toEqual(["ThumbPainSymptom"]);
    expect(Object.keys(result.flat).some((key) => key.includes("/symptom_sign:1/"))).toBe(false);
    expect(result.flat["encounter/history/story_history/any_event:0/symptom_sign:0/anatomical_location/laterality|code"]).toBe("at0083");
    expect(result.flat["encounter/history/story_history/any_event:0/symptom_sign:0/anatomical_location/laterality|value"]).toBe("Right and left");
  });

  it("maps possible to suspected and excluded to exclusion-specific", () => {
    const state = emptyState();
    state.diagnoses["ThumbSprain"] = "possible";
    state.diagnoses["ThumbFracture"] = "excluded";
    const result = buildThumbEncounter(state, "Thumb pain");
    expect(result.flat["encounter/assessment/problem_diagnosis:0/problem_diagnosis_name|code"]).toBe("ThumbSprain");
    expect(result.flat["encounter/assessment/problem_diagnosis:0/diagnostic_certainty|code"]).toBe("at0074");
    expect(result.flat["encounter/assessment/problem_diagnosis:0/diagnostic_certainty|value"]).toBe("Suspected");
    expect(result.flat["encounter/assessment/exclusion_-_specific:0/adverse_reaction_substance|code"]).toBe("ThumbFracture");
    expect(result.flat["encounter/assessment/exclusion_-_specific:0/adverse_reaction_substance|terminology"]).toBe("Clinergy");
    expect(result.flat["encounter/assessment/exclusion_-_specific:0/adverse_reaction_substance|value"]).toBe("Fracture of thumb");
    expect(result.flat["encounter/assessment/exclusion_-_specific:0/adverse_reaction_substance/_mapping:0|match"]).toBe(">");
    expect(result.flat["encounter/assessment/exclusion_-_specific:0/adverse_reaction_substance/_mapping:0/target|code"]).toBe("704213001");
    const coded = JSON.stringify(result.canonical);
    expect(coded).toContain('"terminology_id":{"_type":"TERMINOLOGY_ID","value":"SNOMED-CT"}');
    expect(coded).toContain('"code_string":"704213001"');
    expect(Object.keys(result.flat).some((key) => key.includes("problem_diagnosis:1"))).toBe(false);
  });

  it("accepts the demo composition against the coded OPT", () => {
    const result = buildThumbEncounter(demoState(), "Pain in right thumb");
    const checked = validateComposition(result.canonical, result.flat);
    expect(checked.errors, JSON.stringify(checked.errors, null, 2)).toEqual([]);
    expect(checked.valid).toBe(true);
  });

  it("flags an injected empty section", () => {
    const result = buildThumbEncounter(emptyState(), "Thumb pain");
    const cloned = JSON.parse(JSON.stringify(result.canonical)) as { content: unknown[] };
    cloned.content.push({
      _type: "SECTION",
      name: { _type: "DV_TEXT", value: "Examination" },
      archetype_node_id: "openEHR-EHR-SECTION.adhoc.v1",
      items: [],
    });
    const checked = validateComposition(cloned, result.flat);
    expect(checked.valid).toBe(false);
    expect(checked.errors.some((issue) => issue.message.includes("Items_valid"))).toBe(true);
  });

  it("flags an injected inexact match that is not an openEHR match code", () => {
    const result = buildThumbEncounter(demoState(), "Pain in right thumb");
    const cloned = JSON.parse(JSON.stringify(result.canonical)) as Record<string, unknown>;
    const mapping = firstMapping(cloned);
    expect(mapping).toBeTruthy();
    mapping!.match = "~";
    const checked = validateComposition(cloned, result.flat);
    expect(checked.valid).toBe(false);
    expect(checked.errors.some((issue) => issue.message.includes("Match_valid"))).toBe(true);
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
          expect(["=", "?", ">", "<"]).toContain(side.match);
        }
      }
    }
  });

  it("stores inexact bindings as the openEHR match code", () => {
    const inexact = Object.values(terms).flatMap((row) => [row.opengalen, row.snomed]).filter((side) => side.match);
    expect(inexact.some((side) => side.match === "~")).toBe(false);
    expect(inexact.some((side) => side.match === "?")).toBe(true);
  });

  it("keeps the archetype list in the design note", () => {
    expect(ckmNote).toContain("openEHR-EHR-CLUSTER.problem_qualifier.v2");
    expect(ckmNote).toContain("openEHR-EHR-CLUSTER.symptom_sign.v2");
  });
});
