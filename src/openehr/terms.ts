import { parse } from "yaml";
import raw from "../../data/mappings/thumb-pain-terms.yaml?raw";

export interface Binding {
  verified?: boolean;
  name?: string;
  code?: string;
  fsn?: string;
  preferred?: string;
  match?: string;
  note?: string;
  source?: string;
  needsHumanReview?: boolean;
}

export interface Term {
  clinergy: string;
  preferred: string;
  opengalen: Binding;
  snomed: Binding;
  expression?: string;
}

const doc = parse(raw) as { terms: Record<string, Term> };
export const terms: Record<string, Term> = doc.terms;

export function term(key: string): Term | undefined {
  return terms[key];
}
