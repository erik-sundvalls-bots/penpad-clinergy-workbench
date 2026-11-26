# PEN&PAD-style body-map remake

A separate page in this project, published at:

**https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/remake/**

This is an independent recreation of a PEN&PAD / 1998 Clinergy-style data-entry experience in the browser. It is **not** named Clinergy and it is not the original program. See the in-app **About / credits** panel.

## This slice

- Gen-Demo-style host: patient header, record list, launch buttons (QDE SYM DIS CHK FH PMH INT).
- Patients: Lars Nyström and Eva Holmgren, from the [TermViz V8 demo](https://erik-sundvalls-bots.github.io/TermViz/prototyping/v8-multilingual-stack-demo.html?lang=en) (year of birth and sex only; nothing else is invented). Records are stored in `localStorage`. **Reset demo** clears those records; it is separate from **Reset** on a form.
- Symptom selector with a surface-anatomy body map (hover highlight, click to zoom insets, location filters the topic list).
- Thumb pain form (and thumb swelling / thumb diagnoses opened from it) with constrained-option controls, a live original-equivalent summary sentence, and Accept to save to the patient record.
- Mouse and keyboard only in this version.

## Images and image packs

Artwork and all body-map hotspot coordinates travel together as an **image pack** (`penpad-image-pack/v1`). The format is documented in [`docs/image-pack.md`](../docs/image-pack.md).

The public build ships a built-in pack of CC0 placeholders at `public/remake/packs/cc0-placeholders/` (simple self-made outlines, clearly marked placeholder). You can upload a different pack zip in the browser; it is unzipped client-side and stored in IndexedDB until you revert to the built-in pack.

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
