import { painForm } from "../knowledge.ts";
import { type FindingForm, type WorkbenchState } from "../model.ts";
import {
  DEMO_PATIENT_ID,
  SYMPTOM_PROFILE,
  codingFor,
  demoPatient,
  displayOf,
  isoDuration,
  ucumOf,
} from "./coding.ts";

export interface SymptomGap {
  path: string;
  clinergy?: string;
  reason: string;
}

export interface SymptomExport {
  profile: string;
  documentation: string;
  symptoms: Record<string, unknown>[];
  gaps: SymptomGap[];
}

const DOCUMENTED = "2021-10-21T14:21:00+01:00";

function codeString(key: string): string {
  const coding = codingFor(key);
  return coding?.code ?? key;
}

function annotation(text: string): Record<string, unknown> {
  return { text };
}

function codingNote(key: string): string {
  const coding = codingFor(key);
  if (coding?.system && coding.code) {
    return `${displayOf(key)} (${coding.system}|${coding.code})`;
  }
  return `${displayOf(key)} (no verified code; Clinergy key ${key})`;
}

function positiveSymptom(form: FindingForm): boolean {
  if (form.summary === "absence") return false;
  if (form.summary === "presence") return true;
  return Boolean(
    form.laterality.length ||
      form.sublocation ||
      (form.durationNumber != null && form.durationNumber > 0) ||
      Object.values(form.choices).some(Boolean),
  );
}

function locationOf(form: FindingForm, siteKey: string): Record<string, unknown> | undefined {
  const qualifiers: string[] = [];
  if (form.laterality.includes("left")) qualifiers.push("left");
  if (form.laterality.includes("right")) qualifiers.push("right");
  if (form.sublocation) qualifiers.push(displayOf(form.sublocation));
  if (!qualifiers.length && siteKey === "Thumb" && !form.laterality.length && !form.sublocation) {
    // Still record the body site for a thumb-pain finding.
  }
  return {
    code: codeString(siteKey),
    ...(qualifiers.length ? { qualifier: qualifiers } : {}),
  };
}

function qualityOf(form: FindingForm): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const character = form.choices.AbsolutePainDescriptor;
  if (character) {
    rows.push({
      value: codeString(character),
      note: annotation(codingNote(character)),
    });
  }
  for (const [feature, label] of [
    ["AbsoluteConsistency", "consistency"],
    ["AbsoluteTexture", "texture"],
  ] as const) {
    const value = form.choices[feature];
    if (!value) continue;
    // The IG quality element is the patient's perception of the symptom.
    // Swelling consistency and texture fit that better than impact or events.
    rows.push({
      value: codeString(value),
      note: annotation(`${label}: ${codingNote(value)}`),
    });
  }
  return rows;
}

function severityOf(form: FindingForm): Record<string, unknown> | undefined {
  const value = form.choices.AbsoluteSeverity;
  if (!value) return undefined;
  return { value: codeString(value), note: annotation(codingNote(value)) };
}

function frequencyOf(form: FindingForm): Record<string, unknown> | undefined {
  const value = form.choices.AbsoluteFrequency;
  if (!value) return undefined;
  return { quality: displayOf(value) };
}

function timingOf(form: FindingForm): Record<string, unknown> | undefined {
  const onset = form.choices.AbsoluteOnset;
  const timing: Record<string, unknown> = {};
  if (onset) timing.speedOfOnset = codeString(onset);
  if (form.durationNumber != null && form.durationNumber > 0) {
    const ucum = ucumOf(form.durationUnit);
    timing.duration = {
      value: form.durationNumber,
      unit: ucum.unit,
      system: ucum.system,
      code: ucum.code,
    };
    // Also keep the ISO-8601 form in a note — the IG type is Duration (a Quantity).
    timing.note = annotation(`Episode duration ${isoDuration(form.durationNumber, form.durationUnit)}`);
  }
  if (!onset && !timing.duration) return undefined;
  return timing;
}

function conditionFor(item: string, status: string): Record<string, unknown> {
  const coding = codingFor(item);
  const clinical = status === "presence"
    ? { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] }
    : status === "possible"
      ? { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "provisional", display: "provisional" }] }
      : { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "inactive" }] };
  const resource: Record<string, unknown> = {
    resourceType: "Condition",
    id: `dx-${item}`,
    subject: { reference: `Patient/${DEMO_PATIENT_ID}`, display: "John Parsons" },
    code: coding?.code && coding.system
      ? { coding: [coding], text: displayOf(item) }
      : { text: displayOf(item) },
  };
  if (status === "excluded") {
    resource.verificationStatus = {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "refuted", display: "refuted" }],
    };
    resource.clinicalStatus = {
      coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "inactive" }],
    };
  } else if (status === "possible") {
    resource.verificationStatus = clinical;
  } else {
    resource.clinicalStatus = clinical;
  }
  return resource;
}

function symptomModel(
  id: string,
  topic: string,
  form: FindingForm,
  narrative: string,
  presentFlag: boolean,
): Record<string, unknown> {
  const keyFeatures: Record<string, unknown> = {};
  const location = locationOf(form, "Thumb");
  if (location) keyFeatures.location = [location];
  if (presentFlag) {
    const quality = qualityOf(form);
    if (quality.length) keyFeatures.quality = quality;
    const severity = severityOf(form);
    if (severity) keyFeatures.severity = severity;
    const frequency = frequencyOf(form);
    if (frequency) keyFeatures.frequency = frequency;
  }

  const model: Record<string, unknown> = {
    // Logical model instance, not a FHIR resource. resourceType is a convenience tag.
    resourceType: "SymptomLogicalModel",
    meta: { profile: [SYMPTOM_PROFILE] },
    identifier: id,
    symptomCode: codeString(topic),
    presentFlag,
    affectedPatient: demoPatient(),
    reporterPatient: demoPatient(),
    keyFeatures,
    metadata: {
      documentationDate: DOCUMENTED,
      issued: DOCUMENTED,
    },
  };
  if (narrative.trim()) {
    model.symptomDescription = [annotation(narrative.trim())];
  }
  if (presentFlag) {
    const timing = timingOf(form);
    if (timing) model.timing = timing;
    const trend = form.choices.AbsoluteProgress;
    if (trend) model.trend = codeString(trend);
    const course = form.choices.AbsoluteProcessPattern;
    if (course) model.clinicalCourse = codeString(course);
  }
  return model;
}

