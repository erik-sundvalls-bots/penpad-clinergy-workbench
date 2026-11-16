# Validation and CDR posting

FerroEHR 5.5.0 accepts the coded OPT and all seven canonical fixtures under `tests/fixtures/ferro/`, including a coded excluded diagnosis and its SNOMED mapping.

## Canonical output and validation

The workbench uses ehrtslib 0.13.0. Compositions are built as **canonical RM JSON** in `src/openehr/compose.ts`. The live page validates with `RMSpecificationValidator` and `TemplateValidator` against `templates/thumb-pain.opt` only — there is no FLAT derivation, `validateFlatPayload`, or web-template cross-check in this app.

`RMSpecificationValidator.validate(instance)` walks the composition and checks `TERM_MAPPING.Match_valid` (`=`, `<`, `>`, `?`). `TemplateValidator` runs with invariant checking on. An empty SECTION fails `SECTION.Items_valid`.

## Why FLAT was dropped

ehrtslib’s FLAT serializer and FerroEHR’s read-back exports still disagree on several conventions ([ehrtslib #316](https://github.com/ErikSundvall/ehrtslib/issues/316), [#317](https://github.com/ErikSundvall/ehrtslib/issues/317), [PR 318](https://github.com/ErikSundvall/ehrtslib/pull/318)): `history_origin`, event `time` vs `ctx/time`, `_mapping` cardinality, and related web-template node shapes. Canonical JSON from the workbench is RM-valid and matches the Ferro-accepted fixtures; FerroEHR, EHRbase, and Better all accept canonical composition POST on openEHR REST.

FLAT-specific regression fixtures were removed from this repo once canonical posting became the supported path.

## Posting canonical JSON to a CDR

Use openEHR REST:

```http
POST {base}/ehr/{ehr_id}/composition?templateId=thumb-pain-encounter.v2
Content-Type: application/json
Prefer: return=representation
```

The helper `src/openehr/post.ts` and script `npm run post:cdr` post all seven regression cases. Set:

- `OPENEHR_BASE_URL` — CDR root (e.g. `https://ferro.example/openehr/v1`)
- `OPENEHR_EHR_ID` — target EHR
- `OPENEHR_BASIC_AUTH` — optional `user:password`

The script exits non-zero if env vars are missing, validation fails, or any POST is not 2xx.