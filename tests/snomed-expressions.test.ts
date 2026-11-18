import { describe, expect, it } from "vitest";
import { painForm, snomedMap } from "../src/knowledge.ts";
import { demoState, findingsFromState } from "../src/model.ts";
import { expressionFor, expressionsFor, findingForExpression } from "../src/snomed/expressions.ts";
import type { Finding } from "../vendor/sentence.ts";
import {
  boundConcept,
  buildExpression,
  isValidSyntax,
  parseExpression,
  snomedMapFromParsed,
  type SnomedMap,
} from "../vendor/snomed.ts";

// Expected strings are the extractor's thumb-pain fixture results
// (clinergy-extractor tests/snomed_test.ts, mappings/snomed.yaml).
const PAIN_RIGHT =
  "300955002 |Pain in thumb| :\n  { 363698007 |Finding site| = (76505004 |Thumb structure| : 272741003 |Laterality| = 24028007 |Right|) }";
const PAIN_LEFT =
  "300955002 |Pain in thumb| :\n  { 363698007 |Finding site| = (76505004 |Thumb structure| : 272741003 |Laterality| = 7771000 |Left|) }";
const SWELLING_THUMB = "65124004 |Swelling| :\n  { 363698007 |Finding site| = 76505004 |Thumb structure| }";
const SWELLING_LEFT =
  "65124004 |Swelling| :\n  { 363698007 |Finding site| = (76505004 |Thumb structure| : 272741003 |Laterality| = 7771000 |Left|) }";
const SWELLING_DISTAL =
  "65124004 |Swelling| :\n  { 363698007 |Finding site| = (182007006 |Entire distal phalanx of thumb| : 272741003 |Laterality| = 7771000 |Left|) }";
const SWELLING_ONSET =
  "65124004 |Swelling| :\n  { 363698007 |Finding site| = (182007006 |Entire distal phalanx of thumb| : 272741003 |Laterality| = 7771000 |Left|) },\n  { 263502005 |Clinical course| = 61751001 |Gradual onset| }";
const SWELLING_FULL =
  "65124004 |Swelling| :\n  { 363698007 |Finding site| = (182007006 |Entire distal phalanx of thumb| : 272741003 |Laterality| = 7771000 |Left|) },\n  { 263502005 |Clinical course| = 61751001 |Gradual onset| },\n  { 246112005 |Severity| = 6736007 |Moderate severity| }";

const fixture: Record<string, Finding> = {
  "pain-bare": { topic: "ThumbPainSymptom", location: "Thumb", qualifiers: [] },
  "pain-right": { topic: "ThumbPainSymptom", location: "Thumb", laterality: "right", qualifiers: [] },
  "pain-left": { topic: "ThumbPainSymptom", location: "Thumb", laterality: "left", qualifiers: [] },
  "swelling-present": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    summary: "presence",
    qualifiers: [],
  },
  "swelling-left": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    laterality: "left",
    summary: "presence",
    qualifiers: [],
  },
  "swelling-distal": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    laterality: "left",
    subLocation: "DistalPhalanx",
    summary: "presence",
    qualifiers: [],
  },
  "swelling-2-days": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    laterality: "left",
    subLocation: "DistalPhalanx",
    summary: "presence",
    qualifiers: [{ descriptor: "Duration", value: "day", number: 2, unit: "day" }],
  },
  "swelling-2-weeks": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    laterality: "left",
    subLocation: "DistalPhalanx",
    summary: "presence",
    qualifiers: [{ descriptor: "Duration", value: "week", number: 2, unit: "week" }],
  },
  "swelling-onset": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    laterality: "left",
    subLocation: "DistalPhalanx",
    summary: "presence",
    qualifiers: [
      { descriptor: "Onset", value: "gradual" },
      { descriptor: "Duration", value: "week", number: 2, unit: "week" },
    ],
  },
  "swelling-full": {
    topic: "ThumbSwellingSymptom",
    location: "Thumb",
    laterality: "left",
    subLocation: "DistalPhalanx",
    summary: "presence",
    qualifiers: [
      { descriptor: "Onset", value: "gradual" },
      { descriptor: "Severity", value: "moderate" },
      { descriptor: "Duration", value: "week", number: 2, unit: "week" },
    ],
  },
};

const expected: Record<string, string> = {
  "pain-bare": "300955002 |Pain in thumb|",
  "pain-right": PAIN_RIGHT,
  "pain-left": PAIN_LEFT,
  "swelling-present": SWELLING_THUMB,
  "swelling-left": SWELLING_LEFT,
  "swelling-distal": SWELLING_DISTAL,
  "swelling-2-days": SWELLING_DISTAL,
  "swelling-2-weeks": SWELLING_DISTAL,
  "swelling-onset": SWELLING_ONSET,
  "swelling-full": SWELLING_FULL,
};

