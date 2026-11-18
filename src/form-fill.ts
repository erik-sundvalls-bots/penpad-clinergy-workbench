import { painForm, swellingForm, type FormRow } from "./knowledge.ts";
import type { ExamSide, FindingForm, WorkbenchState } from "./model.ts";

function moreLayerAnswered(form: FindingForm, layer: FormRow[] | undefined): boolean {
  for (const row of layer ?? []) {
    const feature = row.feature;
    if (!feature) continue;
    if (form.choices[feature]) return true;
  }
  return false;
}

/** True when any descriptor on the pain form's hidden "more >>" layer has a value. */
export function painMoreLayerFilled(state: WorkbenchState): boolean {
  return moreLayerAnswered(state.pain, painForm.moreLayer);
}

/** True when swelling's more dialog has answers beyond the always-visible rows. */
export function swellingMoreFilled(state: WorkbenchState): boolean {
  if (moreLayerAnswered(state.swelling, swellingForm.moreLayer)) return true;
  if (state.stiffness) return true;
  return Object.values(state.consequences).some((value) => value);
}

/** True when the examination "more…" dialog for this side has any answer. */
export function examMoreFilled(side: ExamSide): boolean {
  return Boolean(
    side.tenderness ||
      side.flexionRange ||
      side.flexionPain ||
      side.extensionRange ||
      side.extensionPain ||
      side.abductionRange ||
      side.abductionPain ||
      side.adductionRange ||
      side.adductionPain,
  );
}