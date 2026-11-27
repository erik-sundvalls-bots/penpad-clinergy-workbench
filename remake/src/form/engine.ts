import type { Finding, Qualifier } from "../sentence/types.ts";
import type { FormLink, FormRow, RemakeForm } from "../knowledge-data.ts";
import { formOf, topicDisplay } from "../knowledge-data.ts";

export const DURATION_UNITS = ["second", "minute", "hour", "day", "week", "month", "year"] as const;

function isQuantityToken(values: unknown[]): boolean {
  if (values.length !== 1) return false;
  const v = values[0];
  return typeof v === "string" && /Value$/.test(v);
}


export type LateralityChoice = "left" | "right";

export interface FeatureSelection {
  /** Selected value keys, or a duration. */
  values: string[];
  number?: number;
  unit?: string;
}

export interface LinkSelection {
  summary?: string;
  /** Nested form state when the user opened more... and accepted. */
  form?: FormState;
}

export interface FormState {
  topic: string;
  location: string | null;
  laterality: LateralityChoice[];
  subLocation?: string;
  features: Record<string, FeatureSelection>;
  associated: Record<string, LinkSelection>;
  diagnoses: Record<string, LinkSelection>;
  comment: string;
  moreOpen: boolean;
}

export function emptyFormState(form: RemakeForm, extras?: Partial<FormState>): FormState {
  const features: Record<string, FeatureSelection> = {};
  let laterality: LateralityChoice[] = extras?.laterality ? [...extras.laterality] : [];
  let subLocation = extras?.subLocation;
  for (const row of [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])]) {
    if (row.default === undefined) continue;
    const key = rowKey(row);
    if (!key) continue;
    if (key === "laterality") {
      const sides = Array.isArray(row.default) ? row.default : [row.default];
      laterality = sides.filter((s): s is LateralityChoice => s === "left" || s === "right");
      continue;
    }
    if (typeof row.default === "object" && row.default && !Array.isArray(row.default)) {
      const d = row.default as { values?: string[]; number?: number; unit?: string; value?: string };
      features[key] = {
        values: d.values ?? (d.value ? [d.value] : []),
        number: d.number,
        unit: d.unit,
      };
    } else if (Array.isArray(row.default)) {
      features[key] = { values: row.default.map(String) };
    } else {
      features[key] = { values: [String(row.default)] };
    }
    if (key === "sublocation") subLocation = features[key].values[0] ?? subLocation;
  }
  return {
    topic: form.topic,
    location: extras?.location ?? form.location,
    laterality,
    subLocation,
    features,
    associated: {},
    diagnoses: {},
    comment: "",
    moreOpen: false,
  };
}

export function rowKey(row: FormRow): string {
  if (row.feature) return row.feature;
  if (row.criterialLink) return `criterial:${row.criterialLink}`;
  return "";
}

export function valueKey(raw: unknown): string {
  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") return String(raw);
  if (raw && typeof raw === "object" && "value" in raw) return String((raw as { value: unknown }).value);
  return JSON.stringify(raw);
}

export function rowIsVisible(row: FormRow, state: FormState): boolean {
  const cond = row.visibleWhen;
  if (!cond) return true;
  if (cond.feature === "laterality") {
    return cond.values.some((v) => state.laterality.includes(v as LateralityChoice) || state.laterality.includes(v.replace(/Selection$/, "") as LateralityChoice));
  }
  const selected = state.features[cond.feature]?.values ?? [];
  return cond.values.some((v) => selected.includes(v));
}

export function setQuantity(
  state: FormState,
  feature: string,
  valueToken: string,
  number: number | undefined,
  unit: string | undefined,
): FormState {
  const next: FeatureSelection = {
    values: number !== undefined && number > 0 ? [valueToken] : [],
    number: number !== undefined && number > 0 ? number : undefined,
    unit: unit || undefined,
  };
  return { ...state, features: { ...state.features, [feature]: next } };
}

export function setSubLocation(state: FormState, value: string, multiple: boolean): FormState {
  const next = setFeatureValue(state, "sublocation", value, multiple);
  const selected = next.features.sublocation?.values ?? [];
  return { ...next, subLocation: selected[0] };
}

export function toggleLaterality(state: FormState, side: LateralityChoice, multiple: boolean): FormState {
  const has = state.laterality.includes(side);
  let laterality: LateralityChoice[];
  if (multiple) laterality = has ? state.laterality.filter((s) => s !== side) : [...state.laterality, side];
  else laterality = has ? [] : [side];
  return { ...state, laterality };
}

export function setFeatureValue(state: FormState, feature: string, value: string, multiple: boolean): FormState {
  const current = state.features[feature] ?? { values: [] };
  let values: string[];
  if (multiple) {
    values = current.values.includes(value)
      ? current.values.filter((v) => v !== value)
      : [...current.values, value];
  } else {
    values = current.values[0] === value ? [] : [value];
  }
  return { ...state, features: { ...state.features, [feature]: { ...current, values } } };
}

export function setDuration(state: FormState, feature: string, number: number | undefined, unit: string): FormState {
  const current = state.features[feature] ?? { values: ["TemporalValue"] };
  const next: FeatureSelection = {
    values: number && number > 0 ? ["TemporalValue"] : [],
    number: number && number > 0 ? number : undefined,
    unit,
  };
  void current;
  return { ...state, features: { ...state.features, [feature]: next } };
}

