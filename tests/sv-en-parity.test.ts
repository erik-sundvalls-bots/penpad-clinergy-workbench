import { describe, expect, it } from "vitest";
import { emptyState, findingsFromState } from "../src/model.ts";
import { knowledge, painForm, swellingForm } from "../src/knowledge.ts";
import { render, type Finding } from "../vendor/sentence.ts";
import { renderSwedishGp } from "../src/sv/gp-sentence.ts";

type ToggleCase = {
  label: string;
  apply: (state: ReturnType<typeof emptyState>) => void;
};

function painFinding(findings: Finding[]): Finding {
  const row = findings.find((f) => f.topic === "ThumbPainSymptom");
  if (!row) throw new Error("missing ThumbPainSymptom");
  return row;
}

function swellingFinding(findings: Finding[]): Finding {
  const row = findings.find((f) => f.topic === "ThumbSwellingSymptom");
  if (!row) throw new Error("missing ThumbSwellingSymptom");
  return row;
}

const PAIN_TOGGLES: ToggleCase[] = [
  {
    label: "pain character",
    apply: (s) => { s.pain.choices.AbsolutePainDescriptor = "throbbingPain"; },
  },
  {
    label: "pain severity",
    apply: (s) => { s.pain.choices.AbsoluteSeverity = "severe"; },
  },
  {
    label: "pain frequency",
    apply: (s) => { s.pain.choices.AbsoluteFrequency = "frequent"; },
  },
  {
    label: "pain onset",
    apply: (s) => { s.pain.choices.AbsoluteOnset = "sudden"; },
  },
  {
    label: "pain progress",
    apply: (s) => { s.pain.choices.AbsoluteProgress = "worse"; },
  },
  {
    label: "pain pattern",
    apply: (s) => { s.pain.choices.AbsoluteProcessPattern = "continuous"; },
  },
  {
    label: "pain duration",
    apply: (s) => {
      s.pain.durationNumber = 3;
      s.pain.durationUnit = "day";
    },
  },
];

const SWELLING_TOGGLES: ToggleCase[] = [
  {
    label: "swelling onset",
    apply: (s) => {
      s.swelling.summary = "presence";
      s.swelling.choices.AbsoluteOnset = "rapid";
    },
  },
  {
    label: "swelling severity",
    apply: (s) => {
      s.swelling.summary = "presence";
      s.swelling.choices.AbsoluteSeverity = "severe";
    },
  },
  {
    label: "swelling consistency",
    apply: (s) => {
      s.swelling.summary = "presence";
      s.swelling.choices.AbsoluteConsistency = "firm";
    },
  },
  {
    label: "swelling texture",
    apply: (s) => {
      s.swelling.summary = "presence";
      s.swelling.choices.AbsoluteTexture = "nodular";
    },
  },
];

function assertBothChange(
  baseEn: string,
  baseSv: string,
  nextEn: string,
  nextSv: string,
  label: string,
): void {
  expect(nextEn, `${label} English`).not.toBe(baseEn);
  expect(nextSv, `${label} Swedish`).not.toBe(baseSv);
}

describe("English and Swedish note parity", () => {
  for (const toggle of PAIN_TOGGLES) {
    it(`pain: ${toggle.label} changes both languages`, () => {
      const state = emptyState();
      state.pain.laterality = ["right"];
      const baseFindings = findingsFromState(state, painForm.diagnoses);
      const base = painFinding(baseFindings);
      const baseEn = render(base, knowledge);
      const baseSv = renderSwedishGp(base);
      toggle.apply(state);
      const next = painFinding(findingsFromState(state, painForm.diagnoses));
      assertBothChange(baseEn, baseSv, render(next, knowledge), renderSwedishGp(next), toggle.label);
    });
  }

  for (const toggle of SWELLING_TOGGLES) {
    it(`swelling: ${toggle.label} changes both languages`, () => {
      const state = emptyState();
      state.swelling.summary = "presence";
      state.swelling.laterality = ["left"];
      const base = swellingFinding(findingsFromState(state, painForm.diagnoses));
      const baseEn = render(base, knowledge);
      const baseSv = renderSwedishGp(base);
      toggle.apply(state);
      const next = swellingFinding(findingsFromState(state, painForm.diagnoses));
      assertBothChange(baseEn, baseSv, render(next, knowledge), renderSwedishGp(next), toggle.label);
    });
  }

  it("reports throbbing pain in Swedish when character is selected", () => {
    const state = emptyState();
    state.pain.laterality = ["right"];
    state.pain.choices.AbsolutePainDescriptor = "throbbingPain";
    const finding = painFinding(findingsFromState(state, painForm.diagnoses));
    const sv = renderSwedishGp(finding);
    expect(sv.toLowerCase()).toContain("bultande");
    expect(render(finding, knowledge).toLowerCase()).toContain("throbbing");
  });
});