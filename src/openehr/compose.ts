import { examinationProseForSide, movementKeys, presenceKey, type NoteLanguage } from "../exam/prose.ts";
import { displayOf, examsByName, formOf } from "../forms/catalog.ts";
import { knowledge, painForm, snomedMap, swellingForm, type FormLink } from "../knowledge.ts";
import { render, type Finding } from "../../vendor/sentence.ts";
import { renderEnglishGp } from "../en/gp-sentence.ts";
import { renderSwedishGp } from "../sv/gp-sentence.ts";
import { findingsFromState } from "../model.ts";
import { historyFindings, historyNarrativeText } from "../summary.ts";
import { narrativeMappings, type NarrativeMapping } from "../snomed/narrative-mappings.ts";
import type { SnomedMap } from "../../vendor/snomed.ts";
import { emptyExam, emptyFinding, type ExamSide, type FindingForm, type WorkbenchState } from "../model.ts";
import { term, type Term } from "./terms.ts";
import { GP_TEMPLATE_ID, TEMPLATE_ID } from "./template.ts";
import { clinergyCodedText, localCodedText, painOnMovementRubric } from "./coded-text.ts";

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

function rmLabel(language: NoteLanguage, en: string, sv: string): string {
  return language === "sv" ? sv : en;
}

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
/** CKM problem_qualifier.v2 Progression at0102. */
const QUALIFIER_PROGRESS: Record<string, [string, string]> = {
  better: ["at0103", "Improving"],
  same: ["at0104", "Stable"],
  worse: ["at0105", "Worsening"],
};
/** CKM problem_qualifier.v2 Resolution phase at0083. */
const QUALIFIER_HEALING: Record<string, [string, string]> = {
  healed: ["at0084", "Resolved"],
  partiallyHealed: ["at0085", "Resolving"],
  nonHealed: ["at0086", "Not resolving"],
};
const FREQUENCY: Record<string, [string, string]> = {
  infrequent: ["at0002", "Infrequent"],
  occasional: ["at0003", "Occasional"],
  frequent: ["at0004", "Frequent"],
};
const CONSISTENCY: Record<string, [string, string]> = {
  soft: ["at0002", "Soft"],
  firm: ["at0003", "Firm"],
  hard: ["at0004", "Hard"],
  fluctuant: ["at0005", "Fluctuant"],
};
const TEXTURE: Record<string, [string, string]> = {
  smooth: ["at0007", "Smooth"],
  rough: ["at0008", "Rough"],
  nodular: ["at0009", "Nodular"],
  irregular: ["at0010", "Irregular"],
};
const RANGE_QUAL: Record<string, [string, string]> = {
  full: ["at0.2", "Full"],
  reduced: ["at0.3", "Reduced"],
  limited: ["at0.4", "Limited"],
  minimal: ["at0.5", "Minimal"],
  fixed: ["at0.6", "Fixed"],
};
const PAIN_ON_MOVEMENT: Record<string, [string, string]> = {
  absence: ["at0.8", "No pain"],
  mild: ["at0.9", "Mild pain"],
  moderate: ["at0.10", "Moderate pain"],
  severe: ["at0.11", "Severe pain"],
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
  /**
   * Reviewed SNOMED CT map. When set, generated narrative text (story,
   * diagnosis description) gets the sidebar's post-coordinated expressions
   * as TERM_MAPPINGs. A story the caller wrote is not mapped.
   */
  snomed?: SnomedMap;
}

