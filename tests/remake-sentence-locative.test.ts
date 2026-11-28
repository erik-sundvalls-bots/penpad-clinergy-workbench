/**
 * Locative / laterality / consequence wording observed from the original
 * engine (NatLanguageForConcept). Findings use public catalogue tokens only.
 */
import { describe, expect, it } from "vitest";
import { renderSentence } from "../remake/src/sentence/render.ts";
import { getSentenceKnowledge } from "../remake/src/knowledge-data.ts";
import type { Finding } from "../remake/src/sentence/types.ts";

const knowledge = getSentenceKnowledge();

function say(finding: Finding): string {
  return renderSentence(finding, knowledge);
}

describe("sublocation does not repeat the parent site", () => {
  it("names only the sublocation", () => {
    expect(say({ topic: "AbdomenSwellingSymptom", location: "Abdomen", subLocation: "RightHypochondrium", qualifiers: [] }))
      .toBe("Swelling of right hypochondrium");
    expect(say({ topic: "AbdominalLumpSymptom", location: "Abdomen", subLocation: "RightHypochondrium", qualifiers: [] }))
      .toBe("Lump in right hypochondrium");
    expect(say({ topic: "AbdominalPainSymptom", location: "Abdomen", subLocation: "RightHypochondrium", qualifiers: [] }))
      .toBe("Pain in right hypochondrium");
    expect(say({ topic: "AnklePainSymptom", location: "Ankle", subLocation: "AnkleJoint", qualifiers: [] }))
      .toBe("Pain in ankle joint");
    expect(say({ topic: "BreastLumpSymptom", location: "Breast", subLocation: "UpperOuterQuadrant", qualifiers: [] }))
      .toBe("Lump in upper outer quadrant of breast");
  });
});

describe("laterality on {site} {condition} diagnoses", () => {
  it("uses the condition as the head", () => {
    expect(say({ topic: "AnkleDislocation", location: "Ankle", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Dislocation of left ankle");
    expect(say({ topic: "AnkleFracture", location: "Ankle", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Fracture of left ankle");
    expect(say({ topic: "AnkleSprain", location: "Ankle", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Sprain of left ankle");
    expect(say({ topic: "AnkleStrain", location: "Ankle", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Ankle strain of left ankle");
    expect(say({ topic: "ThumbSprain", location: "Thumb", laterality: "right", qualifiers: [], summary: "possible" }))
      .toBe("? sprain of right thumb");
    expect(say({ topic: "AnteriorRibFracture", location: "AnteriorRib", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Fracture of left anterior rib");
    expect(say({ topic: "EyeForeignBodyDiagnosis", location: "Eye", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Foreign body in left eye");
  });

  it("keeps pre-coordinated symptom names", () => {
    expect(say({ topic: "EarDischargeSymptom", location: "Ear", laterality: "left", qualifiers: [] }))
      .toBe("Ear discharge from left ear");
    expect(say({ topic: "EyeForeignBodySymptom", location: "Eye", laterality: "left", qualifiers: [] }))
      .toBe("Eye foreign body in left eye");
    expect(say({ topic: "AuditoryCanalForeignBodySymptom", location: "Ear", laterality: "left", qualifiers: [] }))
      .toBe("Auditory canal foreign body in left ear");
  });
});

describe("laterality attaches to the site already in the topic display", () => {
  it("uses nipple, not breast, for adenoma of nipple", () => {
    expect(say({ topic: "AdenomaOfNipple", location: "Breast", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Adenoma of nipple of left nipple");
    expect(say({ topic: "AdenomaOfNipple", location: "Breast", laterality: "right", qualifiers: [], summary: "presence" }))
      .toBe("Adenoma of nipple of right nipple");
  });

  it("inserts laterality into a topic that already names the site", () => {
    expect(say({ topic: "ColdArmSymptom", laterality: "left", qualifiers: [] }))
      .toBe("Cold left arm");
    expect(say({ topic: "ColdArmSymptom", location: "Arm", laterality: "right", qualifiers: [] }))
      .toBe("Cold right arm");
    expect(say({ topic: "ColdFingerSymptom", laterality: "left", qualifiers: [] }))
      .toBe("Cold left finger");
    expect(say({ topic: "ColdFootSymptom", laterality: "left", qualifiers: [] }))
      .toBe("Cold left foot");
  });
});

describe("pain consequence and value words", () => {
  it("says painful / painless, not no", () => {
    expect(say({
      topic: "AbdominalLumpSymptom",
      location: "Abdomen",
      qualifiers: [{ descriptor: "ConseqPain", value: "absence" }],
    })).toBe("Painless abdominal lump");
    expect(say({
      topic: "AbdominalLumpSymptom",
      location: "Abdomen",
      qualifiers: [{ descriptor: "ConseqPain", value: "presence" }],
    })).toBe("Painful abdominal lump");
  });

  it("uses observed adverb forms instead of +ly fallbacks", () => {
    expect(say({
      topic: "CoughSymptom",
      qualifiers: [{ descriptor: "AbsoluteDiurnalVariation", value: "noDiurnalPattern" }],
    })).toBe("Cough no diurnal variation");
    expect(say({
      topic: "ContraceptiveCheck",
      summary: "performed",
      qualifiers: [{ descriptor: "MethodOfContraception", value: "DepotContraceptiveInjection" }],
    })).toBe("Depot injection contraceptive check performed");
  });
});
