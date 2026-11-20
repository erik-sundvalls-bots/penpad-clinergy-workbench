import { displayOf } from "../forms/catalog.ts";
import { sideExaminations, type ExamMovement, type NoteLanguage, type SideExamination } from "../exam/prose.ts";
import { findingsFromState, type WorkbenchState } from "../model.ts";
import { painForm } from "../knowledge.ts";
import { term } from "../openehr/terms.ts";
import { narrativeMappings } from "../snomed/narrative-mappings.ts";
import { historyFindings } from "../summary.ts";

export const SNOMED = "http://snomed.info/sct";
export const OBS_CATEGORY = "http://terminology.hl7.org/CodeSystem/observation-category";
export const CONDITION_CLINICAL = "http://terminology.hl7.org/CodeSystem/condition-clinical";
export const CONDITION_VER = "http://terminology.hl7.org/CodeSystem/condition-ver-status";
/** Mirrors openEHR problem_qualifier coded progression / resolution on Condition. */
export const CLINERGY_QUALIFIER_EXT =
  "https://erik-sundvalls-bots.github.io/penpad-clinergy-workbench/fhir/StructureDefinition/problem-qualifier";
export const ACT_CODE = "http://terminology.hl7.org/CodeSystem/v3-ActCode";
export const DEMO_PATIENT_ID = "demo-john-parsons";
const TIME = "2021-10-21T14:21:00+01:00";

export interface FhirCoding {
  system: string;
  code: string;
  display: string;
}

/** Verified SNOMED only. Unverified bindings are not written. */
export function snomedOf(key: string): FhirCoding | null {
  const row = term(key);
  if (!row?.snomed.verified || !row.snomed.code) return null;
  return {
    system: SNOMED,
    code: row.snomed.code,
    display: row.snomed.preferred || row.snomed.fsn || row.preferred,
  };
}

/** Laterality at-codes from CLUSTER.anatomical_location.v1. */
function bodySiteFrom(hits: CodedHit[]): { bodySite?: Record<string, unknown> } {
  const right = hits.some((hit) => hit.code === "at0004");
  const left = hits.some((hit) => hit.code === "at0003");
  const both = hits.some((hit) => hit.code === "at0083") || (left && right);
  const side = both ? "right and left" : right ? "right" : left ? "left" : "";
  if (!side) return {};
  const thumb = snomedOf("Thumb");
  return {
    bodySite: {
      ...(thumb ? { coding: [thumb] } : {}),
      text: `${side} thumb`,
    },
  };
}

function compositionLanguage(canonical: Record<string, unknown>): NoteLanguage {
  const code = (canonical.language as { code_string?: string } | undefined)?.code_string;
  return code === "sv" ? "sv" : "en";
}

function conceptText(key: string): string {
  return displayOf(key).replace(/ sign$/i, "");
}

function codeable(key: string, text: string, extra: FhirCoding[] = []): Record<string, unknown> {
  const coding = snomedOf(key);
  const codings = [...(coding ? [coding] : []), ...extra];
  return codings.length ? { coding: codings, text } : { text };
}

/**
 * A post-coordinated expression as a SNOMED CT coding. FHIR `code` allows
 * no line breaks or repeated spaces, so the code has its whitespace
 * collapsed (insignificant in Compositional Grammar). The display keeps the
 * expression exactly as the openEHR mapping and the sidebar have it.
 */
export function expressionCoding(expression: string): FhirCoding {
  return { system: SNOMED, code: expression.replace(/\s+/g, " ").trim(), display: expression };
}

/** SNOMED CT expressions on a DV_TEXT's TERM_MAPPINGs. */
function snomedMappingsOf(value: unknown): string[] {
  const mappings = (value as { mappings?: unknown } | undefined)?.mappings;
  if (!Array.isArray(mappings)) return [];
  return mappings
    .map((row) => (row as { target?: { terminology_id?: { value?: string }; code_string?: string } }).target)
    .filter((target) => target?.terminology_id?.value === "SNOMED-CT" && target.code_string)
    .map((target) => String(target?.code_string));
}

