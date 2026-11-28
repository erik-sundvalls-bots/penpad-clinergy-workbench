/**
 * Associated / diagnosis list captions: incomplete concepts pick up the parent
 * form location, and named body-part pain uses the complete topic wording.
 */
import { describe, expect, it } from "vitest";
import { formOf } from "../remake/src/knowledge-data.ts";
import { linkLabel } from "../remake/src/form/engine.ts";
import type { FormLink } from "../remake/src/knowledge-data.ts";

function linkOn(topic: string, bag: "diagnoses" | "associatedSymptomsAndSigns", concept: string): { link: FormLink; location: string | null } {
  const form = formOf(topic);
  expect(form, topic).toBeTruthy();
  const link = (form![bag] ?? []).find((row) => row.concept === concept);
  expect(link, `${topic} ${bag} ${concept}`).toBeTruthy();
  return { link: link!, location: form!.location ?? null };
}

describe("diagnosis locatives on incomplete concepts", () => {
  it("attaches the form location with the sanctioned preposition", () => {
    const abdomen = linkOn("AbdominalLumpSymptom", "diagnoses", "BenignTumour");
    expect(linkLabel(abdomen.link, abdomen.location).toLowerCase()).toBe("benign tumour of abdomen");

    const abscess = linkOn("AbdominalLumpSymptom", "diagnoses", "CutaneousAbscess");
    expect(linkLabel(abscess.link, abscess.location).toLowerCase()).toBe("cutaneous abscess on abdomen");

    const axilla = linkOn("AxillaryLumpSymptom", "diagnoses", "CutaneousAbscess");
    expect(linkLabel(axilla.link, axilla.location).toLowerCase()).toBe("cutaneous abscess in axilla");

    const ear = linkOn("EarSwellingSymptom", "associatedSymptomsAndSigns", "DeformitySymptom");
    expect(linkLabel(ear.link, ear.location).toLowerCase()).toBe("deformity of ear");
  });

  it("leaves complete concepts without a parent locative", () => {
    const aneurysm = linkOn("AbdominalLumpSymptom", "diagnoses", "AorticAneurysm");
    expect(linkLabel(aneurysm.link, aneurysm.location).toLowerCase()).toBe("aortic aneurysm");

    const pain = linkOn("AbdominalLumpSymptom", "associatedSymptomsAndSigns", "AbdominalPainSymptom");
    expect(linkLabel(pain.link, pain.location).toLowerCase()).toBe("abdominal pain");

    const galactocele = linkOn("BreastLumpSymptom", "diagnoses", "Galactocele");
    expect(linkLabel(galactocele.link, galactocele.location).toLowerCase()).toBe("galactocele");

    const stye = linkOn("EyeLumpSymptom", "diagnoses", "StyeDiagnosis");
    expect(linkLabel(stye.link, stye.location).toLowerCase()).toBe("stye");
  });
});

describe("named body-part pain captions", () => {
  it("uses the complete precoordinated pain topic, not 'pain in <site>'", () => {
    const anal = linkOn("AnalStrain", "associatedSymptomsAndSigns", "NAMEDBodyPartPainSymptom");
    expect(linkLabel(anal.link, anal.location).toLowerCase()).toBe("anal pain");

    const neck = linkOn("CervicalNerveRootLesion", "associatedSymptomsAndSigns", "NAMEDBodyPartPainSymptom");
    expect(linkLabel(neck.link, neck.location).toLowerCase()).toBe("neck pain");

    const cervical = linkOn("CervicalStrain", "associatedSymptomsAndSigns", "NAMEDBodyPartPainSymptom");
    expect(linkLabel(cervical.link, cervical.location).toLowerCase()).toBe("cervical spine pain");

    const calf = linkOn("CalfStrain", "associatedSymptomsAndSigns", "NAMEDBodyPartPainSymptom");
    expect(linkLabel(calf.link, calf.location).toLowerCase()).toBe("lower leg pain");

    const clavicle = linkOn("ClavicleFracture", "associatedSymptomsAndSigns", "NAMEDBodyPartPainSymptom");
    expect(linkLabel(clavicle.link, clavicle.location).toLowerCase()).toBe("clavicular pain");
  });

  it("still uses an explicit complete pain precoordination", () => {
    expect(linkLabel({
      category: "symptom",
      concept: "NAMEDBodyPartPainSymptom",
      item: "NAMEDBodyPartPainSymptom in Elbow",
      location: "Elbow",
      preCoordinated: "ElbowPainSymptom",
      preposition: "in",
      summaryType: "AbsentPresent",
    }).toLowerCase()).toBe("elbow pain");
  });

});

describe("other locative wording", () => {
  it("uses a Generalised* topic when the location is the body as a whole", () => {
    const oa = linkOn("GeneralisedAchingSymptom", "diagnoses", "Osteoarthritis");
    expect(linkLabel(oa.link, oa.location).toLowerCase()).toBe("generalised osteoarthritis");
    const ra = linkOn("GeneralisedAchingSymptom", "diagnoses", "RheumatoidArthritis");
    expect(linkLabel(ra.link, ra.location).toLowerCase()).toBe("generalised rheumatoid arthritis");
  });

  it("keeps a plain locative for swelling of a limb", () => {
    const lymph = linkOn("Lymphoedema", "associatedSymptomsAndSigns", "SwellingSymptom");
    expect(linkLabel(lymph.link, lymph.location).toLowerCase()).toBe("swelling of leg");
  });

  it("uses a complete Location+concept topic when one exists (breast tenderness)", () => {
    const mastalgia = linkOn("CyclicalMastalgia", "associatedSymptomsAndSigns", "TendernessSymptom");
    expect(linkLabel(mastalgia.link, mastalgia.location).toLowerCase()).toBe("breast tenderness");
  });
});
