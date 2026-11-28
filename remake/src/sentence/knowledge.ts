import type {
  ConceptFact,
  DescriptorRules,
  LocativeLink,
  SentenceKnowledge,
} from "./types.ts";

type Yaml = Record<string, unknown>;

/** Load sentence knowledge from the extractor YAML documents (already parsed). */
export function knowledgeFromExtract(rulesDoc: unknown, conceptsDoc: unknown, linksDoc: unknown = {}): SentenceKnowledge {
  const rules = asRecord(rulesDoc);
  const descriptors: SentenceKnowledge["descriptors"] = {};
  for (const [name, raw] of Object.entries(asRecord(rules.descriptors))) {
    const d = asRecord(raw);
    const list = Array.isArray(d.rules) ? d.rules : [];
    descriptors[name] = {
      precedence: typeof d.precedence === "number" ? d.precedence : null,
      rules: list.map((r) => {
        const row = asRecord(r);
        return {
          value: String(row.value ?? ""),
          valueForm: String(row.valueForm ?? ""),
          descriptorForm: String(row.descriptorForm ?? ""),
          order: String(row.order ?? ""),
          position: String(row.position ?? ""),
          valuePrecedence: typeof row.valuePrecedence === "number" ? row.valuePrecedence : null,
        } satisfies DescriptorRules["rules"][number];
      }),
    };
  }
  const concepts: SentenceKnowledge["concepts"] = {};
  for (const [name, raw] of Object.entries(asRecord(conceptsDoc))) {
    const c = asRecord(raw);
    concepts[name] = {
      display: typeof c.display === "string" ? c.display : "",
      category: typeof c.category === "string" ? c.category : null,
      summaryType: typeof c.summaryType === "string" ? c.summaryType : null,
      supers: stringList(c.supers),
    } satisfies ConceptFact;
  }
  const locatives: SentenceKnowledge["locatives"] = {};
  for (const [name, raw] of Object.entries(asRecord(linksDoc))) {
    const links = stringList(asRecord(raw).locativeLinks);
    const parsed = links.map(parseLocative).filter((x): x is LocativeLink => x !== null);
    if (parsed.length) locatives[name] = parsed;
  }
  const lexDescRaw = asRecord(asRecord(rules.lexicon).descriptors);
  const descriptorsLex: SentenceKnowledge["lexicon"]["descriptors"] = {};
  for (const [name, raw] of Object.entries(lexDescRaw)) {
    const w = asRecord(raw);
    descriptorsLex[name] = {
      noun: typeof w.noun === "string" ? w.noun : null,
      adjective: typeof w.adjective === "string" ? w.adjective : null,
      negative: typeof w.negative === "string" ? w.negative : null,
    };
  }
  const adverbs: Record<string, string> = {};
  for (const [name, raw] of Object.entries(asRecord(asRecord(rules.lexicon).valueAdverbs))) {
    if (typeof raw === "string") adverbs[name] = raw;
  }
  const valuePrecedences: Record<string, number> = {};
  for (const [name, raw] of Object.entries(asRecord(rules.valuePrecedences))) {
    if (typeof raw === "number") valuePrecedences[name] = raw;
  }
  return {
    descriptors,
    valuePrecedences,
    summaryTypes: stringList(rules.summaryTypes),
    lexicon: { descriptors: descriptorsLex, valueAdverbs: adverbs },
    concepts,
    locatives,
  };
}

function parseLocative(link: string): LocativeLink | null {
  const trimmed = link.trim();
  if (!trimmed) return null;
  const i = trimmed.indexOf(" ");
  // A bare location token (no preposition) still names the site.
  if (i <= 0) return { preposition: "", location: trimmed };
  return { preposition: trimmed.slice(0, i), location: trimmed.slice(i + 1) };
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function asRecord(v: unknown): Yaml {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Yaml : {};
}