/**
 * Story expressions by finding topic. Only expressions the composition's
 * story text actually carries are returned, so a caller-written story adds
 * nothing.
 */
function storyExpressions(state: WorkbenchState, storyValue: unknown): Map<string, string> {
  const carried = new Set(snomedMappingsOf(storyValue));
  const out = new Map<string, string>();
  if (!carried.size) return out;
  for (const row of narrativeMappings(historyFindings(findingsFromState(state, painForm.diagnoses)))) {
    if (carried.has(row.expression)) out.set(row.topic, row.expression);
  }
  return out;
}

export function demoPatient(): Record<string, unknown> {
  return {
    resourceType: "Patient",
    id: DEMO_PATIENT_ID,
    identifier: [{
      system: "https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/",
      value: "13459",
    }],
    name: [{ text: "John Parsons", family: "Parsons", given: ["John"] }],
  };
}

interface CodedHit {
  code: string;
  text: string;
}

function walkCoded(node: unknown, hits: CodedHit[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walkCoded(child, hits);
    return;
  }
  const record = node as Record<string, unknown>;
  if (record._type === "DV_CODED_TEXT") {
    const code = (record.defining_code as { code_string?: string; terminology_id?: { value?: string } })?.code_string;
    const terminology = (record.defining_code as { terminology_id?: { value?: string } })?.terminology_id?.value;
    if (code && (terminology === "Clinergy" || terminology === "local")) {
      hits.push({ code, text: String(record.value ?? code) });
    }
  }
  for (const value of Object.values(record)) walkCoded(value, hits);
}

function sectionItems(canonical: Record<string, unknown>, name: string): Record<string, unknown>[] {
  const content = Array.isArray(canonical.content) ? canonical.content as Record<string, unknown>[] : [];
  const section = content.find((item) => (item.name as { value?: string })?.value === name);
  return Array.isArray(section?.items) ? section.items as Record<string, unknown>[] : [];
}

const ABSENT_SNOMED = "2667000";

function screeningObservations(
  historyItems: Record<string, unknown>[],
  encounterId: string,
): Record<string, unknown>[] {
  const resources: Record<string, unknown>[] = [];
  let index = 0;
  for (const entry of historyItems) {
    if (entry.archetype_node_id !== "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1") continue;
    const data = entry.data as { events?: { data?: { items?: Record<string, unknown>[] } }[] };
    const clusters = data.events?.[0]?.data?.items ?? [];
    for (const cluster of clusters) {
      if ((cluster as { _type?: string })._type !== "CLUSTER") continue;
      const hits: CodedHit[] = [];
      walkCoded(cluster, hits);
      const name = hits.find((hit) => hit.code.endsWith("Symptom") || hit.code.startsWith("Conseq"));
      const absent = hits.some((hit) => hit.code === "at0024");
      if (!name || !absent) continue;
      index += 1;
      resources.push({
        resourceType: "Observation",
        id: `screening-${index}`,
        status: "final",
        code: codeable(name.code, name.text),
        ...bodySiteFrom(hits),
        subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: TIME,
        valueCodeableConcept: {
          coding: [{ system: SNOMED, code: ABSENT_SNOMED, display: "Absent" }],
          text: "Absent",
        },
      });
    }
  }
  return resources;
}

function examObservationResource(
  examined: SideExamination,
  encounterId: string,
  supplementalNote?: string,
): Record<string, unknown> {
  const site = snomedOf(examined.siteKey);
  const sideLabel = examined.side === "left" ? "Left" : "Right";
  const components: Record<string, unknown>[] = [];
  if (examined.status) {
    components.push({
      code: { text: "Clinical interpretation" },
      valueCodeableConcept: codeable(examined.status, conceptText(examined.status)),
    });
  }
  for (const sign of examined.signs) {
    components.push({
      code: codeable(sign.sign, conceptText(sign.sign)),
      valueCodeableConcept: codeable(sign.value, conceptText(sign.value)),
    });
  }
  for (const movement of examined.movements) {
    components.push(...movementComponents(movement));
  }
  const resource: Record<string, unknown> = {
    resourceType: "Observation",
    id: `exam-${examined.side}`,
    status: "final",
    category: [{
      coding: [{ system: OBS_CATEGORY, code: "exam", display: "Exam" }],
      text: "Exam",
    }],
    code: { text: "Physical examination findings" },
    bodySite: {
      ...(site ? { coding: [site] } : {}),
      text: `${sideLabel} ${conceptText(examined.siteKey).toLowerCase()}`,
    },
    subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
    encounter: { reference: `Encounter/${encounterId}` },
    effectiveDateTime: TIME,
  };
  const notes: { text: string }[] = [];
  if (examined.prose.trim()) notes.push({ text: examined.prose });
  if (supplementalNote?.trim()) notes.push({ text: supplementalNote.trim() });
  if (notes.length) resource.note = notes;
  if (components.length) resource.component = components;
  return resource;
}

