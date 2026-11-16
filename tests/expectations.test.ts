import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import expectationsRaw from "../data/expectations.yaml?raw";
import { knowledge, painForm, swedish } from "../src/knowledge.ts";
import { demoState, findingsFromState } from "../src/model.ts";
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

