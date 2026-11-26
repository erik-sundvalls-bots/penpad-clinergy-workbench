import { PACK_SCHEMA, type ImagePack, type PackIssue } from "./types.ts";
import { isPixelRatio } from "./pixel-ratio.ts";

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function num4(v: unknown): v is [number, number, number, number] {
  return Array.isArray(v) && v.length === 4 && v.every((n) => typeof n === "number" && Number.isFinite(n));
}

/**
 * Structural validation of a parsed pack config. Does not read image bytes.
 * Pass `pathsInArchive` (posix paths, no leading slash) to also require that
 * every image file is present in a zip or folder.
 */
export function validatePack(raw: unknown, pathsInArchive?: Iterable<string>): PackIssue[] {
  const issues: PackIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (!isRecord(raw)) {
    add("$", "pack config must be an object");
    return issues;
  }
  if (raw.schema !== PACK_SCHEMA) {
    add("schema", `must be "${PACK_SCHEMA}" (got ${JSON.stringify(raw.schema)})`);
  }
  for (const key of ["id", "name", "version"] as const) {
    if (typeof raw[key] !== "string" || !raw[key]) add(key, "must be a non-empty string");
  }
  if (!isRecord(raw.license) || typeof raw.license.name !== "string" || !raw.license.name) {
    add("license.name", "license.name is required");
  }
  if (!isRecord(raw.coordinates) ||
    raw.coordinates.hotspot !== "top,bottom,left,right" ||
    raw.coordinates.insetRect !== "left,top,width,height") {
    add("coordinates", 'must set hotspot: "top,bottom,left,right" and insetRect: "left,top,width,height"');
  }
  if (!isRecord(raw.canvas) || typeof raw.canvas.width !== "number" || typeof raw.canvas.height !== "number" ||
    raw.canvas.width <= 0 || raw.canvas.height <= 0) {
    add("canvas", "canvas.width and canvas.height must be positive numbers");
  }
  if (raw.pixelRatio !== undefined && !isPixelRatio(raw.pixelRatio)) {
    add("pixelRatio", "pixelRatio must be 1, 2 or 4 when set (it multiplies the 1× width/height to get the file’s native pixels)");
  }
  if (!isRecord(raw.defaultMaps) || typeof raw.defaultMaps.male !== "string" || typeof raw.defaultMaps.female !== "string") {
    add("defaultMaps", "defaultMaps.male and defaultMaps.female are required");
  }
  if (!isRecord(raw.images) || !Object.keys(raw.images).length) {
    add("images", "at least one image is required");
  }
  const imageIds = new Set<string>();
  if (isRecord(raw.images)) {
    for (const [id, rec] of Object.entries(raw.images)) {
      imageIds.add(id);
      if (!isRecord(rec) || typeof rec.path !== "string" || !rec.path) add(`images.${id}.path`, "path is required");
      else if (rec.path.includes("..") || rec.path.startsWith("/") || rec.path.includes("\\")) {
        add(`images.${id}.path`, "path must be a relative posix path without '..'");
      }
      if (!isRecord(rec) || typeof rec.width !== "number" || typeof rec.height !== "number" || rec.width <= 0 || rec.height <= 0) {
        add(`images.${id}`, "width and height must be positive numbers");
      }
      if (isRecord(rec) && rec.pixelRatio !== undefined && !isPixelRatio(rec.pixelRatio)) {
        add(`images.${id}.pixelRatio`, "pixelRatio must be 1, 2 or 4 when set");
      }
    }
  }
  if (!isRecord(raw.maps) || !Object.keys(raw.maps).length) {
    add("maps", "at least one map is required");
  }
  const mapIds = new Set<string>();
  if (isRecord(raw.maps)) {
    for (const [name, map] of Object.entries(raw.maps)) {
      mapIds.add(name);
      if (!isRecord(map)) { add(`maps.${name}`, "must be an object"); continue; }
      if (typeof map.image !== "string" || !imageIds.has(map.image)) {
        add(`maps.${name}.image`, `unknown image id ${JSON.stringify(map.image)}`);
      }
      if (map.rect !== undefined && !num4(map.rect)) add(`maps.${name}.rect`, "must be [left, top, width, height]");
      if (map.hotspot !== undefined && !num4(map.hotspot)) add(`maps.${name}.hotspot`, "must be [top, bottom, left, right]");
      if (!Array.isArray(map.regions)) { add(`maps.${name}.regions`, "regions array is required"); continue; }
      map.regions.forEach((region, i) => {
        const p = `maps.${name}.regions[${i}]`;
        if (!isRecord(region)) { add(p, "must be an object"); return; }
        if (typeof region.concept !== "string" || !region.concept) add(`${p}.concept`, "required");
        if (!num4(region.hotspot)) add(`${p}.hotspot`, "must be [top, bottom, left, right]");
        if (region.inset !== undefined) {
          if (!isRecord(region.inset) || typeof region.inset.image !== "string" || !imageIds.has(region.inset.image)) {
            add(`${p}.inset.image`, `unknown image id ${JSON.stringify((region.inset as { image?: unknown }).image)}`);
          }
          if (!isRecord(region.inset) || !num4(region.inset.rect)) add(`${p}.inset.rect`, "must be [left, top, width, height]");
        }
        if (region.sublocations !== undefined) {
          if (!Array.isArray(region.sublocations)) add(`${p}.sublocations`, "must be an array");
          else {
            region.sublocations.forEach((sub, j) => {
              const sp = `${p}.sublocations[${j}]`;
              if (!isRecord(sub) || typeof sub.concept !== "string") add(`${sp}.concept`, "required");
              if (!isRecord(sub) || !num4(sub.hotspot)) add(`${sp}.hotspot`, "must be [top, bottom, left, right]");
            });
          }
        }
      });
    }
  }
  if (isRecord(raw.defaultMaps)) {
    if (typeof raw.defaultMaps.male === "string" && !mapIds.has(raw.defaultMaps.male)) {
      add("defaultMaps.male", `unknown map ${JSON.stringify(raw.defaultMaps.male)}`);
    }
    if (typeof raw.defaultMaps.female === "string" && !mapIds.has(raw.defaultMaps.female)) {
      add("defaultMaps.female", `unknown map ${JSON.stringify(raw.defaultMaps.female)}`);
    }
  }
  if (!Array.isArray(raw.selectors)) add("selectors", "selectors array is required");
  else {
    raw.selectors.forEach((sel, i) => {
      const p = `selectors[${i}]`;
      if (!isRecord(sel)) { add(p, "must be an object"); return; }
      if (typeof sel.id !== "string" || !sel.id) add(`${p}.id`, "required");
      if (typeof sel.label !== "string") add(`${p}.label`, "required");
      if (typeof sel.tsFlagType !== "string") add(`${p}.tsFlagType`, "required");
      if (!Array.isArray(sel.options)) { add(`${p}.options`, "required"); return; }
      sel.options.forEach((opt, j) => {
        const op = `${p}.options[${j}]`;
        if (!isRecord(opt)) { add(op, "must be an object"); return; }
        if (opt.sex !== "M" && opt.sex !== "F") add(`${op}.sex`, 'must be "M" or "F"');
        if (typeof opt.anatomyMap === "string" && opt.anatomyMap && !mapIds.has(opt.anatomyMap)) {
          add(`${op}.anatomyMap`, `unknown map ${JSON.stringify(opt.anatomyMap)}`);
        }
        for (const btn of ["buttonUp", "buttonDown"] as const) {
          if (typeof opt[btn] === "string" && opt[btn] && !imageIds.has(opt[btn] as string)) {
            add(`${op}.${btn}`, `unknown image id ${JSON.stringify(opt[btn])}`);
          }
        }
      });
    });
  }
  if (pathsInArchive) {
    const present = new Set([...pathsInArchive].map((p) => p.replace(/^\/+/, "")));
    if (isRecord(raw.images)) {
      for (const [id, rec] of Object.entries(raw.images)) {
        if (!isRecord(rec) || typeof rec.path !== "string") continue;
        if (!present.has(rec.path)) add(`images.${id}.path`, `file missing from pack: ${rec.path}`);
      }
    }
  }
  return issues;
}

export function assertValidPack(raw: unknown, pathsInArchive?: Iterable<string>): ImagePack {
  const issues = validatePack(raw, pathsInArchive);
  if (issues.length) {
    throw new Error(`Invalid image pack:\n${issues.map((i) => ` - ${i.path}: ${i.message}`).join("\n")}`);
  }
  return raw as ImagePack;
}
