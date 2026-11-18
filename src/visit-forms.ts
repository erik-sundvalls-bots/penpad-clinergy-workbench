import { painForm } from "./knowledge.ts";
import type { WorkbenchState } from "./model.ts";
import type { FormLink } from "./knowledge.ts";

/** Disease topics that have a detail form in the visit UI. */
export const DISEASE_DETAIL_TOPICS = ["ThumbSprain", "ThumbFracture"] as const;

export type DiseaseDetailTopic = (typeof DISEASE_DETAIL_TOPICS)[number];

export function diagnosisItemToTopic(item: string): string {
  const link = painForm.diagnoses.find((row) => row.item === item);
  return link?.preCoordinated ?? item;
}

/** Detail form visible when the diagnosis row is present or possible. */
export function showsDiseaseDetail(summary: string | null | undefined): boolean {
  return summary === "presence" || summary === "possible";
}

/** Drop disease descriptor answers when the diagnosis is not present/possible. */
export function syncDiseaseFormAnswers(state: WorkbenchState, item?: string): void {
  const items = item ? [item] : painForm.diagnoses.map((row) => row.item);
  for (const diagnosisItem of items) {
    if (showsDiseaseDetail(state.diagnoses[diagnosisItem])) continue;
    const topic = diagnosisItemToTopic(diagnosisItem);
    delete state.formAnswers[topic];
    delete state.formAnswers[diagnosisItem];
  }
}

export function visibleDiseaseDetailTopics(state: WorkbenchState): DiseaseDetailTopic[] {
  return DISEASE_DETAIL_TOPICS.filter((topic) =>
    showsDiseaseDetail(state.diagnoses[topic]),
  );
}

/** Diagnosis links for findings and openEHR (always from the thumb pain form). */
export function visitDiagnosisLinks(): FormLink[] {
  return painForm.diagnoses;
}