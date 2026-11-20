Runtime browser bundle for this workbench, built from [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) tag **[v0.14](https://github.com/ErikSundvall/ehrtslib/releases/tag/v0.14)** (library release **0.14.0**, GitHub Release *library v0.14*).

**Release base commit:** `9e96d8f3bceca4976875ca31db773df14910f142` (`chore: release library 0.14.0`, 2026-11-17).

**Unreleased fix vendored:** the bundle is built from ehrtslib PR [#326](https://github.com/ErikSundvall/ehrtslib/pull/326) (branch `grokbot/zipehr-tm-escaping`, commit `000b23d1feb93bb34ead377be924dfa33927a824`), which is v0.14 plus escaping of `%`, `|` and `;` in the ZipEHR html5 `tm` attribute ([#325](https://github.com/ErikSundvall/ehrtslib/issues/325)). Re-vendor from the release that includes it once it is merged.

**Published asset (when the release workflow has finished):** [https://eriksundvall.github.io/ehrtslib/lib/v0.14/ehrtslib-0.14.0.min.js](https://eriksundvall.github.io/ehrtslib/lib/v0.14/ehrtslib-0.14.0.min.js)

**Entry:** `workbench_browser_entry.ts` re-exports `mod.ts`, ZipEHR HTML5 (`serializeToHtml5Variant`, `zipehrHtml5ToCanonical`), ITS-XML serializers, CDR profile resolver, and quiet preview helpers (`composeQuietStructureCss`, `buildZipehrPreviewDocument`, `ZIP_QUIET_STRUCTURE_CSS`, `ZIP_QUIET_PREVIEW_SCRIPT`).

**Rebuild (Deno):** clone ehrtslib at tag `v0.14`, then from the workbench repo:

```bash
EHR_TSLIB_ROOT=/path/to/ehrtslib deno run -A scripts/build_workbench_bundle.ts
```

The checked-in `ehrtslib-0.14.0.min.js` is this **workbench** bundle (via `workbench_browser_entry.ts`), not the raw GitHub Pages file. Rebuild after cloning tag `v0.14`; compare against [the Pages artifact](https://eriksundvall.github.io/ehrtslib/lib/v0.14/ehrtslib-0.14.0.min.js) only if you drop the workbench entry.

**ZipEHR API (0.14):** pass the template as `template` on `Html5SerializeOptions` (not `webTemplate` / `operationalTemplate`). Use `templateRenderLang` for `L10n.*` presentation. Template annotations render as `data-antn-{slug}`; OPT 1.4 `<view>` as `data-opt-visibility` / `data-opt-alias`; ADL2 `rm_visibility` as `data-rm-*`.

**ZipEHR quiet CSS in the UI:** copy `examples/demo-app/public/zipehr-css/zipehr-html5-quiet-structure.css` into `public/zipehr-css/`. The app composes it on `zipehr-html5-short.css` via `composeQuietStructureCss`. Preview iframes use `buildQuietZipehrPreviewDocument` (workbench) to run the upstream quiet script plus a small L10n label pass from `data-antn-l10n-{lang}`.

**Post-rebuild checks:** `npm test` (78 tests, including `tests/zipehr-quiet-gp.test.ts` and strict `tests/zipehr-roundtrip.test.ts`).

Apache-2.0. The workbench uses validators and ZipEHR html5 for display only; it does not post FLAT from the UI.