# Remake form generator

A deterministic generator turns a [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) output tree (`forms/**`, plus the usual sidecar YAML) into remake form definitions the data-entry UI can render.

Same input always yields byte-identical output: object keys are sorted, form ids are the extractor topic names, and the writer never emits timestamps. Unit tests run the generator twice and diff the bytes, and compare the result to a golden snapshot built from a synthetic fixture (not from the 1998 demo).

## Why generated catalogues are not in git

`data/README.md` allows only a small, already-approved form extract in this repository, and says not to add other forms from the 1998 demo. The generator therefore writes its catalogue at build time, next to the remake, and that directory is gitignored.

```sh
npx vite-node scripts/generate-remake-forms.ts --in /path/to/extractor-output --out public/remake/generated
```

That writes `forms.json` and a coverage report. Starting the remake (dev or a local preview of `dist`) fetches `remake/generated/forms.json` if it is present. A missing file is a normal 404: only the hand-built forms load. Nothing from the 1998 demo is committed or published by this step.

If a later decision allows a generated catalogue in the repository (the way `remake/data/topics-index.json` already includes catalogue names), the same command can write a reviewed snapshot. Until then, keep generated data local.

## Override mechanism

Hand-built forms win.

1. YAML files imported in `remake/src/knowledge-data.ts` (`data/ThumbPainSymptom.yaml`, `data/ThumbSwellingSymptom.yaml`, and the files under `data/forms/`) are the override set. They are parsed first.
2. If a generated catalogue is loaded, `formOf(topic)` returns the override when one exists, otherwise the generated form.

To take over a generated topic, add or edit a YAML file in that override set and register it in `FORM_YAML`. To stop overriding a topic, remove it from `FORM_YAML`. Overrides are compared by topic id only; the generated entry is left unused.

## What is generated

The generic parts of a form:

- Field types: laterality, sublocation, choice chips, quantity / duration rows (`TemporalValue` and other `*Value` tokens), and criterial-link rows (including `{attribute, value}` chips).
- Choices, defaults, and `visibleWhen` show/hide (the 1998 extract does not currently emit defaults or conditions; the remake honours them when present, including on overrides).
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
- Decide whether a generated catalogue may be committed once rights and `data/README.md` are reviewed.
