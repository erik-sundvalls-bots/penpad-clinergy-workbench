/**
 * penpad-image-pack/v1 — swappable artwork + hit-geometry for the remake.
 * See docs/image-pack.md for the format. Coordinates live in the pack, not in app code.
 */

export const PACK_SCHEMA = "penpad-image-pack/v1" as const;
export type PackSchema = typeof PACK_SCHEMA;

/** Hotspot on the image being clicked: [top, bottom, left, right] in pixels. */
export type Hotspot = [number, number, number, number];
/** Placement of an inset on the parent graphic: [left, top, width, height] in pixels. */
export type Rect = [number, number, number, number];

export interface PackLicense {
  name: string;
  url?: string;
  spdx?: string;
  notice?: string;
}

export interface PackImage {
  path: string;
  width: number;
  height: number;
  role?: "bodymap" | "inset" | "button" | "other";
}

export interface PackSublocation {
  concept: string;
  label?: string | null;
  hotspot: Hotspot;
}

export interface PackRegion {
  concept: string;
  label?: string | null;
  hotspot: Hotspot;
  inset?: { image: string; rect: Rect };
  sublocations?: PackSublocation[];
}

export interface PackMap {
  image: string;
  concept?: string;
  /** Optional MAINGRAPHIC click box [top, bottom, left, right] on the map image. */
  hotspot?: Hotspot;
  rect?: Rect;
  regions: PackRegion[];
}

export interface PackSelectorOption {
  n: string;
  sex: "M" | "F";
  label: string;
  system: string;
  anatomyMap: string;
  buttonUp?: string;
  buttonDown?: string;
}

export interface PackSelector {
  id: string;
  label: string;
  tsFlagType: string;
  style?: string;
  options: PackSelectorOption[];
}

export interface ImagePack {
  schema: PackSchema;
  id: string;
  name: string;
  version: string;
  license: PackLicense;
  description?: string;
  attribution?: string;
  coordinates: {
    hotspot: "top,bottom,left,right";
    insetRect: "left,top,width,height";
  };
  canvas: { width: number; height: number };
  defaultMaps: { male: string; female: string };
  images: Record<string, PackImage>;
  maps: Record<string, PackMap>;
  selectors: PackSelector[];
}

export interface PackIssue {
  path: string;
  message: string;
}

export interface PackFile {
  path: string;
  bytes: Uint8Array;
}
