# Validation and CDR posting

FerroEHR 5.5.0 accepts the coded OPT and all seven canonical fixtures under `tests/fixtures/ferro/`, including a coded excluded diagnosis and its SNOMED mapping.

## Canonical output and validation

The workbench uses ehrtslib 0.20.0. Compositions are built as **canonical RM JSON** in `src/openehr/compose.ts`. The live page validates with `RMSpecificationValidator` and `TemplateValidator` against `templates/thumb-pain.opt`. **Canonical XML**, **Simplified** (FLAT/STRUCTURED with `cdrProfile`), and **ZipEHR** tabs are view/export only (`src/openehr/serialization-views.ts`, `src/openehr/zipehr.ts`); CDR posting uses canonical JSON only. The Simplified tab does not run `validateFlatPayload` or post to a CDR.

`RMSpecificationValidator.validate(instance)` walks the composition and checks `TERM_MAPPING.Match_valid` (`=`, `<`, `>`, `?`). `TemplateValidator` runs with invariant checking on. An empty SECTION fails `SECTION.Items_valid`.

## FLAT and the workbench UI

**Posting format:** canonical RM JSON only (`npm run post:cdr`).

**Workbench UI:** Simplified FLAT/STRUCTURED is available for inspection and download only (vendor dialect via `cdrProfile`). It is not posted. ZipEHR html5 is for human reading.

**ehrtslib ↔ Ferro FLAT:** Library-side FLAT/`cdrProfile` conventions ([ehrtslib #316](https://github.com/ErikSundvall/ehrtslib/issues/316), [PR 318](https://github.com/ErikSundvall/ehrtslib/pull/318)) and the `_mapping` cardinality fix ([#317](https://github.com/ErikSundvall/ehrtslib/issues/317)) landed in ehrtslib 0.14 and are in this 0.20 bundle. A live FLAT post with those conventions has still not been tried, and we do **not** claim FerroEHR accepts ehrtslib FLAT in general. Canonical JSON from the workbench is RM-valid and matches the Ferro-accepted fixtures; FerroEHR, EHRbase, and Better accept canonical composition POST on openEHR REST.

FLAT-specific regression fixtures were removed from this repo when canonical posting became the supported path here.

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