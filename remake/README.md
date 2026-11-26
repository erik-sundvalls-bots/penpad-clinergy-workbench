# PEN&PAD-style body-map remake

A separate page in this project, published at:

**https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/remake/**

This is an independent recreation of a PEN&PAD / 1998 Clinergy-style data-entry experience in the browser. It is **not** named Clinergy and it is not the original program. See the in-app **About / credits** panel.

## This slice

- Gen-Demo-style host: patient header, record list, launch buttons (QDE SYM DIS CHK FH PMH INT).
- Patients: Lars Nyström and Eva Holmgren, from the [TermViz V8 demo](https://erik-sundvalls-bots.github.io/TermViz/prototyping/v8-multilingual-stack-demo.html?lang=en) (year of birth and sex only; nothing else is invented). Records are stored in `localStorage`. **Reset demo** clears those records; it is separate from **Reset** on a form.
- A Gen Demo-style host window (patient header, record, topic launch buttons) stays on a desktop-like background. The topic selector and form open as an overlapping data-entry window with Topics / form tabs, so the host remains visible.
- Symptom selector with a surface-anatomy body map (hover highlight, click to zoom insets, location filters the topic list).
- Thumb pain form with constrained-option controls, a live original-equivalent summary sentence, and Accept to save to the patient record. **more…** (for example thumb swelling) opens an overlapping child window, not a new page; Esc cancels it, Enter accepts when enabled, and the parent form plus its summary stay visible.
- Mouse and keyboard only in this version.

## Images and image packs

Artwork and all body-map hotspot coordinates travel together as an **image pack** (`penpad-image-pack/v1`). The format is documented in [`docs/image-pack.md`](../docs/image-pack.md).

The public build’s default artwork is a built-in **CC0 clinical vector** pack at `public/remake/packs/cc0-clinical-vector/` (new original drawings, dedicated to the public domain). The earlier CC0 outline placeholders remain at `public/remake/packs/cc0-placeholders/` and can be chosen in the **Image pack** window. That window (from the Image pack… button on the desktop, or the title-bar menu on the host and data-entry windows) lets you upload a pack zip — drop or file picker — keep several packs in IndexedDB, switch, remove, or revert to the built-in pack. `?pack=` with the URL of a pack zip also loads one. `?images=placeholders` forces the outline pack; `?images=local` still loads a private unpacked folder.

Original Clinergy images must **never** be committed or published. To load a locally produced pack **privately** on your machine, see [`local-originals/README.md`](local-originals/README.md). A CI / test guard fails if a fingerprint of any original image appears in the git tree or in `dist/` (the existing workbench extract `data/Mus_hand.png` is the only allowlisted path).

## Data

Form definitions, sentence rules, and topic indexes come from the extractor YAML already in `data/` plus remake-specific JSON under `remake/data/`. Body-map geometry is **not** read from those JSON files at runtime; it comes from the active image pack.

## Develop

```sh
npm install
npm test
npm run dev
# open http://127.0.0.1:5173/penpad-clinergy-workbench/remake/
```

The existing workbench remains at the site root and is not replaced by this page.
