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

## Images

The public build uses the CC0 placeholders in `public/remake/placeholders/` (simple self-made outlines, clearly marked placeholder). Original Clinergy images must **never** be committed or published.

A pluggable image source maps logical ids (`M_main`, `B_fhnd`, `All1`, …) from `remake/data/images-manifest.json` to files. Switch modes with `?images=local` or the host-screen control.

To load originals **privately** on your machine, see [`local-originals/README.md`](local-originals/README.md). A CI / test guard fails if a fingerprint of any original image appears in the git tree or in `dist/` (the existing workbench extract `data/Mus_hand.png` is the only allowlisted path).

## Data

Form definitions, sentence rules, and body-map coordinates come from the extractor YAML already in `data/` plus remake-specific JSON under `remake/data/` (hotspots, topic index, location–topic links). Those are data, not images.

## Develop

```sh
npm install
npm test
npm run dev
# open http://127.0.0.1:5173/penpad-clinergy-workbench/remake/
```

The existing workbench remains at the site root and is not replaced by this page.
