/**
 * Exam-tree captions and Features / Appearance folders against original wording.
 */
import { describe, expect, it } from "vitest";
import { examOf, formOf } from "../remake/src/knowledge-data.ts";
import {
  examSignTreeCaption,
  examSignsFor,
  examTreeCaption,
  inlineExamSign,
  inheritedSublocationRow,
  locativeExamSignCaption,
  resolveExamSiteLocation,
  sidedExamCaption,
  signHasFeatureFolder,
  signTreeCaption,
} from "../remake/src/form/exam-tree.ts";

describe("exam tree captions", () => {
  it("shortens harvested concept displays", () => {
    expect(examTreeCaption("abdominal appearance")).toBe("appearance");
    expect(examTreeCaption("abdominal tenderness")).toBe("tenderness");
    expect(examTreeCaption("abdominal percussion")).toBe("percussion");
    expect(examTreeCaption("looks")).toBe("appearance");
    expect(examTreeCaption("scrotal lump")).toBe("lump");
    expect(examTreeCaption("shifting abdominal dullness")).toBe("shifting dullness");
    expect(examTreeCaption("abdominal palpation")).toBe("abdominal palpation");
  });

  it("renders a Features folder for a nested organ base sign", () => {
    const exam = examOf("LiverExam")!;
    const sign = formOf("LiverSign")!;
    expect(signHasFeatureFolder(sign)).toBe(true);
    expect(signTreeCaption(exam.display, exam.baseSign, "LiverSign", sign.display, true)).toBe("Features");
  });

  it("renders Appearance for a nested base sign without the Features triad", () => {
    const exam = examOf("PenisExam")!;
    const sign = formOf("PenisSign")!;
    expect(signHasFeatureFolder(sign)).toBe(false);
    expect(signTreeCaption(exam.display, exam.baseSign, "PenisSign", sign.display, false)).toBe("Appearance");
  });

  it("shortens looks under general inspection rather than treating it as a base sign", () => {
    const exam = examOf("GeneralInspection")!;
    expect(exam.baseSign).toBe("WholeBodySign");
    expect(signTreeCaption(exam.display, exam.baseSign, "StateOfHealthSign", "looks", false)).toBe("appearance");
  });

  it("keeps Speech and Skin as their own nested captions, not Appearance", () => {
    const speech = examOf("SpeechExam") ?? examOf("NervousSystemExam");
    // Speech exam if present; otherwise test the rule directly.
    expect(signTreeCaption("speech", "SpeechSign", "SpeechSign", "speech", false)).toBe("speech");
    expect(signTreeCaption("skin", "SkinSign", "SkinSign", "skin", false)).toBe("skin");
  });

  it("shortens a nested percussion base sign rather than calling it Appearance", () => {
    const exam = examOf("AbdoPercussionExam")!;
    const sign = formOf(exam.baseSign ?? "AbdominalPercussionSign")!;
    expect(signTreeCaption(exam.display, exam.baseSign, exam.baseSign ?? "AbdominalPercussionSign", sign.display, signHasFeatureFolder(sign))).toBe("percussion");
  });

  it("keeps Appearance on tongue and breast even when the Features triad is present", () => {
    const tongue = examOf("TongueExam")!;
    const tongueSign = formOf("TongueSign")!;
    expect(signHasFeatureFolder(tongueSign)).toBe(true);
    expect(signTreeCaption(tongue.display, tongue.baseSign, "TongueSign", tongueSign.display, true)).toBe("Appearance");
    const breast = examOf("BreastExam")!;
    const breastSign = formOf("BreastSign")!;
    expect(signTreeCaption(breast.display, breast.baseSign, "BreastSign", breastSign.display, true)).toBe("Appearance");
  });

  it("renders Appearance for tonsils despite the singular sign display", () => {
    const exam = examOf("TonsilExam")!;
    const sign = formOf("TonsilSign")!;
    expect(exam.display).toBe("tonsils");
    expect(sign.display).toBe("tonsil");
    expect(signTreeCaption(exam.display, exam.baseSign, "TonsilSign", sign.display, signHasFeatureFolder(sign))).toBe("Appearance");
  });

  it("treats vaginal size/patency/contents as a Features folder", () => {
    const exam = examOf("VaginaExam")!;
    const sign = formOf("VaginaSign")!;
    expect(signHasFeatureFolder(sign)).toBe(true);
    expect(signTreeCaption(exam.display, exam.baseSign, "VaginaSign", sign.display, true)).toBe("Features");
  });

  it("keeps the prostate gland folder rather than renaming it Features", () => {
    const exam = examOf("ProstateExam")!;
    const sign = formOf("ProstateGlandSign")!;
    expect(sign.display).toBe("prostate gland");
    expect(signTreeCaption(exam.display, exam.baseSign, "ProstateGlandSign", sign.display, true)).toBe("prostate gland");
  });

  it("captions the urine feature folder as character", () => {
    const exam = examOf("UrineExam")!;
    const sign = formOf("UrineFeature")!;
    expect(signTreeCaption(exam.display, exam.baseSign, "UrineFeature", sign.display, false)).toBe("character");
  });
});

