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
import {
  acceptTopPopup,
  cancelTopPopup,
  openPopup,
  popupAcceptEnabled,
  popupTitle,
  resetTopPopup,
  updateTopPopup,
} from "../remake/src/form/popups.ts";

describe("more… popup stack", () => {
  const painForm = formOf("ThumbPainSymptom");
  const swellingForm = formOf("ThumbSwellingSymptom");
  if (!painForm || !swellingForm) throw new Error("missing forms");
  const pain = painForm;
  const swelling = swellingForm;
  const swellingLink = pain.associatedSymptomsAndSigns?.find((l) => l.item === "ThumbSwellingSymptom")
    ?? pain.associatedSymptomsAndSigns?.[0];
  if (!swellingLink) throw new Error("missing swelling link");

  function openSwelling() {
    let main = emptyFormState(pain, { location: "Thumb" });
    main = toggleLaterality(main, "right", true);
    const opened = openPopup(pain, main, [], "associated", swellingLink, "main");
    if ("error" in opened) throw new Error(opened.error);
    return { main, popups: opened };
  }

  it("opens a More-on window without replacing the parent form state", () => {
    const { main, popups } = openSwelling();
    expect(popups).toHaveLength(1);
    expect(popupTitle(popups[0].form)).toMatch(/^More on /i);
    expect(popupAcceptEnabled(popups[0])).toBe(false);
    expect(main.associated.ThumbSwellingSymptom).toBeUndefined();
    expect(findingsFromForm(pain, main).map((f) => renderSentence(f, sentenceKnowledge))).toEqual([
      "Pain in right thumb",
    ]);
  });

  it("keeps Accept disabled until the child form changes, and Cancel discards it", () => {
    const { main, popups } = openSwelling();
    const dirty = updateTopPopup(popups, setFeatureValue(popups[0].formState, "AbsoluteSeverity", "moderate", false));
    expect(popupAcceptEnabled(dirty[0])).toBe(true);
    const cancelled = cancelTopPopup(dirty);
    expect(cancelled).toHaveLength(0);
    expect(main.associated.ThumbSwellingSymptom).toBeUndefined();
  });

  it("writes the child form back on Accept and updates the parent summary sentences", () => {
    const { main, popups } = openSwelling();
    let child = popups[0].formState;
    child = { ...child, laterality: ["left"] };
    child = { ...child, subLocation: "distalPhalanx" };
    child = setDuration(child, "QuantityDuration", 2, "week");
    child = setFeatureValue(child, "AbsoluteOnset", "gradual", false);
    child = setFeatureValue(child, "AbsoluteSeverity", "moderate", false);
    const accepted = acceptTopPopup(main, updateTopPopup(popups, child));
    expect(accepted.popups).toHaveLength(0);
    expect(accepted.main.associated[swellingLink.item]?.summary).toBe("presence");
    expect(accepted.main.associated[swellingLink.item]?.form).toBeTruthy();
    const sentences = findingsFromForm(pain, accepted.main).map((f) => renderSentence(f, sentenceKnowledge));
    expect(sentences[0]).toBe("Pain in right thumb");
    expect(sentences).toContain(
      "Gradual onset, moderately severe swelling of distal phalanx of left thumb for 2 weeks, present",
    );
  });

  it("Reset on a popup restores the state from when it was opened", () => {
    let main = emptyFormState(pain, { location: "Thumb" });
    main = setLinkSummary(main, "associated", swellingLink.item, "presence");
    // Pretend a previous accept stored a child form
    const prior = emptyFormState(swelling, { location: "Thumb", laterality: ["left"] });
    main = { ...main, associated: { [swellingLink.item]: { summary: "presence", form: prior } } };
    const opened = openPopup(pain, main, [], "associated", swellingLink, "main");
    if ("error" in opened) throw new Error(opened.error);
    const edited = updateTopPopup(opened, toggleLaterality(opened[0].formState, "right", true));
    expect(popupAcceptEnabled(edited[0])).toBe(true);
    const reset = resetTopPopup(edited);
    expect(reset[0].formState.laterality).toEqual(["left"]);
    expect(popupAcceptEnabled(reset[0])).toBe(false);
  });
});
