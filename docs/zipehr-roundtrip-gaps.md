# ZipEHR html5.short strict round-trip

With `propertyMode: "comment"`, `layout: "linesaving"`, `symbolVariant: "emoji"` (demo parity), `tests/zipehr-roundtrip.test.ts` asserts `zipehrHtml5ToCanonical(serializeToHtml5Variant(canonical))` equals the workbench canonical JSON for all seven Ferro regression cases.

**Status:** passing on ehrtslib `afa9901` (PR #322): html5 deserialize sibling order, `composer.name` / `PARTY_IDENTIFIED`, and related fixes are in the vendored bundle. Rebuild with `scripts/build_workbench_bundle.ts` after branch updates.

## Open gap: TERM_MAPPING codes containing `|` or `;`

The html5 `tm` attribute is `match|terminology::code` items joined by `;`, without escaping. A SNOMED CT expression with terms (`300955002 |Pain in thumb|`) contains `|`, so `zipehrHtml5ToCanonical` drops the mapping. A code containing `;` is cut at the `;`. This affects the story and diagnosis expressions (see README). The ZipEHR round-trip tests on generated visits fail until ehrtslib escapes these characters.
