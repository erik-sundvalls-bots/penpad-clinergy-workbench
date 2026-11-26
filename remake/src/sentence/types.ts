/**
 * Types for the remake's original-equivalent English sentence generator.
 * Implemented from extractor rule data and the public thumb-pain walkthrough;
 * not imported from the workbench's vendored renderer (which has local tweaks).
 */

export interface Qualifier {
  descriptor: string;
  value: string;
  number?: number;
  unit?: string;
}

export interface Finding {
  topic: string;
  location?: string;
  /** Single side. Selecting both sides on a form is rendered separately by the UI. */
  laterality?: "left" | "right";
  subLocation?: string;
  qualifiers: Qualifier[];
  /** Present/absent-style value, e.g. "presence". */
  summary?: string;
}

export interface LanguageRule {
  value: string;
  valueForm: string;
  descriptorForm: string;
  order: string;
  position: string;
  valuePrecedence?: number | null;
}

export interface DescriptorRules {
  precedence: number | null;
  rules: LanguageRule[];
}

export interface ConceptFact {
  display: string;
  category?: string | null;
  summaryType?: string | null;
  supers?: string[];
}

export interface LocativeLink {
  preposition: string;
  location: string;
}

export interface SentenceKnowledge {
  descriptors: Record<string, DescriptorRules>;
  valuePrecedences: Record<string, number>;
  summaryTypes: string[];
  lexicon: {
    descriptors: Record<string, { noun: string | null; adjective: string | null; negative: string | null }>;
    valueAdverbs: Record<string, string>;
  };
  concepts: Record<string, ConceptFact>;
  locatives: Record<string, LocativeLink[]>;
}

export interface Rendered {
  sentence: string;
  missing: string[];
}
