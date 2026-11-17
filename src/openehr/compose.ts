import { examinationProseForSide, movementKeys, presenceKey, type NoteLanguage } from "../exam/prose.ts";
import { localizePlan } from "../exam/phrases.ts";
import { examsByName, formOf } from "../forms/catalog.ts";
import { knowledge, painForm, swedish, swellingForm, type FormLink } from "../knowledge.ts";
import { render, type Finding } from "../../vendor/sentence.ts";
import { emptyExam, emptyFinding, type ExamSide, type FindingForm, type WorkbenchState } from "../model.ts";
import { term, type Term } from "./terms.ts";
import { GP_TEMPLATE_ID, TEMPLATE_ID } from "./template.ts";

export interface CoverageRow {
  key: string;
  opengalen: "verified" | "unverified" | "missing";
  snomed: "verified" | "unverified" | "missing";
}

export interface ThumbComposition {
  canonical: Record<string, unknown>;
  coverage: CoverageRow[];
  /** Form values used that have no reviewed row at all. */
  missingTerms: string[];
}

const TIME = "2021-10-21T14:21:00+01:00";

const SEVERITY: Record<string, [string, string]> = {
  mild: ["at0023", "Mild"],
  moderate: ["at0024", "Moderate"],
  severe: ["at0025", "Severe"],
};
const PROGRESS: Record<string, [string, string]> = {
  better: ["at0181", "Improving"],
  same: ["at0182", "Unchanged"],
  worse: ["at0183", "Worsening"],
};
/** Local codes on CLUSTER.range_of_motion.v1 (revision 1.0.2) Movement at0002. */
const MOVEMENT: Record<string, [string, string]> = {
  FlexionSign: ["at0006", "Flexion"],
  ExtensionSign: ["at0005", "Extension"],
  AbductionSign: ["at0003", "Abduction"],
  AdductionSign: ["at0004", "Adduction"],
};

/** Local codes on EVALUATION.problem_diagnosis.v1 Severity at0005. */
const PROBLEM_SEVERITY: Record<string, [string, string]> = {
  mild: ["at0047", "Mild"],
  moderate: ["at0048", "Moderate"],
  severe: ["at0049", "Severe"],
};

export interface ComposeOptions {
  /** Write each side's On Examination prose onto CLUSTER.exam Clinical description at0003. */
  clinicalDescription?: boolean;
  /** Write each present or possible diagnosis sentence onto problem/diagnosis Clinical description at0009. */
  embedDiagnosisText?: boolean;
  /** Language of the narrative fields (story is supplied by the caller in this language). */
  language?: NoteLanguage;
}

export function buildThumbEncounter(
  state: WorkbenchState,
  narrative: string,
  options?: ComposeOptions,
): ThumbComposition {
  const used = new Set<string>();
  const touch = (key: string) => used.add(key);

  const historyItems: Record<string, unknown>[] = [storyObservation(narrative, state, touch)];
  const absent = absentSymptoms(state);
  if (absent.length) historyItems.push(screeningObservation(absent, touch));

  const examItems: Record<string, unknown>[] = [];
  const absentTenderness: string[] = [];
  const language = options?.language ?? "en";
  let commentLeft = state.comment?.trim() ?? "";
  for (const side of examSides(state)) {
    const exam = state.exam[side];
    if (!Object.values(exam).some((value) => value)) continue;
    const prose = options?.clinicalDescription ? examinationProseForSide(state, side, language) : "";
    const comment = commentLeft;
    commentLeft = "";
    examItems.push(examObservation(side, exam, touch, absentTenderness, prose, comment));
  }
  if (absentTenderness.length) {
    examItems.push(screeningObservation(
      absentTenderness.map((name) => ({ key: "TendernessSign", label: name })),
      touch,
    ));
  }

  const problems: Record<string, unknown>[] = [];
  const exclusions: Record<string, unknown>[] = [];
  for (const link of diagnosisLinks(state)) {
    const status = state.diagnoses[link.item];
    if (!status) continue;
    const key = link.preCoordinated ?? link.concept;
    touch(key);
    if (link.location) touch(link.location);
    const answer = diseaseAnswer(state, link);
    const sentence = options?.embedDiagnosisText && status !== "excluded"
      ? diagnosisSentence(link, status, language)
      : "";
    if (status === "excluded") exclusions.push(exclusionEvaluation(key, touch));
    else problems.push(problemEvaluation(key, link.location, status === "possible", touch, answer, sentence));
  }

  const planText = localizePlan(state.plan?.trim() ?? "", language);
  const planItems = planText ? [recommendationEvaluation(planText, touch)] : [];
  const content = [
    section("History", historyItems),
    section("Examination", examItems),
    section("Assessment", [...problems, ...exclusions]),
    section("Plan", planItems),
  ].filter((entry) => Array.isArray(entry.items) && entry.items.length > 0);
  const canonical = composition(content, planText ? GP_TEMPLATE_ID : TEMPLATE_ID, language);

  return {
    canonical,
    coverage: [...used].sort().map(coverageOf),
    missingTerms: [...used].filter((key) => !term(key)).sort(),
  };
}