describe("thumb-pain demo findings become compositional-grammar expressions", () => {
  for (const [id, finding] of Object.entries(fixture)) {
    it(id, () => {
      const result = expressionFor(finding);
      expect(result.expression).toBe(expected[id]);
      expect(result.expression).toBeTruthy();
      expect(isValidSyntax(result.expression!)).toBe(true);
    });
  }

  it("pain-bare has no unmapped parts", () => {
    expect(expressionFor(fixture["pain-bare"]).unmapped).toEqual([]);
  });

  it("swelling-present has no unmapped parts", () => {
    expect(expressionFor(fixture["swelling-present"]).unmapped).toEqual([]);
  });
});

describe("numeric duration is listed as unmapped, not written into the expression", () => {
  for (const id of ["swelling-2-days", "swelling-2-weeks", "swelling-onset", "swelling-full"]) {
    it(id, () => {
      const unmapped = expressionFor(fixture[id]).unmapped;
      expect(unmapped).toHaveLength(1);
      expect(unmapped[0].key).toBe("Duration");
      expect(unmapped[0].reason).toContain("no duration attribute");
    });
  }

  it("includes the numeric value in the reason", () => {
    expect(expressionFor(fixture["swelling-2-days"]).unmapped[0].reason).toContain("2 day");
    expect(expressionFor(fixture["swelling-2-weeks"]).unmapped[0].reason).toContain("2 week");
  });
});

describe("the form's demo state", () => {
  it("matches the extractor pain-right and swelling-full expressions", () => {
    const findings = findingsFromState(demoState(), painForm.diagnoses);
    const results = expressionsFor(findings);
    expect(results).toHaveLength(2);
    expect(results[0].expression).toBe(PAIN_RIGHT);
    expect(results[0].unmapped).toEqual([]);
    expect(results[1].expression).toBe(SWELLING_FULL);
    expect(results[1].unmapped).toHaveLength(1);
    expect(results[1].unmapped[0].key).toBe("Duration");
    expect(results[1].unmapped[0].reason).toContain("no duration attribute");
    expect(results[1].unmapped[0].reason).toContain("2 week");
  });

  it("maps Clinergy form descriptor keys onto the reviewed map names", () => {
    const swelling = findingsFromState(demoState(), painForm.diagnoses)[1];
    const aliased = findingForExpression(swelling);
    expect(aliased.qualifiers.map((item) => item.descriptor).sort()).toEqual([
      "Duration",
      "Onset",
      "Severity",
    ]);
  });
});

describe("safety of the reviewed map", () => {
  it("does not use DistalPhalanx unless the location is Thumb", () => {
    const result = expressionFor({
      topic: "ThumbSwellingSymptom",
      subLocation: "DistalPhalanx",
      qualifiers: [],
    });
    expect(result.expression).toBe("65124004 |Swelling|");
    expect(result.unmapped).toHaveLength(1);
    expect(result.unmapped[0].key).toBe("DistalPhalanx");
    expect(result.unmapped[0].reason).toContain("only used when location is Thumb");
  });

  it("does not write unverified map rows or unknown topics silently", () => {
    const unknown = expressionFor({ topic: "NotAConcept", qualifiers: [] });
    expect(unknown.expression).toBeNull();
    expect(unknown.unmapped[0].key).toBe("NotAConcept");
    const unverified = expressionFor({ topic: "ThumbSwellingSymptom", qualifiers: [] });
    expect(unverified.expression).toBe("65124004 |Swelling|");
    expect(unverified.unmapped).toEqual([]);
    expect(boundConcept(snomedMap, "ThumbSwellingSymptom")).toBeNull();
  });

  it("resolves left and right laterality aliases from the Clinergy form", () => {
    expect(boundConcept(snomedMap, "leftSelection")?.code).toBe("7771000");
    expect(boundConcept(snomedMap, "rightSelection")?.code).toBe("24028007");
    expect(boundConcept(snomedMap, "distalPhalanx")?.code).toBe("182007006");
  });

  it("ignores an unverified code in a hand-built map", () => {
    const map: SnomedMap = snomedMapFromParsed({
      attributes: {
        findingSite: { code: "363698007", term: "Finding site", verified: true, grouped: true },
      },
      concepts: {
        FakePain: { code: "999999999", term: "Not a real concept", verified: false },
      },
      descriptors: {},
    });
    const result = buildExpression({ topic: "FakePain", qualifiers: [] }, map);
    expect(result.expression).toBeNull();
    expect(result.unmapped[0].key).toBe("FakePain");
  });
});

describe("the compositional-grammar parser", () => {
  it("accepts demo expressions and rejects broken ones", () => {
    expect(isValidSyntax("300955002 |Pain in thumb|")).toBe(true);
    expect(isValidSyntax(PAIN_RIGHT)).toBe(true);
    expect(isValidSyntax(SWELLING_FULL)).toBe(true);
    expect(isValidSyntax("")).toBe(false);
    expect(isValidSyntax("300955002 |Pain in thumb")).toBe(false);
    expect(isValidSyntax("300955002 |Pain in thumb| : { 363698007 |Finding site| }")).toBe(false);
    const parsed = parseExpression(PAIN_RIGHT);
    expect(parsed.conceptIds).toEqual(["300955002", "363698007", "76505004", "272741003", "24028007"]);
  });
});
