# Form difference harness

A box-only runner compares the remake's generated catalogues and sentence
renderer to the original 1998 program, across all 2,121 forms.
The algorithm those catalogues and the renderer implement is in [remake algorithm](remake-algorithm.md).

The runner compares:

- **Structure:** runtime form specs (descriptor order, captions, value
  lists, numeric / many-valued fields, associated / diagnosis /
  intervention lists, exam trees) vs `forms.json` / `exams.json` /
  `sentences.json`.
- **Sentences:** a deterministic sample of inputs run through both
  sentence generators.

The runner, the probe, and raw dumps stay on the box (see
`/workspace/penpad-interviews/form-diff/README.md`). They must not be
committed here. This repository only takes **derived** artefacts:

- `remake/src/form/form-captions.json` — field captions harvested by
  majority vote from the original runtime specs, keyed by remake
  feature. `generateRemakeForms` writes these onto form rows so the UI
  shows "how long ago?", "pattern", "aggravated by", etc., instead of
  humanized token names.
- Regression tests under `tests/remake-form-captions.test.ts` and the
  existing quantity oracle fixture.

After changing captions, regenerate:

```bash
npx vite-node scripts/generate-remake-forms.ts --in <extract-dir> --out public/remake/generated
```
