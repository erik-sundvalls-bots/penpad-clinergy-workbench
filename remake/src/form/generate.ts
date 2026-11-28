/**
 * Deterministic generator: extractor form YAML → remake form definitions.
 *
 * Same input always yields byte-identical output: keys are sorted, ids are the
 * extractor topic names, and the writer never emits timestamps.
 *
 * The remake uses only this generated catalogue for every topic. Hand-built
 * YAML under data/ is for the separate thumb-pain demo, not the remake.
 * See docs/remake-form-generator.md.
 */

import type { FormExam, FormLink, FormRow, RemakeForm } from "../knowledge-data.ts";
import { featureCaption, quantitySpec, quantityTokens } from "./quantities.ts";

export const GENERATED_FORMS_SCHEMA = "penpad-remake-forms/v1";

/** Keys that must never appear on a generated form or row (codes, provenance, timestamps). */
const STRIP_KEYS = new Set([
  "readCode",
  "read_code",
  "ReadCode",
  "read2",
  "Read2",
  "ctv3",
  "CTV3",
  "codes",
  "extractedAt",
  "extracted_at",
  "generatedAt",
  "generated_at",
  "timestamp",
  "opengalen",
]);

const FORM_KEYS = [
  "topic",
  "display",
  "category",
  "summaryType",
  "location",
  "firstLayer",
  "moreLayer",
  "associatedSymptomsAndSigns",
  "diagnoses",
  "otherLinks",
  "examinations",
] as const;

const ROW_KEYS = ["feature", "criterialLink", "values", "multiple", "inheritance", "default", "visibleWhen", "caption", "units", "defaultUnit"] as const;

const LINK_KEYS = ["item", "concept", "preposition", "location", "preCoordinated", "summaryType", "category"] as const;

const EXAM_KEYS = ["exam", "perSide", "signs", "subExams"] as const;

export interface ExtractInput {
  /** Parsed form documents, keyed by topic (or by a unique fallback id). */
  forms: Record<string, unknown>;
  exams?: Record<string, unknown>;
  concepts?: Record<string, unknown>;
  sentenceRules?: unknown;
  conceptLinks?: Record<string, unknown>;
}

export interface GeneratedCatalog {
  schema: typeof GENERATED_FORMS_SCHEMA;
  forms: Record<string, RemakeForm>;
}

export type RenderLevel = "full" | "partial" | "none";

export interface FormCoverage {
  topic: string;
  level: RenderLevel;
  unsupported: string[];
  empty: boolean;
}

export interface CoverageReport {
  total: number;
  full: number;
  partial: number;
  none: number;
  empty: number;
  constructs: Record<string, { count: number; examples: string[] }>;
  forms: FormCoverage[];
}

export function stableStringify(value: unknown): string {
  return `${JSON.stringify(sortKeysDeep(value), null, 2)}\n`;
}

export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(obj)
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
        .map((k) => [k, sortKeysDeep(obj[k])]),
    );
  }
  return value;
}

/** Drop Read codes, timestamps, and other keys that must not reach the remake. */
export function stripForbidden(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripForbidden);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (STRIP_KEYS.has(k)) continue;
      out[k] = stripForbidden(v);
    }
    return out;
  }
  return value;
}

function pick(raw: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (raw[k] !== undefined) out[k] = raw[k];
  }
  return out;
}

function asRows(raw: unknown): FormRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = pick(
      (item && typeof item === "object" ? item : {}) as Record<string, unknown>,
      ROW_KEYS,
    );
    const next = row as unknown as FormRow;
    next.values = Array.isArray(row.values) ? (row.values as unknown[]) : [];
    return next;
  });
}

function asLinks(raw: unknown): FormLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const src = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const link = pick(src, LINK_KEYS);
    if (!link.item) link.item = String(src.item ?? src.concept ?? "");
    if (!link.concept) link.concept = String(src.concept ?? "");
    return {
      item: String(link.item ?? ""),
      concept: String(link.concept ?? ""),
      preposition: (link.preposition ?? null) as string | null,
      location: (link.location ?? null) as string | null,
      preCoordinated: (link.preCoordinated ?? null) as string | null,
      summaryType: (link.summaryType ?? null) as string | null,
      category: (link.category ?? null) as string | null,
    };
  });
}

function asExams(raw: unknown): FormExam[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const src = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const exam = pick(src, EXAM_KEYS);
    return {
      exam: String(exam.exam ?? ""),
      perSide: (exam.perSide as FormExam["perSide"]) ?? null,
      signs: Array.isArray(exam.signs) ? (exam.signs as string[]) : undefined,
      subExams: Array.isArray(exam.subExams) ? (exam.subExams as string[]) : undefined,
    };
  });
}

