/**
 * Field captions harvested from the original engine runtime form specs,
 * plus associated/diagnosis labels that include a locative.
 */
import { describe, expect, it } from "vitest";
import { formOf } from "../remake/src/knowledge-data.ts";
import { featureLabel, linkLabel } from "../remake/src/form/engine.ts";
import { featureCaption } from "../remake/src/form/quantities.ts";
import FORM_CAPTIONS from "../remake/src/form/form-captions.json";

describe("harvested field captions", () => {
  it("stores a caption table keyed by feature", () => {
    expect(Object.keys(FORM_CAPTIONS).length).toBeGreaterThan(100);
    expect(FORM_CAPTIONS.QuantityStartTime).toBe("how long ago?");
    expect(FORM_CAPTIONS.QuantityLengthOfHistory).toBe("lasting how long?");
    expect(FORM_CAPTIONS.QuantityDuration).toBe("duration");
    expect(FORM_CAPTIONS.AbsoluteProcessPattern).toBe("pattern");
    expect(FORM_CAPTIONS.AbsolutePainDescriptor).toBe("character");
    expect(FORM_CAPTIONS.AbsoluteAcquisitionMode).toBe("acquisition");
    expect(FORM_CAPTIONS.ConseqTendernessSign).toBe("Tenderness");
    expect(FORM_CAPTIONS.hasAggravatingFactor).toBe("aggravated by");
    expect(FORM_CAPTIONS.hasRelievingFactor).toBe("relieved by");
  });

  it("exposes those captions through featureCaption / featureLabel", () => {
    expect(featureCaption("QuantityStartTime")).toBe("how long ago?");
    expect(featureCaption("AbsoluteProcessPattern")).toBe("pattern");
    expect(featureCaption("ConseqTendernessSign")).toBe("Tenderness");
    expect(featureLabel("hasAggravatingFactor")).toBe("aggravated by");
    // Structural quantity rows stay unlabelled; the parent sign supplies the name.
    expect(featureCaption("hasQuantity")).toBe("");
    expect(featureCaption("hasManyValuedQuantity")).toBe("");
  });

  it("writes captions onto generated form rows", () => {
    const malaria = formOf("PMHOfMalaria");
    expect(malaria).toBeTruthy();
    const byFeature = Object.fromEntries(
      [...(malaria!.firstLayer ?? []), ...(malaria!.moreLayer ?? [])].map((r) => [r.feature ?? r.criterialLink, r.caption]),
    );
    expect(byFeature.QuantityStartTime).toBe("how long ago?");
    expect(byFeature.QuantityLengthOfHistory).toBe("lasting how long?");
    expect(byFeature.AbsoluteHistoricalPattern).toBe("pattern");

    const dysuria = formOf("DysuriaSymptom")!;
    const d = Object.fromEntries(
      [...dysuria.firstLayer, ...dysuria.moreLayer].map((r) => [r.feature ?? r.criterialLink, r.caption]),
    );
    expect(d.QuantityDuration).toBe("duration");
    expect(d.AbsoluteProcessPattern).toBe("pattern");
    expect(d.ConseqPain).toBe("Pain");

    const pulse = formOf("PulseRateSign")!;
    expect(pulse.firstLayer[0]?.feature).toBe("hasQuantity");
    expect(pulse.firstLayer[0]?.caption ?? "").toBe("");

    const temp = formOf("BodyTemperatureSign")!;
    const qty = temp.firstLayer.find((r) => r.feature === "hasQuantity");
    expect(qty?.caption).toBe("value");
    const est = temp.firstLayer.find((r) => r.feature === "EstimatedTemperature");
    expect(est?.caption).toBe("estimated temperature");
  });
});

describe("link labels", () => {
  it("adds a locative with a displayed location name", () => {
    expect(linkLabel({
      category: "symptom",
      concept: "TendernessSymptom",
      item: "TendernessSymptom of Abdomen",
      location: "Abdomen",
      preCoordinated: null,
      preposition: "of",
      summaryType: "AbsentPresent",
    })).toBe("tenderness of abdomen");
  });

  it("uses the precoordinated topic display when present", () => {
    expect(linkLabel({
      category: "symptom",
      concept: "NAMEDBodyPartPainSymptom",
      item: "NAMEDBodyPartPainSymptom in Elbow",
      location: "Elbow",
      preCoordinated: "ElbowPainSymptom",
      preposition: "in",
      summaryType: "AbsentPresent",
    }).toLowerCase()).toContain("elbow");
  });
});