describe("sided exam captions", () => {
  it("prefixes Left or Right onto the exam display", () => {
    expect(sidedExamCaption("groin", "left")).toBe("Left groin");
    expect(sidedExamCaption("eye as a whole", "right")).toBe("Right eye as a whole");
    expect(sidedExamCaption("ear", "left")).toBe("Left ear");
  });

  it("does not double-prefix a display that already names a side", () => {
    expect(sidedExamCaption("left testis", "left")).toBe("Left testis");
  });
});

describe("inline exam-sign value lists", () => {
  it("puts tendon-reflex activity chips on the sign itself", () => {
    const inline = inlineExamSign("LeftBicepsReflexSign");
    expect(inline?.feature).toBe("AbsoluteReflexLev");
    expect(inline?.hide.has("AbsoluteReflexLev")).toBe(true);
  });

  it("keeps an activity child on plantar, corneal and cremasteric reflexes", () => {
    expect(inlineExamSign("LeftPlantarReflexSign")).toBeNull();
    expect(inlineExamSign("CornealReflexSign")).toBeNull();
    expect(inlineExamSign("CremastericReflexSign")).toBeNull();
    expect(inlineExamSign("GlabellarReflexSign")).toBeNull();
    expect(inlineExamSign("SnoutReflexSign")).toBeNull();
  });

  it("shows speech rate on the sign and hides the content row", () => {
    const inline = inlineExamSign("SpeechSign");
    expect(inline?.feature).toBe("AbsoluteRate");
    expect(inline?.hide.has("AbsoluteRate")).toBe(true);
    expect(inline?.hide.has("AbsoluteContentSpeech")).toBe(true);
  });

  it("inlines bowel-sound, dullness, mental-state and inhaler lists", () => {
    expect(inlineExamSign("BowelSoundSign")?.feature).toBe("AbsoluteSoundCharacterBowel");
    expect(inlineExamSign("CardiacDullnessSign")?.feature).toBe("ExpectedProcessActivityLevel");
    expect(inlineExamSign("MoodSign")?.feature).toBe("ExpectedProcessActivityLevel");
    expect(inlineExamSign("EyeContactSign")?.feature).toBe("AbsoluteQuality");
    expect(inlineExamSign("InhalerTechniqueSign")?.feature).toBe("AbsoluteQuality");
  });
});

describe("locative exam-sign captions", () => {
  it("attaches the exam site with the sanctioned preposition", () => {
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Vulva")).toBe("inflammation of vulva");
    expect(locativeExamSignCaption("AbscessSign", "abscess", "Vulva")).toBe("abscess on vulva");
    expect(locativeExamSignCaption("ForeignBodySign", "foreign body", "Eyelid")).toBe("foreign body in eyelid");
    expect(locativeExamSignCaption("BleedingSign", "bleeding", "Gum")).toBe("bleeding from gum");
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "RoofOfMouth")).toBe("inflammation of roof of mouth");
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "InsideOfCheek")).toBe("inflammation of inside of cheek");
  });

  it("leaves Appearance and Features folders alone", () => {
    expect(locativeExamSignCaption("VulvaSign", "Appearance", "Vulva")).toBe("Appearance");
    expect(locativeExamSignCaption("LiverSign", "Features", "Liver")).toBe("Features");
  });

  it("does not add a locative for signs the original keeps short", () => {
    expect(locativeExamSignCaption("LumpSign", "lump", "Stomach")).toBe("lump");
    expect(locativeExamSignCaption("TendernessSign", "tenderness", "Stomach")).toBe("tenderness");
  });

  it("adds a locative on flexion at toe joints but not at the shoulder", () => {
    expect(locativeExamSignCaption("FlexionSign", "flexion", "FifthToeJoint")).toBe("flexion of fifth toe joint");
    expect(locativeExamSignCaption("FlexionSign", "flexion", "ShoulderJoint")).toBe("flexion");
  });

  it("does not double-attach a site already in the caption", () => {
    expect(locativeExamSignCaption("InflammationSign", "inflammation of vulva", "Vulva")).toBe("inflammation of vulva");
  });

  it("is used after the usual exam-tree shortening", () => {
    const exam = { display: "vulva", baseSign: "VulvaSign" };
    expect(
      examSignTreeCaption(exam.display, exam.baseSign, "InflammationSign", "inflammation", false, "Vulva"),
    ).toBe("inflammation of vulva");
    expect(
      examSignTreeCaption(exam.display, exam.baseSign, "VulvaSign", "vulva", false, "Vulva"),
    ).toBe("Appearance");
  });

  it("adds locatives the original uses on throat, tonsils and the knee", () => {
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Throat", undefined, undefined, "SoreThroatSymptom")).toBe("inflammation of throat");
    expect(locativeExamSignCaption("InfectionLesionSign", "infection", "Tonsil", "TonsilExam", "tonsils", "SoreThroatSymptom")).toBe("infection of tonsils");
    expect(locativeExamSignCaption("JointStiffnessSign", "joint stiffness", "Knee", undefined, undefined, "JointClickingOfKneeSymptom")).toBe("joint stiffness in knee");
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Throat")).toBe("inflammation");
    expect(locativeExamSignCaption("ForeignBodySign", "foreign body", "Rectum")).toBe("foreign body in rectum");
  });

  it("keeps short inflammation on contraception and HRT vulva exams", () => {
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Vulva", "ContraVulvaExam")).toBe("inflammation");
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Vulva", "HRTVulvaExam")).toBe("inflammation");
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Vulva", "VulvaExam")).toBe("inflammation of vulva");
  });
});

