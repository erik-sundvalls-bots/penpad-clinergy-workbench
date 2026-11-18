/**
 * SNOMED CT post-coordinated expressions from structured findings.
 *
 * Concept and attribute ids come only from a reviewed map
 * (`mappings/snomed.yaml`). Rows that are not verified are never written
 * into an expression. Unmapped parts are listed, not dropped.
 *
 * Laterality is applied to the body structure (MRCM: 272741003 is a body-
 * structure attribute, not a clinical-finding attribute). Finding site,
 * severity and clinical course are grouped as the Editorial Guide requires;
 * clinical course is self-grouped.
 */
/**
 * Vendored from erik-sundvalls-bots/clinergy-extractor main @ d9bd85b
 * (PRs #13 and #14 merged). Apache-2.0.
 * The filesystem loader (`loadSnomedMap`) and the FHIR / Snowstorm
 * terminology-server clients were dropped so this module bundles in the
 * browser and never calls a terminology server at runtime. Call
 * `snomedMapFromParsed`. Keep in sync with `src/snomed.ts` in the extractor.
 */
import type { Finding, Qualifier } from "./sentence.ts";

export interface BoundConcept {
  key: string;
  code: string;
  term: string;
  fsn?: string;
  match?: string;
  verified: true;
  source?: string;
  note?: string;
  /** Only use this body-structure code when the finding location is this key. */
  requiresLocation?: string;
  /** Location already implied by a precoordinated focus, e.g. Pain in thumb. */
  includesLocation?: string;
}

export interface AttributeDef {
  key: string;
  code: string;
  term: string;
  verified: true;
  grouped?: boolean;
  selfGrouped?: boolean;
  domain?: string;
  range?: string;
  source?: string;
}

export interface DescriptorRouting {
  attribute: string | null;
  reason?: string;
  note?: string;
}

export interface TopicComposition {
  key: string;
  verified: false;
  /** Key of a verified concept to use as the expression focus. */
  focus?: string;
  note?: string;
}

export interface SnomedMap {
  edition?: string;
  verifiedOn?: string;
  source?: string;
  attributes: Record<string, AttributeDef>;
  concepts: Record<string, BoundConcept | TopicComposition>;
  descriptors: Record<string, DescriptorRouting>;
}

export interface Unmapped {
  key: string;
  reason: string;
}

export interface ExpressionResult {
  expression: string | null;
  unmapped: Unmapped[];
  /** Verified concepts and attributes actually written into the expression. */
  used: BoundConcept[];
}

type Yaml = Record<string, unknown>;

