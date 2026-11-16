# Validation cross-check

FerroEHR 5.5.0 rejected the seven generated compositions. Two causes were in the data: a SECTION with no items, and `TERM_MAPPING.match` of `~`. After those were removed, FerroEHR returned 201 for every canonical composition.

The downloadable coded OPT and `archetype_details.template_id` are `thumb-pain-encounter.v2`. FerroEHR's web template for that OPT has tree id `encounter`, so FLAT keys start with `encounter/`. The template id is not the FLAT root. ehrtslib 0.12.0 treats the template id as the FLAT root ([ehrtslib#312](https://github.com/ErikSundvall/ehrtslib/issues/312)); the badge passes the web template to `validateFlatPayload` only after setting `templateId` to the tree id. `templates/thumb-pain-encounter.v2.opt` is the uncoded reference and its template id is `thumb-pain-encounter.v2-uncoded`.

Date/time, duration and boolean leaves use the bare key. Coded text uses `|code`, `|value` and `|terminology`, and each TERM_MAPPING is `_mapping:N|match` plus `_mapping:N/target|code` and `|terminology`. Context is the `ctx/` block (`ctx/time`, `ctx/setting`, `ctx/language`, `ctx/territory`, `ctx/composer_name`), not `encounter/context/start_time|value`.

The OPT term for at0003 is "Excluded concept". Its name constraint lists at0008 Adverse reaction substance first. FerroEHR's web template ids that value node `adverse_reaction_substance` from that first name, and the FLAT follows it. The canonical element name stays the local alternative at0004 Problem/diagnosis.

An excluded diagnosis is `EVALUATION.exclusion_specific` at0003. The element name is the archetype's local alternative at0004 Problem/diagnosis. The value is `DV_CODED_TEXT` with its TERM_MAPPINGs. In FLAT that value is `encounter/assessment/exclusion_-_specific:N/adverse_reaction_substance`. See `docs/ckm-change-requests.md` request 7, tracked as GitHub issue #1.

The page checks a composition with ehrtslib 0.12.0 in three ways. `validateFlatPayload` is given the web template with `templateId` set to the tree id `encounter`, so it does not apply the template-id root from ehrtslib#312. It still counts each `_mapping` key as a second instance of the coded node, and it does not know `history_origin`. Those two reports are not shown on the badge. FerroEHR accepts both.

- `serialization.validateFlatPayload` against the web template built from the coded OPT
- `RMSpecificationValidator.validateInstance(rm, "COMPOSITION")`, which walks the whole composition. `validate(rm)` with one argument does not.
- `TemplateValidator` against `templates/thumb-pain.opt`, with invariant checking left off. The OPT carries no invariant list, and calling `InvariantEvaluator.validateInvariants` without one throws inside ehrtslib.

`Match_valid` is not implemented in ehrtslib 0.12.0. The page rejects a match code other than `=`, `<`, `>` or `?` itself.

The exported OPT constrains `DV_DURATION.value` as an integer and the examination-not-done boolean value as the string `True`. FerroEHR accepted the ISO-8601 duration and the boolean `true`, so the badge does not treat those two primitive mismatches as errors.
