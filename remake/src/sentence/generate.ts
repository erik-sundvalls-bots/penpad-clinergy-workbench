/**
 * Deterministic compact sentence knowledge from an extractor output tree.
 *
 * Raw concepts.yaml / concept-links.yaml are too large to commit. This
 * writer keeps only the fields the remake renderer uses (display, category,
 * summaryType, supers, locativeLinks) plus the rule tables, with sorted
 * keys and no timestamps.
 */
import { knowledgeFromExtract } from "./knowledge.ts";
import type { SentenceKnowledge } from "./types.ts";
import { stripForbidden } from "../form/generate.ts";

export const GENERATED_SENTENCES_SCHEMA = "penpad-remake-sentences/v1";

export interface GeneratedSentenceKnowledge {
  schema: typeof GENERATED_SENTENCES_SCHEMA;
  rules: {
    descriptors: unknown;
    valuePrecedences: unknown;
    summaryTypes: unknown;
    lexicon: unknown;
  };
  concepts: Record<string, { display: string; category?: string | null; summaryType?: string | null; supers?: string[] }>;
  locatives: Record<string, { locativeLinks: string[] }>;
}

export interface SentenceExtractInput {
  sentenceRules: unknown;
  concepts: Record<string, unknown>;
  conceptLinks: Record<string, unknown>;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

export function generateSentenceKnowledge(input: SentenceExtractInput): GeneratedSentenceKnowledge {
  const rulesDoc = asRecord(stripForbidden(input.sentenceRules));
  const conceptsIn = asRecord(stripForbidden(input.concepts));
  const linksIn = asRecord(stripForbidden(input.conceptLinks));
  const concepts: GeneratedSentenceKnowledge["concepts"] = {};
  for (const name of Object.keys(conceptsIn).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const c = asRecord(conceptsIn[name]);
    const rec: GeneratedSentenceKnowledge["concepts"][string] = {
      display: typeof c.display === "string" ? c.display : "",
    };
    if (typeof c.category === "string" && c.category) rec.category = c.category;
    if (typeof c.summaryType === "string" && c.summaryType) rec.summaryType = c.summaryType;
    const supers = asStringList(c.supers);
    if (supers.length) rec.supers = supers;
    concepts[name] = rec;
  }
  const locatives: GeneratedSentenceKnowledge["locatives"] = {};
  for (const name of Object.keys(linksIn).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const locativeLinks = asStringList(asRecord(linksIn[name]).locativeLinks);
    if (locativeLinks.length) locatives[name] = { locativeLinks };
  }
  return {
    schema: GENERATED_SENTENCES_SCHEMA,
    rules: {
      descriptors: rulesDoc.descriptors ?? {},
      valuePrecedences: rulesDoc.valuePrecedences ?? {},
      summaryTypes: Array.isArray(rulesDoc.summaryTypes) ? rulesDoc.summaryTypes : [],
      lexicon: rulesDoc.lexicon ?? { descriptors: {}, valueAdverbs: {} },
    },
    concepts,
    locatives,
  };
}

export function sentenceKnowledgeFromGenerated(doc: GeneratedSentenceKnowledge): SentenceKnowledge {
  const links: Record<string, unknown> = {};
  for (const [name, row] of Object.entries(doc.locatives ?? {})) {
    links[name] = { locativeLinks: row.locativeLinks };
  }
  return knowledgeFromExtract(doc.rules, doc.concepts, links);
}

export function sentenceCatalogFromUnknown(data: unknown): GeneratedSentenceKnowledge | null {
  const rec = asRecord(data);
  if (rec.schema !== GENERATED_SENTENCES_SCHEMA) return null;
  if (!rec.rules || !rec.concepts) return null;
  return rec as unknown as GeneratedSentenceKnowledge;
}
