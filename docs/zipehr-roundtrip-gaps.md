# ZipEHR html5.short strict round-trip

With `propertyMode: "comment"`, `layout: "linesaving"`, `symbolVariant: "emoji"` (demo parity), `tests/zipehr-roundtrip.test.ts` asserts `zipehrHtml5ToCanonical(serializeToHtml5Variant(canonical))` equals the workbench canonical JSON for all seven Ferro regression cases.

**Status:** passing on ehrtslib `afa9901` (PR #322): html5 deserialize sibling order, `composer.name` / `PARTY_IDENTIFIED`, and related fixes are in the vendored bundle. Rebuild with `scripts/build_workbench_bundle.ts` after branch updates.

## TERM_MAPPING codes containing `|` or `;`

The html5 `tm` attribute (`match|terminology::code` items joined by `;`) escapes `%`, `|` and `;` in its fields as of ehrtslib **v0.20.0** (PR #326 / issue #325). SNOMED CT expressions with terms on the story and diagnosis text round-trip cleanly on the released v0.20 bundle; see `vendor/ehrtslib/README.md`.
