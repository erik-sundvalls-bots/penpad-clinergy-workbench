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

const CLINICAL = join(import.meta.dirname, "../public/remake/packs/cc0-clinical-vector");
const PLACEHOLDERS = join(import.meta.dirname, "../public/remake/packs/cc0-placeholders");
const DAVINCI = join(import.meta.dirname, "../public/remake/packs/cc0-davinci-2x");
const BUILTIN = CLINICAL;

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

describe("built-in CC0 clinical vector pack", () => {
  it("validates pack.yaml against the files on disk", () => {
    const raw = parseYaml(readFileSync(join(BUILTIN, "pack.yaml"), "utf8"));
    const files = walkFiles(BUILTIN);
    const issues = validatePack(raw, files);
    expect(issues).toEqual([]);
    const pack = assertValidPack(raw, files);
    expect(pack.id).toBe("cc0-clinical-vector");
    expect(pack.license.spdx).toBe("CC0-1.0");
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
    expect(relative(join(import.meta.dirname, ".."), DAVINCI).replace(/\\/g, "/")).toBe(
      "public/remake/packs/cc0-davinci-2x",
    );
    expect(relative(join(import.meta.dirname, ".."), CLINICAL).replace(/\\/g, "/")).toBe(
      "public/remake/packs/cc0-clinical-vector",
    );
    expect(relative(join(import.meta.dirname, ".."), PLACEHOLDERS).replace(/\\/g, "/")).toBe(
      "public/remake/packs/cc0-placeholders",
    );
  });
});


describe("built-in CC0 Leonardo-style folio pack (default)", () => {
  it("validates pack.yaml against the files on disk", () => {
    const raw = parseYaml(readFileSync(join(DAVINCI, "pack.yaml"), "utf8"));
    const files = walkFiles(DAVINCI);
    expect(validatePack(raw, files)).toEqual([]);
    const pack = assertValidPack(raw, files);
    expect(pack.id).toBe("cc0-davinci-2x");
    expect(pack.license.spdx).toBe("CC0-1.0");
    expect(pack.pixelRatio).toBe(2);
    expect(Object.keys(pack.images)).toHaveLength(95);
    expect(pack.attribution).toMatch(/Leonardo-style art made with Google Antigravity/i);
    const text = [
      readFileSync(join(DAVINCI, "pack.yaml"), "utf8"),
      readFileSync(join(DAVINCI, "pack.json"), "utf8"),
      readFileSync(join(DAVINCI, "ORIGINALITY.txt"), "utf8"),
    ].join("\n");
    expect(text).not.toMatch(/clinergy/i);
  });

  it("hit-tests inset-local sublocation boxes the same way as the remake", () => {
    const pack = assertValidPack(parseYaml(readFileSync(join(DAVINCI, "pack.yaml"), "utf8")));
    const data = bodyMapFromPack(pack);
    const male = regionsOf(data, anatomyMapFor(data, "male"));
    const hand = insetForConcept(male, "Hand", "B_fhnd");
    expect(hand?.insetImageId).toBe("B_fhnd");
    expect(hand?.insetRect).toEqual([7, 95, 96, 148]);
    // A click on the front-hand inset's thumb hotspot (inset-local box, plus inset.rect).
    const x = 7 + (7 + 37) / 2;
    const y = 95 + (42 + 99) / 2;
    const hit = hitTest(x, y, male, hand);
    expect(hit.concept).toBe("Thumb");
    expect(hit.kind).toBe("sublocation");
  });
});

describe("built-in CC0 placeholder pack (still shipped)", () => {
  it("validates pack.yaml against the files on disk", () => {
    const raw = parseYaml(readFileSync(join(PLACEHOLDERS, "pack.yaml"), "utf8"));
    const files = walkFiles(PLACEHOLDERS);
    expect(validatePack(raw, files)).toEqual([]);
    const pack = assertValidPack(raw, files);
    expect(pack.id).toBe("cc0-placeholders");
    expect(pack.license.spdx).toBe("CC0-1.0");
  });
});

