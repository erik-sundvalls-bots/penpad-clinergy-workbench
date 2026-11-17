import { describe, expect, it } from "vitest";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { canonicalToXml, xmlToCanonicalRecord } from "../src/openehr/serialization-views.ts";
import { ferroRegressionCases } from "./ferro-cases-data.ts";

describe("Canonical XML (ehrtslib XmlSerializer)", () => {
  for (const item of ferroRegressionCases) {
    it(`${item.id} round-trips to the same canonical JSON`, () => {
      const built = buildThumbEncounter(item.state, item.narrative);
      const xml = canonicalToXml(built.canonical);
      expect(xml.length, "XML should not be empty").toBeGreaterThan(80);
      expect(xml).toMatch(/<\?xml/);
      expect(xml.toLowerCase()).toContain("composition");
      const roundTrip = xmlToCanonicalRecord(xml);
      expect(roundTrip).toEqual(built.canonical);
    });
  }
});