function movementComponents(movement: ExamMovement): Record<string, unknown>[] {
  const name = conceptText(movement.sign);
  const out: Record<string, unknown>[] = [];
  if (movement.range) {
    out.push({
      code: codeable(movement.sign, name),
      valueCodeableConcept: codeable(movement.range, `${movement.range} range`),
    });
  }
  if (movement.pain) {
    const pain = snomedOf("painOnMovement");
    out.push({
      code: {
        ...(pain ? { coding: [pain] } : {}),
        text: `${name} pain on movement`,
      },
      valueCodeableConcept: codeable(movement.pain, conceptText(movement.pain)),
    });
  }
  return out;
}

function textOf(node: Record<string, unknown> | undefined): string {
  const value = node?.value as { _type?: string; value?: string } | undefined;
  return value?._type === "DV_TEXT" ? String(value.value ?? "") : "";
}

function problemQualifierExtensions(entry: Record<string, unknown>): Record<string, unknown>[] {
  const data = entry.data as { items?: Record<string, unknown>[] } | undefined;
  const cluster = data?.items?.find(
    (item) =>
      item._type === "CLUSTER" &&
      item.archetype_node_id === "at0046" &&
      (item.archetype_details as { archetype_id?: { value?: string } })?.archetype_id?.value?.includes(
        "problem_qualifier",
      ),
  );
  if (!cluster) return [];
  const hits: CodedHit[] = [];
  walkCoded(cluster, hits);
  const locals = hits.filter((hit) => hit.code.startsWith("at0"));
  if (!locals.length) return [];
  return [{
    url: CLINERGY_QUALIFIER_EXT,
    extension: locals.map((hit) => ({
      url: "qualifier",
      valueCodeableConcept: {
        coding: [{ system: "local", code: hit.code, display: hit.text }],
        text: hit.text,
      },
    })),
  }];
}

/**
 * FHIR R4 collection for the same visit the openEHR composition records.
 * Examination findings are Observations in category `exam`.
 * Presenting symptoms are Observations without that category.
 * Diagnoses are Conditions. A plan is a CarePlan whose description is the
 * recommendation narrative.
 */
