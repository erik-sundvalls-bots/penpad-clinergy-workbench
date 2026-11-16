import { conceptLabel } from "../knowledge.ts";
import { term } from "../openehr/terms.ts";

export const SNOMED = "http://snomed.info/sct";
export const OPEN_GALEN = "http://www.opengalen.org/owl/opengalen.owl#";
export const QUESTIONNAIRE_URL =
  "https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/fhir/Questionnaire/thumb-pain";
export const QUESTIONNAIRE_ID = "thumb-pain";
export const SYMPTOM_PROFILE = "http://hl7.org/fhir/uv/symptoms/StructureDefinition/SymptomLogicalModel";
export const SDC_QUESTIONNAIRE_PROFILE = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire";
export const SDC_RESPONSE_PROFILE = "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaireresponse";
export const DEMO_PATIENT_ID = "demo-john-parsons";

export const DISPLAY: Record<string, string> = {
  laterality: "Laterality",
  sublocation: "Sublocation",
  QuantityDuration: "Duration",
  AbsolutePainDescriptor: "Character",
  AbsoluteSeverity: "Severity",
  AbsoluteFrequency: "Frequency",
  AbsoluteOnset: "Onset",
  AbsoluteProgress: "Progress",
  AbsoluteProcessPattern: "Pattern",
  AbsoluteConsistency: "Consistency",
  AbsoluteTexture: "Texture",
  presence: "present",
  absence: "absent",
  possible: "possible",
  excluded: "excluded",
  leftSelection: "left",
  rightSelection: "right",
  normal: "normal",
  notExamined: "not examined",
  ConseqPain: "Pain",
  ConseqTendernessSign: "Tenderness",
  ConseqErythemaSign: "Erythema",
};

export const DURATION_UNITS: Array<{ key: string; word: string; ucum: string }> = [
  { key: "second", word: "seconds", ucum: "s" },
  { key: "minute", word: "minutes", ucum: "min" },
  { key: "hour", word: "hours", ucum: "h" },
  { key: "day", word: "days", ucum: "d" },
  { key: "week", word: "weeks", ucum: "wk" },
  { key: "month", word: "months", ucum: "mo" },
  { key: "year", word: "years", ucum: "a" },
];

export interface FhirCoding {
  system?: string;
  code?: string;
  display: string;
}

export function displayOf(key: string): string {
  return DISPLAY[key] ?? conceptLabel(key);
}

/** Verified SNOMED, else verified OpenGALEN. Unverified keys are left uncoded. */
export function codingFor(key: string): FhirCoding | null {
  const row = term(key);
  const display = row?.preferred || displayOf(key);
  if (row?.snomed.verified && row.snomed.code) {
    return {
      system: SNOMED,
      code: row.snomed.code,
      display: row.snomed.preferred || row.snomed.fsn || display,
    };
  }
  if (row?.opengalen.verified && row.opengalen.name) {
    return { system: OPEN_GALEN, code: row.opengalen.name, display };
  }
  return null;
}

export function codeOrDisplay(key: string): { coding?: FhirCoding; display: string } {
  const coding = codingFor(key);
  return { coding: coding ?? undefined, display: coding?.display ?? displayOf(key) };
}

export function demoPatient(): Record<string, unknown> {
  return {
    resourceType: "Patient",
    id: DEMO_PATIENT_ID,
    identifier: [{
      system: "https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/",
      value: "13459",
    }],
    name: [{ text: "John Parsons", family: "Parsons", given: ["John"] }],
  };
}

export function isoDuration(n: number, unit: string): string {
  const designator: Record<string, string> = {
    second: "PT{n}S",
    minute: "PT{n}M",
    hour: "PT{n}H",
    day: "P{n}D",
    week: "P{n}W",
    month: "P{n}M",
    year: "P{n}Y",
  };
  return (designator[unit] ?? "P{n}D").replace("{n}", String(n));
}

export function ucumOf(unit: string): { unit: string; system: string; code: string } {
  const row = DURATION_UNITS.find((item) => item.key === unit) ?? DURATION_UNITS[3];
  return { unit: row.word, system: "http://unitsofmeasure.org", code: row.ucum };
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch
  ));
}
