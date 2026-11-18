/** English UI phrases still visible in Swedish quiet ZipEHR (longest first for replacement). */
export const ZIP_SV_QUIET_PHRASES = [
  ["Range of motion of a joint", "Ledrörelse"],
  ["Physical examination findings", "Status"],
  ["Symptom/sign screening questionnaire", "Symtom-/tecken-screening"],
  ["System or structure examined", "Undersökt struktur"],
  ["Clinical management", "Klinisk handläggning"],
  ["Clinical interpretation", "Klinisk tolkning"],
  ["Clinical description", "Klinisk beskrivning"],
  ["Problem/Diagnosis name", "Diagnosnamn"],
  ["Problem/Diagnosis", "Problem/diagnos"],
  ["primary medical care", "primärvård"],
  ["Story/History", "Berättelse"],
  ["Recommendation", "Rekommendation"],
  ["Encounter", "Möte"],
  ["Event Series", "Händelseserie"],
  ["Any event", "Händelse"],
  ["History", "Anamnes"],
  ["Assessment", "Bedömning"],
  ["Examination", "Status"],
  ["Symptom/Sign", "Symtom/tecken"],
  ["Movement", "Rörelse"],
  ["event", "händelse"],
  ["Topic", "Ämne"],
] as const satisfies readonly (readonly [string, string])[];

export const ZIP_SV_QUIET_PHRASES_SORTED: readonly (readonly [string, string])[] = [...ZIP_SV_QUIET_PHRASES].sort(
  (a, b) => b[0].length - a[0].length,
);