export function buildThumbEncounter(
  state: WorkbenchState,
  narrative: string,
  options?: ComposeOptions,
): ThumbComposition {
  const used = new Set<string>();
  const touch = (key: string) => used.add(key);
  const language = options?.language ?? "en";

  const findings = options?.snomed ? findingsFromState(state, painForm.diagnoses) : [];
  const storyMappings = options?.snomed && narrative === historyNarrativeText(findings, language)
    ? narrativeMappings(historyFindings(findings), options.snomed)
    : [];
  const historyItems: Record<string, unknown>[] = [storyObservation(narrative, state, touch, language, storyMappings)];
  const absent = absentSymptoms(state);
  if (absent.length) historyItems.push(screeningObservation(absent, touch, language));

  const examItems: Record<string, unknown>[] = [];
  const absentTenderness: string[] = [];
  let commentLeft = state.comment?.trim() ?? "";
  for (const side of examSides(state)) {
    const exam = state.exam[side];
    if (!Object.values(exam).some((value) => value)) continue;
    const prose = options?.clinicalDescription ? examinationProseForSide(state, side, language) : "";
    const comment = commentLeft;
    commentLeft = "";
    examItems.push(examObservation(side, exam, touch, absentTenderness, prose, comment, language));
  }
  if (absentTenderness.length) {
    examItems.push(screeningObservation(
      absentTenderness.map((name) => ({ key: "TendernessSign", label: name })),
      touch,
      language,
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
      ? diagnosisSentence(link, status, language, answer?.laterality ?? [])
      : "";
    const diagnosisFinding = findings.find((finding) => finding.topic === key);
    const sentenceMappings = sentence && diagnosisFinding && options?.snomed
      ? narrativeMappings([diagnosisFinding], options.snomed)
      : [];
    if (status === "excluded") exclusions.push(exclusionEvaluation(key, touch));
    else {
      problems.push(
        problemEvaluation(key, link, status === "possible", touch, answer, sentence, sentenceMappings, state, language),
      );
    }
  }

  const planText = state.plan?.trim() ?? "";
  const planItems = planText ? [recommendationEvaluation(planText, touch, language)] : [];
  const content = [
    section("History", historyItems),
    section("Examination", examItems),
    section("Assessment", [...problems, ...exclusions]),
    section("Plan", planItems),
  ].filter((entry) => Array.isArray(entry.items) && entry.items.length > 0);
  const useGpTemplate = planItems.length > 0 || problems.length > 0 || exclusions.length > 0;
  const canonical = composition(content, useGpTemplate ? GP_TEMPLATE_ID : TEMPLATE_ID, language);

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
  language: NoteLanguage,
  mappings: NarrativeMapping[],
): Record<string, unknown> {
  const symptoms: Record<string, unknown>[] = [];
  if (positiveSymptom(state.pain)) {
    symptoms.push(symptomCluster(painForm.topic, painForm.location ?? "Thumb", state.pain, touch, language));
  }
  if (positiveSymptom(state.swelling)) {
    symptoms.push(symptomCluster(swellingForm.topic, swellingForm.location ?? "Thumb", state.swelling, touch, language));
  }
  if (state.stiffness === "presence") {
    symptoms.push(symptomCluster("JointStiffnessSymptom", null, emptyFinding(), touch, language));
  }
  for (const row of consequenceRows(state)) {
    if (row.value === "presence") symptoms.push(symptomCluster(row.key, null, emptyFinding(), touch, language));
  }
  const storyName = language === "sv" ? "Berättelse" : "Story/History";
  return observation("openEHR-EHR-OBSERVATION.story.v1", storyName, [
    element("at0004", rmLabel(language, "Story", "Berättelse"), dvText(narrative, mappings)),
    ...symptoms,
  ], language);
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
    if (row.value === "absence") rows.push({ key: row.key, label: displayOf(row.key) });
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
  language: NoteLanguage,
): Record<string, unknown> {
  const items: Record<string, unknown>[] = [
    element("at0001", rmLabel(language, "Symptom/Sign name", "Symtom/teckennamn"), writeCoded(nameKey, touch, language)),
  ];
  if (siteKey) items.push(locationCluster(siteKey, form, touch, language));
  const onset = form.choices.AbsoluteOnset;
  if (onset) items.push(element("at0164", rmLabel(language, "Onset timing", "Debut"), writeCoded(onset, touch, language)));
  if (form.durationNumber != null && form.durationNumber > 0) {
    const iso = isoDuration(form.durationNumber, form.durationUnit);
    items.push(element("at0028", rmLabel(language, "Episode duration", "Episodlängd"), { _type: "DV_DURATION", value: iso }));
    touch(form.durationUnit);
  }
  items.push(...specificDetailClusters(form, touch, language));
  const severity = form.choices.AbsoluteSeverity;
  if (severity && SEVERITY[severity]) {
    const [code, text] = SEVERITY[severity];
    items.push(element("at0021", rmLabel(language, "Severity category", "Svårighetsgrad"), writeLocal(code, text, severity, touch, language)));
  }
  const character = form.choices.AbsolutePainDescriptor;
  if (character) {
    items.push(
      element("at0189", rmLabel(language, "Character", "Karaktär"), writeCoded(character, touch, language)),
    );
  }
  const progress = form.choices.AbsoluteProgress;
  if (progress && PROGRESS[progress]) {
    const [code, text] = PROGRESS[progress];
    items.push(element("at0180", "Progression", writeLocal(code, text, progress, touch, language)));
  }
  const pattern = form.choices.AbsoluteProcessPattern;
  if (pattern) items.push(element("at0003", rmLabel(language, "Pattern", "Mönster"), writeCoded(pattern, touch, language)));
  const wrapper = language === "sv" ? "Symtom/tecken" : "Symptom/Sign";
  return cluster("openEHR-EHR-CLUSTER.symptom_sign.v2", wrapper, items);
}

function specificDetailClusters(
  form: FindingForm,
  touch: (key: string) => void,
  language: NoteLanguage,
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const frequency = form.choices.AbsoluteFrequency;
  if (frequency && FREQUENCY[frequency]) {
    const [code, text] = FREQUENCY[frequency];
    out.push(
      cluster(
        "openEHR-EHR-CLUSTER.symptom_sign_frequency.v0",
        rmLabel(language, "Symptom/sign frequency", "Frekvens för symtom/tecken"),
        [
          element(
            "at0001",
            rmLabel(language, "Frequency category", "Frekvenskategori"),
            writeLocal(code, text, frequency, touch, language),
          ),
        ],
      ),
    );
  }
  const consistency = form.choices.AbsoluteConsistency;
  const texture = form.choices.AbsoluteTexture;
  const palpItems: Record<string, unknown>[] = [];
  if (consistency && CONSISTENCY[consistency]) {
    const [code, text] = CONSISTENCY[consistency];
    palpItems.push(
      element(
        "at0001",
        rmLabel(language, "Consistency", "Konsistens"),
        writeLocal(code, text, consistency, touch, language),
      ),
    );
  }
  if (texture && TEXTURE[texture]) {
    const [code, text] = TEXTURE[texture];
    palpItems.push(
      element(
        "at0006",
        rmLabel(language, "Surface texture", "Ytstruktur"),
        writeLocal(code, text, texture, touch, language),
      ),
    );
  }
  if (palpItems.length) {
    out.push(
      cluster(
        "openEHR-EHR-CLUSTER.palpation_characteristics.v0",
        rmLabel(language, "Palpation characteristics", "Palpationsfynd"),
        palpItems,
      ),
    );
  }
  return out;
}

function locationCluster(
  siteKey: string,
  form: { laterality: Array<"left" | "right">; sublocation: string | null },
  touch: (key: string) => void,
  language: NoteLanguage = "en",
): Record<string, unknown> {
  const items = [
    element("at0001", rmLabel(language, "Body site name", "Kroppsplats"), writeCoded(siteKey, touch, language)),
  ];
  if (form.sublocation) {
    items.push(element("at0065", rmLabel(language, "Specific site", "Specifik plats"), writeCoded(form.sublocation, touch, language)));
  }
  const laterality = lateralityCode(form.laterality);
  if (laterality) {
    touch(laterality.key);
    items.push(
      element("at0002", rmLabel(language, "Laterality", "Lateralitet"), writeLocal(laterality.at, laterality.text, laterality.key, touch, language)),
    );
  }
  return cluster(
    "openEHR-EHR-CLUSTER.anatomical_location.v1",
    rmLabel(language, "Anatomical location", "Anatomisk lokalisation"),
    items,
  );
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
  language: NoteLanguage,
): Record<string, unknown> {
  const items = rows.map((row) => cluster("at0022", rmLabel(language, "Specific symptom/sign", "Specifikt symtom/tecken"), [
    element("at0004", rmLabel(language, "Symptom/sign name", "Symtom/teckennamn"), writeCoded(row.key, touch, language)),
    element("at0005", rmLabel(language, "Presence?", "Närvaro?"), writeLocal("at0024", "No", "absence", touch, language)),
  ]));
  return observation(
    "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1",
    rmLabel(language, "Symptom/sign screening questionnaire", "Symtom-/tecken-screening"),
    items,
    language,
  );
}

function examObservationTitle(language: NoteLanguage): string {
  return language === "sv" ? "Status" : "Physical examination findings";
}

function examObservation(
  side: "left" | "right",
  exam: ExamSide,
  touch: (key: string) => void,
  absentTenderness: string[],
  prose: string,
  comment: string,
  language: NoteLanguage,
): Record<string, unknown> {
  const definition = examsByName.ThumbExam;
  const site = definition?.baseLocation ?? "Thumb";
  const items: Record<string, unknown>[] = [
    element("at0001", rmLabel(language, "System or structure examined", "Undersökt struktur"), writeCoded(site, touch, language)),
    locationCluster(site, { laterality: [side], sublocation: null }, touch, language),
  ];
  if (exam.status === "normal") {
    items.push(element("at0006", rmLabel(language, "Clinical interpretation", "Klinisk tolkning"), writeCoded("normal", touch, language)));
  }
  for (const sign of definition?.signs0 ?? ["TendernessSign"]) {
    const key = presenceKey(sign);
    if (!key) continue;
    if (exam[key] === "presence") {
      items.push(cluster("openEHR-EHR-CLUSTER.symptom_sign.v2", rmLabel(language, "Symptom/Sign", "Symtom/tecken"), [
        element("at0001", rmLabel(language, "Symptom/Sign name", "Symtom/teckennamn"), writeCoded(sign, touch, language)),
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
      element("at0002", rmLabel(language, "Movement", "Rörelse"), writeLocal(coded[0], coded[1], sign, touch, language)),
    ];
    if (range && RANGE_QUAL[range]) {
      const [code, text] = RANGE_QUAL[range];
      moveItems.push(
        element(
          "at0.1",
          rmLabel(language, "Qualitative range", "Kvalitativt rörelseomfång"),
          writeLocal(code, text, range, touch, language),
        ),
      );
    }
    if (pain && PAIN_ON_MOVEMENT[pain]) {
      const [code, text] = PAIN_ON_MOVEMENT[pain];
      const rubric = painOnMovementRubric(pain, text, language);
      moveItems.push(
        element(
          "at0.7",
          rmLabel(language, "Pain on movement", "Smärta vid rörelse"),
          writeLocal(code, rubric, `romPain:${pain}`, touch, language),
        ),
      );
    }
    items.push(
      cluster(
        "openEHR-EHR-CLUSTER.range_of_motion-qualitative.v0",
        rmLabel(language, "Qualitative range of motion of a joint", "Kvalitativ rörelseomfång för led"),
        moveItems,
      ),
    );
  }
  if (prose) {
    items.push(element("at0003", rmLabel(language, "Clinical description", "Klinisk beskrivning"), dvText(prose)));
  }
  if (comment) items.push(element("at0007", rmLabel(language, "Comment", "Kommentar"), dvText(comment)));
  if (exam.status === "notExamined") {
    touch("notExamined");
    items.push(cluster("openEHR-EHR-CLUSTER.exclusion_exam.v1", "Exclusion of examination", [
      element("at0001", rmLabel(language, "Examination not done", "Undersökning ej utförd"), { _type: "DV_BOOLEAN", value: true }),
    ]));
  }
  const examTitle = examObservationTitle(language);
  return observation("openEHR-EHR-OBSERVATION.exam.v1", examTitle, [
    cluster("openEHR-EHR-CLUSTER.exam.v2", examTitle, items),
  ], language);
}

function diagnosisSentence(
  link: FormLink,
  status: string,
  language: NoteLanguage,
  laterality: Array<"left" | "right">,
): string {
  const side = laterality.length > 1 ? "both" as const : laterality[0];
  const finding: Finding = {
    topic: link.preCoordinated ?? link.concept,
    location: link.location ?? (side ? "Thumb" : undefined),
    laterality: side,
    summary: status,
    qualifiers: [],
  };
  if (language === "sv") return renderSwedishGp(finding);
  return renderEnglishGp(finding);
}

function problemEvaluation(
  key: string,
  link: FormLink,
  suspected: boolean,
  touch: (key: string) => void,
  answer: FindingForm | undefined,
  sentence: string,
  sentenceMappings: NarrativeMapping[],
  state: WorkbenchState,
  language: NoteLanguage = "en",
): Record<string, unknown> {
  const location = link.location;
  const laterality = answer?.laterality?.length ? answer.laterality : [];
  const items = [
    element("at0002", rmLabel(language, "Problem/Diagnosis name", "Diagnosnamn"), writeCoded(key, touch, language)),
    locationCluster(location ?? "Thumb", { laterality, sublocation: null }, touch, language),
  ];
  const severity = answer?.choices.AbsoluteSeverity;
  if (severity && PROBLEM_SEVERITY[severity]) {
    const [code, text] = PROBLEM_SEVERITY[severity];
    items.push(
      element("at0005", rmLabel(language, "Severity", "Svårighetsgrad"), writeLocal(code, text, severity, touch, language)),
    );
  }
  const onset = problemDiagnosisOnset(state, link, answer);
  if (onset) {
    items.push(
      element(
        "at0077",
        rmLabel(language, "Date/time of onset", "Datum/tid för debut"),
        { _type: "DV_DATE_TIME", value: onset },
      ),
    );
  }
  const qualifier = problemQualifierCluster(answer, touch, language);
  if (qualifier) items.push(qualifier);
  if (sentence) {
    items.push(element("at0009", rmLabel(language, "Clinical description", "Klinisk beskrivning"), dvText(sentence, sentenceMappings)));
  }
  if (suspected) {
    items.push(
      element(
        "at0073",
        rmLabel(language, "Diagnostic certainty", "Diagnostisk säkerhet"),
        writeLocal("at0074", "Suspected", "possible", () => {}, language),
      ),
    );
  }
  return evaluation(
    "openEHR-EHR-EVALUATION.problem_diagnosis.v1",
    rmLabel(language, "Problem/Diagnosis", "Problem/diagnos"),
    items,
    language,
  );
}

/**
 * EVALUATION.recommendation.v2 (CKM revision 2.0.5).
 * at0002 Recommendation is required. at0006 Topic names the subject.
 */
function recommendationEvaluation(
  text: string,
  _touch: (key: string) => void,
  language: NoteLanguage,
): Record<string, unknown> {
  return evaluation(
    "openEHR-EHR-EVALUATION.recommendation.v2",
    rmLabel(language, "Recommendation", "Rekommendation"),
    [
      element("at0002", rmLabel(language, "Recommendation", "Rekommendation"), dvText(text)),
    ],
    language,
  );
}

function exclusionEvaluation(key: string, touch: (key: string) => void): Record<string, unknown> {
  return evaluation("openEHR-EHR-EVALUATION.exclusion_specific.v1", "Exclusion - specific", [
    element("at0003", dvLocalName("at0004", "Problem/diagnosis"), writeCoded(key, touch, "en")),
  ]);
}

function writeCoded(
  key: string,
  touch: (key: string) => void,
  language: NoteLanguage = "en",
): Record<string, unknown> {
  touch(key);
  const row = term(key);
  const text = clinergyCodedText(key, language);
  return dvCoded(text, "Clinergy", key, mappingList(row));
}

function writeLocal(
  at: string,
  text: string,
  key: string,
  touch: (key: string) => void,
  language: NoteLanguage = "en",
): Record<string, unknown> {
  touch(key);
  const rubric = localCodedText(at, text, language, key);
  return dvCoded(rubric, "local", at, mappingList(term(key)));
}

function mappingList(row: Term | undefined): Record<string, unknown>[] {
  if (!row) return [];
  const out: Record<string, unknown>[] = [];
  if (row.clinergy) {
    out.push(termMapping("=", "Clinergy", row.clinergy));
  }
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

function observation(
  archetype: string,
  name: string,
  items: Record<string, unknown>[],
  language: NoteLanguage = "en",
): Record<string, unknown> {
  return {
    _type: "OBSERVATION",
    name: dvText(name),
    archetype_node_id: archetype,
    archetype_details: archetyped(archetype),
    language: codePhrase("ISO_639-1", language),
    encoding: codePhrase("IANA_character-sets", "UTF-8"),
    subject: { _type: "PARTY_SELF" },
    data: history(items, language),
  };
}

function evaluation(
  archetype: string,
  name: string,
  items: Record<string, unknown>[],
  language: NoteLanguage = "en",
): Record<string, unknown> {
  return {
    _type: "EVALUATION",
    name: dvText(name),
    archetype_node_id: archetype,
    archetype_details: archetyped(archetype),
    language: codePhrase("ISO_639-1", language),
    encoding: codePhrase("IANA_character-sets", "UTF-8"),
    subject: { _type: "PARTY_SELF" },
    data: {
      _type: "ITEM_TREE",
      name: dvText(rmLabel(language, "Tree", "Träd")),
      archetype_node_id: "at0001",
      items,
    },
  };
}

function history(items: Record<string, unknown>[], language: NoteLanguage = "en"): Record<string, unknown> {
  return {
    _type: "HISTORY",
    name: dvText(rmLabel(language, "Event Series", "Händelseserie")),
    archetype_node_id: "at0001",
    origin: { _type: "DV_DATE_TIME", value: TIME },
    events: [{
      _type: "POINT_EVENT",
      name: dvText(rmLabel(language, "Any event", "Händelse")),
      archetype_node_id: "at0002",
      time: { _type: "DV_DATE_TIME", value: TIME },
      data: {
        _type: "ITEM_TREE",
        name: dvText(rmLabel(language, "Tree", "Träd")),
        archetype_node_id: "at0003",
        items,
      },
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

function dvText(value: string, mappings: NarrativeMapping[] = []): Record<string, unknown> {
  if (!mappings.length) return { _type: "DV_TEXT", value };
  return {
    _type: "DV_TEXT",
    value,
    mappings: mappings.map((row) => termMapping(row.match, "SNOMED-CT", row.expression)),
  };
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

function diagnosisLinks(_state: WorkbenchState): FormLink[] {
  return painForm.diagnoses;
}

function diseaseAnswer(state: WorkbenchState, link: FormLink): FindingForm | undefined {
  const summary = state.diagnoses[link.item];
  if (summary !== "presence" && summary !== "possible") return undefined;
  const key = link.preCoordinated ?? link.item;
  return state.formAnswers?.[key] ?? state.formAnswers?.[link.item];
}

function problemQualifierCluster(
  answer: FindingForm | undefined,
  touch: (key: string) => void,
  language: NoteLanguage,
): Record<string, unknown> | null {
  if (!answer) return null;
  const items: Record<string, unknown>[] = [];
  const progress = answer.choices?.AbsoluteProgress;
  if (progress && QUALIFIER_PROGRESS[progress]) {
    const [code, text] = QUALIFIER_PROGRESS[progress];
    items.push(
      element(
        "at0102",
        rmLabel(language, "Progression", "Progression"),
        writeLocal(code, text, progress, touch, language),
      ),
    );
  }
  const healing = answer.choices?.AbsoluteHealingCharacter;
  if (healing && QUALIFIER_HEALING[healing]) {
    const [code, text] = QUALIFIER_HEALING[healing];
    items.push(
      element(
        "at0083",
        rmLabel(language, "Resolution phase", "Resolutionsfas"),
        writeLocal(code, text, healing, touch, language),
      ),
    );
  }
  if (!items.length) return null;
  return {
    _type: "CLUSTER",
    name: dvText(rmLabel(language, "Status", "Status")),
    archetype_node_id: "at0046",
    archetype_details: archetyped("openEHR-EHR-CLUSTER.problem_qualifier.v2"),
    items,
  };
}

function linkedSymptomDuration(state: WorkbenchState): { amount: number; unit: string } | null {
  if (state.pain.durationNumber != null && state.pain.durationNumber > 0) {
    return { amount: state.pain.durationNumber, unit: state.pain.durationUnit };
  }
  return null;
}

function problemDiagnosisOnset(
  state: WorkbenchState,
  link: FormLink,
  answer: FindingForm | undefined,
): string | null {
  const topic = link.preCoordinated ?? link.item;
  if (topic === "ThumbFracture") {
    if (answer?.durationNumber != null && answer.durationNumber > 0) {
      return onsetDateTimeMinus(TIME, answer.durationNumber, answer.durationUnit);
    }
    return null;
  }
  if (topic === "ThumbSprain" || topic === "ThumbJointDislocation") {
    if (answer?.durationNumber != null && answer.durationNumber > 0) return null;
    const linked = linkedSymptomDuration(state);
    if (!linked) return null;
    return null;
  }
  return null;
}

function onsetDateTimeMinus(endIso: string, amount: number, unit: string): string {
  const end = new Date(endIso);
  if (Number.isNaN(end.getTime())) throw new Error(`Invalid composition time: ${endIso}`);
  const start = new Date(end.getTime());
  const n = Math.max(0, Math.floor(amount));
  switch (unit) {
    case "second":
      start.setUTCSeconds(start.getUTCSeconds() - n);
      return formatOnsetPrecision(start, "second");
    case "minute":
      start.setUTCMinutes(start.getUTCMinutes() - n);
      return formatOnsetPrecision(start, "minute");
    case "hour":
      start.setUTCHours(start.getUTCHours() - n);
      return formatOnsetPrecision(start, "hour");
    case "day":
      start.setUTCDate(start.getUTCDate() - n);
      return formatOnsetPrecision(start, "day");
    case "week":
      start.setUTCDate(start.getUTCDate() - n * 7);
      return formatOnsetPrecision(start, "day");
    case "month":
      start.setUTCMonth(start.getUTCMonth() - n);
      return formatOnsetPrecision(start, "month");
    case "year":
      start.setUTCFullYear(start.getUTCFullYear() - n);
      return formatOnsetPrecision(start, "year");
    default:
      throw new Error(`Unknown duration unit: ${unit}`);
  }
}

function formatOnsetPrecision(date: Date, unit: string): string {
  const pad = (v: number) => String(v).padStart(2, "0");
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  if (unit === "year") return `${y}`;
  if (unit === "month") return `${y}-${m}`;
  if (unit === "day" || unit === "week") return `${y}-${m}-${d}`;
  if (unit === "hour") return `${y}-${m}-${d}T${h}`;
  if (unit === "minute") return `${y}-${m}-${d}T${h}:${min}`;
  return `${y}-${m}-${d}T${h}:${min}:${s}`;
}

/**
 * The visit builder used by the page. Examination prose is stored on the
 * exam cluster. A non-empty plan becomes a Plan section. Symptom and exam
 * forms that are not selected are left out. Generated story and diagnosis
 * text get SNOMED CT expression mappings from the reviewed map.
 */
export function buildVisit(
  state: WorkbenchState,
  narrative: string | undefined,
  language: NoteLanguage = "en",
): ThumbComposition {
  const findings = findingsFromState(state, painForm.diagnoses);
  const story = narrative ?? historyNarrativeText(findings, language);
  return buildThumbEncounter(state, story, {
    clinicalDescription: true,
    embedDiagnosisText: true,
    language,
    snomed: snomedMap,
  });
}

function isoDuration(n: number, unit: string): string {
  const designator: Record<string, string> = {
    second: "PT{n}S", minute: "PT{n}M", hour: "PT{n}H", day: "P{n}D",
    week: "P{n}W", month: "P{n}M", year: "P{n}Y",
  };
  const pattern = designator[unit];
  if (!pattern) throw new Error(`Unknown duration unit: ${unit}`);
  return pattern.replace("{n}", String(n));
}
