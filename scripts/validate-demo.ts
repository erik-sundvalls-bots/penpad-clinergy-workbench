import { findingsFromState, gpVisitState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { painForm } from "../src/knowledge.ts";
import { historyNarrativeText } from "../src/summary.ts";

const state = gpVisitState();
const narrative = historyNarrativeText(findingsFromState(state, painForm.diagnoses), "en");
const built = buildVisit(state, narrative);
const checked = await validateComposition(built.canonical);
console.log(JSON.stringify(checked, null, 2));