function storyObservation(
  narrative: string,
  state: WorkbenchState,
  touch: (key: string) => void,
): Record<string, unknown> {
  const symptoms: Record<string, unknown>[] = [];
  if (positiveSymptom(state.pain)) {
    symptoms.push(symptomCluster(painForm.topic, painForm.location ?? "Thumb", state.pain, touch));
  }
  if (positiveSymptom(state.swelling)) {
    symptoms.push(symptomCluster(swellingForm.topic, swellingForm.location ?? "Thumb", state.swelling, touch));
  }
  if (state.stiffness === "presence") {
    symptoms.push(symptomCluster("JointStiffnessSymptom", null, emptyFinding(), touch));
  }
  for (const row of consequenceRows(state)) {
    if (row.value === "presence") symptoms.push(symptomCluster(row.key, null, emptyFinding(), touch));
  }
  return observation("openEHR-EHR-OBSERVATION.story.v1", "Story/History", [
    element("at0004", "Story", dvText(narrative)),
    ...symptoms,
  ]);
}

function positiveSymptom(form: WorkbenchState["pain"]): boolean {
  if (form.summary === "absence") return false;
  if (form.summary === "presence") return true;
  return Boolean(
    form.laterality.length ||
      form.sublocation ||
      (form.durationNumber != null && form.durationNumber > 0) ||
      Object.values(form.choices).some(Boolean),
  );
}

function absentSymptoms(state: WorkbenchState): { key: string; label: string }[] {
  const rows: { key: string; label: string }[] = [];
  if (state.pain.summary === "absence") rows.push({ key: painForm.topic, label: painForm.display });
  if (state.swelling.summary === "absence") rows.push({ key: swellingForm.topic, label: swellingForm.display });
  if (state.stiffness === "absence") rows.push({ key: "JointStiffnessSymptom", label: "joint stiffness" });
  for (const row of consequenceRows(state)) {
    if (row.value === "absence") rows.push({ key: row.key, label: row.key });
  }
  return rows;
}

function consequenceRows(state: WorkbenchState): { key: string; value: string }[] {
  const rows: { key: string; value: string }[] = [];
  for (const layer of [...(swellingForm.firstLayer ?? []), ...(swellingForm.moreLayer ?? [])]) {
    const key = layer.criterialLink;
    if (!key) continue;
    const value = state.consequences?.[key];
    if (!value) continue;
    rows.push({ key, value });
  }
  return rows;
}

function symptomCluster(
  nameKey: string,
  siteKey: string | null,
  form: FindingForm,
  touch: (key: string) => void,
): Record<string, unknown> {
  const items: Record<string, unknown>[] = [
    element("at0001", "Symptom/Sign name", writeCoded(nameKey, touch)),
  ];
  if (siteKey) items.push(locationCluster(siteKey, form, touch));
  const onset = form.choices.AbsoluteOnset;
  if (onset) items.push(element("at0164", "Onset timing", writeCoded(onset, touch)));
  if (form.durationNumber != null && form.durationNumber > 0) {
    const iso = isoDuration(form.durationNumber, form.durationUnit);
    items.push(element("at0028", "Episode duration", { _type: "DV_DURATION", value: iso }));
    touch(form.durationUnit);
    items.push(descriptorCluster({ duration_unit: form.durationUnit, ...descriptorValues(form) }, touch));
  } else {
    const extra = descriptorValues(form);
    if (Object.keys(extra).length) items.push(descriptorCluster(extra, touch));
  }
  const severity = form.choices.AbsoluteSeverity;
  if (severity && SEVERITY[severity]) {
    const [code, text] = SEVERITY[severity];
    items.push(element("at0021", "Severity category", writeLocal(code, text, severity, touch)));
  }
  const character = form.choices.AbsolutePainDescriptor;
  if (character) items.push(element("at0189", "Character", writeCoded(character, touch)));
  const progress = form.choices.AbsoluteProgress;
  if (progress && PROGRESS[progress]) {
    const [code, text] = PROGRESS[progress];
    items.push(element("at0180", "Progression", writeLocal(code, text, progress, touch)));
  }
  const pattern = form.choices.AbsoluteProcessPattern;
  if (pattern) items.push(element("at0003", "Pattern", writeCoded(pattern, touch)));
  return cluster("openEHR-EHR-CLUSTER.symptom_sign.v2", "Symptom/Sign", items);
}

