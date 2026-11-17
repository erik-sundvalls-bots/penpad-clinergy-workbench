Runtime browser bundle for this workbench, built from [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) branch [`cursor/ferro-wt-flat-fixes-316-317-ea0e`](https://github.com/ErikSundvall/ehrtslib/tree/cursor/ferro-wt-flat-fixes-316-317-ea0e) (PR [#322](https://github.com/ErikSundvall/ehrtslib/pull/322)).

**Source commit at last rebuild:** `4153466ffe55053f395468f3dfddc0dea25d4011` (2026-11-16).

**Entry:** `workbench_browser_entry.ts` re-exports `mod.ts` plus ZipEHR HTML5 (`serializeToHtml5Variant`, `zipehrHtml5ToCanonical`).

**Rebuild (Deno):** clone ehrtslib at the branch above, copy `vendor/ehrtslib/workbench_browser_entry.ts` and `scripts/build_workbench_bundle.ts` into the clone, run:

```bash
deno run -A scripts/build_workbench_bundle.ts
```

Until PR #322 merges the html5 fixes on that branch, the rebuild applies the same three ZipEHR html5 patches documented in [ehrtslib#322](https://github.com/ErikSundvall/ehrtslib/pull/322) (`html5_deserialize.ts`, `shared.ts` comment-mode `p` attrs). Drop those local edits once the branch contains them.

**ITS-XML (workbench bundle patches on the same ehrtslib checkout):** `serialization/xml/xml_deserializer.ts` — repeating RM list tags via `isArray`, `parseTagValue: false`, and DV_BOOLEAN text-value handling; `serialization/xml/xml_serializer.ts` — DV_BOOLEAN as element text (avoids nested `<value>` under ELEMENT `value`). Reapply on rebuild until upstream absorbs them.

**Template rubric (`lookupTemplateRubric`):** archetype-scoped lookup for `local::at*` codes (see `docs/ehrtslib-validation-rubric.md`). Patch lives in `validation/template_validator.ts` on the PR #322 branch checkout until upstream merges.

**ZipEHR quiet CSS:** workbench `public/zipehr-css/zipehr-html5-short-quiet.css` — align with ehrtslib demo when PR #322 adds the upstream quiet sheet; keep `mergeZipehrQuietStylesheet` for iframe `srcdoc`.

**Quiet stylesheet:** `public/zipehr-css/zipehr-html5-short-quiet.css` is workbench-local until upstream adds an equivalent under `examples/demo-app/public/zipehr-css/`; align filenames when it lands.

Apache-2.0. The workbench uses validators and ZipEHR html5 for display only; it does not post FLAT from the UI.