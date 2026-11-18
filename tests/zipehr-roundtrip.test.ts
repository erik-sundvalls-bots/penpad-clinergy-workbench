import { describe, expect, it } from "vitest";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { canonicalToZipehrHtml5, zipehrHtml5ToCanonicalRecord } from "../src/openehr/zipehr.ts";
import { ferroRegressionCases } from "./ferro-cases-data.ts";

describe("ZipEHR html5.short (demo options)", () => {
  for (const item of ferroRegressionCases) {
    it(`${item.id} renders and round-trips to the same canonical JSON`, async () => {
      const built = buildThumbEncounter(item.state, item.narrative);
      const html = await canonicalToZipehrHtml5(built.canonical);
      expect(html.length, "ZipEHR markup should not be empty").toBeGreaterThan(80);
      expect(html, "ZipEHR html5 short root tag").toMatch(/<o-co[\s>]/);
      const templateId = (built.canonical.archetype_details as { template_id?: { value?: string } })
        ?.template_id?.value;
      expect(html).toContain(templateId ?? "thumb-pain-encounter.v2");
      const roundTrip = await zipehrHtml5ToCanonicalRecord(html);
      expect(roundTrip).toEqual(built.canonical);
    });
  }
});