function descriptorValues(form: WorkbenchState["pain"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (form.choices.AbsoluteFrequency) out.frequency = form.choices.AbsoluteFrequency;
  if (form.choices.AbsoluteConsistency) out.consistency = form.choices.AbsoluteConsistency;
  if (form.choices.AbsoluteTexture) out.texture = form.choices.AbsoluteTexture;
  return out;
}

function descriptorCluster(values: Record<string, string>, touch: (key: string) => void): Record<string, unknown> {
  const node: Record<string, [string, string]> = {
    frequency: ["at0001", "Frequency"],
    consistency: ["at0002", "Consistency"],
    texture: ["at0003", "Texture"],
    duration_unit: ["at0005", "Duration unit"],
    pain_on_movement: ["at0004", "Pain on movement"],
  };
  const items = Object.entries(values).filter(([, value]) => value).map(([slot, value]) => {
    const [at, label] = node[slot];
    return element(at, label, writeCoded(value, touch));
  });
  return cluster("openEHR-EHR-CLUSTER.clinergy_descriptor.v0", "Clinergy descriptor", items);
}

function locationCluster(
  siteKey: string,
  form: { laterality: Array<"left" | "right">; sublocation: string | null },
  touch: (key: string) => void,
): Record<string, unknown> {
  const items = [element("at0001", "Body site name", writeCoded(siteKey, touch))];
  if (form.sublocation) items.push(element("at0065", "Specific site", writeCoded(form.sublocation, touch)));
  const laterality = lateralityCode(form.laterality);
  if (laterality) {
    touch(laterality.key);
    items.push(element("at0002", "Laterality", writeLocal(laterality.at, laterality.text, laterality.key, touch)));
  }
  return cluster("openEHR-EHR-CLUSTER.anatomical_location.v1", "Anatomical location", items);
}

function lateralityCode(sides: Array<"left" | "right">): { at: string; text: string; key: string } | null {
  if (sides.length > 1) return { at: "at0083", text: "Right and left", key: "bilateral" };
  if (sides[0] === "left") return { at: "at0003", text: "Left", key: "leftSelection" };
  if (sides[0] === "right") return { at: "at0004", text: "Right", key: "rightSelection" };
  return null;
}

function screeningObservation(
  rows: { key: string; label: string }[],
  touch: (key: string) => void,
): Record<string, unknown> {
  const items = rows.map((row) => cluster("at0022", "Specific symptom/sign", [
    element("at0004", "Symptom/sign name", writeCoded(row.key, touch)),
    element("at0005", "Presence?", writeLocal("at0024", "No", "absence", touch)),
  ]));
  return observation("openEHR-EHR-OBSERVATION.symptom_sign_screening.v1", "Symptom/sign screening questionnaire", items);
}

function examObservation(
  side: "left" | "right",
  exam: ExamSide,
  touch: (key: string) => void,
  absentTenderness: string[],
  prose: string,
  comment: string,
): Record<string, unknown> {
  const definition = examsByName.ThumbExam;
  const site = definition?.baseLocation ?? "Thumb";
  const items: Record<string, unknown>[] = [
    element("at0001", "System or structure examined", writeCoded(site, touch)),
    locationCluster(site, { laterality: [side], sublocation: null }, touch),
  ];
  if (exam.status === "normal") {
    items.push(element("at0006", "Clinical interpretation", writeCoded("normal", touch)));
  }
  for (const sign of definition?.signs0 ?? ["TendernessSign"]) {
    const key = presenceKey(sign);
    if (!key) continue;
    if (exam[key] === "presence") {
      items.push(cluster("openEHR-EHR-CLUSTER.symptom_sign.v2", "Symptom/Sign", [
        element("at0001", "Symptom/Sign name", writeCoded(sign, touch)),
      ]));
    }
    if (exam[key] === "absence") absentTenderness.push(`${side} thumb`);
  }
  const sub = examsByName[definition?.subExams[0] ?? "ThumbMovementExam"];
  for (const sign of sub?.signs0 ?? []) {
    const keys = movementKeys(sign);
    const coded = MOVEMENT[sign];
    if (!keys || !coded) continue;
    const range = exam[keys.range as keyof ExamSide];
    const pain = exam[keys.pain as keyof ExamSide];
    if (!range && !pain) continue;
    const moveItems: Record<string, unknown>[] = [
      element("at0002", "Movement", writeLocal(coded[0], coded[1], sign, touch)),
    ];
    if (range) moveItems.push(element("at0035", "Clinical interpretation", writeCoded(range, touch)));
    if (pain) moveItems.push(descriptorCluster({ pain_on_movement: pain === "absence" ? "absence" : pain }, touch));
    items.push(cluster("openEHR-EHR-CLUSTER.range_of_motion.v1", "Range of motion of a joint", moveItems));
  }
  if (prose) items.push(element("at0003", "Clinical description", dvText(prose)));
  if (comment) items.push(element("at0007", "Comment", dvText(comment)));
  if (exam.status === "notExamined") {
    touch("notExamined");
    items.push(cluster("openEHR-EHR-CLUSTER.exclusion_exam.v1", "Exclusion of examination", [
      element("at0001", "Examination not done", { _type: "DV_BOOLEAN", value: true }),
    ]));
  }
  return observation("openEHR-EHR-OBSERVATION.exam.v1", "Physical examination findings", [
    cluster("openEHR-EHR-CLUSTER.exam.v2", "Physical examination findings", items),
  ]);
}

function diagnosisSentence(link: FormLink, status: string, language: NoteLanguage): string {
  const finding: Finding = link.preCoordinated
    ? { topic: link.preCoordinated, summary: status, qualifiers: [] }
    : { topic: link.concept, location: link.location ?? undefined, summary: status, qualifiers: [] };
  return render(finding, knowledge, language === "sv" ? swedish : undefined);
}

function problemEvaluation(
  key: string,
  location: string | null,
  suspected: boolean,
  touch: (key: string) => void,
  answer?: FindingForm,
  sentence = "",
): Record<string, unknown> {
  const laterality = answer?.laterality?.length ? answer.laterality : [];
  const items = [
    element("at0002", "Problem/Diagnosis name", writeCoded(key, touch)),
    locationCluster(location ?? "Thumb", { laterality, sublocation: null }, touch),
  ];
  const severity = answer?.choices.AbsoluteSeverity;
  if (severity && PROBLEM_SEVERITY[severity]) {
    const [code, text] = PROBLEM_SEVERITY[severity];
    items.push(element("at0005", "Severity", writeLocal(code, text, severity, touch)));
  }
  const note = [sentence, unmappedDiseaseText(answer)].filter((part) => part && part.length > 0).join(". ");
  if (note) items.push(element("at0009", "Clinical description", dvText(note)));
  if (suspected) {
    items.push(element("at0073", "Diagnostic certainty", writeLocal("at0074", "Suspected", "possible", () => {})));
  }
  return evaluation("openEHR-EHR-EVALUATION.problem_diagnosis.v1", "Problem/Diagnosis", items);
}

/**
 * EVALUATION.recommendation.v2 (CKM revision 2.0.5).
 * at0002 Recommendation is required. at0006 Topic names the subject.
 */
function recommendationEvaluation(text: string, _touch: (key: string) => void): Record<string, unknown> {
  return evaluation("openEHR-EHR-EVALUATION.recommendation.v2", "Recommendation", [
    element("at0006", "Topic", dvText("Clinical management")),
    element("at0002", "Recommendation", dvText(text)),
  ]);
}

function exclusionEvaluation(key: string, touch: (key: string) => void): Record<string, unknown> {
  return evaluation("openEHR-EHR-EVALUATION.exclusion_specific.v1", "Exclusion - specific", [
    element("at0003", dvLocalName("at0004", "Problem/diagnosis"), writeCoded(key, touch)),
  ]);
}

function writeCoded(key: string, touch: (key: string) => void): Record<string, unknown> {
  touch(key);
  const row = term(key);
  const text = row?.preferred ?? key;
  return dvCoded(text, "Clinergy", key, mappingList(row));
}

function writeLocal(at: string, text: string, key: string, touch: (key: string) => void): Record<string, unknown> {
  touch(key);
  return dvCoded(text, "local", at, mappingList(term(key)));
}

function mappingList(row: Term | undefined): Record<string, unknown>[] {
  if (!row) return [];
  const out: Record<string, unknown>[] = [];
  if (row.opengalen.verified && row.opengalen.name) {
    out.push(termMapping(openEhrMatch(row.opengalen.match), "OpenGALEN", row.opengalen.name));
  }
  if (row.snomed.verified && row.snomed.code) {
    out.push(termMapping(openEhrMatch(row.snomed.match), "SNOMED-CT", row.snomed.code));
  }
  return out;
}

function coverageOf(key: string): CoverageRow {
  const row = term(key);
  const side = (binding: Term["opengalen"] | undefined): CoverageRow["opengalen"] =>
    !binding ? "missing" : binding.verified ? "verified" : "unverified";
  return { key, opengalen: side(row?.opengalen), snomed: side(row?.snomed) };
}

function composition(
  content: Record<string, unknown>[],
  templateId: string = TEMPLATE_ID,
  language: NoteLanguage = "en",
): Record<string, unknown> {
  return {
    _type: "COMPOSITION",
    name: dvText("Encounter"),
    archetype_node_id: "openEHR-EHR-COMPOSITION.encounter.v1",
    archetype_details: archetyped("openEHR-EHR-COMPOSITION.encounter.v1", templateId),
    language: codePhrase("ISO_639-1", language),
    territory: codePhrase("ISO_3166-1", "GB"),
    category: dvCoded("event", "openehr", "433"),
    composer: { _type: "PARTY_IDENTIFIED", name: "Dr J Brown" },
    context: {
      _type: "EVENT_CONTEXT",
      start_time: { _type: "DV_DATE_TIME", value: TIME },
      setting: dvCoded("primary medical care", "openehr", "228"),
    },
    content,
  };
}

function section(name: string, items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "SECTION",
    name: dvText(name),
    archetype_node_id: "openEHR-EHR-SECTION.adhoc.v1",
    archetype_details: archetyped("openEHR-EHR-SECTION.adhoc.v1"),
    items,
  };
}

