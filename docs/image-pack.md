# Image pack format (`penpad-image-pack/v1`)

An **image pack** is a zip (or an unpacked folder with the same layout) that
carries everything that depends on a particular set of body-map pictures:

- the pictures themselves
- every hotspot / selection-area coordinate
- which picture belongs to which body map, inset, and selector button

The remake does not keep those coordinates in application code. Swapping the
pack is how you switch artwork **and** geometry. Alternative image sets with a
different size or layout work as long as their `pack.yaml` describes them.

This document is the canonical schema. The extractor (`clinergy-extractor`)
emits the same format. The built-in online pack is the CC0 clinical vector set at
`public/remake/packs/cc0-clinical-vector/`. The earlier CC0 outline
placeholders remain at `public/remake/packs/cc0-placeholders/` and can
be chosen in the Image pack window.

## Zip layout

```
pack.yaml          # required (pack.yml or pack.json also accepted)
images/
  bodymap/…        # maps and insets
  buttons/…        # selector option buttons
  bitmaps/…        # optional other artwork
```

A single wrapping folder is allowed (`my-pack/pack.yaml`, `my-pack/images/…`).
Paths inside the config are relative to the directory that contains `pack.yaml`
and must be posix paths with no `..`.

Do **not** put 1998 Clinergy originals in git, in `public/`, or in `dist/`. A
pack produced from the demo zip is a local study copy only.

## Config (`pack.yaml`)

```yaml
schema: penpad-image-pack/v1     # required, exact string
id: cc0-placeholders             # stable pack id (kebab-case recommended)
name: CC0 placeholder outlines
version: "1.0.0"                 # this pack's own version, not the schema id
license:
  name: CC0 1.0 Universal        # required
  spdx: CC0-1.0                  # optional
  url: https://creativecommons.org/publicdomain/zero/1.0/
  notice: |                      # optional, shown in the remake when the pack is active
    …
description: …                   # optional
attribution: …                   # optional credit / provenance

# Coordinate conventions — required, exact strings. Do not change the axis order.
coordinates:
  hotspot: "top,bottom,left,right"     # pixels on the picture being clicked
  insetRect: "left,top,width,height"   # placement of an inset on the graphic canvas

canvas: { width: 240, height: 330 }    # selector graphic size in 1× pixels
# Optional. Files’ native pixels = width/height × pixelRatio. 1, 2 or 4; default 1.
# Canvas, hotspots and inset rects always stay in 1× space. One pack per ratio is fine.
pixelRatio: 1
defaultMaps:
  male: MaleSurfaceAnatomy
  female: FemaleSurfaceAnatomy

images:
  M_main:
    path: images/bodymap/M_main.svg    # required, relative to pack.yaml
    width: 240                         # logical 1× size (hotspot / inset coordinate space)
    height: 330
    role: bodymap                      # optional: bodymap | inset | button | other
    # pixelRatio: 4                    # optional per-image override of the pack default
  B_fhnd:
    path: images/bodymap/B_fhnd.svg
    width: 96
    height: 152
    role: inset
  All1:
    path: images/buttons/All1.svg
    width: 32
    height: 32
    role: button

maps:
  MaleSurfaceAnatomy:
    image: M_main                      # image id, not a path
    concept: BodyAsAWhole
    rect: [0, 0, 240, 330]             # optional; [left, top, width, height]
    hotspot: [30, 324, 3, 236]         # optional MAINGRAPHIC box [top, bottom, left, right]
    regions:
      - concept: Hand
        label: null
        hotspot: [169, 202, 9, 40]     # on the map image
        inset:
          image: B_fhnd
          rect: [7, 95, 96, 148]       # where the inset is drawn on the canvas
        sublocations:
          - concept: Thumb
            hotspot: [42, 99, 7, 37]   # on the inset image, not the main figure

selectors:
  - id: symptom
    label: Symptom Selector
    tsFlagType: symptom
    style: Default
    options:
      - n: "1"
        sex: M                         # M or F
        label: all
        system: FunctionalSystem
        anatomyMap: MaleSurfaceAnatomy
        buttonUp: All1
        buttonDown: All2
```

### Rules

- `hotspot` is `[top, bottom, left, right]` in pixels of the picture being
  clicked (the map image for a region, the inset image for a sublocation).
  This is the convention used in the 1998 selector INI files.
- `inset.rect` and `map.rect` are `[left, top, width, height]`.
- Every `images.*.path` must exist in the zip / folder.
- Map `image`, inset `image`, and button ids must refer to keys under `images`.
- `defaultMaps` and each option’s `anatomyMap` must refer to keys under `maps`.
- `images.*.width` and `images.*.height` are the **logical 1× size** in the
  same coordinate space as hotspots and inset rects (for the main figures
  this is 240×330). They are not the file’s native pixel size when the pack
  ships a 2× or 4× raster.
- Optional `pixelRatio` (pack-level default, or a per-image override) is
  `1`, `2` or `4`. The file’s native pixels should be approximately
  `width × pixelRatio` by `height × pixelRatio`. The remake draws each
  picture at its logical 1× size so a 2× or 4× file stays sharp. A decoded
  size that does not match is a **warning**, not a validation failure.
  SVGs have no native raster size and are not size-checked. Shipping one
  pack per ratio (a 2× pack and a 4× pack) is the usual arrangement.
- JSON is accepted (`pack.json`) with the same fields. YAML is the usual form.

## How the remake uses a pack

1. **Built-in** — `public/remake/packs/cc0-clinical-vector/` is the default
   pack shipped with the site (CC0 clinical vector artwork; geometry from the
   extracted Onelist.ini). `public/remake/packs/cc0-placeholders/` is also
   shipped and can be selected in the Image pack window. `?images=placeholders`
   forces the outline pack.
2. **Upload** — the Image pack window accepts a `.zip` (file picker or
   drag-and-drop). It is unzipped client-side (`fflate`), validated, and stored
   in IndexedDB (`penpad-remake` / `packs`). Several uploaded packs can be kept
   at once; the active one is remembered until you switch, remove it, or revert
   to the default built-in pack. `?pack=` with an http(s) URL of a pack zip
   downloads and installs it the same way.
3. **Local dev** — `?images=local` loads `remake/local-originals/pack.yaml` and
   the files beside it (gitignored). Unzip a pack there, or have the extractor
   write one and unpack it. The Vite dev server serves this folder and does
   not copy it into `dist/`.

The hash-guard test still fails the build if a fingerprint of a 1998 original
image appears in the git tree or in `dist/`.

## Producing a pack from the 1998 demo

If you have your own copy of `ClinergyDemo.zip`, the extractor can write a
local pack after (or without re-running) a normal extract:

```sh
# during extract
deno task extract ClinergyDemo.zip out/clinergy-extract-out --image-pack

# or from an existing extract tree (no Wine run)
deno task image-pack out/clinergy-extract-out
# → out/clinergy-extract-out/penpad-image-pack-clinergy-1998.zip
```

That zip is gitignored. It is a private study copy of the 1998 artwork and
must not be committed, published, or uploaded to a public host.

## Building the committed CC0 pack

```sh
node scripts/build-cc0-pack.mjs
```

This copies `public/remake/placeholders/` into
`public/remake/packs/cc0-placeholders/` and writes `pack.yaml` / `pack.json`
from `remake/data/bodymap-onelist.json`. Runtime geometry is the pack, not
that JSON file.

## Versioning

`schema: penpad-image-pack/v1` is the format version. A future `v2` would be
a new schema id; older remakes should reject unknown schema values rather
than guess. The pack’s own `version` field is independent (artwork or
coordinate revisions inside the same schema).
