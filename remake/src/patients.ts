/**
 * Demo patients taken from the TermViz V8 multilingual stack demo
 * (https://erik-sundvalls-bots.github.io/TermViz/prototyping/v8-multilingual-stack-demo.html?lang=en).
 *
 * TermViz exposes only id, name, year of birth, and sex. No full birth date
 * or national identifier is present there, so none is invented here.
 *
 * Note: the implementation brief asked for "Eva Nyström". The TermViz source
 * uses Eva Holmgren (female, born 1968) and Lars Nyström (male, born 1959).
 * This remake follows TermViz so the two demos can be joined later.
 */
export interface Patient {
  id: "pat:lars" | "pat:eva";
  name: string;
  /** Year of birth only — the only birth figure published in TermViz. */
  born: number;
  sex: "male" | "female";
  source: "TermViz V8 stack demo";
  fictitious: true;
}

export const PATIENTS: Patient[] = [
  { id: "pat:lars", name: "Lars Nyström", born: 1959, sex: "male", source: "TermViz V8 stack demo", fictitious: true },
  { id: "pat:eva", name: "Eva Holmgren", born: 1968, sex: "female", source: "TermViz V8 stack demo", fictitious: true },
];

export function patientById(id: string): Patient {
  return PATIENTS.find((p) => p.id === id) ?? PATIENTS[0];
}

export function ageInYears(born: number, now: Date = new Date()): number {
  return now.getFullYear() - born;
}