function observation(archetype: string, name: string, items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "OBSERVATION",
    name: dvText(name),
    archetype_node_id: archetype,
    archetype_details: archetyped(archetype),
    language: codePhrase("ISO_639-1", "en"),
    encoding: codePhrase("IANA_character-sets", "UTF-8"),
    subject: { _type: "PARTY_SELF" },
    data: history(items),
  };
}

function evaluation(archetype: string, name: string, items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "EVALUATION",
    name: dvText(name),
    archetype_node_id: archetype,
    archetype_details: archetyped(archetype),
    language: codePhrase("ISO_639-1", "en"),
    encoding: codePhrase("IANA_character-sets", "UTF-8"),
    subject: { _type: "PARTY_SELF" },
    data: { _type: "ITEM_TREE", name: dvText("Tree"), archetype_node_id: "at0001", items },
  };
}

function history(items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "HISTORY",
    name: dvText("Event Series"),
    archetype_node_id: "at0001",
    origin: { _type: "DV_DATE_TIME", value: TIME },
    events: [{
      _type: "POINT_EVENT",
      name: dvText("Any event"),
      archetype_node_id: "at0002",
      time: { _type: "DV_DATE_TIME", value: TIME },
      data: { _type: "ITEM_TREE", name: dvText("Tree"), archetype_node_id: "at0003", items },
    }],
  };
}