describe("pack catalog helpers", () => {
  it("merges built-in, uploaded, and local packs and marks the active one", async () => {
    const { mergePackList, nextActiveAfterRemove, userPackKey, resolvePackQueryUrl, DEFAULT_BUILTIN_KEY } = await import("../remake/src/pack/catalog.ts");
    const license = { name: "CC0 1.0", spdx: "CC0-1.0" as const };
    const item = (key: string, origin: "builtin" | "idb" | "local", id: string) => ({
      key, origin, id, name: id, version: "1.0.0", license, imageCount: 2, removable: origin === "idb", active: false,
    });
    const list = mergePackList(
      [item(DEFAULT_BUILTIN_KEY, "builtin", "cc0-clinical-vector")],
      [item("user:extra", "idb", "extra")],
      item("local", "local", "dev"),
      "user:extra",
    );
    expect(list.map((r) => r.key)).toEqual([DEFAULT_BUILTIN_KEY, "user:extra", "local"]);
    expect(list.find((r) => r.key === "user:extra")?.active).toBe(true);
    expect(list.find((r) => r.key === DEFAULT_BUILTIN_KEY)?.active).toBe(false);
    expect(nextActiveAfterRemove("user:extra", "user:extra", DEFAULT_BUILTIN_KEY)).toBe(DEFAULT_BUILTIN_KEY);
    expect(nextActiveAfterRemove("user:keep", "user:extra", DEFAULT_BUILTIN_KEY)).toBe("user:keep");
    expect(userPackKey("My Pack!")).toBe("user:My-Pack");
    expect(resolvePackQueryUrl("https://example.org/a.zip")).toBe("https://example.org/a.zip");
    expect(resolvePackQueryUrl("/packs/a.zip", "https://example.org/remake/")).toBe("https://example.org/packs/a.zip");
    expect(() => resolvePackQueryUrl("javascript:alert(1)")).toThrow(/http or https/i);
    expect(() => resolvePackQueryUrl("")).toThrow(/empty/i);
  });

  it("ships the Leonardo-style folio as the default built-in pack, with clinical and outline packs still listed", async () => {
    const { BUILTIN_CATALOG, DEFAULT_BUILTIN_KEY, defaultBuiltin } = await import("../remake/src/pack/catalog.ts");
    expect(DEFAULT_BUILTIN_KEY).toBe("builtin:cc0-davinci-2x");
    expect(defaultBuiltin().key).toBe(DEFAULT_BUILTIN_KEY);
    expect(defaultBuiltin().dir).toBe("remake/packs/cc0-davinci-2x");
    const keys = BUILTIN_CATALOG.map((b) => b.key);
    expect(keys).toEqual([
      "builtin:cc0-davinci-2x",
      "builtin:cc0-clinical-vector",
      "builtin:cc0-placeholders",
    ]);
    expect(BUILTIN_CATALOG.filter((b) => b.isDefault)).toHaveLength(1);
  });
});

describe("plain-language pack errors", () => {
  it("explains a missing pack.yaml, a bad schema, and a failed download", async () => {
    const { formatPackError, formatPackIssues } = await import("../remake/src/pack/errors.ts");
    expect(formatPackError(new Error("This zip is not an image pack: missing pack.yaml or pack.json (at the root or inside a single folder).")))
      .toMatch(/not an image pack/i);
    expect(formatPackError(new Error('Invalid image pack:\n - schema: must be "penpad-image-pack/v1" (got "nope")')))
      .toMatch(/not supported/i);
    expect(formatPackError(new Error("The pack could not be downloaded (HTTP 404).")))
      .toMatch(/HTTP 404/);
    expect(formatPackError(new Error("Failed to fetch"))).toMatch(/could not be downloaded/i);
    expect(formatPackIssues([{ path: "images.M_main.path", message: "file missing from pack: images/bodymap/M_main.svg" }]))
      .toMatch(/missing a picture/i);
  });
});

