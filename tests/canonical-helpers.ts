type JsonRecord = Record<string, unknown>;

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? (value as JsonRecord[]) : [];
}

function sections(canonical: JsonRecord): JsonRecord[] {
  return asArray(canonical.content);
}

function sectionNamed(canonical: JsonRecord, name: string): JsonRecord | undefined {
  return sections(canonical).find((s) => (s.name as { value?: string })?.value === name);
}

function itemsOf(node: JsonRecord | undefined): JsonRecord[] {
  if (!node) return [];
  if (Array.isArray(node.items)) return asArray(node.items);
  const data = node.data as JsonRecord | undefined;
  if (!data) return [];
  if (Array.isArray(data.events)) {
    const event = data.events[0] as JsonRecord | undefined;
    const tree = event?.data as JsonRecord | undefined;
    return asArray(tree?.items);
  }
  return asArray(data.items);
}

export function allCodedCodes(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) allCodedCodes(child, out);
    return out;
  }
  const record = node as JsonRecord;
  if (record._type === "DV_CODED_TEXT") {
    const code = (record.defining_code as { code_string?: string })?.code_string;
    if (code) out.push(code);
  }
  for (const value of Object.values(record)) allCodedCodes(value, out);
  return out;
}

function elementText(node: JsonRecord): string | undefined {
  const value = node.value as JsonRecord | undefined;
  if (value?._type === "DV_TEXT") return String(value.value ?? "");
  return undefined;
}

export function historyStoryText(canonical: JsonRecord): string | undefined {
  const history = sectionNamed(canonical, "History");
  if (!history) return undefined;
  for (const obs of itemsOf(history)) {
    if (obs.archetype_node_id !== "openEHR-EHR-OBSERVATION.story.v1") continue;
    for (const item of itemsOf(obs)) {
      if (item.archetype_node_id === "at0004") return elementText(item);
    }
  }
  return undefined;
}

export function historySymptomCodes(canonical: JsonRecord): string[] {
  const history = sectionNamed(canonical, "History");
  if (!history) return [];
  const codes: string[] = [];
  for (const obs of itemsOf(history)) {
    if (obs.archetype_node_id !== "openEHR-EHR-OBSERVATION.story.v1") continue;
    for (const item of itemsOf(obs)) {
      if (item.archetype_node_id !== "openEHR-EHR-CLUSTER.symptom_sign.v2") continue;
      const name = allCodedCodes(item).find((c) => c.endsWith("Symptom"));
      if (name) codes.push(name);
    }
  }
  return codes;
}

export function hasStorySymptomCluster(canonical: JsonRecord): boolean {
  const history = sectionNamed(canonical, "History");
  if (!history) return false;
  for (const obs of itemsOf(history)) {
    if (obs.archetype_node_id !== "openEHR-EHR-OBSERVATION.story.v1") continue;
    for (const item of itemsOf(obs)) {
      if (item.archetype_node_id === "openEHR-EHR-CLUSTER.symptom_sign.v2") return true;
    }
  }
  return false;
}

export function hasScreeningQuestionnaire(canonical: JsonRecord): boolean {
  const history = sectionNamed(canonical, "History");
  if (!history) return false;
  return itemsOf(history).some((obs) => obs.archetype_node_id === "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1");
}

export function screeningSymptomCode(canonical: JsonRecord): string | undefined {
  const history = sectionNamed(canonical, "History");
  if (!history) return undefined;
  for (const obs of itemsOf(history)) {
    if (obs.archetype_node_id !== "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1") continue;
    return allCodedCodes(obs).find((c) => c.endsWith("Symptom"));
  }
  return undefined;
}

export function screeningPresenceCode(canonical: JsonRecord): string | undefined {
  const history = sectionNamed(canonical, "History");
  if (!history) return undefined;
  for (const obs of itemsOf(history)) {
    if (obs.archetype_node_id !== "openEHR-EHR-OBSERVATION.symptom_sign_screening.v1") continue;
    const codes = allCodedCodes(obs);
    return codes.find((c) => c === "at0024");
  }
  return undefined;
}

export function assessmentCodedCodes(canonical: JsonRecord): string[] {
  const assessment = sectionNamed(canonical, "Assessment");
  if (!assessment) return [];
  return allCodedCodes(assessment);
}