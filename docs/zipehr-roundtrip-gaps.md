# ZipEHR html5.short strict round-trip

With `propertyMode: "comment"`, `layout: "linesaving"`, `symbolVariant: "emoji"` (demo parity), `tests/zipehr-roundtrip.test.ts` asserts `zipehrHtml5ToCanonical(serializeToHtml5Variant(canonical))` equals the workbench canonical JSON for all seven Ferro regression cases.

**Status:** passing on ehrtslib `afa9901` (PR #322): html5 deserialize sibling order, `composer.name` / `PARTY_IDENTIFIED`, and related fixes are in the vendored bundle. Rebuild with `scripts/build_workbench_bundle.ts` after branch updates.