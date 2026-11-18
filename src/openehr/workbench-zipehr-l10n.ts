/**
 * Workbench-only Swedish labels for ZipEHR quiet preview when template L10n
 * attrs are absent (e.g. composition root `/` and openEHR terminology rubrics).
 * Prefer OPT `L10n.sv` and ehrtslib `templateRenderLang` everywhere else.
 */
export const WORKBENCH_ZIPEHR_LABEL_SV: Readonly<Record<string, string>> = {
  Encounter: "Besök",
  event: "",
  "primary medical care": "primärvård",
  Examination: "Status",
  Assessment: "Bedömning",
  History: "Anamnes",
  Moderate: "Måttlig",
  Right: "Höger",
  Left: "Vänster",
};