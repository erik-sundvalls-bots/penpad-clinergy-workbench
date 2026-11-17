export interface FhirIssue {
  path: string;
  message: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function need(issues: FhirIssue[], path: string, ok: boolean, message: string): void {
  if (!ok) issues.push({ path, message });
}

/**
 * Structural R4 checks for the visit bundle. This is not the Java validator.
 * It fails on missing required fields rather than skipping a resource.
 */
export function validateFhirBundle(bundle: unknown): FhirIssue[] {
  const issues: FhirIssue[] = [];
  const root = asRecord(bundle);
  need(issues, "Bundle", root?.resourceType === "Bundle", "resourceType must be Bundle");
  need(issues, "Bundle.type", root?.type === "collection", "type must be collection");
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  need(issues, "Bundle.entry", entries.length > 0, "entry must not be empty");
  const ids = new Set<string>();
  entries.forEach((entry, index) => {
    const resource = asRecord(asRecord(entry)?.resource);
    const path = `Bundle.entry[${index}]`;
    if (!resource) {
      issues.push({ path, message: "resource is missing" });
      return;
    }
    const type = String(resource.resourceType ?? "");
    const id = String(resource.id ?? "");
    need(issues, `${path}.resourceType`, type.length > 0, "resourceType is required");
    need(issues, `${path}.id`, id.length > 0, "id is required");
    if (id) {
      const key = `${type}/${id}`;
      if (ids.has(key)) issues.push({ path, message: `duplicate ${key}` });
      ids.add(key);
    }
    if (type === "Encounter") checkEncounter(issues, path, resource);
    if (type === "Observation") checkObservation(issues, path, resource);
    if (type === "Condition") checkCondition(issues, path, resource);
    if (type === "CarePlan") checkCarePlan(issues, path, resource);
    if (type === "Patient") {
      need(issues, `${path}.name`, Array.isArray(resource.name) && resource.name.length > 0, "Patient.name is required");
    }
  });
  return issues;
}

function checkEncounter(issues: FhirIssue[], path: string, resource: Record<string, unknown>): void {
  need(issues, `${path}.status`, resource.status === "finished" || resource.status === "in-progress", "Encounter.status is required");
  const clazz = asRecord(resource.class);
  need(issues, `${path}.class.code`, Boolean(clazz?.code), "Encounter.class is required");
  const period = asRecord(resource.period);
  need(issues, `${path}.period.start`, typeof period?.start === "string" && period.start.length > 0, "Encounter.period.start is required");
  const subject = asRecord(resource.subject);
  need(issues, `${path}.subject`, typeof subject?.reference === "string", "Encounter.subject is required");
}

function checkObservation(issues: FhirIssue[], path: string, resource: Record<string, unknown>): void {
  need(issues, `${path}.status`, resource.status === "final", "Observation.status must be final");
  const code = asRecord(resource.code);
  need(issues, `${path}.code`, Boolean(code?.text) || (Array.isArray(code?.coding) && code.coding.length > 0), "Observation.code is required");
  const subject = asRecord(resource.subject);
  need(issues, `${path}.subject`, typeof subject?.reference === "string", "Observation.subject is required");
  const hasValue = typeof resource.valueString === "string" || asRecord(resource.valueCodeableConcept);
  need(issues, `${path}.value[x]`, Boolean(hasValue), "Observation.value[x] is required");
  const categories = Array.isArray(resource.category) ? resource.category : [];
  for (const category of categories) {
    const codings = asRecord(category)?.coding;
    if (!Array.isArray(codings)) continue;
    for (const coding of codings) {
      const row = asRecord(coding);
      if (row?.system === "http://terminology.hl7.org/CodeSystem/observation-category") {
        need(issues, `${path}.category`, row.code === "exam", "examination category must be exam");
      }
    }
  }
}

function checkCondition(issues: FhirIssue[], path: string, resource: Record<string, unknown>): void {
  const code = asRecord(resource.code);
  need(issues, `${path}.code`, Boolean(code?.text) || (Array.isArray(code?.coding) && code.coding.length > 0), "Condition.code is required");
  const subject = asRecord(resource.subject);
  need(issues, `${path}.subject`, typeof subject?.reference === "string", "Condition.subject is required");
  const verification = asRecord(resource.verificationStatus);
  const verCoding = Array.isArray(verification?.coding) ? asRecord(verification.coding[0]) : null;
  need(issues, `${path}.verificationStatus`, Boolean(verCoding?.code), "Condition.verificationStatus is required");
  const clinical = asRecord(resource.clinicalStatus);
  const clinicalCoding = Array.isArray(clinical?.coding) ? asRecord(clinical.coding[0]) : null;
  need(issues, `${path}.clinicalStatus`, Boolean(clinicalCoding?.code), "Condition.clinicalStatus is required");
}

function checkCarePlan(issues: FhirIssue[], path: string, resource: Record<string, unknown>): void {
  need(issues, `${path}.status`, resource.status === "active", "CarePlan.status is required");
  need(issues, `${path}.intent`, resource.intent === "plan", "CarePlan.intent must be plan");
  need(issues, `${path}.description`, typeof resource.description === "string" && resource.description.length > 0, "CarePlan.description is required");
  const subject = asRecord(resource.subject);
  need(issues, `${path}.subject`, typeof subject?.reference === "string", "CarePlan.subject is required");
}
