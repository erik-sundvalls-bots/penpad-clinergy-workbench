import { describe, expect, it } from "vitest";
import { buildThumbEncounter } from "../src/openehr/compose.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import case01 from "./fixtures/ferro/01-demo-1998.json";
import case02 from "./fixtures/ferro/02-pain-rich.json";
import case03 from "./fixtures/ferro/03-bilateral-pain.json";
import case04 from "./fixtures/ferro/04-absent-swelling-chosen.json";
import case05 from "./fixtures/ferro/05-possible-excluded-present.json";
import case06 from "./fixtures/ferro/06-exam-per-side.json";
import case07 from "./fixtures/ferro/07-exam-normal-absent-tenderness.json";
import { ferroRegressionCases } from "./ferro-cases-data.ts";

const expectedById: Record<string, unknown> = {
  "01-demo-1998": case01,
  "02-pain-rich": case02,
  "03-bilateral-pain": case03,
  "04-absent-swelling-chosen": case04,
  "05-possible-excluded-present": case05,
  "06-exam-per-side": case06,
  "07-exam-normal-absent-tenderness": case07,
};

describe("FerroEHR regression cases (canonical)", () => {
  for (const item of ferroRegressionCases) {
    it(`${item.id} matches the accepted canonical composition and validates`, async () => {
      const result = buildThumbEncounter(item.state, item.narrative);
      expect(result.canonical).toEqual(expectedById[item.id]);
      expect(JSON.stringify(result.canonical)).not.toContain('"match":"~"');
      const names = result.canonical.content as { name: { value: string }; items: unknown[] }[];
      expect(names.every((section) => section.items.length > 0)).toBe(true);
      const checked = await validateComposition(result.canonical);
      expect(checked.errors, JSON.stringify(checked.errors, null, 2)).toEqual([]);
      expect(checked.warnings, JSON.stringify(checked.warnings, null, 2)).toEqual([]);
    });
  }
});