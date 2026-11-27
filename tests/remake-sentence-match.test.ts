/**
 * Sentence match set, grounded in published walkthrough lines.
 *
 * The extract does not store a large corpus of saved clinical sentences, so
 * the evidence is: the five findings in data/expectations.yaml, plus the
 * extractor thumb-pain findings fixture (ten walkthrough lines). That fixture
 * uses short descriptor names (Duration, Onset, Severity) that match its
 * synthetic rule tables. The extracted rule tables use QuantityDuration,
 * AbsoluteOnset, and AbsoluteSeverity; the match set rewrites those three
 * names (and TemporalValue for a numeric duration) so the cases exercise the
 * real extract, not the synthetic aliases. No other aliases are invented.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import expectationsRaw from "../data/expectations.yaml?raw";
import { findingsFromParsed, renderSentence } from "../remake/src/sentence/render.ts";
import { getSentenceKnowledge } from "../remake/src/knowledge-data.ts";
import type { Finding, Qualifier } from "../remake/src/sentence/types.ts";

const DESCRIPTOR_FROM_FIXTURE: Record<string, string> = {
  Duration: "QuantityDuration",
  Onset: "AbsoluteOnset",
  Severity: "AbsoluteSeverity",
};

const expectedById: Record<string, string> = {
  "pain-bare": "Thumb pain",
  "pain-right": "Pain in right thumb",
  "pain-left": "Pain in left thumb",
  "swelling-present": "Thumb swelling present",
  "swelling-left": "Swelling of left thumb present",
  "swelling-distal": "Swelling of distal phalanx of left thumb present",
  "swelling-2-days": "Swelling of distal phalanx of left thumb for 2 days, present",
  "swelling-2-weeks": "Swelling of distal phalanx of left thumb for 2 weeks, present",
  "swelling-onset": "Gradual onset swelling of distal phalanx of left thumb for 2 weeks, present",
  "swelling-full": "Gradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present",
};

const findingsPath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/remake-sentence-match/findings.yaml");

interface CaseResult {
  id: string;
  expected: string;
  actual: string;
  ok: boolean;
}

const results: CaseResult[] = [];

function rewriteQualifier(q: Qualifier): Qualifier {
  const descriptor = DESCRIPTOR_FROM_FIXTURE[q.descriptor] ?? q.descriptor;
  const value =
    descriptor === "QuantityDuration" && q.number
      ? "TemporalValue"
      : q.value;
  return { ...q, descriptor, value };
}

function rewriteFinding(finding: Finding): Finding {
  return {
    ...finding,
    subLocation: finding.subLocation === "DistalPhalanx" ? "distalPhalanx" : finding.subLocation,
    qualifiers: (finding.qualifiers ?? []).map(rewriteQualifier),
  };
}

describe("sentence match set (walkthrough + extractor fixture)", () => {
  const knowledge = getSentenceKnowledge();

  const findings = findingsFromParsed(parse(readFileSync(findingsPath, "utf8")));
  const raw = parse(readFileSync(findingsPath, "utf8")) as { id?: string }[];
  const rows = raw.map((row, i) => ({ id: row.id ?? `row-${i}`, finding: rewriteFinding(findings[i]!) }));

  for (const [id, expected] of Object.entries(expectedById)) {
    it(id, () => {
      const row = rows.find((r) => r.id === id);
      expect(row, `missing finding ${id}`).toBeTruthy();
      const actual = renderSentence(row!.finding, knowledge);
      results.push({ id, expected, actual, ok: actual === expected });
      expect(actual).toBe(expected);
    });
  }

  const published = parse(expectationsRaw) as { expected: string; finding: unknown }[];
  for (const row of published) {
    it(`published: ${row.expected}`, () => {
      const [finding] = findingsFromParsed(row.finding);
      const actual = renderSentence(finding, knowledge);
      const id = `published:${row.expected}`;
      results.push({ id, expected: row.expected, actual, ok: actual === row.expected });
      expect(actual).toBe(row.expected);
    });
  }

  it("reports the match tally", () => {
    const ok = results.filter((r) => r.ok).length;
    const total = results.length;
    const unique = new Map<string, boolean>();
    for (const row of results) unique.set(row.expected, (unique.get(row.expected) ?? true) && row.ok);
    const uniqueOk = [...unique.values()].filter(Boolean).length;
    // eslint-disable-next-line no-console
    console.log(`sentence match: ${ok}/${total} cases, ${uniqueOk}/${unique.size} unique strings`);
    expect(total).toBeGreaterThan(0);
    expect(ok).toBe(total);
  });
});
