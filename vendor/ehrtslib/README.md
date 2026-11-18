Runtime browser bundle for this workbench, built from [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) branch [`cursor/ferro-wt-flat-fixes-316-317-ea0e`](https://github.com/ErikSundvall/ehrtslib/tree/cursor/ferro-wt-flat-fixes-316-317-ea0e) (PR [#322](https://github.com/ErikSundvall/ehrtslib/pull/322)).

**Source commit at last rebuild:** `afa990104756d85ac0c4df6878538a0e4c51c43e` (2026-11-17).

**Entry:** `workbench_browser_entry.ts` re-exports `mod.ts`, ZipEHR HTML5 (`serializeToHtml5Variant`, `zipehrHtml5ToCanonical`), ITS-XML serializers, CDR profile resolver, and quiet preview helpers (`composeQuietStructureCss`, `buildZipehrPreviewDocument`, `ZIP_QUIET_STRUCTURE_CSS`).

**Rebuild (Deno):** clone ehrtslib at the branch/commit above, then from the workbench repo:

```bash
EHR_TSLIB_ROOT=/path/to/ehrtslib deno run -A scripts/build_workbench_bundle.ts
```

No local source patches are applied at rebuild time on this commit: PR #322 includes ZipEHR html5 round-trip fixes, ITS-XML boolean/list handling, archetype-scoped template rubric lookup, composer `name`, sibling order, and quiet-structure CSS/markup (`data-zs-quiet-heading`).

**ZipEHR quiet CSS in the UI:** copy `examples/demo-app/public/zipehr-css/zipehr-html5-quiet-structure.css` into `public/zipehr-css/`. The app composes it on `zipehr-html5-short.css` via `composeQuietStructureCss` (iframe `srcdoc` cannot resolve `@import`).

**Post-rebuild checks:** `npm test` (53 tests, including strict `tests/zipehr-roundtrip.test.ts`).

Apache-2.0. The workbench uses validators and ZipEHR html5 for display only; it does not post FLAT from the UI.