import type { BodyMapData, MapRegion } from "../knowledge-data.ts";

/** Clinergy hotspot: [top, bottom, left, right]. */
export type Hotspot = [number, number, number, number];
/** insetRect / graphic rect: [left, top, width, height]. */
export type Rect = [number, number, number, number];

export function pointInHotspot(x: number, y: number, box: Hotspot): boolean {
  const [top, bottom, left, right] = box;
  return x >= left && x <= right && y >= top && y <= bottom;
}

export function hotspotArea(box: Hotspot): number {
  const [top, bottom, left, right] = box;
  return Math.max(0, bottom - top) * Math.max(0, right - left);
}

export function rectContains(rect: Rect, x: number, y: number): boolean {
  const [left, top, width, height] = rect;
  return x >= left && x <= left + width && y >= top && y <= top + height;
}

export interface Hit {
  kind: "region" | "sublocation" | "none";
  concept: string | null;
  region: MapRegion | null;
  /** Set when the hit is on a sublocation inside an open inset. */
  sublocation?: { concept: string; hotspot: Hotspot };
}

/**
 * Hit-test a click in the 240×330 graphic space.
 * An open inset is tested first (sublocations, then the inset's own concept).
 * Overlapping main-figure regions resolve to the smallest hotspot.
 */
export function hitTest(
  x: number,
  y: number,
  map: MapRegion[],
  openInset: MapRegion | null,
): Hit {
  if (openInset?.insetRect && rectContains(openInset.insetRect, x, y)) {
    const lx = x - openInset.insetRect[0];
    const ly = y - openInset.insetRect[1];
    const subs = openInset.sublocations.filter((s) => pointInHotspot(lx, ly, s.hotspot));
    if (subs.length) {
      const sub = [...subs].sort((a, b) => hotspotArea(a.hotspot) - hotspotArea(b.hotspot))[0];
      // The catch-all "whole inset is this region" box is usually the largest.
      return {
        kind: sub.concept === openInset.concept && subs.length > 1 && hotspotArea(sub.hotspot) === Math.max(...subs.map((s) => hotspotArea(s.hotspot)))
          ? "region"
          : "sublocation",
        concept: sub.concept,
        region: openInset,
        sublocation: sub,
      };
    }
    return { kind: "region", concept: openInset.concept, region: openInset };
  }

  const hits = map.filter((r) => pointInHotspot(x, y, r.hotspot));
  if (!hits.length) return { kind: "none", concept: null, region: null };
  const region = [...hits].sort((a, b) => hotspotArea(a.hotspot) - hotspotArea(b.hotspot))[0];
  return { kind: "region", concept: region.concept, region };
}

export function anatomyMapFor(data: BodyMapData, sex: "male" | "female"): string {
  return sex === "female" ? "FemaleSurfaceAnatomy" : "MaleSurfaceAnatomy";
}

export function regionsOf(data: BodyMapData, mapName: string): MapRegion[] {
  return data.maps[mapName] ?? [];
}

/** Prefer the front-hand inset when opening Hand from the arm, etc. */
export function insetForConcept(map: MapRegion[], concept: string, prefer?: string | null): MapRegion | null {
  const matches = map.filter((r) => r.concept === concept && r.insetImageId);
  if (!matches.length) return null;
  if (prefer) {
    const hit = matches.find((r) => r.insetImageId === prefer);
    if (hit) return hit;
  }
  // Prefer front-hand / left-side insets when several share a concept.
  const front = matches.find((r) => /fhnd|front|_f/i.test(r.insetImageId ?? "") || (r.insetRect && r.insetRect[0] < 120));
  return front ?? matches[0];
}
