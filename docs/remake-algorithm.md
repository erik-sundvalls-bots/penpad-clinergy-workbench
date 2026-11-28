# Remake algorithm

End-to-end notes for the body-map remake: how catalogues are built from extract inputs, how forms and exam trees are laid out, how summary sentences are rendered, and how black-box conformance is checked. Wording was aligned to the original 1998 program by behavioural comparison only; this repository does not contain that program's binaries, images, or source.

Related: [remake form generator](remake-form-generator.md), [form-difference harness](form-difference-harness.md). Live remake: the `/remake/` page of this project.

## Extraction inputs

- Input is an extractor output tree (YAML/JSON tables of concepts, links, visible features, exams, and sentence rules). Neutral names only; no original program title in the remake UI.
- Driver: `scripts/generate-remake-forms.ts` (`npm run generate:forms -- --in <extract-dir> --out public/remake/generated`).
- Load + generate:
  - Forms: `remake/src/form/generate.ts` — `loadExtractFromDir`, `generateRemakeForms`, `formFromExtractDoc`.
  - Exams: `remake/src/form/exams.ts` — `generateRemakeExams`.
  - Sentence tables: `remake/src/sentence/generate.ts` — `generateSentenceKnowledge`.
- Output (committed, text only): `public/remake/generated/{forms,exams,sentences}.json`. Runtime load: `remake/src/form/catalog.ts`, `remake/src/knowledge-data.ts` (`setGeneratedForms`, `setGeneratedExams`, `applyGeneratedSentenceKnowledge`).
- Forbidden in catalogues: original images, program source, Read codes, timestamps (`stripForbidden` in `generate.ts`).

## Form generation

- **Catalogues:** 2,121 complete-topic forms in `forms.json`; exam definitions and incomplete-sign forms in `exams.json`; compact sentence knowledge in `sentences.json`.
- **Field layout:** typ-driven rows in `formFromExtractDoc` (choice, typ=2 numeric, typ=3 laterality, typ=4 sublocation, typ=5 criterial/consequence, typ=6 empty-caption `>> more` group). Captions from extract labels plus harvest `remake/src/form/form-captions.json`.
- **Presentation overrides:** `remake/src/form/form-layout.ts` — `applyFormFieldLayout` (applied in `formOf`). Vaccination stage vs status, family-history strength/relation, normality, drinking/smoking, a few laterality rows, lymph-node laterality, Sciatica sublocation.
- **Units:** `remake/src/form/quantities.ts` (family default units); rows carry `units` / `defaultUnit`.
- **Sublocation inheritance:** `remake/src/form/exam-tree.ts` — `resolveExamSiteLocation`, `inheritedSublocationRow`, harvest `exam-sublocations.json`. Respiratory exams map to Thorax (12 zones).
- **Exam tree captions:** `examTreeCaption`, `signTreeCaption`, `examSignTreeCaption`, `locativeExamSignCaption`, `sidedExamCaption`; harvests `exam-captions.json`, `exam-locative-signs.json` (plus form-scoped `formPairs`), `exam-inline-values.json`. Appearance vs Features folders; loin kidney Appearance; uterus/cervix Features on named forms.
- **Extra exam signs:** `examSignsFor` / `exam-extra-signs.json`; missing incomplete-sign forms in `exam-sign-forms.json` (merged in `setGeneratedExams`).
- **Site / laterality exams:** form `examinations[]` entries have `exam`, optional `perSide` (`[left, right]`), `signs`, `subExams`. Exam definitions may also be `lateral`. UI: `remake/src/app.ts` (`examSection`, `examPopupWindow`, `examSignBlock`). Laterality on a sign is hidden when the parent exam is already sided.
- **Per-site state keys:** `remake/src/form/engine.ts` — `examSignKey(siteExam, sign)` so the same sign on two sites does not share values; `siteStatus[siteExam]` for nested sub-exam status (one key per sub-exam, not a split of nested laterals).

## Sentence generation

Entry: `renderSentence` / `renderSentenceReport` in `remake/src/sentence/render.ts`. Findings come from `findingsFromForm` in `engine.ts` (optional exam findings via `findingsFromExams`).

- **Ordering:** qualifier phrases are built in `phraseOf`, split into before/after the head, sorted by descriptor then value precedence (`closerLast` / `closerFirst`).
- **Head / locatives:** `headOf`, `grammaticalHead`, `shouldExpandHead`, `isInherentLocation`, `resolveLocation`. A unique usual site stays pre-coordinated (`thumb pain`); laterality, a non-unique site, or a sub-location switches to a prepositional head (`Pain in right hypochondrium`). Bare locative tokens are parsed in `remake/src/sentence/knowledge.ts` (`parseLocative`).
- **Laterality:** `insertLaterality` and trailing-site insertion (`cold left lower leg`, `clicking of left knee`). Named complete diseases keep their default-site head (`sciatica`) and may prefer the first sanctioned site when laterality is set on a generic last link.
- **Sublocation:** relative parts keep the parent site (`quadrant of breast`, `toe nail of fifth toe`); skip a parent already named in the sublocation; vague `temporal region` keeps `of head`, but `posterior ribs region` does not add `of back`.
- **Presence / negation:** implicit default summaries are omitted (`presence` on PresentPossibleExcluded, `yesPMH`, `done`). `nonePresent` and several absence tokens render as `no`. Consequences use short phrases (`painless` / `non itching`); a lexicon adjective that already starts with `non`/`not` is not followed by a second `no`.
- **Quantity phrasing:** numeric rules in `phraseOf` / `numericPhrase` — descriptor-first (`for 3 days`) vs value-first (`2 weeks ago`). Units via `unitWord` / `pluralizeEn`.
- **Other wording:** `DESCRIPTOR_PHRASE_PREFIX` (`aggravated by`, `from`, `caused by`); `AbsoluteDizzDescriptor` is parenthesized (`dizziness (rotation of self)`).
- **On Examination:** `remake/src/exam/prose.ts` — `onExamination` layouts site-labelled lines from exam findings (locative dropped when the site label already names the place).

## Black-box conformance harness

- Compares remake catalogues + `renderSentence` to the original 1998 program's runtime behaviour (form structure and sentences) across all 2,121 forms. Behavioural only; no decompilation.
- **What it compares:** structure (field order, captions, value lists, numeric rows, associated/diagnosis/intervention lists, exam trees) and sentence strings on a fixed case list.
- **Oracle fixture in this repo:** `tests/fixtures/remake-sentence-match/oracle-engine.json` — derived expected strings and structured findings (public catalogue tokens only). Checked by `tests/remake-sentence-oracle.test.ts`.
- **Raw runner** (original-program probe, full dumps, case generation) is kept **outside the repo**. See [form-difference harness](form-difference-harness.md). Do not commit binaries, dumps, or the probe.