export function buildFhirBundle(
  state: WorkbenchState,
  canonical: Record<string, unknown>,
): Record<string, unknown> {
  const patient = demoPatient();
  const encounterId = "encounter";
  const resources: Record<string, unknown>[] = [
    patient,
    {
      resourceType: "Encounter",
      id: encounterId,
      status: "finished",
      class: { system: ACT_CODE, code: "AMB", display: "ambulatory" },
      type: [{ text: "primary medical care" }],
      subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
      participant: [{ individual: { display: "Dr J Brown" } }],
      period: { start: TIME },
    },
  ];

  const story = sectionItems(canonical, "History");
  let symptomIndex = 0;
  for (const entry of story) {
    if (entry.archetype_node_id !== "openEHR-EHR-OBSERVATION.story.v1") continue;
    const data = entry.data as { events?: { data?: { items?: Record<string, unknown>[] } }[] };
    const items = data.events?.[0]?.data?.items ?? [];
    const narrative = items.find((item) => item.archetype_node_id === "at0004");
    const storyText = textOf(narrative);
    const expressions = storyExpressions(state, narrative?.value);
    if (storyText) {
      resources.push({
        resourceType: "Observation",
        id: "history-story",
        status: "final",
        code: { text: "Story" },
        subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: TIME,
        valueString: storyText,
      });
    }
    for (const item of items) {
      if (item.archetype_node_id !== "openEHR-EHR-CLUSTER.symptom_sign.v2") continue;
      const hits: CodedHit[] = [];
      walkCoded(item, hits);
      const name = hits.find((hit) => hit.code.endsWith("Symptom") || hit.code.startsWith("Conseq")) ?? hits[0];
      if (!name) continue;
      symptomIndex += 1;
      const expression = expressions.get(name.code);
      resources.push({
        resourceType: "Observation",
        id: `symptom-${symptomIndex}`,
        status: "final",
        code: codeable(name.code, name.text, expression ? [expressionCoding(expression)] : []),
        ...bodySiteFrom(hits),
        subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
        encounter: { reference: `Encounter/${encounterId}` },
        effectiveDateTime: TIME,
        valueString: name.text,
      });
    }
  }
  resources.push(...screeningObservations(story, encounterId));

  const noteLanguage = compositionLanguage(canonical);
  const examComment = state.comment?.trim() ?? "";
  let commentAttached = false;
  for (const examined of sideExaminations(state, noteLanguage)) {
    const extra = !commentAttached && examComment ? examComment : undefined;
    if (extra) commentAttached = true;
    resources.push(examObservationResource(examined, encounterId, extra));
  }

  const assessment = sectionItems(canonical, "Assessment");
  let conditionIndex = 0;
  for (const entry of assessment) {
    const hits: CodedHit[] = [];
    walkCoded(entry, hits);
    const name = hits.find((hit) => !hit.code.startsWith("at"));
    if (!name) continue;
    const codes = hits.map((hit) => hit.code);
    const suspected = codes.includes("at0074");
    const excluded = entry.archetype_node_id === "openEHR-EHR-EVALUATION.exclusion_specific.v1";
    conditionIndex += 1;
    const verification = excluded ? "refuted" : suspected ? "provisional" : "confirmed";
    const clinical = excluded ? "inactive" : "active";
    const data = entry.data as { items?: Record<string, unknown>[] } | undefined;
    const qualifierExt = problemQualifierExtensions(entry);
    const descriptionItem = (data?.items ?? []).find((item) => item.archetype_node_id === "at0009");
    const description = textOf(descriptionItem);
    const diagnosisExpressions = snomedMappingsOf(descriptionItem?.value).map(expressionCoding);
    resources.push({
      resourceType: "Condition",
      id: `condition-${conditionIndex}`,
      clinicalStatus: {
        coding: [{ system: CONDITION_CLINICAL, code: clinical, display: clinical }],
      },
      verificationStatus: {
        coding: [{ system: CONDITION_VER, code: verification, display: verification }],
      },
      code: codeable(name.code, name.text, diagnosisExpressions),
      ...bodySiteFrom(hits),
      ...(description ? { note: [{ text: description }] } : {}),
      ...(qualifierExt.length ? { extension: qualifierExt } : {}),
      subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
      encounter: { reference: `Encounter/${encounterId}` },
    });
  }

  const planItems = sectionItems(canonical, "Plan");
  for (const entry of planItems) {
    const data = entry.data as { items?: Record<string, unknown>[] } | undefined;
    const recommendation = (data?.items ?? []).find((item) => item.archetype_node_id === "at0002");
    const text = textOf(recommendation);
    if (!text) continue;
    resources.push({
      resourceType: "CarePlan",
      id: "plan",
      status: "active",
      intent: "plan",
      title: "Recommendation",
      description: text,
      subject: { reference: `Patient/${DEMO_PATIENT_ID}` },
      encounter: { reference: `Encounter/${encounterId}` },
    });
  }

  return {
    resourceType: "Bundle",
    type: "collection",
    timestamp: TIME,
    entry: resources.map((resource) => ({
      fullUrl: `${resource.resourceType}/${resource.id}`,
      resource,
    })),
  };
}
