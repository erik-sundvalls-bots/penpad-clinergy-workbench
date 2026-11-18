import { describe, expect, it } from "vitest";
import { formatEnglishSummaryLine } from "../src/summary.ts";
import { renderEnglishGp } from "../src/en/gp-sentence.ts";
import { gpVisitState, findingsFromState } from "../src/model.ts";
import { painForm } from "../src/knowledge.ts";

describe("formatEnglishSummaryLine", () => {
  it("drops trailing present with or without a comma", () => {
    expect(formatEnglishSummaryLine("Thumb sprain in right thumb present")).toBe(
      "Thumb sprain in right thumb.",
    );
    expect(formatEnglishSummaryLine("for 2 weeks, present")).toBe("for 2 weeks.");
  });

  it("renders GP sprain without doubled thumb or present", () => {
    const finding = findingsFromState(gpVisitState(), painForm.diagnoses).find((f) => f.topic === "ThumbSprain");
    expect(renderEnglishGp(finding!)).toBe("Sprain of right thumb.");
  });
});