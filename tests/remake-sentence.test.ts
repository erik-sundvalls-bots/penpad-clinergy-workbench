import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import expectationsRaw from "../data/expectations.yaml?raw";
import rulesRaw from "../data/sentence-rules.yaml?raw";
import conceptsRaw from "../data/concepts.yaml?raw";
import linksRaw from "../data/concept-links.yaml?raw";
import { knowledgeFromExtract } from "../remake/src/sentence/knowledge.ts";
import { findingsFromParsed, renderSentence } from "../remake/src/sentence/render.ts";

const knowledge = knowledgeFromExtract(parse(rulesRaw), parse(conceptsRaw), parse(linksRaw));
const rows = parse(expectationsRaw) as { expected: string; finding: unknown }[];

describe("remake original-equivalent generator: five walkthrough sentences", () => {
  for (const row of rows) {
    it(row.expected, () => {
      const [finding] = findingsFromParsed(row.finding);
      expect(renderSentence(finding, knowledge)).toBe(row.expected);
    });
  }
});
