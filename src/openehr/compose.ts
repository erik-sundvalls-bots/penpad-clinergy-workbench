import type { WorkbenchState } from "../model.ts";
import { painForm } from "../knowledge.ts";
import { term, type Term } from "./terms.ts";
import { TEMPLATE_ID, webTemplate } from "./webtemplate.ts";

export interface CoverageRow {
  key: string;
  opengalen: "verified" | "unverified" | "missing";
  snomed: "verified" | "unverified" | "missing";
}

export interface ThumbComposition {
  canonical: Record<string, unknown>;
  flat: Record<string, string>;
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
const MOVEMENT: Record<string, [string, string]> = {
  flexion: ["at0006", "Flexion"],
  extension: ["at0005", "Extension"],
  abduction: ["at0003", "Abduction"],
  adduction: ["at0004", "Adduction"],
};

export function buildThumbEncounter(state: WorkbenchState, narrative: string): ThumbComposition {
  const flat: Record<string, string> = {};
  const used = new Set<string>();
  const put = (chain: string, suffix: string, value: string) => {
    flat[`${TEMPLATE_ID}/${chain}|${suffix}`] = value;
  };
  const touch = (key: string) => used.add(key);

  put("category", "code", "433");
  put("category", "value", "event");
  put("category", "terminology", "openehr");
  put("context/start_time", "value", TIME);
  put("context/setting", "code", "228");
  put("context/setting", "value", "primary medical care");
  put("context/setting", "terminology", "openehr");
  put("composer", "name", "Dr J Brown");
  put("history/story/any_event/story_text", "value", narrative);

  const historyItems: Record<string, unknown>[] = [storyObservation(narrative, state, put, touch)];
  const absent = absentSymptoms(state);
  if (absent.length) historyItems.push(screeningObservation(absent, "history/screening", put, touch));

  const examItems: Record<string, unknown>[] = [];
  const absentTenderness: string[] = [];
  let examIndex = 0;
  for (const side of ["left", "right"] as const) {
    const exam = state.exam[side];
    const active = Object.values(exam).some((value) => value);
    if (!active) continue;
    examItems.push(examObservation(side, exam, examIndex, put, touch, absentTenderness));
    examIndex += 1;
  }
  if (absentTenderness.length) {
    examItems.push(screeningObservation(
      absentTenderness.map((name) => ({ key: "TendernessSign", label: name })),
      "examination/screening",
      put,
      touch,
    ));
  }

  const problems: Record<string, unknown>[] = [];
  const exclusions: Record<string, unknown>[] = [];
  let problemIndex = 0;
  let exclusionIndex = 0;
  for (const link of painForm.diagnoses) {
    const status = state.diagnoses[link.item];
    if (!status) continue;
    const key = link.preCoordinated ?? link.concept;
    touch(key);
    if (link.location) touch(link.location);
    if (status === "excluded") {
      exclusions.push(exclusionEvaluation(key, exclusionIndex, put));
      exclusionIndex += 1;
    } else {
      problems.push(problemEvaluation(key, link.location, status === "possible", problemIndex, put, touch));
      problemIndex += 1;
    }
  }

  const content = [
    section("History", historyItems),
    section("Examination", examItems),
    section("Assessment", [...problems, ...exclusions]),
  ];

  return {
    canonical: composition(content),
    flat,
    coverage: [...used].sort().map(coverageOf),
    missingTerms: [...used].filter((key) => !term(key)).sort(),
  };
}

function storyObservation(
  narrative: string,
  state: WorkbenchState,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  const symptoms: Record<string, unknown>[] = [];
  let index = 0;
  if (positiveSymptom(state.pain)) {
    symptoms.push(symptomCluster("ThumbPainSymptom", "Thumb", state.pain, index, "history/story/any_event/symptom", put, touch));
    index += 1;
  }
  if (positiveSymptom(state.swelling)) {
    symptoms.push(symptomCluster(
      "ThumbSwellingSymptom",
      "Thumb",
      state.swelling,
      index,
      "history/story/any_event/symptom",
      put,
      touch,
    ));
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
  if (state.pain.summary === "absence") rows.push({ key: "ThumbPainSymptom", label: "thumb pain" });
  if (state.swelling.summary === "absence") rows.push({ key: "ThumbSwellingSymptom", label: "thumb swelling" });
  return rows;
}

function symptomCluster(
  nameKey: string,
  siteKey: string,
  form: WorkbenchState["pain"],
  index: number,
  chain: string,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  const base = `${chain}:${index}`;
  const items: Record<string, unknown>[] = [];
  items.push(element("at0001", "Symptom/Sign name", writeCoded(nameKey, `${base}/name`, put, touch)));
  items.push(locationCluster(siteKey, form, `${base}/body_site`, put, touch));
  const onset = form.choices.AbsoluteOnset;
  if (onset) items.push(element("at0164", "Onset timing", writeCoded(onset, `${base}/onset`, put, touch)));
  if (form.durationNumber != null && form.durationNumber > 0) {
    const iso = isoDuration(form.durationNumber, form.durationUnit);
    put(`${base}/duration`, "value", iso);
    items.push(element("at0028", "Episode duration", { _type: "DV_DURATION", value: iso }));
    touch(form.durationUnit);
    items.push(descriptorCluster({ duration_unit: form.durationUnit, ...descriptorValues(form) }, `${base}/descriptor`, put, touch));
  } else {
    const extra = descriptorValues(form);
    if (Object.keys(extra).length) items.push(descriptorCluster(extra, `${base}/descriptor`, put, touch));
  }
  const severity = form.choices.AbsoluteSeverity;
  if (severity && SEVERITY[severity]) {
    const [code, text] = SEVERITY[severity];
    items.push(element("at0021", "Severity category", writeLocal(code, text, severity, `${base}/severity`, put, touch)));
  }
  const character = form.choices.AbsolutePainDescriptor;
  if (character) items.push(element("at0189", "Character", writeCoded(character, `${base}/character:0`, put, touch)));
  const progress = form.choices.AbsoluteProgress;
  if (progress && PROGRESS[progress]) {
    const [code, text] = PROGRESS[progress];
    items.push(element("at0180", "Progression", writeLocal(code, text, progress, `${base}/progression`, put, touch)));
  }
  const pattern = form.choices.AbsoluteProcessPattern;
  if (pattern) items.push(element("at0003", "Pattern", writeCoded(pattern, `${base}/pattern`, put, touch)));
  return cluster("openEHR-EHR-CLUSTER.symptom_sign.v2", "Symptom/Sign", items.filter(Boolean) as Record<string, unknown>[]);
}

function descriptorValues(form: WorkbenchState["pain"]): Record<string, string> {
  const out: Record<string, string> = {};
  if (form.choices.AbsoluteFrequency) out.frequency = form.choices.AbsoluteFrequency;
  if (form.choices.AbsoluteConsistency) out.consistency = form.choices.AbsoluteConsistency;
  if (form.choices.AbsoluteTexture) out.texture = form.choices.AbsoluteTexture;
  return out;
}

function descriptorCluster(
  values: Record<string, string>,
  chain: string,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  const node: Record<string, [string, string]> = {
    frequency: ["at0001", "Frequency"],
    consistency: ["at0002", "Consistency"],
    texture: ["at0003", "Texture"],
    duration_unit: ["at0005", "Duration unit"],
    pain_on_movement: ["at0004", "Pain on movement"],
  };
  const items = Object.entries(values).filter(([, value]) => value).map(([slot, value]) => {
    const [at, label] = node[slot];
    return element(at, label, writeCoded(value, `${chain}/${slot}`, put, touch));
  });
  return cluster("openEHR-EHR-CLUSTER.clinergy_descriptor.v0", "Clinergy descriptor", items);
}

function locationCluster(
  siteKey: string,
  form: { laterality: Array<"left" | "right">; sublocation: string | null },
  chain: string,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  const items = [element("at0001", "Body site name", writeCoded(siteKey, `${chain}/site_name`, put, touch))];
  if (form.sublocation) {
    items.push(element("at0065", "Specific site", writeCoded(form.sublocation, `${chain}/specific_site`, put, touch)));
  }
  const laterality = lateralityCode(form.laterality);
  if (laterality) {
    touch(laterality.key);
    items.push(element("at0002", "Laterality", writeLocal(
      laterality.at,
      laterality.text,
      laterality.key,
      `${chain}/laterality`,
      put,
      touch,
    )));
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
  chain: string,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  const items = rows.map((row, index) => cluster("at0022", "Specific symptom/sign", [
    element("at0004", "Symptom/sign name", writeCoded(row.key, `${chain}/any_event/screened:${index}/name`, put, touch)),
    element("at0005", "Presence", writeLocal("at0024", "No", "absence", `${chain}/any_event/screened:${index}/presence`, put, touch)),
  ]));
  return observation("openEHR-EHR-OBSERVATION.symptom_sign_screening.v1", "Symptom/sign screening questionnaire", items);
}

function examObservation(
  side: "left" | "right",
  exam: WorkbenchState["exam"]["left"],
  index: number,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
  absentTenderness: string[],
): Record<string, unknown> {
  const base = `examination/exam:${index}/any_event/detail`;
  const items: Record<string, unknown>[] = [
    element("at0001", "System or structure examined", writeCoded("Thumb", `${base}/structure`, put, touch)),
    locationCluster("Thumb", { laterality: [side], sublocation: null }, `${base}/body_site`, put, touch),
  ];
  if (exam.status === "normal") {
    items.push(element("at0006", "Clinical interpretation", writeCoded("normal", `${base}/interpretation`, put, touch)));
  }
  if (exam.tenderness === "presence") {
    items.push(cluster("openEHR-EHR-CLUSTER.symptom_sign.v2", "Tenderness", [
      element("at0001", "Symptom/Sign name", writeCoded("TendernessSign", `${base}/tenderness/name`, put, touch)),
    ]));
  }
  if (exam.tenderness === "absence") absentTenderness.push(`${side} thumb`);
  let movementIndex = 0;
  for (const [name, rangeKey, painKey] of [
    ["flexion", "flexionRange", "flexionPain"],
    ["extension", "extensionRange", "extensionPain"],
    ["abduction", "abductionRange", "abductionPain"],
    ["adduction", "adductionRange", "adductionPain"],
  ] as const) {
    const range = exam[rangeKey];
    const pain = exam[painKey];
    if (!range && !pain) continue;
    const move = `${base}/movement:${movementIndex}`;
    movementIndex += 1;
    const moveItems: Record<string, unknown>[] = [
      element("at0002", "Movement", writeLocal(MOVEMENT[name][0], MOVEMENT[name][1], `${name[0].toUpperCase()}${name.slice(1)}Sign`, move + "/movement", put, touch)),
    ];
    if (range) moveItems.push(element("at0035", "Clinical interpretation", writeCoded(range, move + "/interpretation", put, touch)));
    if (pain) {
      moveItems.push(descriptorCluster({ pain_on_movement: pain === "absence" ? "absence" : pain }, move + "/descriptor", put, touch));
    }
    items.push(cluster("openEHR-EHR-CLUSTER.range_of_motion.v1", "Range of motion of a joint", moveItems));
  }
  if (exam.status === "notExamined") {
    put(`${base}/not_done/flag`, "value", "true");
    touch("notExamined");
    items.push(cluster("openEHR-EHR-CLUSTER.exclusion_exam.v1", "Exclusion of examination", [
      element("at0001", "Examination not done", { _type: "DV_BOOLEAN", value: true }),
    ]));
  }
  return observation("openEHR-EHR-OBSERVATION.exam.v1", "Physical examination findings", [
    cluster("openEHR-EHR-CLUSTER.exam.v2", "Physical examination findings", items),
  ]);
}

function problemEvaluation(
  key: string,
  location: string | null,
  suspected: boolean,
  index: number,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  const base = `assessment/problem:${index}`;
  const items = [
    element("at0002", "Problem/Diagnosis name", writeCoded(key, `${base}/name`, put, touch)),
    locationCluster(location ?? "Thumb", { laterality: [], sublocation: null }, `${base}/body_site`, put, touch),
  ];
  if (suspected) {
    items.push(element("at0073", "Diagnostic certainty", writeLocal("at0074", "Suspected", "possible", `${base}/certainty`, put, () => {})));
  }
  return evaluation("openEHR-EHR-EVALUATION.problem_diagnosis.v1", "Problem/Diagnosis", items);
}

function exclusionEvaluation(
  key: string,
  index: number,
  put: (chain: string, suffix: string, value: string) => void,
): Record<string, unknown> {
  const base = `assessment/exclusion:${index}`;
  return evaluation("openEHR-EHR-EVALUATION.exclusion_specific.v1", "Exclusion - specific", [
    element("at0003", dvLocalName("at0004", "Problem/diagnosis"), writeCoded(key, `${base}/concept`, put, () => {})),
  ]);
}

function writeCoded(
  key: string,
  chain: string,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  touch(key);
  const row = term(key);
  const text = row?.preferred ?? key;
  put(chain, "code", key);
  put(chain, "value", text);
  put(chain, "terminology", "Clinergy");
  return dvCoded(text, "Clinergy", key, mappingList(row));
}

function writeLocal(
  at: string,
  text: string,
  key: string,
  chain: string,
  put: (chain: string, suffix: string, value: string) => void,
  touch: (key: string) => void,
): Record<string, unknown> {
  touch(key);
  put(chain, "code", at);
  put(chain, "value", text);
  put(chain, "terminology", "local");
  return dvCoded(text, "local", at, mappingList(term(key)));
}

function mappingList(row: Term | undefined): Record<string, unknown>[] {
  if (!row) return [];
  const out: Record<string, unknown>[] = [];
  if (row.opengalen.verified && row.opengalen.name) {
    out.push(termMapping(row.opengalen.match ?? "~", "OpenGALEN", row.opengalen.name));
  }
  if (row.snomed.verified && row.snomed.code) {
    out.push(termMapping(row.snomed.match ?? "~", "SNOMED-CT", row.snomed.code));
  }
  return out;
}

function coverageOf(key: string): CoverageRow {
  const row = term(key);
  const side = (binding: Term["opengalen"] | undefined): CoverageRow["opengalen"] =>
    !binding ? "missing" : binding.verified ? "verified" : "unverified";
  return { key, opengalen: side(row?.opengalen), snomed: side(row?.snomed) };
}

function composition(content: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "COMPOSITION",
    name: dvText("Encounter"),
    archetype_node_id: "openEHR-EHR-COMPOSITION.encounter.v1",
    archetype_details: archetyped("openEHR-EHR-COMPOSITION.encounter.v1", TEMPLATE_ID),
    language: codePhrase("ISO_639-1", "en"),
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
  const root = archetype.startsWith("at") ? archetype : archetype;
  return {
    _type: "CLUSTER",
    name: dvText(name),
    archetype_node_id: root,
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
function isoDuration(n: number, unit: string): string {
  const designator: Record<string, string> = {
    second: "PT{n}S", minute: "PT{n}M", hour: "PT{n}H", day: "P{n}D",
    week: "P{n}W", month: "P{n}M", year: "P{n}Y",
  };
  return (designator[unit] ?? "P{n}D").replace("{n}", String(n));
}

export { webTemplate };
