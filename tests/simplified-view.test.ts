import { describe, expect, it } from "vitest";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { canonicalToSimplifiedJson } from "../src/openehr/serialization-views.ts";
import { ferroRegressionCases } from "./ferro-cases-data.ts";

describe("Simplified view (ehrtslib serializers)", () => {
  for (const item of ferroRegressionCases) {
    it(`${item.id} renders non-empty flat and structured export`, () => {
      const built = buildThumbEncounter(item.state, item.narrative);
      for (const profile of ["better", "ehrbase", "ferroehr"] as const) {
        const flat = canonicalToSimplifiedJson(built.canonical, profile, "flat");
        expect(flat.length).toBeGreaterThan(40);
        const structured = canonicalToSimplifiedJson(built.canonical, profile, "structured");
        expect(structured.length).toBeGreaterThan(40);
      }
    });
  }
});