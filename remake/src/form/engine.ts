import type { Finding, Qualifier } from "../sentence/types.ts";
import type { FormLink, FormRow, RemakeForm } from "../knowledge-data.ts";
import { formOf, topicDisplay } from "../knowledge-data.ts";

export const DURATION_UNITS = ["second", "minute", "hour", "day", "week", "month", "year"] as const;

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
  return {
    topic: form.topic,
    location: extras?.location ?? form.location,
    laterality: extras?.laterality ? [...extras.laterality] : [],
    subLocation: extras?.subLocation,
    features: {},
    associated: {},
    diagnoses: {},
    comment: "",
    moreOpen: false,
  };
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
    if (!row.feature || row.feature === "laterality") continue;
    const sel = state.features[row.feature];
    if (!sel) continue;
    if (sel.values.includes("TemporalValue") && sel.number && sel.unit) {
      out.push({ descriptor: row.feature, value: "TemporalValue", number: sel.number, unit: sel.unit });
      continue;
    }
    for (const value of sel.values) {
      if (value === "TemporalValue") continue;
      out.push({ descriptor: row.feature, value });
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

export function valueLabel(value: string): string {
  if (value === "leftSelection") return "left";
  if (value === "rightSelection") return "right";
  if (value === "TemporalValue") return "duration";
  return value.replace(/Selection$/, "").replace(/Pain$/, "").replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
}

export function linkLabel(link: FormLink): string {
  if (link.preCoordinated) return topicDisplay(link.preCoordinated);
  const loc = link.location ? ` ${link.preposition ?? ""} ${link.location}`.replace(/\s+/g, " ") : "";
  return `${topicDisplay(link.concept)}${loc}`;
}

export function rowsOf(form: RemakeForm, moreOpen: boolean): FormRow[] {
  return moreOpen ? [...form.firstLayer, ...form.moreLayer] : [...form.firstLayer];
}

export function hasMoreLayer(form: RemakeForm): boolean {
  return (form.moreLayer?.length ?? 0) > 0;
}
