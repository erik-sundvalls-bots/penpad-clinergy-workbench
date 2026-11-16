# Validation cross-check

FerroEHR 5.5.0 rejected the seven generated compositions. Two causes were in the data: a SECTION with no items, and `TERM_MAPPING.match` of `~`. After those were removed, FerroEHR returned 201 for every canonical composition. The FLAT root FerroEHR accepts is `encounter/`, with the node ids in `templates/thumb-pain.webtemplate.json`.

The page checks a composition with ehrtslib 0.12.0 in three ways:

- `serialization.validateFlatPayload` against the web template built from the coded OPT
- `RMSpecificationValidator.validateInstance(rm, "COMPOSITION")`, which walks the whole composition. `validate(rm)` with one argument does not.
- `TemplateValidator` against `templates/thumb-pain.opt`, with invariant checking left off. The OPT carries no invariant list, and calling `InvariantEvaluator.validateInvariants` without one throws inside ehrtslib.

`Match_valid` is not implemented in ehrtslib 0.12.0. The page rejects a match code other than `=`, `<`, `>` or `?` itself.

The exported OPT constrains `DV_DURATION.value` as an integer and the examination-not-done boolean value as the string `True`. FerroEHR accepted the ISO-8601 duration and the boolean `true`, so the badge does not treat those two primitive mismatches as errors.
