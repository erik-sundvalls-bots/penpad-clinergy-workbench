# Validation cross-check

FerroEHR 5.5.0 accepts the coded OPT and all seven canonical fixtures, including a coded excluded diagnosis and its SNOMED mapping.

The workbench uses ehrtslib 0.13.0. FLAT is `serializeToFlat` of the canonical composition against the web template `buildWebTemplate` produces from `templates/thumb-pain.opt`, with `locatableName: "omit"`. There is no workbench FLAT path builder.

`RMSpecificationValidator.validate(instance)` with one argument walks the composition and checks `TERM_MAPPING.Match_valid` (`=`, `<`, `>`, `?`). `InvariantEvaluator.validateInvariants` with no invariant list returns an empty result. `TemplateValidator` runs with invariant checking on. An empty SECTION fails `SECTION.Items_valid`.

The shipped OPT still constrains `DV_DURATION.value` as INTEGER. ehrtslib 0.13 writes `C_DURATION` on a new export; this OPT was not re-exported, because FerroEHR already accepted it. The badge ignores that one "Expected integer, got string" report. Boolean `true` on examination-not-done now passes template validation, so that filter is gone.

`validateFlatPayload` still counts each `_mapping` key as another instance of a max-1 coded node. Those cardinality reports are not shown on the badge. The keys themselves are what FerroEHR accepts.

## Known FLAT gap against FerroEHR

`tests/fixtures/ferro-flat/known-gap.json` is the key-set difference after dropping `ctx/` and `_uid` and stripping the root (`thumb-pain-encounter.v2` versus FerroEHR's `encounter`). Same paths are not listed.

ehrtslib's web template tree id is the template id `thumb-pain-encounter.v2`. FerroEHR's web template tree id is `encounter`. That is the whole root difference.

After the root, ehrtslib also emits and FerroEHR does not:

- `/language|code` and `/language|terminology`, and `/territory|code` and `/territory|terminology`, on the composition
- `/composer|name`
- `/context/start_time` (bare) and `/context/setting|code`, `|value`, `|terminology`. FerroEHR puts the same facts in `ctx/time` and `ctx/setting`
- `/history/dv_text`, `/examination/dv_text`, `/assessment/dv_text` (the section name)
- `language` and `encoding` on each OBSERVATION and EVALUATION

Node ids that follow the OPT term text rather than FerroEHR's web template:

- Excluded concept is `.../excluded_concept`. The OPT term for at0003 is "Excluded concept". FerroEHR ids it `adverse_reaction_substance` from the first name-constraint code, at0008.
- Tenderness is `.../physical_examination_findings/tenderness/symptom_sign_name`. The OPT names that cluster Tenderness. FerroEHR ids it `symptom_sign`.

The canonical element name for an excluded diagnosis is still the local alternative at0004 Problem/diagnosis, and the value is `DV_CODED_TEXT` with its mappings. See `docs/ckm-change-requests.md` request 7.
