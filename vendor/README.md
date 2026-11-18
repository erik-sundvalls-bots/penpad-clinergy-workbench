# Vendored generator

TypeScript from [erik-sundvalls-bots/clinergy-extractor](https://github.com/erik-sundvalls-bots/clinergy-extractor), Apache-2.0 (see `LICENSE`). This workbench does not push to that repository.

Taken from `main` at `f975528` (merge of PRs #9, #10 and #11, CI green). Files: `sentence.ts`, `language.ts`, `openehr.ts`, `lang/en.yaml`, `lang/sv.yaml`, `mappings/openehr.yaml`, `templates/thumb-pain.opt`, `templates/thumb-pain.webtemplate.json`.

`snomed.ts` and `mappings/snomed.yaml` were taken later from `main` at `d9bd85b` (merge of PRs #13 and #14). The filesystem loader and the FHIR / Snowstorm terminology-server clients were removed so the module bundles in the browser and never calls a terminology server at runtime. Call `snomedMapFromParsed`. The workbench wrapper in `src/snomed/expressions.ts` maps Clinergy form keys (`AbsoluteSeverity`, `AbsoluteOnset`, `QuantityDuration`) onto the fixture names in the map (`Severity`, `Onset`, `Duration`). Port that alias list back if the extractor starts consuming the real extract names.

Filesystem loaders (`Deno.readTextFile`, `@std/yaml`) were removed so the modules bundle in the browser. Call `sentenceKnowledgeFromParsed`, `packFromParsed`, and `descriptorMapFromParsed`.

## Local fixes to port back

1. **`valueAdj` + `NoDescriptor` is an adjective.** In the real rules, `absence`, `possible`, and `same` use `valueAdj` with `NoDescriptor` and are not in `valueAdverbs`. The `+ly` fallback rendered "absently". `valueAdj` together with a descriptor adjective is still an adverb ("moderately severe"), and the long name `valueAdverb` is unchanged. See `wordForValue` in `sentence.ts`.

2. **Laterality `both`.** The thumb form marks laterality `multiple: true`. `Finding.laterality` now accepts `"both"`, rendered as "left and right" plus a plural location word.

3. **OpenGALEN laterality keys.** The real extract calls the buttons `leftSelection` and `rightSelection`. `buildOpenEhr` looks those up when `left` / `right` are not themselves verified mappings.

4. **Descriptor names in `mappings/openehr.yaml`.** The map was written against the synthetic names `Severity`, `Onset`, `Duration`, `Character`, and `Frequency`. The extract calls them `AbsoluteSeverity`, `AbsoluteOnset`, `QuantityDuration`, `AbsolutePainDescriptor`, and `AbsoluteFrequency`. Both names now share one node. Frequency stays unmapped: the template has no frequency element.

5. **Swedish pack.** `lang/sv.yaml` gained entries for the real thumb-form keys (noun of `presence` is `föreligger`, because the real rule uses `valueNoun`). The wording is ours and has not had a native-speaker review. `lang/en.yaml` is the upstream pack and is not what the page uses for English; English sentences come from the extracted lexicon and `data/concepts.yaml`.
