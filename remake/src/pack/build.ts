import type {
  ImagePack,
  PackImage,
  PackLicense,
  PackMap,
  PackSelector,
  PackSchema,
} from "./types.ts";
import { PACK_SCHEMA } from "./types.ts";

export interface LooseLocation {
  label?: string | null;
  concept: string;
  hotspot: [number, number, number, number];
  inset?: string | null;
  insetRect?: [number, number, number, number] | null;
  insetImageId?: string | null;
  insetImage?: string | null;
  sublocations?: Array<{ label?: string | null; concept: string; hotspot: [number, number, number, number] }>;
}

export interface LooseSelectorOption {
  n: string;
  sex: string;
  label: string;
  system: string;
  anatomyMap?: string | null;
  bitmaps?: string[];
  buttonIds?: string[];
  bitmapImages?: Array<string | null>;
}

export interface LooseSelector {
  label?: string;
  style?: string;
  tsFlagType?: string;
  settings?: Record<string, string[]>;
  options: LooseSelectorOption[];
}

export interface LooseMainGraphic {
  concept?: string;
  hotspot?: [number, number, number, number];
  picture?: string | null;
  image?: string | null;
  imageId?: string | null;
  rect?: [number, number, number, number] | null;
}

export interface LooseOnelist {
  selectors: LooseSelector[];
  mainGraphics: Record<string, LooseMainGraphic>;
  maps: Record<string, LooseLocation[]>;
}

export function isAbsentRef(v: unknown): boolean {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return !s || s === "null" || s === "none";
}

export function stemFromPath(p: string | null | undefined): string | null {
  if (isAbsentRef(p)) return null;
  const base = p!.replace(/\\/g, "/").split("/").pop() ?? "";
  const stem = base.replace(/\.(png|svg|bmp|dib|jpe?g|gif|webp)$/i, "");
  return isAbsentRef(stem) ? null : stem;
}

export function packPathFor(id: string, sourcePath: string | null | undefined, ext = ".png"): string {
  const p = (sourcePath ?? "").replace(/\\/g, "/");
  if (p.includes("/bodymap/") || p.startsWith("bodymap/") || p.includes("images/bodymap/")) {
    return `images/bodymap/${id}${ext}`;
  }
  if (p.includes("/buttons/") || p.startsWith("buttons/") || p.includes("images/buttons/")) {
    return `images/buttons/${id}${ext}`;
  }
  if (p.includes("/bitmaps/") || p.startsWith("bitmaps/") || p.includes("images/bitmaps/")) {
    return `images/bitmaps/${id}${ext}`;
  }
  return `images/bodymap/${id}${ext}`;
}

export interface BuildPackMeta {
  id: string;
  name: string;
  version: string;
  license: PackLicense;
  description?: string;
  attribution?: string;
  canvas?: { width: number; height: number };
  defaultMaps?: { male: string; female: string };
  schema?: PackSchema;
}

export interface ResolvedImage {
  id: string;
  path: string;
  width: number;
  height: number;
  role?: PackImage["role"];
}

/**
 * Build a v1 pack config from Onelist-shaped selector + map data
 * (either the remake's bodymap-onelist.json or the extractor's Onelist.ini YAML).
 */
export function buildPackFromOnelist(
  data: LooseOnelist,
  images: Record<string, ResolvedImage>,
  meta: BuildPackMeta,
): ImagePack {
  const maps: Record<string, PackMap> = {};
  for (const [name, locs] of Object.entries(data.maps)) {
    const mg = data.mainGraphics[name] ?? {};
    const image = mg.imageId ?? stemFromPath(mg.image) ?? stemFromPath(mg.picture);
    if (!image) continue;
    maps[name] = {
      image,
      concept: mg.concept,
      hotspot: mg.hotspot,
      rect: mg.rect ?? undefined,
      regions: (locs ?? []).map((loc) => {
        const insetId = loc.insetImageId ?? stemFromPath(loc.insetImage) ?? stemFromPath(loc.inset);
        return {
          concept: loc.concept,
          label: loc.label ?? null,
          hotspot: loc.hotspot,
          inset: insetId && loc.insetRect
            ? { image: insetId, rect: loc.insetRect }
            : undefined,
          sublocations: (loc.sublocations ?? []).map((s) => ({
            concept: s.concept,
            label: s.label ?? null,
            hotspot: s.hotspot,
          })),
        };
      }),
    };
  }

  const selectors: PackSelector[] = data.selectors.map((sel, i) => {
    const label = sel.label ?? sel.settings?.Label?.[0] ?? `Selector ${i + 1}`;
    const tsFlagType = sel.tsFlagType ?? sel.settings?.TSFlagType?.[0] ?? "symptom";
    const style = sel.style ?? sel.settings?.SelectorStyle?.[0];
    const id = tsFlagType || `selector-${i + 1}`;
    return {
      id,
      label,
      tsFlagType,
      style,
      options: sel.options.map((o) => {
        const up = o.buttonIds?.[0] ?? stemFromPath(o.bitmapImages?.[0] ?? null) ?? stemFromPath(o.bitmaps?.[0] ?? null);
        const down = o.buttonIds?.[1] ?? stemFromPath(o.bitmapImages?.[1] ?? null) ?? stemFromPath(o.bitmaps?.[1] ?? null);
        return {
          n: String(o.n),
          sex: o.sex === "F" || o.sex === "f" ? "F" : "M",
          label: o.label,
          system: o.system,
          anatomyMap: o.anatomyMap ?? "",
          buttonUp: up ?? undefined,
          buttonDown: down ?? undefined,
        };
      }),
    };
  });

  const male = meta.defaultMaps?.male
    ?? (maps.MaleSurfaceAnatomy ? "MaleSurfaceAnatomy" : Object.keys(maps)[0]);
  const female = meta.defaultMaps?.female
    ?? (maps.FemaleSurfaceAnatomy ? "FemaleSurfaceAnatomy" : male);

  return {
    schema: meta.schema ?? PACK_SCHEMA,
    id: meta.id,
    name: meta.name,
    version: meta.version,
    license: meta.license,
    description: meta.description,
    attribution: meta.attribution,
    coordinates: {
      hotspot: "top,bottom,left,right",
      insetRect: "left,top,width,height",
    },
    canvas: meta.canvas ?? { width: 240, height: 330 },
    defaultMaps: { male, female },
    images,
    maps,
    selectors,
  };
}

/** Collect every image id referenced by maps and selectors. */
export function referencedImageIds(pack: Pick<ImagePack, "maps" | "selectors">): Set<string> {
  const ids = new Set<string>();
  for (const map of Object.values(pack.maps)) {
    ids.add(map.image);
    for (const r of map.regions) {
      if (r.inset?.image) ids.add(r.inset.image);
    }
  }
  for (const sel of pack.selectors) {
    for (const o of sel.options) {
      if (o.buttonUp) ids.add(o.buttonUp);
      if (o.buttonDown) ids.add(o.buttonDown);
    }
  }
  return ids;
}
