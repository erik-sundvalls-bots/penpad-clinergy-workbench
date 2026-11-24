Runtime browser bundle for this workbench, built from [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) tag **[v0.17](https://github.com/ErikSundvall/ehrtslib/releases/tag/v0.17)** (library release **0.17.0**, GitHub Release *library v0.17*).

**Release commit:** `e097f37ad91a5e2e7d5f4267d6c545aeaabb6980` (`chore: release library 0.17.0`, 2026-11-24). Includes the unified OPT node label resolver and OPT2/WT, L10n, and Better `ovl-*` naming fixes ([#330](https://github.com/ErikSundvall/ehrtslib/issues/330) / [PR #331](https://github.com/ErikSundvall/ehrtslib/pull/331)), the ADL header `uid` fix for values starting with `at`/`ac`/`id` ([#328](https://github.com/ErikSundvall/ehrtslib/issues/328)), ZipEHR display localization ([#323](https://github.com/ErikSundvall/ehrtslib/issues/323)), ADL 1.4 `C_DV_QUANTITY` support ([#324](https://github.com/ErikSundvall/ehrtslib/issues/324)), and ZipEHR html5 `tm` attribute escaping ([#325](https://github.com/ErikSundvall/ehrtslib/issues/325) / PR [#326](https://github.com/ErikSundvall/ehrtslib/pull/326)).

**Published asset:** [https://eriksundvall.github.io/ehrtslib/lib/v0.17/ehrtslib-0.17.0.min.js](https://eriksundvall.github.io/ehrtslib/lib/v0.17/ehrtslib-0.17.0.min.js)

**Entry:** `workbench_browser_entry.ts` re-exports `mod.ts`, ZipEHR HTML5 (`serializeToHtml5Variant`, `zipehrHtml5ToCanonical`), ITS-XML serializers, CDR profile resolver, and quiet preview helpers (`composeQuietStructureCss`, `buildZipehrPreviewDocument`, `ZIP_QUIET_STRUCTURE_CSS`, `ZIP_QUIET_PREVIEW_SCRIPT`).

**Rebuild (Deno):** clone ehrtslib at tag `v0.17`, then from the workbench repo:

```bash
EHR_TSLIB_ROOT=/path/to/ehrtslib deno run -A scripts/build_workbench_bundle.ts
```

The checked-in `ehrtslib-0.17.0.min.js` is this **workbench** bundle (via `workbench_browser_entry.ts`), not the raw GitHub Pages file. Rebuild after cloning tag `v0.17`; compare against [the Pages artifact](https://eriksundvall.github.io/ehrtslib/lib/v0.17/ehrtslib-0.17.0.min.js) only if you drop the workbench entry.

**ZipEHR API (0.17):** pass the template as `template` on `Html5SerializeOptions` (not `webTemplate` / `operationalTemplate`). Use `templateRenderLang` for display localization: ehrtslib natively resolves template `L10n.{lang}`, OPT/archetype `term_definitions`, and openEHR terminology rubrics (`openehr::NNN`) into paired `.zs-canonical-value` / `.zs-display-value` spans while keeping HTML5 round-trip lossless. Template annotations render as `data-antn-{slug}`; OPT 1.4 `<view>` as `data-opt-visibility` / `data-opt-alias`; ADL2 `rm_visibility` as `data-rm-*`.

**ZipEHR quiet CSS in the UI:** copy `examples/demo-app/public/zipehr-css/*.css` into `public/zipehr-css/`. The app composes `zipehr-html5-quiet-structure.css` on `zipehr-html5-short.css` via `composeQuietStructureCss`, hiding `.zs-canonical-value` and showing `.zs-display-value`. Preview iframes use `buildQuietZipehrPreviewDocument` (workbench) to run the upstream quiet script plus a small pass-through label strip for `data-opt-visibility="pass-through"`.

**Post-rebuild checks:** `npm test` (including `tests/zipehr-quiet-gp.test.ts` and strict `tests/zipehr-roundtrip.test.ts`).

Apache-2.0. The workbench uses validators and ZipEHR html5 for display only; it does not post FLAT from the UI.