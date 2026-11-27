# Remake form generator

A deterministic generator turns a [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) output tree into remake form definitions, examination entry, and compact sentence knowledge. The remake uses this generated catalogue for **every** topic. Same input always yields byte-identical output: object keys are sorted, ids are the extractor topic and exam names, and the writer never emits timestamps. Unit tests run the generator twice and diff the bytes, and compare the result to golden snapshots built from a synthetic fixture (not from the 1998 demo).

## Committed catalogues

The generated catalogues are committed under `public/remake/generated/`:

- `forms.json` — every complete-topic form
- `exams.json` — the examination tree, plus incomplete-sign forms built from concept features (signs that have no complete-topic form YAML)
- `sentences.json` — compact sentence knowledge (rule tables, concept display / summary type / supers, locative links)

All three are text and structure only: no original images, no program source, no Read codes, no timestamps. Regenerate with:

```sh
npm run generate:forms -- --in /path/to/extractor-output --out public/remake/generated
```

That also writes a local `coverage.json` report, which is gitignored. CI checks that the committed catalogues are present and valid. When `PENPAD_EXTRACT_DIR` points at an extractor output tree, CI regenerates all three files and fails if any of them differs.

The remake fetches these files at startup, in parallel with the image pack. A missing forms file is a normal 404 and every topic shows as a stub until the catalogue is available. A missing exams or sentences file leaves examination entry and fallback sentence knowledge off until they load.

Hand-built YAML under `data/` (`ThumbPainSymptom.yaml`, `ThumbSwellingSymptom.yaml`, and `data/forms/`) is for the separate thumb-pain demo on the experimental workbench only. It is not loaded by the remake and does not override generated forms.

## What is generated

The generic parts of a form:

- Field types: laterality, sublocation, choice chips, quantity / duration rows (`TemporalValue` and other `*Value` tokens), and criterial-link rows (including `{attribute, value}` chips).
- Choices, defaults, and `visibleWhen` show/hide (the 1998 extract does not currently emit defaults or conditions; the remake honours them when present).
- First layer and the `>> more` layer.
- Associated symptoms/signs, diagnoses, and other links. `more…` opens the target topic in a modal window when that topic also has a loaded form.
- Examination entry, driven from `exams.yaml`. Per-side status chips come from the base sign's summary type (for example NormalNotEx → normal / not examined). `more…` opens signs and nested sub-exams. Incomplete signs (no complete-topic form) are generated from the concept's `visibleFeatures` and `criterialLinkSummaries`. Entry uses `signs0`. When `signs1` differs, the original names are kept for provenance; suffixes `S` and `S+` are stripped before resolving a sign, and the remake does not invent a second entry mode for them (their meaning is not spelled out in the extract).
- Findings used by the sentence generator, plus an "On Examination" block whose layout and wording follow the public thumb-pain walkthrough.

Read codes and provenance timestamps are stripped and never written. The remake UI does not use the name of the 1998 program. Patients remain Lars Nyström and Eva Holmgren.

## Sentences

The remake renderer is an original-equivalent implementation of the algorithm documented by the extractor and the public walkthrough (precedence, summary type, pre-coordinated vs prepositional head, numeric qualifiers, first-character capitalisation). It is not a copy of the 1998 engine (that source is not in this repository) and it does not wrap the workbench's vendored renderer (that copy has local tweaks).

`sentences.json` supplies the full extracted rule tables and a compact cut of concepts and locative links so generated-topic sentences are no longer limited to the trimmed thumb-demo extract. The extractor marks the lexicon scan as heuristic; missing lexicon entries still fall back as documented.

The extract does not store a large corpus of saved clinical sentences. The match set is the published walkthrough lines plus the extractor's thumb-pain findings fixture (ten cases, a superset of the five walkthrough sentences already in `data/expectations.yaml`). Uncertain or ungrounded rules are not invented.

## Coverage labels

- **full** — every generic field on the form is a supported construct, and every named examination resolves in the exam catalogue (an empty form, with only a comment box, counts as full).
- **partial** — the form renders, but at least one construct is an unknown row shape, or a named examination is missing from the exam catalogue.
- **none** — the document could not be turned into a form (the generator skips it; it is not in the catalogue).

Run the coverage report against a local extract to get totals. The synthetic fixture in `tests/fixtures/remake-form-generate/` is the regression source for the generator itself.
