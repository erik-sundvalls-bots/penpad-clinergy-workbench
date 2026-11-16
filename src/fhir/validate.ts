/** Lightweight FHIR R4 / logical-model shape checks. Not a full FHIR validator. */

export interface ShapeIssue {
  path: string;
  message: string;
}

export interface ShapeReport {
  valid: boolean;
  errors: ShapeIssue[];
  warnings: ShapeIssue[];
}

function issue(path: string, message: string): ShapeIssue {
  return { path, message };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function walkItems(
  items: unknown,
  path: string,
  ids: Map<string, string>,
  errors: ShapeIssue[],
): void {
  if (!Array.isArray(items)) return;
  items.forEach((item, i) => {
    const here = `${path}.item[${i}]`;
    if (!isObject(item)) {
      errors.push(issue(here, "item is not an object"));
      return;
    }
    const linkId = item.linkId;
    if (typeof linkId !== "string" || !linkId) {
      errors.push(issue(here, "missing linkId"));
      return;
    }
    if (ids.has(linkId)) errors.push(issue(here, `duplicate linkId ${linkId} (also at ${ids.get(linkId)})`));
    else ids.set(linkId, here);
    const type = item.type;
    if (type != null && typeof type !== "string") errors.push(issue(here, "type must be a string"));
    if (type === "choice" && !Array.isArray(item.answerOption) && item.answerOption != null) {
      errors.push(issue(here, "choice item answerOption must be an array"));
    }
    walkItems(item.item, here, ids, errors);
  });
}

export function validateQuestionnaire(resource: Record<string, unknown>): ShapeReport {
  const errors: ShapeIssue[] = [];
  const warnings: ShapeIssue[] = [];
  if (resource.resourceType !== "Questionnaire") {
    errors.push(issue("resourceType", "expected Questionnaire"));
  }
  if (resource.status !== "draft" && resource.status !== "active" && resource.status !== "retired" && resource.status !== "unknown") {
    errors.push(issue("status", "status is not a QuestionnaireStatus code"));
  }
  if (resource.url != null && typeof resource.url !== "string") errors.push(issue("url", "url must be a uri string"));
  const ids = new Map<string, string>();
  walkItems(resource.item, "Questionnaire", ids, errors);
  if (!ids.size) errors.push(issue("item", "Questionnaire has no items"));
  return { valid: errors.length === 0, errors, warnings };
}

function collectLinkIds(items: unknown, into: Set<string>): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (!isObject(item) || typeof item.linkId !== "string") continue;
    into.add(item.linkId);
    collectLinkIds(item.item, into);
  }
}

function walkResponseItems(
  items: unknown,
  path: string,
  allowed: Set<string>,
  errors: ShapeIssue[],
): void {
  if (items == null) return;
  if (!Array.isArray(items)) {
    errors.push(issue(path, "item must be an array"));
    return;
  }
  items.forEach((item, i) => {
    const here = `${path}.item[${i}]`;
    if (!isObject(item)) {
      errors.push(issue(here, "item is not an object"));
      return;
    }
    const linkId = item.linkId;
    if (typeof linkId !== "string" || !linkId) {
      errors.push(issue(here, "missing linkId"));
    } else if (!allowed.has(linkId)) {
      errors.push(issue(here, `linkId ${linkId} is not in the Questionnaire`));
    }
    if (item.answer != null) {
      if (!Array.isArray(item.answer)) errors.push(issue(here + ".answer", "answer must be an array"));
      else {
        item.answer.forEach((ans, j) => {
          if (!isObject(ans)) {
            errors.push(issue(`${here}.answer[${j}]`, "answer is not an object"));
            return;
          }
          const valueKeys = Object.keys(ans).filter((key) => key.startsWith("value"));
          if (!valueKeys.length) errors.push(issue(`${here}.answer[${j}]`, "answer has no value[x]"));
        });
      }
    }
    walkResponseItems(item.item, here, allowed, errors);
  });
}

function narrativeOk(text: unknown, errors: ShapeIssue[]): void {
  if (text == null) {
    errors.push(issue("text", "QuestionnaireResponse has no narrative"));
    return;
  }
  if (!isObject(text)) {
    errors.push(issue("text", "text must be a Narrative"));
    return;
  }
  if (typeof text.div !== "string" || !text.div.includes("http://www.w3.org/1999/xhtml")) {
    errors.push(issue("text.div", "Narrative.div must be an XHTML string with the FHIR namespace"));
  }
  if (text.status !== "generated" && text.status !== "extensions" && text.status !== "additional" && text.status !== "empty") {
    errors.push(issue("text.status", "Narrative.status is not a valid code"));
  }
}

