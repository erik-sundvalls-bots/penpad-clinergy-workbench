# PEN&PAD + Clinergy experimental workbench

A static page for hackathon participants. The visit always includes thumb pain, swelling and examination; open sprain or fracture detail forms from the Diagnoses row (present/possible). Watch English and Swedish summary sentences, including the On Examination block, OpenGALEN bindings, **SNOMED CT post-coordinated expressions**, **canonical openEHR JSON**, a FHIR R4 collection, and FHIR (Questionnaire and a [Symptoms IG Symptom Logical Model](https://build.fhir.org/ig/HL7/fhir-symptoms-ig/en/StructureDefinition-SymptomLogicalModel.html) export of the current finding) update as you click.

**Live site:** https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/

The form follows the [1998 Clinergy thumb pain demo](https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/). It is experimental and part of the [PEN&PAD revival](https://pen-pad-revival.github.io).

Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. Only a small extract is included, for demonstration. See [data/README.md](data/README.md).

The sentence generator, the openEHR builder, and the SNOMED CT expression builder are vendored from [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor) `main`. See [vendor/README.md](vendor/README.md) for the local fixes to port back. Expressions use only ids from the reviewed map in `mappings/snomed.yaml`. Duration is listed as unmapped (there is no MRCM duration attribute). The page does not call a terminology server. Generated narrative text carries these expressions; see [SNOMED CT expressions in the output](#snomed-ct-expressions-in-the-output).

## openEHR output

Compositions are **canonical RM JSON** (template `thumb-pain-encounter.v2`). That is what the workbench **posts** to CDRs (`POST /ehr/{ehr_id}/composition?templateId=…`) and what the **Canonical JSON** tab shows; ehrtslib validates it against the coded OPT.

Additional tabs are **view/export only** (copy and download on each):

- **Canonical XML** — ehrtslib `XmlSerializer` / ITS-XML.
- **Simplified** — ehrtslib FLAT or STRUCTURED via `serializeToFlatJson` / `serializeToStructuredJson`, with a **CDR dialect** picker (`cdrProfile`: Better, EHRbase, FerroEHR; default Better) and **Flat / Structured** (default Structured). Nothing from this tab is posted.
- **ZipEHR** — ehrtslib `zipehr.html5/short` with the same options as the [ehrtslib demo app](https://github.com/ErikSundvall/ehrtslib/tree/main/examples/demo-app) (emoji symbols, linesaving layout, RM property names as HTML comments). Code/Document toggle and stylesheet picker match that demo.

No live POST of FLAT or STRUCTURED has been run from this workbench; we do not claim any CDR accepts or rejects those wire forms here. Canonical posting is documented in [docs/validation-crosscheck.md](docs/validation-crosscheck.md) (`npm run post:cdr`).

## SNOMED CT expressions in the output

Generated narrative text keeps its text and gets the sidebar's post-coordinated expression, one per finding:

| Narrative | openEHR | FHIR |
|---|---|---|
| Story (`story.v1` at0004) | `DV_TEXT.mappings`, one `TERM_MAPPING` per finding | extra coding on that finding's symptom `Observation.code` |
| Diagnosis description (`problem_diagnosis.v1` at0009) | `DV_TEXT.mappings` | extra coding on `Condition.code` |
| Examination description (`exam.v2` at0003) | none: the sidebar has no examination expression | none |

- The target is `SNOMED-CT::<expression>`, byte-identical to the sidebar.
- `match` is `=` when the text is one finding with nothing unmapped. Otherwise it is `>`, because the text says more than the expression.
- No mapping is written for a finding without a verified focus, an absent or possible finding, or a story the user typed.
- A FHIR `code` cannot hold line breaks or repeated spaces, so the FHIR code is the expression with whitespace collapsed. `display` keeps it as is.

## Develop

```bash
npm ci
npm test
npm run dev
```

`npm run build` writes `dist/`. GitHub Actions tests every push and deploys `main` to Pages.