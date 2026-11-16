# PEN&PAD + Clinergy experimental workbench

A static page for hackathon participants. Fill a Clinergy-like thumb pain form in the browser and watch English and Swedish summary sentences, OpenGALEN bindings, and openEHR canonical JSON and FLAT update as you click.

**Live site:** https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/

The form follows the [1998 Clinergy thumb pain demo](https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/). It is experimental and part of the [PEN&PAD revival](https://pen-pad-revival.github.io).

Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. Only a small extract is included, for demonstration. See [data/README.md](data/README.md).

The sentence generator and the openEHR builder are vendored from [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) `main`. See [vendor/README.md](vendor/README.md) for the local fixes to port back.

## Develop

```bash
npm ci
npm test
npm run dev
```

`npm run build` writes `dist/`. GitHub Actions tests every push and deploys `main` to Pages.
