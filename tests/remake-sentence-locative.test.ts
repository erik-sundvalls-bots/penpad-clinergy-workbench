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

describe("laterality topic heads and site wording leftovers", () => {
  it("lifts a generic last word even when the prefix does not overlap the site", () => {
    expect(say({ topic: "ArmFracture", location: "Arm", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Fracture of left upper arm");
    expect(say({ topic: "LegFracture", location: "Leg", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Fracture of left lower leg");
    expect(say({ topic: "ScaphoidFracture", location: "Wrist", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Fracture of left wrist");
  });

  it("inserts laterality in front of an already-named site phrase", () => {
    expect(say({ topic: "ColdLowerLegSymptom", location: "Leg", laterality: "left", qualifiers: [] }))
      .toBe("Cold left lower leg");
    expect(say({ topic: "JointClickingOfKneeSymptom", location: "Knee", laterality: "left", qualifiers: [] }))
      .toBe("Clicking of left knee");
    expect(say({ topic: "NippleBleedingSymptom", location: "Nipple", laterality: "left", qualifiers: [] }))
      .toBe("Nipple bleeding from left nipple");
    expect(say({ topic: "SoleOfFootStrain", location: "SoleOfFootMuscleGroup", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Strain of left sole of foot");
    expect(say({ topic: "EyeDrynessSymptom", laterality: "left", qualifiers: [] }))
      .toBe("Dry eye left eye");
  });

  it("lifts joint dislocation but keeps a multi-word joint name at a broader site", () => {
    expect(say({ topic: "FifthToeJointDislocation", location: "FifthToe", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Dislocation of left fifth toe");
    expect(say({ topic: "ThumbJointDislocation", location: "Thumb", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Dislocation of left thumb");
    expect(say({ topic: "AcromioClavicularJointDislocation", location: "Shoulder", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Acromio clavicular joint dislocation in left shoulder");
    expect(say({ topic: "VitreousHaemorrhage", location: "Eye", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Vitreous haemorrhage in left eye");
    expect(say({ topic: "LegSwellingSymptom", location: "Leg", laterality: "left", qualifiers: [] }))
      .toBe("Leg swelling of left lower leg");
  });

  it("says enlargement / decreased size for Large* and Small* findings", () => {
    expect(say({ topic: "LargeBreastSymptom", location: "Breast", laterality: "left", qualifiers: [] }))
      .toBe("Enlargement of left breast");
    expect(say({ topic: "SmallBreastSymptom", location: "Breast", laterality: "left", qualifiers: [] }))
      .toBe("Decreased size of left breast");
  });

  it("does not attach the default site of a named complete disease", () => {
    expect(say({ topic: "Sciatica", location: "SciaticNerve", qualifiers: [], summary: "presence" }))
      .toBe("Sciatica");
    expect(say({ topic: "HalluxValgus", location: "GreatToe", qualifiers: [], summary: "presence" }))
      .toBe("Hallux valgus");
  });

  it("prefers the first sanctioned site when laterality is set on a generic last link", () => {
    expect(say({ topic: "HalluxValgus", location: "GreatToe", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Hallux valgus of left foot");
    expect(say({ topic: "DupuytrensContracture", location: "Hand", laterality: "left", qualifiers: [], summary: "presence" }))
      .toBe("Dupuytren's contracture of left index finger");
  });

  it("still expands an incomplete infection onto its site", () => {
    expect(say({ topic: "SubcutaneousInfection", location: "Thumb", qualifiers: [], summary: "presence" }))
      .toBe("Subcutaneous infection on thumb");
  });

  it("keeps the parent site on a relative sublocation such as a nail", () => {
    expect(say({ topic: "LumpSymptom", location: "FifthToe", subLocation: "ToeNail", qualifiers: [] }))
      .toBe("Lump on toe nail of fifth toe");
    expect(say({ topic: "ThumbLumpSymptom", location: "Thumb", subLocation: "ThumbNail", qualifiers: [] }))
      .toBe("Lump on thumb nail");
    expect(say({ topic: "FacialLumpSymptom", location: "Face", subLocation: "Forehead", qualifiers: [] }))
      .toBe("Lump on forehead");
    expect(say({ topic: "BackPainSymptom", location: "Back", subLocation: "PosteriorRibsRegion", qualifiers: [] }))
      .toBe("Pain in posterior ribs region");
    expect(say({ topic: "Sciatica", location: "SciaticNerve", subLocation: "PosteriorRibsRegion", qualifiers: [], summary: "presence" }))
      .toBe("Sciatica of posterior ribs region");
  });
});

describe("dizziness parentheses and consequence phrasing", () => {
  it("parenthesizes absolute dizziness descriptors", () => {
    expect(say({
      topic: "DizzinessSymptom",
      qualifiers: [{ descriptor: "AbsoluteDizzDescriptor", value: "rotationOfSelf" }],
    })).toBe("Dizziness (rotation of self)");
    expect(say({
      topic: "DizzinessSymptom",
      qualifiers: [{ descriptor: "AbsoluteDizzDescriptor", value: "lightHeadedness" }],
    })).toBe("Dizziness (light-headedness)");
  });

  it("does not say no after a non-itching consequence", () => {
    expect(say({
      topic: "UmbilicalDischargeSymptom",
      qualifiers: [{ descriptor: "ConseqItching", value: "absence" }],
    })).toBe("Non itching umbilical discharge");
  });

  it("uses short consequence prepositions", () => {
    expect(say({
      topic: "FlatulenceSymptom",
      qualifiers: [{ descriptor: "carriesFrom", value: "Anus" }],
    })).toBe("Flatulence from anus");
    expect(say({
      topic: "BlisterSymptom",
      qualifiers: [{ descriptor: "isSpecificConsequenceOf", value: "Burn" }],
    })).toBe("Blister caused by burn");
  });
});
