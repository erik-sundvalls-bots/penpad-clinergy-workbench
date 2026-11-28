/**
 * Exam-tree captions and Features / Appearance folders against original wording.
 */
import { describe, expect, it } from "vitest";
import { examOf, formOf } from "../remake/src/knowledge-data.ts";
import {
  examSignTreeCaption,
  examTreeCaption,
  inlineExamSign,
  locativeExamSignCaption,
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
    expect(locativeExamSignCaption("InflammationSign", "inflammation", "Throat")).toBe("inflammation");
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
});