function element(nodeId: string, name: string | Record<string, unknown>, value: Record<string, unknown>): Record<string, unknown> {
  return { _type: "ELEMENT", name: typeof name === "string" ? dvText(name) : name, archetype_node_id: nodeId, value };
}

function cluster(archetype: string, name: string, items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "CLUSTER",
    name: dvText(name),
    archetype_node_id: archetype.startsWith("at") ? archetype : archetype,
    ...(archetype.startsWith("openEHR-") ? { archetype_details: archetyped(archetype) } : {}),
    items,
  };
}

function dvText(value: string): Record<string, unknown> {
  return { _type: "DV_TEXT", value };
}
function codePhrase(terminology: string, code: string): Record<string, unknown> {
  return { _type: "CODE_PHRASE", terminology_id: { _type: "TERMINOLOGY_ID", value: terminology }, code_string: code };
}
function dvCoded(value: string, terminology: string, code: string, mappings: Record<string, unknown>[] = []): Record<string, unknown> {
  return {
    _type: "DV_CODED_TEXT",
    value,
    defining_code: codePhrase(terminology, code),
    ...(mappings.length ? { mappings } : {}),
  };
}
function dvLocalName(at: string, text: string): Record<string, unknown> {
  return dvCoded(text, "local", at);
}
function openEhrMatch(match: string | undefined): string {
  if (match === "=" || match === "<" || match === ">") return match;
  return "?";
}
function termMapping(match: string, terminology: string, code: string): Record<string, unknown> {
  return { _type: "TERM_MAPPING", match, target: codePhrase(terminology, code) };
}
function archetyped(archetype: string, templateId?: string): Record<string, unknown> {
  return {
    _type: "ARCHETYPED",
    archetype_id: { _type: "ARCHETYPE_ID", value: archetype },
    ...(templateId ? { template_id: { _type: "TEMPLATE_ID", value: templateId } } : {}),
    rm_version: "1.1.0",
  };
}
function examSides(state: WorkbenchState): Array<"left" | "right"> {
  const entry = painForm.examinations?.[0];
  const sides = (entry?.perSide ?? ["left", "right"]).filter(
    (side): side is "left" | "right" => side === "left" || side === "right",
  );
  return sides.length ? sides : ["left", "right"];
}