describe("clinical pack zip round-trip", () => {
  it("opens a zip built from the shipped clinical folder", () => {
    const files = walkFiles(CLINICAL);
    const entries = files
      .filter((rel) => rel !== "pack.yaml" && rel !== "pack.json" && rel !== "CC0-LICENSE.txt")
      .map((rel) => ({ path: rel, bytes: new Uint8Array(readFileSync(join(CLINICAL, rel))) }));
    const yaml = readFileSync(join(CLINICAL, "pack.yaml"), "utf8");
    const zip = buildPackZip(yaml, "pack.yaml", entries);
    const opened = openPackZip(zip);
    expect(opened.config.id).toBe("cc0-clinical-vector");
    expect(opened.files.has("images/bodymap/M_main.svg")).toBe(true);
    expect(opened.files.has("images/bodymap/B_fhnd.svg")).toBe(true);
  });
});


describe("pixelRatio", () => {
  it("defaults to 1, accepts pack-level and per-image 2 or 4, and rejects other values", async () => {
    const { packPixelRatio, imagePixelRatio, nativePixelSize } = await import("../remake/src/pack/pixel-ratio.ts");
    const pack = minimalPack();
    expect(packPixelRatio(pack)).toBe(1);
    expect(nativePixelSize(pack, pack.images.M_main)).toEqual({ width: 240, height: 330 });
    pack.pixelRatio = 2;
    expect(packPixelRatio(pack)).toBe(2);
    expect(nativePixelSize(pack, pack.images.M_main)).toEqual({ width: 480, height: 660 });
    pack.images.B_fhnd.pixelRatio = 4;
    expect(imagePixelRatio(pack, pack.images.B_fhnd)).toBe(4);
    expect(nativePixelSize(pack, pack.images.B_fhnd)).toEqual({ width: 384, height: 608 });
    expect(validatePack({ ...minimalPack(), pixelRatio: 3 }).some((i) => i.path === "pixelRatio")).toBe(true);
    const bad = minimalPack();
    bad.images.M_main.pixelRatio = 3 as 1;
    expect(validatePack(bad).some((i) => i.path === "images.M_main.pixelRatio")).toBe(true);
    expect(validatePack({ ...minimalPack(), pixelRatio: 4 })).toEqual([]);
  });

  it("warns, but does not fail validation, when a raster’s pixels are not width × pixelRatio", async () => {
    const { imageSizeWarnings, readRasterSize } = await import("../remake/src/pack/pixel-ratio.ts");
    // 2×2 PNG
    const png2 = Uint8Array.from(atob(
      "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEElEQVR4nGNgYGD4D8UQBgAd9AP9yOH2qAAAAABJRU5ErkJggg==",
    ), (c) => c.charCodeAt(0));
    expect(readRasterSize(png2, "x.png")).toEqual({ width: 2, height: 2 });
    const pack = minimalPack();
    pack.pixelRatio = 2;
    pack.images.M_main.path = "images/bodymap/M_main.png";
    pack.images.M_main.width = 1;
    pack.images.M_main.height = 1;
    pack.images.B_fhnd.path = "images/bodymap/B_fhnd.png";
    pack.images.B_fhnd.width = 10;
    pack.images.B_fhnd.height = 10;
    const files = new Map<string, Uint8Array>([
      ["images/bodymap/M_main.png", png2],
      ["images/bodymap/B_fhnd.png", png2],
    ]);
    expect(validatePack(pack, files.keys())).toEqual([]);
    const warnings = imageSizeWarnings(pack, files);
    expect(warnings.some((w) => w.path === "images.B_fhnd" && /warning only/i.test(w.message))).toBe(true);
    expect(warnings.some((w) => w.path === "images.M_main")).toBe(false);
  });
});
