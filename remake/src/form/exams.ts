/**
 * Deterministic exam catalogue: extractor exams.yaml + concept features
 * → remake exam definitions and incomplete-sign forms.
 *
 * Same input always yields byte-identical output: keys are sorted, ids are
 * the extractor exam and sign names, and the writer never emits timestamps.
 *
 * signs0 is the entry list (the same choice the form generator already
 * stored on FormExam.signs). When signs1 differs, the original names are
 * kept on the definition for provenance; suffixes " S" and " S+" are
 * stripped before resolving a sign topic. The meaning of those suffixes
 * is not spelled out in the extract, so the remake does not invent a
 * second entry mode for them.
 */
import type { FormRow, RemakeForm } from "../knowledge-data.ts";
import { formFromExtractDoc, sortKeysDeep, stripForbidden } from "./generate.ts";

export const GENERATED_EXAMS_SCHEMA = "penpad-remake-exams/v1";

export type ExamGroup = "root" | "system" | "location" | "sub" | string;

export interface ExamDefinition {
  name: string;
  display: string;
  group: string | null;
  lateral: boolean;
  super: string | null;
  level: number | null;
  baseSign: string | null;
  baseLocation: string | null;
  /** Canonical signs0 names, suffixes stripped. */
  signs: string[];
  /** Original signs0 strings when they differed from the canonical list. */
  signs0Raw?: string[];
  /** Canonical signs1, only when it differs from signs after stripping. */
  signs1?: string[];
  signs1Raw?: string[];
  subExams: string[];
  symptomLinks?: string[];
}

export interface GeneratedExamsCatalog {
  schema: typeof GENERATED_EXAMS_SCHEMA;
  exams: Record<string, ExamDefinition>;
  /** Incomplete signs (no complete-topic form) generated from concept features. */
  signs: Record<string, RemakeForm>;
  /** Parsed summary-type value sets, used for status chips. */
  summaryTypes: Record<string, SummaryOption[]>;
}

export interface SummaryOption {
  attribute: string;
  value: string;
}

export interface ExamExtractInput {
  exams: Record<string, unknown>;
  concepts?: Record<string, unknown>;
  /** Already-generated complete-topic forms, so we do not duplicate them under signs. */
  completeForms?: Record<string, RemakeForm>;
  summaryTypes?: string[];
}

const EXAM_KEYS = [
  "name",
  "group",
  "lateral",
  "super",
  "level",
  "baseSign",
  "baseLocation",
  "signs0",
  "signs1",
  "subExams",
  "symptomLinks",
] as const;

/** Engine suffix on some signs1 names; not part of the topic id. */
export function canonicalSignName(name: string): string {
  return name.replace(/\s+S\+?\s*$/, "").trim();
}

export function parseSummaryTypeLine(line: string): { name: string; options: SummaryOption[] } | null {
  const cut = line.indexOf(":");
  if (cut <= 0) return null;
  const name = line.slice(0, cut).trim();
  const options: SummaryOption[] = [];
  const re = /\{\s*(\S+)\s+(\S+)\s*\}/g;
  let m: RegExpExecArray | null;
  const rest = line.slice(cut + 1);
  while ((m = re.exec(rest))) {
    options.push({ attribute: m[1], value: m[2] });
  }
  if (!name) return null;
  return { name, options };
}

