# PEN&PAD + Clinergy experimental workbench

A static page for hackathon participants. Combine extracted Clinergy forms (thumb pain, swelling, examination, sprain, fracture) into a general-practice encounter and watch English and Swedish summary sentences, including the On Examination block, OpenGALEN bindings, **canonical openEHR JSON**, a FHIR R4 collection, and FHIR (Questionnaire and a [Symptoms IG Symptom Logical Model](https://build.fhir.org/ig/HL7/fhir-symptoms-ig/en/StructureDefinition-SymptomLogicalModel.html) export of the current finding) update as you click.

**Live site:** https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/

The form follows the [1998 Clinergy thumb pain demo](https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/). It is experimental and part of the [PEN&PAD revival](https://pen-pad-revival.github.io).

Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. Only a small extract is included, for demonstration. See [data/README.md](data/README.md).

The sentence generator and the openEHR builder are vendored from [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) `main`. See [vendor/README.md](vendor/README.md) for the local fixes to port back.

## openEHR output

Compositions are **canonical RM JSON** (template `thumb-pain-encounter.v2`). That is what the workbench **posts** to CDRs (`POST /ehr/{ehr_id}/composition?templateId=…`) and what the **Canonical JSON** tab shows; ehrtslib validates it against the coded OPT.

Additional tabs are **view/export only** (copy and download on each):

- **Canonical XML** — ehrtslib `XmlSerializer` / ITS-XML.
- **Simplified** — ehrtslib FLAT or STRUCTURED via `serializeToFlatJson` / `serializeToStructuredJson`, with a **CDR dialect** picker (`cdrProfile`: Better, EHRbase, FerroEHR; default Better) and **Flat / Structured** (default Structured). Nothing from this tab is posted.
- **ZipEHR** — ehrtslib `zipehr.html5/short` with the same options as the [ehrtslib demo app](https://github.com/ErikSundvall/ehrtslib/tree/main/examples/demo-app) (emoji symbols, linesaving layout, RM property names as HTML comments). Code/Document toggle and stylesheet picker match that demo.

No live POST of FLAT or STRUCTURED has been run from this workbench; we do not claim any CDR accepts or rejects those wire forms here. Canonical posting is documented in [docs/validation-crosscheck.md](docs/validation-crosscheck.md) (`npm run post:cdr`).

## Develop

```bash
npm ci
npm test
npm run dev
```

`npm run build` writes `dist/`. GitHub Actions tests every push and deploys `main` to Pages.