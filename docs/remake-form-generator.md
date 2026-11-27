# Remake form generator

A deterministic generator turns a [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) output tree into remake form definitions. The remake uses this generated catalogue for **every** topic. Same input always yields byte-identical output: object keys are sorted, form ids are the extractor topic names, and the writer never emits timestamps. Unit tests run the generator twice and diff the bytes, and compare the result to a golden snapshot built from a synthetic fixture (not from the 1998 demo).

## Committed catalogue

The generated catalogue is committed at `public/remake/generated/forms.json` (text and structure only: no original images, no program source, no Read codes, no timestamps). It is regenerated with:

```sh
npm run generate:forms -- --in /path/to/extractor-output --out public/remake/generated
```

That also writes a local `coverage.json` report, which is gitignored. CI checks that the committed catalogue is present and valid. When `PENPAD_EXTRACT_DIR` points at an extractor output tree, CI regenerates the catalogue and fails if `forms.json` differs.

The remake fetches this file at startup, in parallel with the image pack. A missing file is a normal 404 and every topic shows as a stub until the catalogue is available.

Hand-built YAML under `data/` (`ThumbPainSymptom.yaml`, `ThumbSwellingSymptom.yaml`, and `data/forms/`) is for the separate thumb-pain demo on the experimental workbench only. It is not loaded by the remake and does not override generated forms.

## What is generated

The generic parts of a form:

- Field types: laterality, sublocation, choice chips, quantity / duration rows (`TemporalValue` and other `*Value` tokens), and criterial-link rows (including `{attribute, value}` chips).
- Choices, defaults, and `visibleWhen` show/hide (the 1998 extract does not currently emit defaults or conditions; the remake honours them when present).
- First layer and the `>> more` layer.
- Associated symptoms/signs, diagnoses, and other links. `more…` opens the target topic in a modal window when that topic also has a loaded form.
- Findings used by the existing sentence generator.

Examinations are listed on the form but the entry UI is still a stub, so any form that names an examination is reported as **partial**.

Read codes and provenance timestamps are stripped and never written. The remake UI does not use the name of the 1998 program. Patients remain Lars Nyström and Eva Holmgren.

## Coverage labels

- **full** — every generic field on the form is a supported construct (an empty form, with only a comment box, counts as full).
- **partial** — the form renders, but at least one construct is stubbed (today: examinations) or is an unknown row shape.
- **none** — the document could not be turned into a form (the generator skips it; it is not in the catalogue).

Run the coverage report against a local extract to get totals. The synthetic fixture in `tests/fixtures/remake-form-generate/` is the regression source for the generator itself.

## Next slices

- Drive examination entry from `exams.yaml` (nested signs, per-side exams) so those forms can move from partial to full.
- Optionally load full sentence-rules / concepts from the same local extract so summary sentences for generated topics are as complete as the thumb-path ones.
