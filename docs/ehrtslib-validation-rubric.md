# ehrtslib template rubric warnings (PR #322)

## Symptom

With ehrtslib 0.13.0 `TemplateValidator` (`validateTerminology: true`), thumb-pain compositions showed three false-positive **warnings**:

- `local::at0004` rubric resolved as **Problem/diagnosis** while the instance value is **Right** (laterality).
- `local::at0003` resolved as **Excluded concept** while the value is **Left** (laterality).
- `local::at0024` resolved as **No** while the value is **Moderate** (severity).

Ferro-accepted canonical fixtures and the workbench composer use the correct codes for each archetype node; this is not a Clinergy data bug.

## Root cause (ehrtslib)

`lookupTemplateRubric()` in `validation/template_validator.ts` scans **all** template term tables and returns the **first** rubric for an `at` code. Archetype-local codes such as `at0003` / `at0004` / `at0024` are reused across archetypes in the same OPT, so a laterality value can be checked against a rubric from problem diagnosis or screening.

## Status (ehrtslib `afa9901`, PR #322)

Fixed upstream in `validation/template_validator.ts` (`3025e5e`). The workbench vendored bundle at `afa9901` includes the fix; no local patch at rebuild.