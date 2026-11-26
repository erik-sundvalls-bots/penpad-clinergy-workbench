import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import * as fflate from "fflate";
import { describe, expect, it } from "vitest";
import { PACK_SCHEMA } from "../remake/src/pack/types.ts";
import { assertValidPack, validatePack } from "../remake/src/pack/validate.ts";
import { bodyMapFromPack } from "../remake/src/pack/geometry.ts";
import { buildPackZip, openPackZip } from "../remake/src/pack/zip.ts";
import { anatomyMapFor, hitTest, insetForConcept, regionsOf } from "../remake/src/selector/hit.ts";
import type { ImagePack } from "../remake/src/pack/types.ts";

const BUILTIN = join(import.meta.dirname, "../public/remake/packs/cc0-placeholders");

function walkFiles(dir: string, prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (statSync(abs).isDirectory()) out.push(...walkFiles(abs, rel));
    else out.push(rel.replace(/\\/g, "/"));
  }
  return out;
}

function tinyPng(): Uint8Array {
  // 1×1 transparent PNG
  return Uint8Array.from(atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ), (c) => c.charCodeAt(0));
}

function minimalPack(over: Partial<ImagePack> = {}): ImagePack {
  return {
    schema: PACK_SCHEMA,
    id: "test-pack",
    name: "Test pack",
    version: "1.0.0",
    license: { name: "CC0 1.0", spdx: "CC0-1.0" },
    coordinates: { hotspot: "top,bottom,left,right", insetRect: "left,top,width,height" },
    canvas: { width: 240, height: 330 },
    defaultMaps: { male: "MaleSurfaceAnatomy", female: "MaleSurfaceAnatomy" },
    images: {
      M_main: { path: "images/bodymap/M_main.png", width: 240, height: 330, role: "bodymap" },
      B_fhnd: { path: "images/bodymap/B_fhnd.png", width: 96, height: 152, role: "inset" },
    },
    maps: {
      MaleSurfaceAnatomy: {
        image: "M_main",
        concept: "BodyAsAWhole",
        rect: [0, 0, 240, 330],
        regions: [
          {
            concept: "Hand",
            hotspot: [169, 202, 9, 40],
            inset: { image: "B_fhnd", rect: [7, 95, 96, 148] },
            sublocations: [{ concept: "Thumb", hotspot: [42, 99, 7, 37] }],
          },
        ],
      },
    },
    selectors: [
      {
        id: "symptom",
        label: "Symptom Selector",
        tsFlagType: "symptom",
        options: [{
          n: "1",
          sex: "M",
          label: "all",
          system: "FunctionalSystem",
          anatomyMap: "MaleSurfaceAnatomy",
          buttonUp: undefined,
        }],
      },
    ],
    ...over,
  };
}

describe("image pack validation", () => {
  it("accepts a minimal valid pack", () => {
    const pack = minimalPack();
    expect(validatePack(pack, ["images/bodymap/M_main.png", "images/bodymap/B_fhnd.png", "pack.yaml"])).toEqual([]);
  });

  it("rejects a wrong schema, missing files, unknown refs, and path traversal", () => {
    expect(validatePack({ ...minimalPack(), schema: "nope" }).some((i) => i.path === "schema")).toBe(true);
    expect(validatePack(minimalPack(), ["pack.yaml"]).some((i) => i.path.startsWith("images."))).toBe(true);
    const badMap = minimalPack();
    badMap.maps.MaleSurfaceAnatomy.image = "missing";
    expect(validatePack(badMap).some((i) => i.path.endsWith(".image"))).toBe(true);
    const traverse = minimalPack();
    traverse.images.M_main.path = "../secret.png";
    expect(validatePack(traverse).some((i) => i.message.includes(".."))).toBe(true);
  });
});