export function formFromExtractDoc(doc: unknown): RemakeForm | null {
  if (!doc || typeof doc !== "object") return null;
  const cleaned = stripForbidden(doc) as Record<string, unknown>;
  const topic = typeof cleaned.topic === "string" ? cleaned.topic : "";
  if (!topic) return null;
  const picked = pick(cleaned, FORM_KEYS);
  const form: RemakeForm = {
    topic,
    display: typeof picked.display === "string" ? picked.display : topic,
    category: typeof picked.category === "string" ? picked.category : undefined,
    summaryType: typeof picked.summaryType === "string" ? picked.summaryType : "AbsentPresent",
    location: typeof picked.location === "string" ? picked.location : picked.location === null ? null : null,
    firstLayer: asRows(picked.firstLayer),
    moreLayer: asRows(picked.moreLayer),
    associatedSymptomsAndSigns: asLinks(picked.associatedSymptomsAndSigns),
    diagnoses: asLinks(picked.diagnoses),
    otherLinks: asLinks(picked.otherLinks),
    examinations: asExams(picked.examinations),
  };
  return form;
}

export function generateRemakeForms(input: ExtractInput): GeneratedCatalog {
  const forms: Record<string, RemakeForm> = {};
  const topics = Object.keys(input.forms).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of topics) {
    const form = formFromExtractDoc(input.forms[key]);
    if (!form) continue;
    enrichQuantityRows(form, input.concepts ?? {});
    forms[form.topic] = form;
  }
  return { schema: GENERATED_FORMS_SCHEMA, forms };
}

function conceptDisplayOf(concepts: Record<string, unknown>, name: string): string | undefined {
  const c = concepts[name];
  if (c && typeof c === "object" && "display" in c && typeof (c as { display: unknown }).display === "string") {
    return (c as { display: string }).display;
  }
  return undefined;
}

/** Attach original-style captions and unit lists/defaults to quantity rows. */
function enrichQuantityRows(form: RemakeForm, concepts: Record<string, unknown>): void {
  for (const row of [...form.firstLayer, ...form.moreLayer]) {
    const feature = row.feature ?? row.criterialLink;
    const tokens = quantityTokens(row);
    const isQty = (feature ?? "").startsWith("Quantity") || feature === "hasQuantity" || feature === "hasManyValuedQuantity" || tokens.length > 0;
    const known = feature ? featureCaption(feature) : "";
    const hasNamedCaption = Boolean(feature && known && (feature.startsWith("Quantity") || feature.startsWith("Absolute") || feature.startsWith("has")));
    if (hasNamedCaption && !row.caption) {
      // Only store captions we actually know from the original engine / lexicon map.
      if (["QuantityStartTime","QuantityLengthOfHistory","QuantityDuration","QuantityTimeOcc","QuantityMensesDuration","QuantityMensesFrequency","QuantityFrequency","QuantityCount","QuantityWidth","QuantityLongitude","QuantityHeight","QuantityCircumference","QuantityWalkingDistance","AbsoluteHistoricalPattern","hasQuantity","hasManyValuedQuantity","hasLevel","hasTrendInState","hasChangeInState"].includes(feature!)) {
        row.caption = known;
      }
    }
    if (!isQty) continue;
    const spec = quantitySpec(feature, row.values ?? []);
    if (!row.units) row.units = spec.units.map((u) => u.id);
    if (!row.defaultUnit) row.defaultUnit = spec.defaultUnit;
    void concepts;
  }
}

function rowConstructs(row: FormRow): string[] {
  const out: string[] = [];
  if (!row.feature && !row.criterialLink) out.push("row-without-key");
  if (row.visibleWhen) out.push("visibleWhen");
  if (row.default !== undefined) out.push("default");
  const vals = row.values ?? [];
  const hasDict = vals.some((v) => v && typeof v === "object");
  const hasScalar = vals.some((v) => typeof v === "string" || typeof v === "number");
  if (hasDict && row.criterialLink) out.push("criterial-attribute-value");
  else if (hasDict) out.push("feature-attribute-value");
  if (row.feature === "laterality") out.push("laterality");
  else if (row.feature === "sublocation") out.push("sublocation");
  else if (isQuantityValues(vals) || (row.feature ?? "").startsWith("Quantity")) out.push("quantity");
  else if (row.feature && hasScalar) out.push("choice");
  if (row.criterialLink && !hasDict) out.push("criterial-choice");
  if (row.multiple) out.push("multiple");
  return out;
}

/** Quantity-style value tokens used by the extractor (TemporalValue, CountValue, …). */
export function isQuantityValues(values: unknown[]): boolean {
  if (!values.length) return false;
  return values.every((v) => typeof v === "string" && /Value$/.test(v));
}

export function isQuantityRow(row: FormRow): boolean {
  return (
    isQuantityValues(row.values ?? [])
    || (row.feature ?? "").startsWith("Quantity")
    || row.feature === "hasQuantity"
    || row.feature === "hasManyValuedQuantity"
  );
}

/**
 * Constructs the remake does not yet render fully. Examinations are rendered
 * when the exam catalogue can resolve every named exam; otherwise the form
 * is partial with missing-exam-definition.
 */
