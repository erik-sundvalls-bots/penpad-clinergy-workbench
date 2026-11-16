# Data

A small extract of the 1998 Clinergy / PEN&PAD thumb pain and thumb swelling forms, published in this repository with the owner's approval so the workbench can run in a browser.

**Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. All rights reserved.** Only this small extract is included, and only for demonstration. Do not add other Clinergy forms.

| File | What it is |
|---|---|
| `ThumbPainSymptom.yaml` | Data-entry form for thumb pain, from the extractor. |
| `ThumbSwellingSymptom.yaml` | Data-entry form for thumb swelling, from the extractor. |
| `sentence-rules.yaml` | Sentence rules trimmed to the descriptors those two forms use. |
| `mappings.yaml` | Clinergy → OpenGALEN 8 name mappings trimmed to the concepts those forms use. OpenGALEN names are under the [GALEN Open Source License](https://opengalen.eggbird.eu/gosl.html). |
| `expectations.yaml` | The five known-good English sentences from the original demo. The tests must pass these. |
| `concepts.yaml` | Displays the sentence generator needs. Topic lines are copied from the form files. `PainSymptom` and `SwellingSymptom` are the grammatical heads implied by "thumb pain" / "thumb swelling" and by those five sentences; the ancestor records were not in the attached extract. Button words that are not a plain de-camelcase are the labels from the [public walkthrough](https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/). |
| `concept-links.yaml` | Prepositions for the five sentences (`in` thumb pain, `of` thumb swelling) and the prepositions written on the diagnosis links. The extractor's `concept-links.yaml` was not in the attached extract. |
| `Mus_hand.png` | Hand drawing supplied with the extract, shown beside the form. |

The summary-sentence generator, the Swedish word list, and the openEHR template are code from [clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor), not Clinergy content. See `vendor/README.md`.
