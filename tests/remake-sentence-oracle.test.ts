/**
 * Sanitized expected-output fixture: sentence strings plus structured findings
 * (concept ids and qualifier values already in the public catalogue). No
 * original binaries, images, or engine source.
 *
 * The expected strings were produced by the original 1998 engine's
 * NatLanguageForConcept on a private box-only probe, then checked against
 * this remake generator (636/636).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { renderSentence } from "../remake/src/sentence/render.ts";
import { getSentenceKnowledge } from "../remake/src/knowledge-data.ts";
import type { Finding } from "../remake/src/sentence/types.ts";

interface OracleCase {
  id: string;
  finding: Finding;
  expected: string;
}

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/remake-sentence-match/oracle-engine.json");
const cases = JSON.parse(readFileSync(fixturePath, "utf8")) as OracleCase[];

describe("sentence oracle fixture (original-engine strings)", () => {
  const knowledge = getSentenceKnowledge();

  it("has a broad set of cases", () => {
    expect(cases.length).toBeGreaterThan(500);
  });

  it("matches every expected sentence", () => {
    const mismatches: string[] = [];
    for (const row of cases) {
      const actual = renderSentence(row.finding, knowledge);
      if (actual !== row.expected) mismatches.push(`${row.id}: expected ${JSON.stringify(row.expected)} actual ${JSON.stringify(actual)}`);
    }
    if (mismatches.length) {
      // eslint-disable-next-line no-console
      console.log(mismatches.slice(0, 20).join("\n"));
    }
    expect(mismatches, `${mismatches.length} mismatches`).toEqual([]);
  });
});
