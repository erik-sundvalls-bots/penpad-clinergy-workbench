import { describe, expect, it } from "vitest";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { demoState, emptyExam, emptyState, type WorkbenchState } from "../src/model.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import case01 from "./fixtures/ferro/01-demo-1998.json";
import case02 from "./fixtures/ferro/02-pain-rich.json";
import case03 from "./fixtures/ferro/03-bilateral-pain.json";
import case04 from "./fixtures/ferro/04-absent-swelling-chosen.json";
import case05 from "./fixtures/ferro/05-possible-excluded-present.json";
import case06 from "./fixtures/ferro/06-exam-per-side.json";
import case07 from "./fixtures/ferro/07-exam-normal-absent-tenderness.json";
import flat01 from "./fixtures/ferro-flat/ferro-flat-01.json";
import flat02 from "./fixtures/ferro-flat/ferro-flat-02.json";
import flat03 from "./fixtures/ferro-flat/ferro-flat-03.json";
import flat04 from "./fixtures/ferro-flat/ferro-flat-04.json";
import flat05 from "./fixtures/ferro-flat/ferro-flat-05.json";
import flat06 from "./fixtures/ferro-flat/ferro-flat-06.json";
import flat07 from "./fixtures/ferro-flat/ferro-flat-07.json";

/**
 * The seven FerroEHR cases from the 2026-11-16 cross-check. cases.zip was not
 * in the upload, so the states are rebuilt from the report's case names. The
 * committed JSON is the canonical composition after empty sections are omitted
 * and inexact matches are '?'.
 */
const cases: { id: string; narrative: string; state: WorkbenchState; expected: unknown; flat: Record<string, unknown> }[] = [
  { id: "01-demo-1998", narrative: "Pain in right thumb\nGradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present", state: demoState(), expected: case01, flat: flat01 },
  { id: "02-pain-rich", narrative: "Aching, infrequent, gradual onset, moderately severe pain in right thumb for 3 days, worse, single", state: painRich(), expected: case02, flat: flat02 },
  { id: "03-bilateral-pain", narrative: "Pain in left and right thumbs", state: bilateral(), expected: case03, flat: flat03 },
  { id: "04-absent-swelling-chosen", narrative: "Absent thumb swelling", state: absentSwelling(), expected: case04, flat: flat04 },
  { id: "05-possible-excluded-present", narrative: "Possible thumb sprain\nThumb fracture excluded\nParonychia of thumb present", state: diagnoses(), expected: case05, flat: flat05 },
  { id: "06-exam-per-side", narrative: "Thumb pain", state: examPerSide(), expected: case06, flat: flat06 },
  { id: "07-exam-normal-absent-tenderness", narrative: "Thumb pain", state: examNormal(), expected: case07, flat: flat07 },
];

function compositionFlatKeys(flat: Record<string, unknown>): string[] {
  return Object.keys(flat).filter((key) => !key.startsWith("ctx/") && key !== "encounter/_uid").sort();
}

function painRich(): WorkbenchState {
  const state = emptyState();
  state.pain.summary = "presence";
  state.pain.laterality = ["right"];
  state.pain.durationNumber = 3;
  state.pain.durationUnit = "day";
  state.pain.choices = {
    AbsolutePainDescriptor: "achingPain",
    AbsoluteFrequency: "infrequent",
    AbsoluteOnset: "gradual",
    AbsoluteSeverity: "moderate",
    AbsoluteProgress: "worse",
    AbsoluteProcessPattern: "single",
  };
  return state;
}

function bilateral(): WorkbenchState {
  const state = emptyState();
  state.pain.summary = "presence";
  state.pain.laterality = ["left", "right"];
  return state;
}

function absentSwelling(): WorkbenchState {
  const state = emptyState();
  state.swelling.summary = "absence";
  return state;
}

function diagnoses(): WorkbenchState {
  const state = emptyState();
  state.diagnoses.ThumbSprain = "possible";
  state.diagnoses.ThumbFracture = "excluded";
  state.diagnoses["Paronychia on Thumb"] = "present";
  return state;
}

function examPerSide(): WorkbenchState {
  const state = emptyState();
  state.exam.right.tenderness = "presence";
  state.exam.right.flexionRange = "full";
  state.exam.left.status = "notExamined";
  return state;
}

function examNormal(): WorkbenchState {
  const state = emptyState();
  state.exam.right = emptyExam();
  state.exam.right.status = "normal";
  state.exam.right.tenderness = "absence";
  return state;
}

describe("FerroEHR regression cases", () => {
  for (const item of cases) {
    it(`${item.id} matches the accepted canonical composition and validates`, () => {
      const result = buildThumbEncounter(item.state, item.narrative);
      expect(result.canonical).toEqual(item.expected);
      expect(JSON.stringify(result.canonical)).not.toContain('"match":"~"');
      const names = (result.canonical.content as { name: { value: string }; items: unknown[] }[]);
      expect(names.every((section) => section.items.length > 0)).toBe(true);
      expect(compositionFlatKeys(result.flat)).toEqual(compositionFlatKeys(item.flat));
      const checked = validateComposition(result.canonical, result.flat);
      expect(checked.errors, JSON.stringify(checked.errors, null, 2)).toEqual([]);
    });
  }
});