describe("exam leftover folders, laterality and extra signs", () => {
  it("keeps Appearance on a loin kidney even when the Features triad is present", () => {
    const exam = examOf("LoinKidneyExam")!;
    const sign = formOf("KidneySign")!;
    expect(signHasFeatureFolder(sign)).toBe(true);
    expect(signTreeCaption(exam.display, exam.baseSign, "KidneySign", sign.display, true)).toBe("Appearance");
  });

  it("adds laterality to axillary and inguinal node signs", () => {
    expect(formOf("AxillaryLymphNodesSign")!.firstLayer.some((row) => row.feature === "laterality")).toBe(true);
    expect(formOf("InguinalLymphNodesSign")!.firstLayer.some((row) => row.feature === "laterality")).toBe(true);
  });

  it("adds the original's extra signs on leftover forms", () => {
    expect(examSignsFor("StyeSymptom", "WholeEyeExam", [])).toContain("StyeSign");
    expect(examSignsFor("JointClickingOfKneeSymptom", "KneeExam", ["TendernessSign", "SwellingSign"]))
      .toEqual(["TendernessSign", "SwellingSign", "JointStiffnessSign", "JointLockingSign"]);
    expect(examSignsFor("RectalForeignBodySymptom", "RectalExam", ["RectalMassSign"])).toContain("ForeignBodySign");
  });
});

describe("inherited exam-site sublocations", () => {
  it("gives abdominal scars the nine abdominal regions", () => {
    const row = inheritedSublocationRow("AbdominalScarSign", "Abdomen");
    expect(row?.caption).toBe("Sublocation");
    expect(row?.values).toEqual([
      "RightHypochondrium", "Epigastrium", "LeftHypochondrium", "RightFlank",
      "Umbilicus", "LeftFlank", "RightIliacFossa", "SupraPubicRegion", "LeftIliacFossa",
    ]);
  });

  it("gives a colon lump the six colonic segments", () => {
    const row = inheritedSublocationRow("LumpSign", "Colon");
    expect(row?.values).toEqual([
      "AscendingColon", "HepaticFlexure", "SplenicFlexure", "TransverseColon",
      "DescendingColon", "SigmoidColon",
    ]);
  });

  it("walks up to the abdomen when appearance has no baseLocation", () => {
    const appearance = { name: "AbdominalAppearanceExam", baseLocation: null, super: "AbdomenExam" };
    const exams: Record<string, { name: string; baseLocation: string | null; super: string | null }> = {
      AbdomenExam: { name: "AbdomenExam", baseLocation: "Abdomen", super: null },
    };
    expect(resolveExamSiteLocation(appearance, (name) => exams[name] ?? null)).toBe("Abdomen");
  });

  it("maps respiratory exams onto the thorax zone list", () => {
    const exam = { name: "RespSoundExam", baseLocation: null, super: "RespSysExam" };
    const exams = {
      RespSysExam: { name: "RespSysExam", baseLocation: null, super: null },
    };
    expect(resolveExamSiteLocation(exam, (name) => exams[name as keyof typeof exams] ?? null)).toBe("Thorax");
    expect(inheritedSublocationRow("BreathSoundSign", "Thorax")?.values).toHaveLength(12);
  });

  it("does not invent a sublocation for signs the original keeps without one", () => {
    expect(inheritedSublocationRow("BowelSoundSign", "Abdomen")).toBeNull();
    expect(inheritedSublocationRow("AbdominalDistensionSign", "Abdomen")).toBeNull();
    expect(inheritedSublocationRow("VaginalDischargeSign", "Vagina")).toBeNull();
  });
});
