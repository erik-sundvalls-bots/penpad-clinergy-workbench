import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import expectationsRaw from "../data/expectations.yaml?raw";
import { descriptorMap, knowledge, openGalenBindings, painForm, swedish } from "../src/knowledge.ts";
import { demoState, findingsFromState } from "../src/model.ts";
import { buildOpenEhr } from "../vendor/openehr.ts";
import { findingsFromParsed, render, renderReport, type Finding } from "../vendor/sentence.ts";

const rows = parse(expectationsRaw) as { expected: string; finding: unknown }[];

describe("five known-good English sentences", () => {
  for (const row of rows) {
    it(row.expected, () => {
      const [finding] = findingsFromParsed(row.finding);
      expect(render(finding, knowledge)).toBe(row.expected);
    });
  }
});

describe("Swedish for the same five findings", () => {
  const expected = [
    "Svullnad av vänster tumme föreligger",
    "Svullnad av ytterfalang av vänster tumme i 2 veckor, föreligger",
    "Gradvis debut, måttligt svår svullnad av ytterfalang av vänster tumme i 2 veckor, föreligger",
    "Smärta i höger tumme",
    "Måttligt svår smärta i höger tumme",
  ];
  it("matches the five Swedish lines", () => {
    swedish.missing.length = 0;
    const sentences = rows.map((row) => {
      const [finding] = findingsFromParsed(row.finding);
      return renderReport(finding, knowledge, swedish).sentence;
    });
    expect(swedish.missing).toEqual([]);
    expect(sentences).toEqual(expected);
  });
});

describe("the form's demo state", () => {
  it("reproduces the walkthrough's two summary lines", () => {
    const findings = findingsFromState(demoState(), painForm.diagnoses);
    expect(findings.map((finding) => render(finding, knowledge))).toEqual([
      "Pain in right thumb",
      "Gradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present",
    ]);
  });
});

describe("generator fixes against the real rules", () => {
  it("renders absence as an adjective", () => {
    const finding: Finding = {
      topic: "ThumbSwellingSymptom",
      location: "Thumb",
      summary: "absence",
      qualifiers: [],
    };
    expect(render(finding, knowledge)).toBe("Absent thumb swelling");
  });
});

describe("openEHR for the demo findings", () => {
  it("writes canonical JSON, FLAT, and the real descriptor names", () => {
    const findings = findingsFromState(demoState(), painForm.diagnoses);
    const result = buildOpenEhr(findings, knowledge, descriptorMap, openGalenBindings);
    expect(result.canonical._type).toBe("COMPOSITION");
    const category = result.canonical.category as { value: string; defining_code: { code_string: string } };
    expect(category.value).toBe("event");
    expect(category.defining_code.code_string).toBe("433");
    const flat = result.flat;
    const story = Object.entries(flat).filter(([key]) => key.includes("items[at0004:"));
    expect(story.map(([, value]) => value)).toEqual([
      "Pain in right thumb",
      "Gradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present",
    ]);
    expect(flat["thumb-pain-encounter.v1/content[openEHR-EHR-OBSERVATION.story.v1:0]/data[at0001]/events[at0002:0]/data[at0003]/items[openEHR-EHR-CLUSTER.symptom_sign.v2:1]/items[at0021]/value|code"]).toBe("at0024");
    expect(flat["thumb-pain-encounter.v1/content[openEHR-EHR-OBSERVATION.story.v1:0]/data[at0001]/events[at0002:0]/data[at0003]/items[openEHR-EHR-CLUSTER.symptom_sign.v2:1]/items[at0028]/value"]).toBe("P2W");
    expect(result.bindings.map((binding) => binding.opengalen).sort()).toEqual([
      "DistalPhalanx",
      "Thumb",
      "gradual",
      "leftSelection",
      "rightSelection",
    ]);
    expect(result.unmapped.map((item) => item.key)).toContain("ThumbPainSymptom");
    expect(result.unmapped.map((item) => item.key)).toContain("moderate");
  });

  it("reports frequency as unmapped", () => {
    const [finding] = findingsFromParsed({
      topic: "ThumbPainSymptom",
      location: "Thumb",
      qualifiers: [{ descriptor: "AbsoluteFrequency", value: "occasional" }],
    });
    const result = buildOpenEhr([finding], knowledge, descriptorMap, openGalenBindings);
    expect(result.unmapped.some((item) => item.key === "AbsoluteFrequency")).toBe(true);
    expect(Object.keys(result.flat).some((key) => key.includes("at0189") && key.endsWith("|value") || key.endsWith("/value") && result.flat[key] === "occasional")).toBe(false);
  });
});