export function parseSummaryTypes(lines: unknown): Record<string, SummaryOption[]> {
  const out: Record<string, SummaryOption[]> = {};
  if (!Array.isArray(lines)) return out;
  for (const line of lines) {
    if (typeof line !== "string") continue;
    const parsed = parseSummaryTypeLine(line);
    if (parsed) out[parsed.name] = parsed.options;
  }
  return out;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function asStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function nonempty(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

function conceptDisplayOf(concepts: Record<string, unknown>, name: string | null): string | null {
  if (!name) return null;
  const display = asRecord(concepts[name]).display;
  return typeof display === "string" && display.trim() ? display : null;
}

function humanizeExamName(name: string): string {
  return name.replace(/Exam$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

export function examFromExtractDoc(
  doc: unknown,
  concepts: Record<string, unknown> = {},
): ExamDefinition | null {
  if (!doc || typeof doc !== "object") return null;
  const cleaned = stripForbidden(doc) as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const k of EXAM_KEYS) {
    if (cleaned[k] !== undefined) picked[k] = cleaned[k];
  }
  const name = nonempty(picked.name) ?? nonempty(cleaned.name);
  if (!name) return null;
  const signs0Raw = asStringList(picked.signs0);
  const signs1Raw = asStringList(picked.signs1);
  const signs = unique(signs0Raw.map(canonicalSignName).filter(Boolean));
  const signs1 = unique(signs1Raw.map(canonicalSignName).filter(Boolean));
  const signs1Differs = signs1.length !== signs.length || signs1.some((s, i) => s !== signs[i]);
  const baseLocation = nonempty(picked.baseLocation);
  const display =
    conceptDisplayOf(concepts, baseLocation) ??
    conceptDisplayOf(concepts, nonempty(picked.baseSign)) ??
    humanizeExamName(name);
  const def: ExamDefinition = {
    name,
    display,
    group: nonempty(picked.group),
    lateral: picked.lateral === true,
    super: nonempty(picked.super),
    level: typeof picked.level === "number" ? picked.level : null,
    baseSign: nonempty(picked.baseSign),
    baseLocation,
    signs,
    subExams: asStringList(picked.subExams),
  };
  if (signs0Raw.some((s, i) => canonicalSignName(s) !== signs[i] || s !== signs[i])) {
    def.signs0Raw = signs0Raw;
  }
  if (signs1Differs && signs1.length) def.signs1 = signs1;
  if (signs1Raw.length && (signs1Differs || signs1Raw.some((s, i) => s !== (signs1[i] ?? "")))) {
    if (signs1Raw.some((s) => s !== canonicalSignName(s))) def.signs1Raw = signs1Raw;
  }
  const links = asStringList(picked.symptomLinks);
  if (links.length) def.symptomLinks = links;
  return def;
}

function unique(items: string[]): string[] {
  const out: string[] = [];
  for (const item of items) {
    if (!out.includes(item)) out.push(item);
  }
  return out;
}

function layerOf(raw: Record<string, unknown>): "first" | "more" {
  return raw.layer === "more" ? "more" : "first";
}

/** Build a remake form for a sign concept that has no complete-topic form YAML. */
export function signFormFromConcept(name: string, conceptDoc: unknown): RemakeForm | null {
  if (!conceptDoc || typeof conceptDoc !== "object") return null;
  const cleaned = asRecord(stripForbidden(conceptDoc));
  const firstLayer: FormRow[] = [];
  const moreLayer: FormRow[] = [];
  const push = (row: FormRow, layer: "first" | "more") => {
    (layer === "more" ? moreLayer : firstLayer).push(row);
  };
  for (const raw of Array.isArray(cleaned.visibleFeatures) ? cleaned.visibleFeatures : []) {
    const rec = asRecord(raw);
    const feature = nonempty(rec.feature);
    if (!feature) continue;
    const row: FormRow = {
      feature,
      values: Array.isArray(rec.values) ? rec.values : [],
    };
    if (typeof rec.inheritance === "string") row.inheritance = rec.inheritance;
    push(row, layerOf(rec));
  }
  for (const raw of Array.isArray(cleaned.criterialLinkSummaries) ? cleaned.criterialLinkSummaries : []) {
    const rec = asRecord(raw);
    const criterialLink = nonempty(rec.criterialLink);
    if (!criterialLink) continue;
    const row: FormRow = {
      criterialLink,
      values: Array.isArray(rec.values) ? rec.values : [],
    };
    if (typeof rec.inheritance === "string") row.inheritance = rec.inheritance;
    push(row, layerOf(rec));
  }
  const display = typeof cleaned.display === "string" && cleaned.display.trim() ? cleaned.display : humanizeExamName(name);
  const category = typeof cleaned.category === "string" ? cleaned.category : "sign";
  const summaryType = typeof cleaned.summaryType === "string" && cleaned.summaryType !== "No Summary"
    ? cleaned.summaryType
    : "AbsentPresent";
  return {
    topic: name,
    display,
    category,
    summaryType,
    location: typeof cleaned.location === "string" ? cleaned.location : null,
    firstLayer,
    moreLayer,
    associatedSymptomsAndSigns: [],
    diagnoses: [],
    examinations: [],
  };
}

function collectSignNames(exams: Record<string, ExamDefinition>): string[] {
  const names: string[] = [];
  for (const exam of Object.values(exams)) {
    if (exam.baseSign) names.push(exam.baseSign);
    names.push(...exam.signs);
    if (exam.signs1) names.push(...exam.signs1);
  }
  return unique(names).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function generateRemakeExams(input: ExamExtractInput): GeneratedExamsCatalog {
  const concepts = input.concepts ?? {};
  const exams: Record<string, ExamDefinition> = {};
  const keys = Object.keys(input.exams).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const key of keys) {
    const exam = examFromExtractDoc(input.exams[key], concepts);
    if (!exam) continue;
    exams[exam.name] = exam;
  }
  const complete = input.completeForms ?? {};
  const signs: Record<string, RemakeForm> = {};
  for (const name of collectSignNames(exams)) {
    if (complete[name]) continue;
    const fromConcept = signFormFromConcept(name, concepts[name]);
    if (fromConcept) {
      signs[name] = fromConcept;
      continue;
    }
    const formDoc = concepts[name];
    const asForm = formDoc ? formFromExtractDoc({ ...(asRecord(formDoc)), topic: name }) : null;
    if (asForm && (asForm.firstLayer.length || asForm.moreLayer.length || asForm.summaryType)) {
      signs[name] = asForm;
    }
  }
  return {
    schema: GENERATED_EXAMS_SCHEMA,
    exams,
    signs,
    summaryTypes: parseSummaryTypes(input.summaryTypes ?? []),
  };
}

export function examCatalogFromUnknown(data: unknown): GeneratedExamsCatalog | null {
  const rec = asRecord(data);
  if (rec.schema !== GENERATED_EXAMS_SCHEMA) return null;
  if (!rec.exams || typeof rec.exams !== "object") return null;
  return rec as unknown as GeneratedExamsCatalog;
}

/** Stable clone used in tests; generate.ts already exports stableStringify. */
export function sortExamCatalog(catalog: GeneratedExamsCatalog): GeneratedExamsCatalog {
  return sortKeysDeep(catalog) as GeneratedExamsCatalog;
}
