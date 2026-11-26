#!/usr/bin/env node
/**
 * Build the committed built-in CC0 placeholder pack from
 * remake/data/bodymap-onelist.json + public/remake/placeholders/*.svg.
 * Geometry is copied into pack.yaml so the remake no longer reads
 * coordinates from the Onelist-derived JSON at runtime.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const onelist = JSON.parse(readFileSync(join(root, "remake/data/bodymap-onelist.json"), "utf8"));
const manifest = JSON.parse(readFileSync(join(root, "remake/data/images-manifest.json"), "utf8"));
const outDir = join(root, "public/remake/packs/cc0-placeholders");
const placeholders = join(root, "public/remake/placeholders");

function isAbsentRef(v) {
  if (v == null) return true;
  if (typeof v !== "string") return false;
  const s = v.trim().toLowerCase();
  return !s || s === "null" || s === "none";
}

function stemFromPath(p) {
  if (isAbsentRef(p)) return null;
  const base = String(p).replace(/\\/g, "/").split("/").pop() ?? "";
  const stem = base.replace(/\.(png|svg|bmp|dib|jpe?g|gif|webp)$/i, "");
  return isAbsentRef(stem) ? null : stem;
}

function packPathFor(id, sourcePath) {
  const p = (sourcePath ?? "").replace(/\\/g, "/");
  if (p.includes("buttons/") || p.startsWith("buttons/")) return `images/buttons/${id}.svg`;
  if (p.includes("bitmaps/") || p.startsWith("bitmaps/")) return `images/bitmaps/${id}.svg`;
  return `images/bodymap/${id}.svg`;
}

const maps = {};
for (const [name, locs] of Object.entries(onelist.maps)) {
  const mg = onelist.mainGraphics[name] ?? {};
  const image = mg.imageId ?? stemFromPath(mg.picture);
  if (!image) continue;
  maps[name] = {
    image,
    concept: mg.concept,
    hotspot: mg.hotspot,
    rect: mg.rect ?? undefined,
    regions: locs.map((loc) => {
      const insetId = loc.insetImageId ?? stemFromPath(loc.inset);
      return {
        concept: loc.concept,
        label: loc.label ?? null,
        hotspot: loc.hotspot,
        ...(insetId && loc.insetRect ? { inset: { image: insetId, rect: loc.insetRect } } : {}),
        sublocations: (loc.sublocations ?? []).map((s) => ({
          concept: s.concept,
          label: s.label ?? null,
          hotspot: s.hotspot,
        })),
      };
    }),
  };
}

const selectors = onelist.selectors.map((sel, i) => ({
  id: sel.tsFlagType || `selector-${i + 1}`,
  label: sel.label,
  tsFlagType: sel.tsFlagType,
  style: sel.style,
  options: sel.options.map((o) => ({
    n: String(o.n),
    sex: o.sex === "F" || o.sex === "f" ? "F" : "M",
    label: o.label,
    system: o.system,
    anatomyMap: o.anatomyMap ?? "",
    ...(o.buttonIds?.[0] ? { buttonUp: o.buttonIds[0] } : {}),
    ...(o.buttonIds?.[1] ? { buttonDown: o.buttonIds[1] } : {}),
  })),
}));

const needed = new Set();
for (const m of Object.values(maps)) {
  if (m.image) needed.add(m.image);
  for (const r of m.regions) if (r.inset?.image) needed.add(r.inset.image);
}
for (const s of selectors) {
  for (const o of s.options) {
    if (o.buttonUp) needed.add(o.buttonUp);
    if (o.buttonDown) needed.add(o.buttonDown);
  }
}
needed.delete(null);
needed.delete(undefined);
needed.delete("");

const images = {};
const missing = [];
for (const id of [...needed].sort()) {
  const rec = manifest.images[id];
  if (!rec) {
    missing.push(`${id} (not in manifest)`);
    continue;
  }
  const srcName = rec.placeholder;
  const src = join(placeholders, srcName);
  if (!existsSync(src)) {
    missing.push(`${id} (missing placeholder ${srcName})`);
    continue;
  }
  const path = packPathFor(id, rec.originalRel);
  const dest = join(outDir, path);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  const folder = (rec.originalRel || "").split("/")[0];
  images[id] = {
    path,
    width: rec.width,
    height: rec.height,
    role: folder === "buttons" ? "button" : id.includes("_") && id.toLowerCase().includes("hnd") || folder === "bodymap"
      ? (maps && Object.values(maps).some((m) => m.image === id) ? "bodymap" : "inset")
      : folder === "bodymap" ? "bodymap" : "other",
  };
  if (folder === "bodymap") {
    images[id].role = Object.values(maps).some((m) => m.image === id) ? "bodymap" : "inset";
  }
}

if (missing.length) {
  console.error("Missing placeholder files:\n - " + missing.join("\n - "));
  process.exit(1);
}

const pack = {
  schema: "penpad-image-pack/v1",
  id: "cc0-placeholders",
  name: "CC0 placeholder outlines",
  version: "1.0.0",
  license: {
    name: "CC0 1.0 Universal",
    spdx: "CC0-1.0",
    url: "https://creativecommons.org/publicdomain/zero/1.0/",
    notice: "Original outline drawings by the remake authors, released under CC0 1.0. Not traced from the 1998 Clinergy artwork.",
  },
  description: "Built-in online pack for the PEN&PAD-style body-map remake. Coarse anatomical outlines with PLACEHOLDER · CC0 marks, plus the 1998 demo's hotspot geometry so the tracer walkthrough works until an alternative pack is uploaded.",
  attribution: "Placeholder artwork: CC0 1.0. Hotspot coordinates derived from the 1998 demo's Onelist.ini as extracted by clinergy-extractor (private study copy; coordinates are factual data about click regions).",
  coordinates: {
    hotspot: "top,bottom,left,right",
    insetRect: "left,top,width,height",
  },
  canvas: { width: 240, height: 330 },
  defaultMaps: { male: "MaleSurfaceAnatomy", female: "FemaleSurfaceAnatomy" },
  images,
  maps,
  selectors,
};

mkdirSync(outDir, { recursive: true });
const yaml = `# penpad-image-pack/v1 — built-in CC0 placeholder pack.
# Generated by scripts/build-cc0-pack.mjs from remake/data/bodymap-onelist.json
# and public/remake/placeholders/. See docs/image-pack.md.
${stringify(pack, { lineWidth: 120, indent: 2 })}`;
writeFileSync(join(outDir, "pack.yaml"), yaml);
writeFileSync(join(outDir, "pack.json"), JSON.stringify(pack, null, 2) + "\n");
console.log(`Wrote ${outDir} (${Object.keys(images).length} images, ${Object.keys(maps).length} maps)`);