function diagnosisLinks(state: WorkbenchState): FormLink[] {
  const selected = state.selectedForms?.length ? state.selectedForms : ["ThumbPainSymptom"];
  const topics = selected.includes("ThumbPainSymptom")
    ? ["ThumbPainSymptom", ...selected.filter((topic) => topic !== "ThumbPainSymptom")]
    : selected;
  const links: FormLink[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    const form = topic === "ThumbPainSymptom" ? painForm : formOf(topic);
    if (!form?.diagnoses) continue;
    for (const link of form.diagnoses) {
      if (seen.has(link.item)) continue;
      seen.add(link.item);
      links.push(link);
    }
  }
  return links;
}

function diseaseAnswer(state: WorkbenchState, link: FormLink): FindingForm | undefined {
  const key = link.preCoordinated ?? link.item;
  return state.formAnswers?.[key] ?? state.formAnswers?.[link.item];
}

/** Disease-form values that problem_diagnosis has no element for. */
function unmappedDiseaseText(answer: FindingForm | undefined): string | null {
  if (!answer) return null;
  const bits: string[] = [];
  if (answer.durationNumber != null && answer.durationNumber > 0) {
    bits.push(`duration ${answer.durationNumber} ${answer.durationUnit}`);
  }
  const progress = answer.choices?.AbsoluteProgress;
  if (progress) bits.push(`progress ${progress}`);
  const healing = answer.choices?.AbsoluteHealingCharacter;
  if (healing) bits.push(healing);
  return bits.length ? bits.join("; ") : null;
}

/**
 * The visit builder used by the page. Examination prose is stored on the
 * exam cluster. A non-empty plan becomes a Plan section. Symptom and exam
 * forms that are not selected are left out.
 */
export function buildVisit(
  state: WorkbenchState,
  narrative: string,
  language: NoteLanguage = "en",
): ThumbComposition {
  const selected = state.selectedForms ?? [];
  const view: WorkbenchState = {
    ...state,
    pain: selected.length && !selected.includes("ThumbPainSymptom") ? emptyFinding() : state.pain,
    swelling: selected.length && !selected.includes("ThumbSwellingSymptom") ? emptyFinding() : state.swelling,
    stiffness: selected.length && !selected.includes("ThumbSwellingSymptom") ? null : state.stiffness,
    consequences: selected.length && !selected.includes("ThumbSwellingSymptom") ? {} : state.consequences,
    exam: selected.length && !selected.includes("ThumbExam")
      ? { left: emptyExam(), right: emptyExam() }
      : state.exam,
  };
  return buildThumbEncounter(view, narrative, { clinicalDescription: true, embedDiagnosisText: true, language });
}

function isoDuration(n: number, unit: string): string {
  const designator: Record<string, string> = {
    second: "PT{n}S", minute: "PT{n}M", hour: "PT{n}H", day: "P{n}D",
    week: "P{n}W", month: "P{n}M", year: "P{n}Y",
  };
  return (designator[unit] ?? "P{n}D").replace("{n}", String(n));
}