describe("built-in CC0 pack", () => {
  it("validates pack.yaml against the files on disk", () => {
    const raw = parseYaml(readFileSync(join(BUILTIN, "pack.yaml"), "utf8"));
    const files = walkFiles(BUILTIN);
    const issues = validatePack(raw, files);
    expect(issues).toEqual([]);
    const pack = assertValidPack(raw, files);
    expect(pack.id).toBe("cc0-placeholders");
    expect(pack.license.spdx).toBe("CC0-1.0");
    expect(pack.maps.MaleSurfaceAnatomy.image).toBe("M_main");
    const hand = pack.maps.MaleSurfaceAnatomy.regions.find((r) => r.concept === "Hand" && r.inset?.image === "B_fhnd");
    expect(hand?.hotspot).toEqual([169, 202, 9, 40]);
    expect(hand?.inset?.rect).toEqual([7, 95, 96, 148]);
    const thumb = hand?.sublocations?.find((s) => s.concept === "Thumb");
    expect(thumb?.hotspot).toEqual([42, 99, 7, 37]);
  });

  it("hit-tests the pack geometry the same way as the first remake slice", () => {
    const pack = assertValidPack(parseYaml(readFileSync(join(BUILTIN, "pack.yaml"), "utf8")));
    const data = bodyMapFromPack(pack);
    expect(anatomyMapFor(data, "male")).toBe("MaleSurfaceAnatomy");
    expect(anatomyMapFor(data, "female")).toBe("FemaleSurfaceAnatomy");
    const male = regionsOf(data, anatomyMapFor(data, "male"));
    const hand = insetForConcept(male, "Hand", "B_fhnd");
    expect(hand?.insetImageId).toBe("B_fhnd");
    expect(hand?.insetRect).toEqual([7, 95, 96, 148]);
    // A click on the front-hand inset's thumb hotspot.
    const x = 7 + (7 + 37) / 2;
    const y = 95 + (42 + 99) / 2;
    const hit = hitTest(x, y, male, hand);
    expect(hit.concept).toBe("Thumb");
    expect(hit.kind).toBe("sublocation");
  });
});

describe("pack zip open / wrap / zip-slip", () => {
  it("opens a pack zip and a single wrapping folder", () => {
    const pack = minimalPack();
    const files = [
      { path: "images/bodymap/M_main.png", bytes: tinyPng() },
      { path: "images/bodymap/B_fhnd.png", bytes: tinyPng() },
    ];
    const zip = buildPackZip(JSON.stringify(pack), "pack.json", files);
    const opened = openPackZip(zip);
    expect(opened.config.id).toBe("test-pack");
    expect(opened.files.has("images/bodymap/M_main.png")).toBe(true);

    const wrapped = buildPackZip(JSON.stringify(pack), "pack.json", files);
    // Re-wrap by hand: prefix entries.
    const { zipSync, unzipSync } = fflate;
    const inner = unzipSync(wrapped);
    const prefixed: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(inner)) prefixed[`my-pack/${k}`] = v as Uint8Array;
    const openedWrapped = openPackZip(zipSync(prefixed));
    expect(openedWrapped.config.id).toBe("test-pack");
    expect(openedWrapped.files.has("images/bodymap/M_main.png")).toBe(true);
    expect([...openedWrapped.files.keys()].some((k) => k.startsWith("my-pack/"))).toBe(false);
  });

  it("rejects a zip that tries to escape with .. entries, and a zip with no pack config", () => {
    const { zipSync, strToU8 } = fflate;
    expect(() => openPackZip(zipSync({ "readme.txt": strToU8("hi") }))).toThrow(/not an image pack/i);
    const pack = minimalPack();
    pack.images.M_main.path = "images/bodymap/M_main.png";
    const sneaky = zipSync({
      "pack.json": strToU8(JSON.stringify(pack)),
      "images/bodymap/M_main.png": tinyPng(),
      "images/bodymap/B_fhnd.png": tinyPng(),
      "../outside.png": tinyPng(),
    });
    const opened = openPackZip(sneaky);
    expect(opened.files.has("../outside.png")).toBe(false);
    expect(opened.files.has("outside.png")).toBe(false);
  });
});


describe("repo relative path for docs", () => {
  it("keeps the format doc at docs/image-pack.md", () => {
    const doc = readFileSync(join(import.meta.dirname, "../docs/image-pack.md"), "utf8");
    expect(doc).toContain("penpad-image-pack/v1");
    expect(relative(join(import.meta.dirname, ".."), BUILTIN).replace(/\\/g, "/")).toBe(
      "public/remake/packs/cc0-placeholders",
    );
  });
});