export function setLinkSummary(state: FormState, bag: "associated" | "diagnoses", key: string, summary: string | undefined): FormState {
  const current = { ...(state[bag][key] ?? {}) };
  if (!summary) {
    const { [key]: _, ...rest } = state[bag];
    void _;
    return { ...state, [bag]: rest };
  }
  current.summary = summary;
  return { ...state, [bag]: { ...state[bag], [key]: current } };
}

export function lateralityOf(sides: LateralityChoice[]): Finding["laterality"] {
  if (sides.includes("left") && !sides.includes("right")) return "left";
  if (sides.includes("right") && !sides.includes("left")) return "right";
  return undefined;
}

export function lateralityPhrase(sides: LateralityChoice[]): "left" | "right" | "left-and-right" | undefined {
  if (sides.includes("left") && sides.includes("right")) return "left-and-right";
  return lateralityOf(sides);
}

function qualifiersFromFeatures(form: RemakeForm, state: FormState): Qualifier[] {
  const rows = [...form.firstLayer, ...form.moreLayer];
  const out: Qualifier[] = [];
  for (const row of rows) {
    const key = rowKey(row);
    if (!key || key === "laterality" || key === "sublocation") continue;
    const sel = state.features[key];
    if (!sel) continue;
    const token = (row.values ?? []).length === 1 && typeof row.values![0] === "string" ? String(row.values![0]) : undefined;
    if (sel.number && (sel.values.some((v) => /Value$/.test(v)) || isQuantityToken(row.values ?? []))) {
      out.push({
        descriptor: row.criterialLink ?? row.feature ?? key,
        value: sel.values[0] ?? token ?? "TemporalValue",
        number: sel.number,
        unit: sel.unit,
      });
      continue;
    }
    for (const value of sel.values) {
      if (/Value$/.test(value) && !sel.number) continue;
      out.push({ descriptor: row.criterialLink ?? row.feature ?? key, value });
    }
  }
  return out;
}

/** Findings produced by a filled-in form, including accepted associated/diagnosis links. */
export function findingsFromForm(form: RemakeForm, state: FormState): Finding[] {
  const findings: Finding[] = [];
  const sides = lateralityPhrase(state.laterality);
  const base: Finding = {
    topic: form.topic,
    location: state.location ?? undefined,
    laterality: sides === "left" || sides === "right" ? sides : undefined,
    subLocation: state.subLocation,
    qualifiers: qualifiersFromFeatures(form, state),
  };
  // When both sides are selected, emit two laterality-specific sentences (the
  // original multiple:true laterality row). Not a "both" token in the generator.
  if (sides === "left-and-right") {
    findings.push({ ...base, laterality: "left", qualifiers: base.qualifiers.map((q) => ({ ...q })) });
    findings.push({ ...base, laterality: "right", qualifiers: base.qualifiers.map((q) => ({ ...q })) });
  } else {
    findings.push(base);
  }

  const addLinks = (links: FormLink[], bag: Record<string, LinkSelection>) => {
    for (const link of links) {
      const sel = bag[link.item];
      if (!sel) continue;
      if (sel.form) {
        const nestedForm = formOf(sel.form.topic);
        if (nestedForm) {
          const nested = findingsFromForm(nestedForm, sel.form);
          if (sel.summary) {
            for (const f of nested) {
              if (!f.summary) f.summary = sel.summary;
            }
          }
          findings.push(...nested);
          continue;
        }
      }
      if (!sel.summary) continue;
      const topic = sel.form?.topic ?? link.preCoordinated ?? link.concept;
      const loc = sel.form?.location ?? link.location ?? undefined;
      const lat = sel.form ? lateralityOf(sel.form.laterality) : lateralityOf(state.laterality);
      findings.push({
        topic,
        location: loc,
        laterality: lat,
        subLocation: sel.form?.subLocation,
        qualifiers: [],
        summary: sel.summary,
      });
    }
  };
  addLinks(form.associatedSymptomsAndSigns ?? [], state.associated);
  addLinks(form.diagnoses ?? [], state.diagnoses);
  return findings;
}

export function isFormDirty(state: FormState): boolean {
  return (
    state.laterality.length > 0 ||
    state.comment.trim().length > 0 ||
    Object.values(state.features).some((f) => f.values.length > 0 || (f.number ?? 0) > 0) ||
    Object.keys(state.associated).length > 0 ||
    Object.keys(state.diagnoses).length > 0
  );
}

export function featureLabel(feature: string): string {
  if (feature === "laterality") return "Laterality";
  if (feature === "QuantityDuration") return "Duration";
  return feature.replace(/^Absolute/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

export function valueLabel(value: string | unknown): string {
  const key = typeof value === "string" ? value : valueKey(value);
  if (key === "leftSelection") return "left";
  if (key === "rightSelection") return "right";
  if (key === "TemporalValue") return "duration";
  if (/Value$/.test(key)) return "value";
  return key.replace(/Selection$/, "").replace(/Pain$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

export function linkLabel(link: FormLink): string {
  if (link.preCoordinated) return topicDisplay(link.preCoordinated);
  const loc = link.location ? ` ${link.preposition ?? ""} ${link.location}`.replace(/\s+/g, " ") : "";
  return `${topicDisplay(link.concept)}${loc}`;
}

export function rowsOf(form: RemakeForm, moreOpen: boolean, state?: FormState): FormRow[] {
  const rows = moreOpen ? [...form.firstLayer, ...form.moreLayer] : [...form.firstLayer];
  return state ? rows.filter((row) => rowIsVisible(row, state)) : rows;
}

export function hasMoreLayer(form: RemakeForm): boolean {
  return (form.moreLayer?.length ?? 0) > 0;
}