export function validateQuestionnaireResponse(
  response: Record<string, unknown>,
  questionnaire: Record<string, unknown>,
): ShapeReport {
  const errors: ShapeIssue[] = [];
  const warnings: ShapeIssue[] = [];
  if (response.resourceType !== "QuestionnaireResponse") {
    errors.push(issue("resourceType", "expected QuestionnaireResponse"));
  }
  const statuses = new Set(["in-progress", "completed", "amended", "entered-in-error", "stopped"]);
  if (typeof response.status !== "string" || !statuses.has(response.status)) {
    errors.push(issue("status", "status is not a QuestionnaireResponseStatus code"));
  }
  if (response.questionnaire != null && response.questionnaire !== questionnaire.url) {
    warnings.push(issue("questionnaire", "canonical does not match the generated Questionnaire.url"));
  }
  narrativeOk(response.text, errors);
  const allowed = new Set<string>();
  collectLinkIds(questionnaire.item, allowed);
  walkResponseItems(response.item, "QuestionnaireResponse", allowed, errors);
  if (response.subject != null && !isObject(response.subject)) {
    errors.push(issue("subject", "subject must be a Reference"));
  }
  return { valid: errors.length === 0, errors, warnings };
}

function requireKeys(obj: Record<string, unknown>, path: string, keys: string[], errors: ShapeIssue[]): void {
  for (const key of keys) {
    if (obj[key] == null) errors.push(issue(`${path}.${key}`, "required element is missing"));
  }
}

export function validateSymptomModel(model: Record<string, unknown>, path = "SymptomLogicalModel"): ShapeReport {
  const errors: ShapeIssue[] = [];
  const warnings: ShapeIssue[] = [];
  if (!isObject(model)) {
    return { valid: false, errors: [issue(path, "not an object")], warnings };
  }
  requireKeys(model, path, ["identifier", "symptomCode", "presentFlag", "affectedPatient", "keyFeatures", "metadata"], errors);
  if (model.reporterPatient == null && model.reporterRelatedPerson == null) {
    errors.push(issue(`${path}.reporter[x]`, "required reporterPatient or reporterRelatedPerson is missing"));
  }
  if (typeof model.identifier !== "string") errors.push(issue(`${path}.identifier`, "must be a string"));
  if (typeof model.symptomCode !== "string") errors.push(issue(`${path}.symptomCode`, "must be a string (IG type is code)"));
  if (typeof model.presentFlag !== "boolean") errors.push(issue(`${path}.presentFlag`, "must be a boolean"));
  if (model.affectedPatient != null && (!isObject(model.affectedPatient) || model.affectedPatient.resourceType !== "Patient")) {
    errors.push(issue(`${path}.affectedPatient`, "must be a Patient"));
  }
  if (model.keyFeatures != null && !isObject(model.keyFeatures)) {
    errors.push(issue(`${path}.keyFeatures`, "must be an object"));
  }
  if (isObject(model.metadata)) {
    requireKeys(model.metadata, `${path}.metadata`, ["documentationDate", "issued"], errors);
  } else if (model.metadata != null) {
    errors.push(issue(`${path}.metadata`, "must be an object"));
  }
  if (model.symptomDescription != null) {
    if (!Array.isArray(model.symptomDescription)) {
      errors.push(issue(`${path}.symptomDescription`, "must be an array of Annotation"));
    } else {
      model.symptomDescription.forEach((row, i) => {
        if (!isObject(row) || typeof row.text !== "string") {
          errors.push(issue(`${path}.symptomDescription[${i}]`, "Annotation must have text"));
        }
      });
    }
  }
  const features = isObject(model.keyFeatures) ? model.keyFeatures : null;
  if (features && features.severity != null) {
    if (!isObject(features.severity) || features.severity.value == null) {
      errors.push(issue(`${path}.keyFeatures.severity.value`, "severity.value is required when severity is present"));
    }
  }
  if (features && Array.isArray(features.quality)) {
    features.quality.forEach((row, i) => {
      if (!isObject(row) || row.value == null) {
        errors.push(issue(`${path}.keyFeatures.quality[${i}].value`, "quality.value is required"));
      }
    });
  }
  if (features && Array.isArray(features.location)) {
    features.location.forEach((row, i) => {
      if (!isObject(row) || row.code == null) {
        errors.push(issue(`${path}.keyFeatures.location[${i}].code`, "location.code is required"));
      }
    });
  }
  return { valid: errors.length === 0, errors, warnings };
}

export function validateSymptomExport(doc: { symptoms?: unknown }): ShapeReport {
  const errors: ShapeIssue[] = [];
  const warnings: ShapeIssue[] = [];
  if (!Array.isArray(doc.symptoms) || !doc.symptoms.length) {
    errors.push(issue("symptoms", "expected at least one Symptom Logical Model instance"));
    return { valid: false, errors, warnings };
  }
  doc.symptoms.forEach((row, i) => {
    const report = validateSymptomModel(isObject(row) ? row : {}, `symptoms[${i}]`);
    errors.push(...report.errors);
    warnings.push(...report.warnings);
  });
  return { valid: errors.length === 0, errors, warnings };
}
