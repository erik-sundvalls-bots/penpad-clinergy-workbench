# Validation cross-check

FerroEHR 5.5.0 rejected the seven generated compositions. Two causes were in the data: a SECTION with no items, and `TERM_MAPPING.match` of `~`. After those were removed, FerroEHR returned 201 for every canonical composition.

The downloadable coded OPT, `archetype_details.template_id`, and the web template / FLAT root are all `thumb-pain-encounter.v2`. The earlier FLAT root `encounter/` was the id FerroEHR's own web template used; this tree now uses the template id so the three identifiers match. `templates/thumb-pain-encounter.v2.opt` is the uncoded reference and its template id is `thumb-pain-encounter.v2-uncoded`.

An excluded diagnosis is `EVALUATION.exclusion_specific` at0003. The element name is the archetype's local alternative at0004 Problem/diagnosis. The value is `DV_CODED_TEXT` (Clinergy defining code and TERM_MAPPINGs). The published archetype constrains that value as `DV_TEXT`, and `DV_CODED_TEXT` is the subtype its comment asks to code. The OPT node is `DV_CODED_TEXT` so FLAT carries `|code`, `|value` and `|terminology`. ehrtslib 0.12.0 reports `DV_CODED_TEXT has no FLAT field` for a mappings suffix, so the TERM_MAPPINGs are in the canonical value only. See `docs/ckm-change-requests.md` request 7, tracked as GitHub issue #1.

The page checks a composition with ehrtslib 0.12.0 in three ways:

- `serialization.validateFlatPayload` against the web template built from the coded OPT
- `RMSpecificationValidator.validateInstance(rm, "COMPOSITION")`, which walks the whole composition. `validate(rm)` with one argument does not.
- `TemplateValidator` against `templates/thumb-pain.opt`, with invariant checking left off. The OPT carries no invariant list, and calling `InvariantEvaluator.validateInvariants` without one throws inside ehrtslib.

`Match_valid` is not implemented in ehrtslib 0.12.0. The page rejects a match code other than `=`, `<`, `>` or `?` itself.

The exported OPT constrains `DV_DURATION.value` as an integer and the examination-not-done boolean value as the string `True`. FerroEHR accepted the ISO-8601 duration and the boolean `true`, so the badge does not treat those two primitive mismatches as errors.
