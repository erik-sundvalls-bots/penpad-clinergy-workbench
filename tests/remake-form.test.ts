import { describe, expect, it } from "vitest";
import { formOf, sentenceKnowledge } from "../remake/src/knowledge-data.ts";
import {
  emptyFormState,
  findingsFromForm,
  setDuration,
  setFeatureValue,
  setLinkSummary,
  toggleLaterality,
} from "../remake/src/form/engine.ts";
import { renderSentence } from "../remake/src/sentence/render.ts";

describe("thumb-path form engine", () => {
  const pain = formOf("ThumbPainSymptom");
  if (!pain) throw new Error("missing ThumbPainSymptom form");

  it("renders the walkthrough pain sentences from form state", () => {
    let state = emptyFormState(pain, { location: "Thumb" });
    state = toggleLaterality(state, "right", true);
    const bare = findingsFromForm(pain, state);
    expect(bare.map((f) => renderSentence(f, sentenceKnowledge))).toEqual(["Pain in right thumb"]);

    state = setFeatureValue(state, "AbsoluteSeverity", "moderate", false);
    const rich = findingsFromForm(pain, state);
    expect(rich.map((f) => renderSentence(f, sentenceKnowledge))).toEqual([
      "Moderately severe pain in right thumb",
    ]);
  });

  it("nests thumb swelling and matches a walkthrough swelling sentence", () => {
    const swelling = formOf("ThumbSwellingSymptom");
    if (!swelling) throw new Error("missing swelling form");
    let sw = emptyFormState(swelling, { location: "Thumb", laterality: ["left"] });
    sw = { ...sw, subLocation: "distalPhalanx" };
    sw = setDuration(sw, "QuantityDuration", 2, "week");
    sw = setFeatureValue(sw, "AbsoluteOnset", "gradual", false);
    sw = setFeatureValue(sw, "AbsoluteSeverity", "moderate", false);
    // presence is the topic summary when the associated symptom is marked present
    const findings = findingsFromForm(swelling, { ...sw, /* summary via dedicated field? */ });
    // The swelling form itself has no explicit summary control in firstLayer; mark presence
    // the same way the parent link would: add summary on a finding after.
    const sentences = findings.map((f) => renderSentence({ ...f, summary: "presence" }, sentenceKnowledge));
    expect(sentences).toEqual([
      "Gradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present",
    ]);
  });

  it("records a diagnosis summary in the original engine's possible form", () => {
    let state = emptyFormState(pain, { location: "Thumb" });
    state = toggleLaterality(state, "right", true);
    state = setLinkSummary(state, "diagnoses", "ThumbSprain", "possible");
    const sentences = findingsFromForm(pain, state).map((f) => renderSentence(f, sentenceKnowledge));
    expect(sentences[0]).toBe("Pain in right thumb");
    expect(sentences.some((s) => s === "? thumb sprain")).toBe(true);
  });
});
