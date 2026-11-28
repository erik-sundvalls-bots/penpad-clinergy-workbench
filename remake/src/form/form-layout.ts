/**
 * Presentation layout for a few form families where the generated catalogue
 * puts the wrong list on the summary chips or mis-captions a first-layer row.
 *
 * Vaccinations: "stage" is the dose (first / second / booster) and the form
 * summary is given / required / not required / postponed / refused. Family history: "strength" is none / weak / moderate /
 * strong and "relation" is the relative, not a form summary.
 */
import type { RemakeForm, FormRow } from "../knowledge-data.ts";

export type SummaryTypeOptions = Record<string, Array<{ attribute: string; value: string }>>;

export const VACCINATION_STATUS_SUMMARY = "VaccinationStatus";

export const VACCINATION_STATUS_OPTIONS = [
  { attribute: "hasInterventionStatus", value: "given" },
  { attribute: "hasInterventionStatus", value: "required" },
  { attribute: "hasInterventionStatus", value: "notRequired" },
  { attribute: "hasInterventionStatus", value: "postponed" },
  { attribute: "hasInterventionStatus", value: "refused" },
];

function valuesOf(summaryTypes: SummaryTypeOptions, summaryType: string): string[] {
  return (summaryTypes[summaryType] ?? []).map((row) => row.value);
}

function replaceCaptionedRow(rows: FormRow[], caption: string, next: FormRow): FormRow[] {
  const key = caption.toLowerCase();
  let replaced = false;
  const out = rows.map((row) => {
    if ((row.caption ?? "").toLowerCase() === key) {
      replaced = true;
      return next;
    }
    return row;
  });
  return replaced ? out : [next, ...out];
}

export function applyFormFieldLayout(form: RemakeForm, summaryTypes: SummaryTypeOptions): RemakeForm {
  if (form.summaryType.startsWith("VaccStage")) {
    const stageRow = form.firstLayer.find((row) => row.feature === "hasInterventionStatus");
    if (stageRow) {
      const stages = valuesOf(summaryTypes, form.summaryType);
      const stage: FormRow = {
        caption: "stage",
        feature: "AbsoluteVaccinationStage",
        values: stages,
      };
      const firstLayer = form.firstLayer.filter((row) => row.feature !== "hasInterventionStatus");
      return {
        ...form,
        summaryType: VACCINATION_STATUS_SUMMARY,
        firstLayer: [stage, ...firstLayer],
      };
    }
  }

  if (form.summaryType === "FamilyHistorySummary") {
    const relationRow = form.firstLayer.find((row) => row.feature === "isWithReferenceTo");
    if (relationRow) {
      const strength: FormRow = {
        caption: "strength",
        feature: "AbsoluteStrength",
        values: valuesOf(summaryTypes, "FamilyHistorySummary"),
      };
      const relation: FormRow = {
        ...relationRow,
        caption: "relation",
        feature: "isWithReferenceTo",
      };
      const firstLayer = replaceCaptionedRow(
        form.firstLayer.filter((row) => row.feature !== "isWithReferenceTo"),
        "strength",
        strength,
      );
      // replaceCaptionedRow may have added strength at the front; append relation after it
      const withoutRelation = firstLayer.filter((row) => row.feature !== "isWithReferenceTo");
      const strengthIndex = withoutRelation.findIndex((row) => row.feature === "AbsoluteStrength");
      const nextRows = [...withoutRelation];
      nextRows.splice(strengthIndex < 0 ? 0 : strengthIndex + 1, 0, relation);
      return {
        ...form,
        summaryType: "No Summary",
        firstLayer: nextRows,
      };
    }
  }

  return form;
}
