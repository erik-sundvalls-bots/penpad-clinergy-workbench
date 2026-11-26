import type { BodyMapData, MapRegion } from "../knowledge-data.ts";
import type { ImagePack } from "./types.ts";

/** Adapt a pack into the remake's existing BodyMapData so hit-testing stays unchanged. */
export function bodyMapFromPack(pack: ImagePack): BodyMapData {
  const maps: BodyMapData["maps"] = {};
  for (const [name, m] of Object.entries(pack.maps)) {
    maps[name] = m.regions.map((r): MapRegion => ({
      label: r.label ?? null,
      concept: r.concept,
      hotspot: r.hotspot,
      inset: r.inset ? (pack.images[r.inset.image]?.path ?? r.inset.image) : null,
      insetRect: r.inset?.rect ?? null,
      insetImageId: r.inset?.image ?? null,
      root: false,
      sublocations: (r.sublocations ?? []).map((s) => ({
        label: s.label ?? null,
        concept: s.concept,
        hotspot: s.hotspot,
      })),
    }));
  }
  const mainGraphics: BodyMapData["mainGraphics"] = {};
  for (const [name, m] of Object.entries(pack.maps)) {
    const img = pack.images[m.image];
    const w = img?.width ?? pack.canvas.width;
    const h = img?.height ?? pack.canvas.height;
    mainGraphics[name] = {
      concept: m.concept ?? "",
      hotspot: m.hotspot ?? [0, h, 0, w],
      picture: img?.path ?? m.image,
      imageId: m.image,
      rect: m.rect ?? [0, 0, w, h],
    };
  }
  return {
    selectors: pack.selectors.map((s) => ({
      label: s.label,
      style: s.style ?? "Default",
      tsFlagType: s.tsFlagType,
      settings: {},
      options: s.options.map((o) => ({
        n: o.n,
        sex: o.sex,
        label: o.label,
        system: o.system,
        anatomyMap: o.anatomyMap,
        bitmaps: [],
        buttonIds: [o.buttonUp, o.buttonDown].filter((x): x is string => !!x),
      })),
    })),
    mainGraphics,
    maps,
    defaultMaps: pack.defaultMaps,
  };
}
