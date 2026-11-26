import { describe, expect, it } from "vitest";
import { bodyMap } from "../remake/src/knowledge-data.ts";
import { anatomyMapFor, hitTest, insetForConcept, pointInHotspot, regionsOf } from "../remake/src/selector/hit.ts";

describe("body-map hit testing (thumb path)", () => {
  const male = regionsOf(bodyMap, anatomyMapFor(bodyMap, "male"));
  const female = regionsOf(bodyMap, anatomyMapFor(bodyMap, "female"));

  it("has male and female surface maps with a front-hand thumb", () => {
    const hand = insetForConcept(male, "Hand");
    expect(hand?.insetImageId).toBe("B_fhnd");
    const thumb = hand?.sublocations.find((s) => s.concept === "Thumb");
    expect(thumb).toBeTruthy();
    const fHand = insetForConcept(female, "Hand");
    expect(fHand?.insetImageId).toBe("B_fhnd");
  });

  it("clicks the front-hand hotspot on the main figure and opens the hand inset", () => {
    const hand = male.find((r) => r.concept === "Hand" && r.insetImageId === "B_fhnd");
    expect(hand).toBeTruthy();
    const [t, b, l, r] = hand!.hotspot;
    const hit = hitTest((l + r) / 2, (t + b) / 2, male, null);
    expect(hit.concept).toBe("Hand");
    expect(hit.kind).toBe("region");
  });

  it("clicks the thumb on the open hand inset", () => {
    const hand = insetForConcept(male, "Hand")!;
    const thumb = hand.sublocations.find((s) => s.concept === "Thumb")!;
    const [il, it] = hand.insetRect!;
    const [top, bottom, left, right] = thumb.hotspot;
    const x = il + (left + right) / 2;
    const y = it + (top + bottom) / 2;
    const hit = hitTest(x, y, male, hand);
    expect(hit.kind).toBe("sublocation");
    expect(hit.concept).toBe("Thumb");
    expect(pointInHotspot((left + right) / 2, (top + bottom) / 2, thumb.hotspot)).toBe(true);
  });

  it("a miss on the main figure is Location none", () => {
    const hit = hitTest(2, 10, male, null);
    expect(hit.kind).toBe("none");
    expect(hit.concept).toBeNull();
  });
});
