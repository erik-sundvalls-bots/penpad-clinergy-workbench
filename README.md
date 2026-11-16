# PEN&PAD + Clinergy experimental workbench

A static page for hackathon participants. Fill a Clinergy-like thumb pain form in the browser and watch English and Swedish summary sentences, OpenGALEN bindings, and **canonical openEHR JSON** update as you click.

**Live site:** https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/

The form follows the [1998 Clinergy thumb pain demo](https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/). It is experimental and part of the [PEN&PAD revival](https://pen-pad-revival.github.io).

Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. Only a small extract is included, for demonstration. See [data/README.md](data/README.md).

The sentence generator and the openEHR builder are vendored from [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) `main`. See [vendor/README.md](vendor/README.md) for the local fixes to port back.

## openEHR output

Compositions are **canonical RM JSON** (template `thumb-pain-encounter.v2`). That is what the workbench **posts** to CDRs (`POST /ehr/{ehr_id}/composition?templateId=…`) and what the **Canonical JSON** tab shows; ehrtslib validates it against the coded OPT.

The **ZipEHR** tab is a human-readable view only: ehrtslib `zipehr.html5/short` with the same options as the [ehrtslib demo app](https://github.com/ErikSundvall/ehrtslib/tree/main/examples/demo-app) (emoji symbols, linesaving layout, RM property names as HTML comments). Code/Document toggle, copy, download, and stylesheet picker match that demo.

**FLAT** is not shown in the UI and is not posted from this app (to keep the hackathon surface small). That is not a statement that FerroEHR rejects ehrtslib FLAT in general — FLAT ↔ Ferro conventions are still being aligned ([#316](https://github.com/ErikSundvall/ehrtslib/issues/316), [#317](https://github.com/ErikSundvall/ehrtslib/issues/317), [PR 318](https://github.com/ErikSundvall/ehrtslib/pull/318)); no live FLAT post with fixed node ids has been tried yet. See [docs/validation-crosscheck.md](docs/validation-crosscheck.md) and `npm run post:cdr` for canonical posting.

## Develop

```bash
npm ci
npm test
npm run dev
```

`npm run build` writes `dist/`. GitHub Actions tests every push and deploys `main` to Pages.