function asRecord(value: unknown): Yaml {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Yaml : {};
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function requiredString(value: unknown, label: string): string {
  const s = optionalString(value);
  if (!s) throw new Error(`snomed map: ${label} is missing`);
  return s;
}

/** Load a reviewed SNOMED map from a parsed YAML document. */
export function snomedMapFromParsed(doc: unknown): SnomedMap {
  const raw = asRecord(doc);
  const attributes: Record<string, AttributeDef> = {};
  for (const [key, value] of Object.entries(asRecord(raw.attributes))) {
    const row = asRecord(value);
    if (row.verified !== true) continue;
    attributes[key] = {
      key,
      code: requiredString(row.code, `attributes.${key}.code`),
      term: requiredString(row.term, `attributes.${key}.term`),
      verified: true,
      grouped: row.grouped === true,
      selfGrouped: row.selfGrouped === true,
      domain: optionalString(row.domain),
      range: optionalString(row.range),
      source: optionalString(row.source),
    };
  }
  const concepts: Record<string, BoundConcept | TopicComposition> = {};
  const add = (key: string, entry: BoundConcept | TopicComposition) => {
    if (concepts[key] && concepts[key] !== entry) {
      throw new Error(`snomed map: duplicate key ${key}`);
    }
    concepts[key] = entry;
  };
  for (const [key, value] of Object.entries(asRecord(raw.concepts))) {
    const row = asRecord(value);
    if (row.verified === true) {
      const bound: BoundConcept = {
        key,
        code: requiredString(row.code, `concepts.${key}.code`),
        term: requiredString(row.term, `concepts.${key}.term`),
        fsn: optionalString(row.fsn),
        match: optionalString(row.match),
        verified: true,
        source: optionalString(row.source),
        note: optionalString(row.note),
        requiresLocation: optionalString(row.requiresLocation),
        includesLocation: optionalString(row.includesLocation),
      };
      add(key, bound);
      const aliases = Array.isArray(row.aliases) ? row.aliases : [];
      for (const alias of aliases) {
        if (typeof alias === "string" && alias) add(alias, { ...bound, key: alias });
      }
    } else {
      add(key, {
        key,
        verified: false,
        focus: optionalString(row.focus),
        note: optionalString(row.note),
      });
    }
  }
  const descriptors: Record<string, DescriptorRouting> = {};
  for (const [key, value] of Object.entries(asRecord(raw.descriptors))) {
    const row = asRecord(value);
    const attribute = row.attribute == null ? null : String(row.attribute);
    descriptors[key] = {
      attribute,
      reason: optionalString(row.reason),
      note: optionalString(row.note),
    };
  }
  return {
    edition: optionalString(raw.edition),
    verifiedOn: optionalString(raw.verifiedOn),
    source: optionalString(raw.source),
    attributes,
    concepts,
    descriptors,
  };
}

/** Verified binding for a Clinergy / finding key, or null if none. */
export function boundConcept(map: SnomedMap, key: string | undefined): BoundConcept | null {
  if (!key) return null;
  const row = map.concepts[key];
  return row && row.verified === true ? row : null;
}

function focusOf(finding: Finding, map: SnomedMap, unmapped: Unmapped[]): BoundConcept | null {
  const row = map.concepts[finding.topic];
  if (row && row.verified === true) return row;
  if (row && row.verified === false && row.focus) {
    const focus = boundConcept(map, row.focus);
    if (focus) return focus;
    unmapped.push({
      key: finding.topic,
      reason: `focus ${row.focus} is not a verified concept`,
    });
    return null;
  }
  unmapped.push({
    key: finding.topic,
    reason: row?.verified === false
      ? (row.note ?? "no verified precoordinated concept and no focus")
      : "no verified SNOMED concept",
  });
  return null;
}

function siteOf(finding: Finding, map: SnomedMap, unmapped: Unmapped[]): BoundConcept | null {
  if (finding.subLocation) {
    const sub = boundConcept(map, finding.subLocation);
    if (sub) {
      if (sub.requiresLocation && sub.requiresLocation !== finding.location) {
        unmapped.push({
          key: finding.subLocation,
          reason: `${sub.code} |${sub.term}| is only used when location is ${sub.requiresLocation}` +
            (finding.location ? `, not ${finding.location}` : ", and this finding has no location"),
        });
      } else {
        return sub;
      }
    } else {
      unmapped.push({
        key: finding.subLocation,
        reason: "no verified SNOMED body structure",
      });
    }
  }
  if (finding.location) {
    const loc = boundConcept(map, finding.location);
    if (loc) return loc;
    unmapped.push({
      key: finding.location,
      reason: "no verified SNOMED body structure",
    });
  }
  return null;
}

function lateralityOf(finding: Finding, map: SnomedMap, unmapped: Unmapped[]): BoundConcept | null {
  if (!finding.laterality) return null;
  const side = boundConcept(map, finding.laterality);
  if (side) return side;
  unmapped.push({
    key: finding.laterality,
    reason: "no verified SNOMED laterality value",
  });
  return null;
}

function formatConcept(concept: { code: string; term: string }): string {
  return `${concept.code} |${concept.term}|`;
}

function formatSite(site: BoundConcept, laterality: BoundConcept | null, lateralityAttr: AttributeDef | null): string {
  if (!laterality || !lateralityAttr) return formatConcept(site);
  return `(${formatConcept(site)} : ${formatConcept(lateralityAttr)} = ${formatConcept(laterality)})`;
}

/**
 * Turn one finding into a compositional-grammar expression.
 * Presence of the finding is the expression itself; it is not a refinement.
 */
export function buildExpression(finding: Finding, map: SnomedMap): ExpressionResult {
  const unmapped: Unmapped[] = [];
  const used: BoundConcept[] = [];
  const remember = (row: { code: string; term: string; key?: string }): BoundConcept => {
    const bound: BoundConcept = {
      key: row.key ?? row.code,
      code: row.code,
      term: row.term,
      verified: true,
    };
    if (!used.some((item) => item.code === bound.code && item.term === bound.term)) used.push(bound);
    return bound;
  };

  const focus = focusOf(finding, map, unmapped);
  if (!focus) return { expression: null, unmapped, used };

  remember(focus);
  const findingSite = map.attributes.findingSite;
  const lateralityAttr = map.attributes.laterality;
  const site = siteOf(finding, map, unmapped);
  const laterality = lateralityOf(finding, map, unmapped);

  if (laterality && !site) {
    unmapped.push({
      key: finding.laterality ?? "laterality",
      reason:
        "laterality cannot be applied without a verified finding site (MRCM: laterality refines a body structure)",
    });
  }
  if (laterality && site && !lateralityAttr) {
    unmapped.push({
      key: finding.laterality ?? "laterality",
      reason: "laterality attribute is missing from the reviewed map",
    });
  }

  const groups: string[] = [];
  const topicBound = boundConcept(map, finding.topic);
  const siteAlreadyInFocus = Boolean(
    topicBound?.includesLocation &&
      !finding.subLocation &&
      !laterality &&
      (finding.location === topicBound.includesLocation || !finding.location),
  );
  const siteIsRefinement = Boolean(site && findingSite && !siteAlreadyInFocus);
  // A precoordinated topic such as "Pain in thumb" already has the location.
  // Refine the site when laterality or a more specific sub-location is present,
  // or when the focus does not already include the site (e.g. Swelling).
  if (site && findingSite && siteIsRefinement) {
    remember(findingSite);
    remember(site);
    if (laterality && lateralityAttr) {
      remember(lateralityAttr);
      remember(laterality);
    }
    const value = formatSite(site, laterality && lateralityAttr ? laterality : null, lateralityAttr ?? null);
    groups.push(`{ ${formatConcept(findingSite)} = ${value} }`);
  } else if (site && !findingSite && siteIsRefinement) {
    unmapped.push({
      key: finding.subLocation ?? finding.location ?? "site",
      reason: "finding site attribute is missing from the reviewed map",
    });
  }

  for (const qualifier of finding.qualifiers ?? []) {
    groups.push(...qualifierGroups(qualifier, map, unmapped, remember));
  }

  const expression = groups.length ? `${formatConcept(focus)} :\n  ${groups.join(",\n  ")}` : formatConcept(focus);
  return { expression, unmapped, used };
}

function qualifierGroups(
  qualifier: Qualifier,
  map: SnomedMap,
  unmapped: Unmapped[],
  remember: (row: { code: string; term: string; key?: string }) => BoundConcept,
): string[] {
  const routing = map.descriptors[qualifier.descriptor];
  if (!routing) {
    unmapped.push({
      key: qualifier.descriptor,
      reason: "no reviewed descriptor-to-attribute routing",
    });
    return [];
  }
  if (!routing.attribute) {
    const detail = qualifier.number != null
      ? `${qualifier.number} ${qualifier.unit ?? qualifier.value}`
      : qualifier.value;
    unmapped.push({
      key: qualifier.descriptor,
      reason: (routing.reason ?? "no MRCM attribute for this descriptor").trim() + ` (value: ${detail})`,
    });
    return [];
  }
  const attribute = map.attributes[routing.attribute];
  if (!attribute) {
    unmapped.push({
      key: qualifier.descriptor,
      reason: `reviewed attribute ${routing.attribute} is missing from the map`,
    });
    return [];
  }
  const value = boundConcept(map, qualifier.value);
  if (!value) {
    unmapped.push({
      key: qualifier.value,
      reason: `no verified SNOMED value for ${qualifier.descriptor}`,
    });
    return [];
  }
  remember(attribute);
  remember(value);
  return [`{ ${formatConcept(attribute)} = ${formatConcept(value)} }`];
}

export function buildExpressions(findings: Finding[], map: SnomedMap): ExpressionResult[] {
  return findings.map((finding) => buildExpression(finding, map));
}

// --- Compositional grammar syntax ------------------------------------------

const WS = /[ \t\r\n]+/y;

export interface SyntaxError {
  message: string;
  index: number;
}

export interface SyntaxResult {
  ok: boolean;
  errors: SyntaxError[];
  /** Concept ids in the expression, in order of appearance. */
  conceptIds: string[];
}

/**
 * Parse a close subset of SNOMED CT Compositional Grammar (brief syntax).
 * Enough to check the expressions this module emits, including nested
 * laterality refinements and role groups.
 */
export function parseExpression(input: string): SyntaxResult {
  const errors: SyntaxError[] = [];
  const conceptIds: string[] = [];
  let i = 0;
  const skip = () => {
    WS.lastIndex = i;
    const m = WS.exec(input);
    if (m) i = WS.lastIndex;
  };
  const fail = (message: string): false => {
    errors.push({ message, index: i });
    return false;
  };
  const accept = (s: string): boolean => {
    skip();
    if (input.startsWith(s, i)) {
      i += s.length;
      return true;
    }
    return false;
  };
  const concept = (): boolean => {
    skip();
    const m = /^[0-9]+/.exec(input.slice(i));
    if (!m) return fail("expected a concept id");
    conceptIds.push(m[0]);
    i += m[0].length;
    skip();
    if (accept("|")) {
      const end = input.indexOf("|", i);
      if (end < 0) return fail("unterminated term");
      const term = input.slice(i, end);
      if (!term.trim()) return fail("empty term");
      if (/[\r\n]/.test(term)) return fail("term may not contain a line break");
      i = end + 1;
    }
    return true;
  };
  const attributeValue = (): boolean => {
    skip();
    if (accept("(")) {
      if (!subExpression()) return false;
      skip();
      return accept(")") || fail("expected )");
    }
    return concept();
  };
  const attribute = (): boolean => {
    if (!concept()) return false;
    skip();
    if (!accept("=")) return fail("expected =");
    return attributeValue();
  };
  const attributeSet = (): boolean => {
    if (!attribute()) return false;
    while (accept(",")) {
      skip();
      if (input[i] === "{") return fail("ungrouped attributes cannot be mixed with role groups in this parser");
      if (!attribute()) return false;
    }
    return true;
  };
  const group = (): boolean => {
    if (!accept("{")) return fail("expected {");
    if (!attribute()) return false;
    while (accept(",")) {
      if (!attribute()) return false;
    }
    skip();
    return accept("}") || fail("expected }");
  };
  const refinement = (): boolean => {
    skip();
    if (input[i] === "{") {
      if (!group()) return false;
      while (true) {
        skip();
        if (!accept(",")) break;
        skip();
        if (input[i] !== "{") return fail("expected { after comma in grouped refinement");
        if (!group()) return false;
      }
      return true;
    }
    return attributeSet();
  };
  const subExpression = (): boolean => {
    if (!concept()) return false;
    while (accept("+")) {
      if (!concept()) return false;
    }
    skip();
    if (accept(":")) return refinement();
    return true;
  };
  skip();
  if (accept("<<<") || accept("===")) {
    // definition status is allowed and ignored
  }
  if (!subExpression()) {
    if (!errors.length) fail("invalid expression");
    return { ok: false, errors, conceptIds };
  }
  skip();
  if (i !== input.length) fail(`unexpected input at ${i}`);
  return { ok: errors.length === 0, errors, conceptIds };
}

/** True when the string is syntactically valid compositional grammar. */
export function isValidSyntax(expression: string): boolean {
  return parseExpression(expression).ok;
}
