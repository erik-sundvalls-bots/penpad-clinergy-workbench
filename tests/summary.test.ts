import { describe, expect, it } from "vitest";
import { formatEnglishSummaryLine } from "../src/summary.ts";

describe("formatEnglishSummaryLine", () => {
  it("drops trailing present with or without a comma", () => {
    expect(formatEnglishSummaryLine("Thumb sprain in right thumb present")).toBe(
      "Thumb sprain in right thumb.",
    );
    expect(formatEnglishSummaryLine("for 2 weeks, present")).toBe("for 2 weeks.");
  });
});