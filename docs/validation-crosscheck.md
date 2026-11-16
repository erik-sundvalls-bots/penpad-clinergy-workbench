# Validation cross-check

FerroEHR 5.5.0 accepts the coded OPT and all seven canonical fixtures, including a coded excluded diagnosis and its SNOMED mapping.

The workbench uses ehrtslib 0.13.0. FLAT is `serializeToFlat` of the canonical composition, with `locatableName: "omit"` and `flavor: "input"`, against `templates/thumb-pain-encounter.v2.web-template.json`. That file is the web template FerroEHR 5.5.0 exported for the coded OPT. Its tree id is `encounter`. There is no workbench FLAT path builder and no `buildWebTemplate` call.

`RMSpecificationValidator.validate(instance)` with one argument walks the composition and checks `TERM_MAPPING.Match_valid` (`=`, `<`, `>`, `?`). `InvariantEvaluator.validateInvariants` with no invariant list returns an empty result. `TemplateValidator` runs with invariant checking on. An empty SECTION fails `SECTION.Items_valid`.

The shipped OPT still constrains `DV_DURATION.value` as INTEGER. ehrtslib 0.13 writes `C_DURATION` on a new export; this OPT was not re-exported, because FerroEHR already accepted it. The badge ignores that one "Expected integer, got string" report. Boolean `true` on examination-not-done now passes template validation, so that filter is gone.

`validateFlatPayload` still counts each `_mapping` key as another instance of a max-1 coded node. Those cardinality reports are not shown on the badge. The keys themselves are what FerroEHR accepts.

Posting that FLAT to FerroEHR 5.5.0 returns 201 for all seven cases. Compared with FerroEHR's own read-back export, after dropping `ctx/` and `_uid`, every generated key is in the export. The export also contains `history_origin` and `any_event:N/time`. `history_origin` is not a node in this web template. The input flavor omits event time when it equals `ctx/time`. The key-set test requires those to be the only keys present in the export and absent from `serializeToFlat`.