function stiffnessModel(summary: string, sentence: string | undefined): Record<string, unknown> {
  return {
    resourceType: "SymptomLogicalModel",
    meta: { profile: [SYMPTOM_PROFILE] },
    identifier: "joint-stiffness",
    symptomCode: codeString("JointStiffnessSymptom"),
    presentFlag: summary === "presence",
    affectedPatient: demoPatient(),
    reporterPatient: demoPatient(),
    ...(sentence ? { symptomDescription: [annotation(sentence)] } : {}),
    keyFeatures: {},
    metadata: { documentationDate: DOCUMENTED, issued: DOCUMENTED },
  };
}

export function buildSymptomExport(state: WorkbenchState, narrative: string): SymptomExport {
  const gaps: SymptomGap[] = [];
  const sentences = narrative.split("\n").map((line) => line.trim()).filter(Boolean);
  const painSentence = sentences[0] ?? narrative;
  const swellingSentence = sentences.find((line, i) => i > 0 && /swell/i.test(line));
  const stiffnessSentence = sentences.find((line) => /stiff/i.test(line));

  const symptoms: Record<string, unknown>[] = [];

  const painPresent = state.pain.summary !== "absence";
  // Always emit the form topic. presentFlag is true unless the user marked pain absent,
  // matching the English sentence "Thumb pain" on an untouched form.
  symptoms.push(symptomModel("thumb-pain", "ThumbPainSymptom", state.pain, painSentence, painPresent));

  if (state.swelling.summary === "absence" || positiveSymptom(state.swelling)) {
    const present = state.swelling.summary !== "absence";
    symptoms.push(symptomModel(
      "thumb-swelling",
      "ThumbSwellingSymptom",
      state.swelling,
      swellingSentence ?? (present ? "Thumb swelling" : "Absent thumb swelling"),
      present,
    ));
  }

  if (state.stiffness) {
    symptoms.push(stiffnessModel(state.stiffness, stiffnessSentence));
  }

  const conditions: Record<string, unknown>[] = [];
  for (const link of painForm.diagnoses) {
    const status = state.diagnoses[link.item];
    if (!status) continue;
    conditions.push(conditionFor(link.preCoordinated ?? link.concept, status));
  }

  const primary = symptoms[0] as Record<string, unknown> | undefined;
  if (primary) {
    const associated = symptoms.slice(1);
    if (associated.length) primary.associatedSymptoms = associated;
    if (conditions.length) primary.associatedConditions = conditions;
  }

  // Gaps that are honest about what the form has and the model does not take.
  if (Object.values(state.exam.left).some(Boolean) || Object.values(state.exam.right).some(Boolean)) {
    gaps.push({
      path: "examination",
      reason: "Thumb examination findings (status, tenderness, movement range and pain on movement) have no element on the Symptom Logical Model. They stay on the openEHR encounter only.",
    });
  }
  for (const [key, value] of Object.entries(state.consequences)) {
    if (!value) continue;
    gaps.push({
      path: "keyFeatures.surroundingEvents",
      clinergy: key,
      reason: `Swelling-form consequence ${displayOf(key)} (${value}) is a criterial link, not a Symptom Logical Model trigger or alleviating factor, so it is not mapped.`,
    });
  }
  gaps.push({
    path: "reporter[x]",
    reason: "The workbench is a clinician form (composer Dr J Brown in the openEHR encounter). The logical model only allows Patient or RelatedPerson as reporter, so reporterPatient is the demo subject John Parsons, not the clinician.",
  });
  gaps.push({
    path: "timing.onset[x]",
    reason: "The form records qualitative onset (gradual, rapid, sudden) as timing.speedOfOnset. It has no calendar date or period for first occurrence.",
  });
  if (state.pain.choices.AbsoluteFrequency || state.swelling.choices.AbsoluteFrequency) {
    // already mapped to frequency.quality; note the missing quantity
    gaps.push({
      path: "keyFeatures.frequency.quantity",
      reason: "Frequency on the form is qualitative only (infrequent, occasional, frequent). No numeric rate is available for frequency.quantity.",
    });
  }
  if (!codingFor("ThumbPainSymptom")?.system) {
    // ThumbPainSymptom has verified SNOMED actually - skip
  }
  if (!codingFor("ThumbSwellingSymptom") && symptoms.some((s) => s.identifier === "thumb-swelling")) {
    gaps.push({
      path: "SymptomLogicalModel[thumb-swelling].symptomCode",
      clinergy: "ThumbSwellingSymptom",
      reason: "No verified OpenGALEN or SNOMED code for ThumbSwellingSymptom; the code is the Clinergy key.",
    });
  }
  gaps.push({
    path: "keyFeatures.impact",
    reason: "The published extract has no impact, trigger, or alleviating-factor questions, so those elements are left empty.",
  });

  return {
    profile: SYMPTOM_PROFILE,
    documentation: "https://build.fhir.org/ig/HL7/fhir-symptoms-ig/en/StructureDefinition-SymptomLogicalModel.html",
    symptoms,
    gaps,
  };
}

