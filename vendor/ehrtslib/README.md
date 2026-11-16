Runtime bundle built from [ErikSundvall/ehrtslib](https://github.com/ErikSundvall/ehrtslib) tag `v0.13` (Apache-2.0), using entry `workbench_browser_entry.ts` so the browser build also exports ZipEHR HTML5 (`serializeToHtml5Variant`, `zipehrHtml5ToCanonical`). Upstream `ehrtslib-0.13.0.min.js` on the release does not export those on the public barrel.

Rebuild (Deno required), from an ehrtslib clone with `workbench_browser_entry.ts` copied next to `mod.ts`:

```bash
deno run -A scripts/build_workbench_bundle.ts
```

This workbench bundle additionally carries small ZipEHR html5 fixes (comment mode + `fast-xml-parser`) until they land upstream:

- `serialization/zipehr/html5_deserialize.ts` — do not inherit parent `p` on children; prepend `#text` before child elements.
- `serialization/zipehr/shared.ts` — emit `p`/`property` in comment mode (comments are dropped by the XML parser).
- `scripts/build_workbench_bundle.ts` — esbuild pack script for this entry.

The workbench uses `toTypedRm`, validators, and ZipEHR html5 serialization. It does not post FLAT from the UI.