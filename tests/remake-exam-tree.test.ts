/**
 * Exam-tree captions and Features / Appearance folders against original wording.
 */
import { describe, expect, it } from "vitest";
import { examOf, formOf } from "../remake/src/knowledge-data.ts";
import {
  examTreeCaption,
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