export function assessFormCoverage(form: RemakeForm, examNames?: Set<string> | ReadonlySet<string>): FormCoverage {
  const unsupported: string[] = [];
  const rows = [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])];
  for (const row of rows) {
    if (!row.feature && !row.criterialLink) unsupported.push("row-without-key");
    if (row.feature && (row.values ?? []).some((v) => v && typeof v === "object")) {
      unsupported.push("feature-attribute-value");
    }
  }
  if (form.examinations?.length) {
    const missing = form.examinations.filter((ex) => ex.exam && !examNames?.has(ex.exam));
    if (missing.length) unsupported.push("missing-exam-definition");
  }
  const unique = [...new Set(unsupported)];
  const empty =
    rows.length === 0 &&
    !(form.associatedSymptomsAndSigns?.length) &&
    !(form.diagnoses?.length) &&
    !(form.otherLinks?.length) &&
    !(form.examinations?.length);
  let level: RenderLevel = "full";
  if (unique.length) {
    level = "partial";
    // row-without-key and feature-attribute-value are partial, not none —
    // the rest of the form still renders.
    if (rows.length === 0 && !form.associatedSymptomsAndSigns?.length && !form.examinations?.length) level = "none";
  }
  // A form we could not identify would be "none"; formFromExtractDoc already dropped those.
  return { topic: form.topic, level, unsupported: unique, empty };
}

export function assessCoverage(
  forms: Record<string, RemakeForm>,
  examNames?: Set<string> | ReadonlySet<string>,
): CoverageReport {
  const items = Object.keys(forms)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((t) => assessFormCoverage(forms[t]!, examNames));
  const constructs: Record<string, { count: number; examples: string[] }> = {};
  const bump = (name: string, topic: string) => {
    const slot = (constructs[name] ??= { count: 0, examples: [] });
    slot.count += 1;
    if (slot.examples.length < 5 && !slot.examples.includes(topic)) slot.examples.push(topic);
  };
  for (const form of Object.values(forms)) {
    for (const row of [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])]) {
      for (const c of rowConstructs(row)) bump(c, form.topic);
    }
    if (form.associatedSymptomsAndSigns?.length) bump("associated", form.topic);
    if (form.diagnoses?.length) bump("diagnoses", form.topic);
    if (form.otherLinks?.length) bump("otherLinks", form.topic);
    if (form.moreLayer?.length) bump("moreLayer", form.topic);
    if (form.examinations?.length) bump("examinations", form.topic);
    if (assessFormCoverage(form).empty) bump("empty", form.topic);
  }
  return {
    total: items.length,
    full: items.filter((i) => i.level === "full").length,
    partial: items.filter((i) => i.level === "partial").length,
    none: items.filter((i) => i.level === "none").length,
    empty: items.filter((i) => i.empty).length,
    constructs,
    forms: items,
  };
}

export interface DirReader {
  read(path: string): string;
  exists(path: string): boolean;
  listFiles(dir: string): string[];
}

/** Load every YAML file under the extract forms directory, except index.yaml. */
export function loadExtractFromDir(root: string, io: DirReader, parseYaml: (text: string) => unknown): ExtractInput {
  const formsDir = joinPath(root, "forms");
  const files = io.exists(formsDir) ? walkYaml(formsDir, io) : [];
  const forms: Record<string, unknown> = {};
  for (const file of files) {
    const base = file.split("/").pop() ?? file;
    if (base === "index.yaml" || base === "index.yml") continue;
    const doc = parseYaml(io.read(file));
    const topic =
      doc && typeof doc === "object" && typeof (doc as { topic?: unknown }).topic === "string"
        ? (doc as { topic: string }).topic
        : base.replace(/\.ya?ml$/, "");
    forms[topic] = doc;
  }
  const optionalYaml = (file: string): unknown | undefined => {
    const path = joinPath(root, file);
    if (!io.exists(path)) return undefined;
    return parseYaml(io.read(path));
  };
  const examsDoc = optionalYaml("exams.yaml") ?? optionalYaml("exams.yml");
  const conceptsDoc = optionalYaml("concepts.yaml") ?? optionalYaml("concepts.yml");
  const rulesDoc = optionalYaml("sentence-rules.yaml") ?? optionalYaml("sentence-rules.yml");
  const linksDoc = optionalYaml("concept-links.yaml") ?? optionalYaml("concept-links.yml");
  const asMap = (doc: unknown): Record<string, unknown> | undefined =>
    doc && typeof doc === "object" && !Array.isArray(doc) ? (doc as Record<string, unknown>) : undefined;
  return {
    forms,
    exams: asMap(examsDoc),
    concepts: asMap(conceptsDoc),
    sentenceRules: rulesDoc,
    conceptLinks: asMap(linksDoc),
  };
}

function walkYaml(dir: string, io: DirReader): string[] {
  const out: string[] = [];
  for (const name of io.listFiles(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const path = joinPath(dir, name);
    if (name.endsWith(".yaml") || name.endsWith(".yml")) out.push(path);
    else if (!name.includes(".")) {
      // directory entries are listed as names; listFiles should return both files and dirs
      try {
        out.push(...walkYaml(path, io));
      } catch {
        // not a directory
      }
    }
  }
  return out;
}

function joinPath(a: string, b: string): string {
  if (!a) return b;
  if (a.endsWith("/")) return a + b;
  return `${a}/${b}`;
}
