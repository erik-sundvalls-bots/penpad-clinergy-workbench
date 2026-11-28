/**
 * Summary, stage, family-history strength and aggravating-factor wording
 * observed from the original engine (NatLanguageForConcept). Findings use
 * public catalogue tokens only.
 */
import { describe, expect, it } from "vitest";
import { humanize, renderSentence } from "../remake/src/sentence/render.ts";
import { getSentenceKnowledge } from "../remake/src/knowledge-data.ts";
import type { Finding } from "../remake/src/sentence/types.ts";

const knowledge = getSentenceKnowledge();

function say(finding: Finding): string {
  return renderSentence(finding, knowledge);
}

describe("implicit default summaries are omitted", () => {
  it("does not say yes on a YesNoPMH topic", () => {
    expect(say({ topic: "PMHOfAlcoholism", summary: "yesPMH", qualifiers: [] }))
      .toBe("PMH of alcoholism");
    expect(say({
      topic: "ContraceptiveHistory",
      summary: "yesPMH",
      qualifiers: [{ descriptor: "AbsoluteHistoricalPattern", value: "intermittant" }],
    })).toBe("Contraceptive history intermittently");
  });

  it("still prefixes no on a YesNoPMH topic", () => {
    expect(say({ topic: "PMHOfAlcoholism", summary: "noPMH", qualifiers: [] }))
      .toBe("No PMH of alcoholism");
  });

  it("does not say done on an ActionDoneSummary topic", () => {
    expect(say({ topic: "ChangedTreatment", summary: "done", qualifiers: [] }))
      .toBe("Change of treatment");
    expect(say({ topic: "GPAction", summary: "done", qualifiers: [] }))
      .toBe("Action");
  });
});

describe("family-history strength sits in front of the topic", () => {
  it("turns none into no", () => {
    expect(say({
      topic: "FHOfAlcoholism",
      qualifiers: [{ descriptor: "AbsoluteStrength", value: "nonePresent" }],
    })).toBe("No FH of alcoholism");
    expect(say({
      topic: "FamilyHistoryOfDisease",
      qualifiers: [{ descriptor: "AbsoluteStrength", value: "nonePresent" }],
    })).toBe("No family history of disease");
  });

  it("fronts weak, moderate and strong", () => {
    expect(say({
      topic: "FHOfAlcoholism",
      qualifiers: [{ descriptor: "AbsoluteStrength", value: "weak" }],
    })).toBe("Weak FH of alcoholism");
    expect(say({
      topic: "FHOfAlcoholism",
      qualifiers: [{ descriptor: "AbsoluteStrength", value: "moderateLevel" }],
    })).toBe("Moderate FH of alcoholism");
    expect(say({
      topic: "FHOfAlcoholism",
      qualifiers: [{ descriptor: "AbsoluteStrength", value: "strong" }],
    })).toBe("Strong FH of alcoholism");
  });
});

describe("vaccination stage sits in front of the topic", () => {
  it("fronts first, second, third and booster and still says given", () => {
    expect(say({
      topic: "AnthraxVaccination",
      summary: "given",
      qualifiers: [{ descriptor: "AbsoluteVaccinationStage", value: "firstStage" }],
    })).toBe("First anthrax vaccination given");
    expect(say({
      topic: "AnthraxVaccination",
      summary: "given",
      qualifiers: [{ descriptor: "AbsoluteVaccinationStage", value: "secondStage" }],
    })).toBe("Second anthrax vaccination given");
    expect(say({
      topic: "CholeraVaccination",
      summary: "given",
      qualifiers: [{ descriptor: "AbsoluteVaccinationStage", value: "booster" }],
    })).toBe("Booster cholera vaccination given");
  });
});

describe("aggravating factors use 'aggravated by'", () => {
  it("follows the original field caption", () => {
    expect(say({
      topic: "DysphagiaSymptom",
      qualifiers: [{ descriptor: "hasAggravatingFactor", value: "Eating" }],
    })).toBe("Dysphagia aggravated by eating");
    expect(say({
      topic: "GeneralisedHyperhidrosisSymptom",
      qualifiers: [{ descriptor: "hasAggravatingFactor", value: "HighAmbientTemperature" }],
    })).toBe("Generalised hyperhidrosis aggravated by heat");
  });
});

describe("humanize keeps numeric ranges", () => {
  it("does not turn 1-9 into 1 9", () => {
    expect(humanize("1-9")).toBe("1-9");
    expect(humanize("10-19")).toBe("10-19");
    expect(humanize("CurrentLevel")).toBe("current level");
  });

  it("keeps cigarette and alcohol range words in the sentence", () => {
    expect(say({
      topic: "CurrentLevelOfSmoking",
      qualifiers: [{ descriptor: "unknown", value: "1-9" }],
    })).toBe("Cigarettes/day now 1-9");
    expect(say({
      topic: "CurrentLevelOfDrinking",
      qualifiers: [{ descriptor: "unknown", value: "1-2" }],
    })).toBe("Alcohol U/day now 1-2");
  });
});
