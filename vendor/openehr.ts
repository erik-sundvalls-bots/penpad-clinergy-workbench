/**
 * Build an openEHR canonical JSON composition and its FLAT form from findings.
 *
 * Paths and at-codes come from mappings/openehr.yaml, which cites the published
 * CKM archetypes. OpenGALEN names are added only from a verified mappings file
 * (method exact, normalised or reviewed). Worklist hints are ignored. Anything
 * without a verified name is listed in `unmapped`.
 */
/**
 * Vendored from erik-sundvalls-bots/clinergy-extractor main @ f975528
 * (PRs #9, #10 and #11 merged). Apache-2.0.
 * The filesystem loader was dropped. LOCAL FIX: laterality looks up
 * leftSelection / rightSelection, the keys in the real Clinergy extract.
 */
import { type Finding, render, type SentenceKnowledge } from "./sentence.ts";

export interface CodedValue {
  code: string;
  text: string;
  terminology?: string;
}
export interface NodeRef {
  nodeId: string;
  path: string;
  rmType: string;
  status?: string;
  note?: string;
  values?: Record<string, CodedValue>;
}
export interface DescriptorMap {
  templateId: string;
  composition: {
    archetype: string;
    revision: string;
    category: CodedValue & { terminology: string };
    setting: CodedValue & { terminology: string };
  };
  story: { archetype: string; revision: string; nodeId: string; path: string; rmType: string };
  symptom: {
    archetype: string;
    revision: string;
    name: NodeRef;
    bodySiteSlot: string;
  };
  location: {
    archetype: string;
    revision: string;
    name: NodeRef;
    specificSite: NodeRef;
    laterality: NodeRef;
  };
  descriptors: Record<string, NodeRef>;
  summary: Record<string, { status: string; note?: string }>;
}

/** The verified-mapping shape written by clinergy-to-opengalen.ts. */
export interface OpenGalenMapping {
  opengalen: string | null;
  method: string;
}

export interface TermBinding {
  /** Concept key that was looked up. */
  key: string;
  opengalen: string;
  method: string;
}
export interface Unmapped {
  key: string;
  reason: string;
}
export interface OpenEhrResult {
  canonical: Record<string, unknown>;
  flat: Record<string, string>;
  /** Verified OpenGALEN bindings actually written onto the composition. */
  bindings: TermBinding[];
  /** Concepts, descriptors and values with no verified mapping or no archetype path. */
  unmapped: Unmapped[];
}

export interface BuildOptions {
  /** ISO 8601. Default is the public walkthrough's form time, 21 Oct 2021 14:21 BST. */
  time?: string;
  composer?: string;
  territory?: string;
  language?: string;
}

const DEFAULT_TIME = "2021-10-21T14:21:00+01:00";
const VERIFIED_METHODS = new Set(["exact", "normalised", "reviewed"]);

type Yaml = Record<string, unknown>;

export function descriptorMapFromParsed(doc: unknown): DescriptorMap {
  const raw = asRecord(doc);
  const composition = asRecord(raw.composition);
  const story = asRecord(raw.story);
  const symptom = asRecord(raw.symptom);
  const location = asRecord(raw.location);
  const descriptors: DescriptorMap["descriptors"] = {};
  for (const [name, value] of Object.entries(asRecord(raw.descriptors))) {
    descriptors[name] = nodeFrom(asRecord(value));
  }
  const summary: DescriptorMap["summary"] = {};
  for (const [name, value] of Object.entries(asRecord(raw.summary))) {
    const row = asRecord(value);
    summary[name] = { status: String(row.status ?? "unmapped"), note: optionalString(row.note) };
  }
  return {
    templateId: String(raw.templateId ?? "thumb-pain-encounter.v1"),
    composition: {
      archetype: String(composition.archetype),
      revision: String(composition.revision ?? ""),
      category: coded(asRecord(composition.category)),
      setting: coded(asRecord(composition.setting)),
    },
    story: {
      archetype: String(story.archetype),
      revision: String(story.revision ?? ""),
      nodeId: String(story.nodeId),
      path: String(story.path),
      rmType: String(story.rmType),
    },
    symptom: {
      archetype: String(symptom.archetype),
      revision: String(symptom.revision ?? ""),
      name: nodeFrom(asRecord(symptom.name)),
      bodySiteSlot: String(symptom.bodySiteSlot),
    },
    location: {
      archetype: String(location.archetype),
      revision: String(location.revision ?? ""),
      name: nodeFrom(asRecord(location.name)),
      specificSite: nodeFrom(asRecord(location.specificSite)),
      laterality: nodeFrom(asRecord(location.laterality)),
    },
    descriptors,
    summary,
  };
}

/** mappings.yaml as written by the OpenGALEN preprocessor. Hints are not mappings. */
export function openGalenFromParsed(doc: unknown): Record<string, OpenGalenMapping> {
  const out: Record<string, OpenGalenMapping> = {};
  for (const [name, value] of Object.entries(asRecord(doc))) {
    const row = asRecord(value);
    out[name] = {
      opengalen: typeof row.opengalen === "string" ? row.opengalen : null,
      method: String(row.method ?? ""),
    };
  }
  return out;
}

export function buildOpenEhr(
  findings: Finding[],
  knowledge: SentenceKnowledge,
  map: DescriptorMap,
  opengalen: Record<string, OpenGalenMapping> = {},
  options: BuildOptions = {},
): OpenEhrResult {
  const time = options.time ?? DEFAULT_TIME;
  const composer = options.composer ?? "Dr J Brown";
  const language = options.language ?? "en";
  const territory = options.territory ?? "GB";
  const unmapped: Unmapped[] = [];
  const bindings: TermBinding[] = [];
  const flat: Record<string, string> = {};
  const id = map.templateId;

  const bind = (key: string): string | null => {
    // LOCAL FIX. Laterality buttons in the real extract are leftSelection and
    // rightSelection. A finding still says laterality: left | right.
    const resolved = resolveGalenKey(key, opengalen);
    const row = opengalen[resolved];
    if (!row) {
      unmapped.push({ key: resolved, reason: "no verified OpenGALEN mapping" });
      return null;
    }
    if (!row.opengalen || !VERIFIED_METHODS.has(row.method)) {
      unmapped.push({
        key: resolved,
        reason: row.method ? `mapping method ${row.method} is not a verified mapping` : "mapping has no OpenGALEN name",
      });
      return null;
    }
    bindings.push({ key: resolved, opengalen: row.opengalen, method: row.method });
    return row.opengalen;
  };

  const clusters = findings.map((finding, index) =>
    symptomCluster(finding, index, knowledge, map, bind, unmapped, flat, id)
  );
  const storyItems = findings.map((finding, index) => {
    const sentence = render(finding, knowledge);
    const node = `${storyBase(id)}/data[at0001]/events[at0002:0]/data[at0003]/items[at0004:${index}]/value`;
    flat[node] = sentence;
    return element(map.story.nodeId, "Story", dvText(sentence));
  });

  flat[`${id}/category|code`] = map.composition.category.code;
  flat[`${id}/category|value`] = map.composition.category.text;
  flat[`${id}/category|terminology`] = map.composition.category.terminology;
  flat[`${id}/context/start_time`] = time;
  flat[`${id}/context/setting|code`] = map.composition.setting.code;
  flat[`${id}/context/setting|value`] = map.composition.setting.text;
  flat[`${id}/context/setting|terminology`] = map.composition.setting.terminology;
  flat[`${id}/composer|name`] = composer;
  flat[`${storyBase(id)}/data[at0001]/events[at0002:0]/time`] = time;

  const canonical = composition(map, language, territory, composer, time, storyItems, clusters);
  return { canonical, flat, bindings: dedupeBindings(bindings), unmapped: dedupe(unmapped) };
}

function symptomCluster(
  finding: Finding,
  index: number,
  knowledge: SentenceKnowledge,
  map: DescriptorMap,
  bind: (key: string) => string | null,
  unmapped: Unmapped[],
  flat: Record<string, string>,
  templateId: string,
): Record<string, unknown> | null {
  if (finding.summary && map.summary[finding.summary]?.status === "unmapped") {
    unmapped.push({
      key: finding.summary,
      reason: map.summary[finding.summary].note ?? "summary value is not mapped",
    });
    return null;
  }
  if (finding.summary && map.summary[finding.summary]?.status === "implied") {
    // Presence is the cluster itself. Not an OpenGALEN miss and not an element.
  }
  const items: Record<string, unknown>[] = [];
  const base = `${
    storyBase(templateId)
  }/data[at0001]/events[at0002:0]/data[at0003]/items[${map.symptom.archetype}:${index}]`;
  const name = symptomName(finding, knowledge);
  const nameOg = bind(finding.topic);
  items.push(element(
    map.symptom.name.nodeId,
    "Symptom/Sign name",
    nameOg ? dvCoded(name, "OpenGALEN", nameOg) : dvText(name),
  ));
  flat[`${base}/items[${map.symptom.name.nodeId}]/${nameOg ? "value|value" : "value"}`] = name;
  if (nameOg) {
    flat[`${base}/items[${map.symptom.name.nodeId}]/value|code`] = nameOg;
    flat[`${base}/items[${map.symptom.name.nodeId}]/value|terminology`] = "OpenGALEN";
  }

  if (finding.location) {
    const loc = locationCluster(
      finding,
      knowledge,
      map,
      bind,
      unmapped,
      flat,
      `${base}/items[${map.location.archetype}:0]`,
    );
    items.push(loc);
  }
  for (const qualifier of finding.qualifiers ?? []) {
    const node = map.descriptors[qualifier.descriptor];
    if (!node || node.status === "unmapped" || !node.nodeId) {
      unmapped.push({
        key: qualifier.descriptor,
        reason: node?.note ?? "no archetype path for this descriptor",
      });
      continue;
    }
    const written = writeQualifier(qualifier, node, knowledge, bind, flat, `${base}/items[${node.nodeId}]`);
    if (written) items.push(written);
    else unmapped.push({ key: `${qualifier.descriptor}.${qualifier.value}`, reason: node.note ?? "value not mapped" });
  }
  return cluster(map.symptom.archetype, "Symptom/Sign", items);
}

function locationCluster(
  finding: Finding,
  knowledge: SentenceKnowledge,
  map: DescriptorMap,
  bind: (key: string) => string | null,
  unmapped: Unmapped[],
  flat: Record<string, string>,
  base: string,
): Record<string, unknown> {
  const items: Record<string, unknown>[] = [];
  const locName = display(knowledge, finding.location!);
  const locOg = bind(finding.location!);
  items.push(element(
    map.location.name.nodeId,
    "Body site name",
    locOg ? dvCoded(locName, "OpenGALEN", locOg) : dvText(locName),
  ));
  flat[`${base}/items[${map.location.name.nodeId}]/${locOg ? "value|value" : "value"}`] = locName;
  if (locOg) {
    flat[`${base}/items[${map.location.name.nodeId}]/value|code`] = locOg;
    flat[`${base}/items[${map.location.name.nodeId}]/value|terminology`] = "OpenGALEN";
  }
  if (finding.subLocation) {
    const subName = display(knowledge, finding.subLocation);
    const subOg = bind(finding.subLocation);
    items.push(element(
      map.location.specificSite.nodeId,
      "Specific site",
      subOg ? dvCoded(subName, "OpenGALEN", subOg) : dvText(subName),
    ));
    const subPath = `${base}/items[${map.location.specificSite.nodeId}]`;
    flat[`${subPath}/${subOg ? "value|value" : "value"}`] = subName;
    if (subOg) {
      flat[`${subPath}/value|code`] = subOg;
      flat[`${subPath}/value|terminology`] = "OpenGALEN";
    }
  }
  if (finding.laterality === "both") {
    unmapped.push({
      key: "both",
      reason: "anatomical location laterality is a single side; left and right are both selected",
    });
  } else if (finding.laterality) {
    const codedValue = map.location.laterality.values?.[finding.laterality];
    if (!codedValue) {
      unmapped.push({ key: finding.laterality, reason: "laterality value is not in the anatomical location map" });
    } else {
      const og = bind(finding.laterality);
      const value = dvCoded(codedValue.text, "local", codedValue.code, og);
      items.push(element(map.location.laterality.nodeId, "Laterality", value));
      const path = `${base}/items[${map.location.laterality.nodeId}]`;
      flat[`${path}/value|code`] = codedValue.code;
      flat[`${path}/value|value`] = codedValue.text;
      flat[`${path}/value|terminology`] = "local";
    }
  }
  return cluster(map.location.archetype, "Anatomical location", items);
}

function writeQualifier(
  qualifier: Finding["qualifiers"][number],
  node: NodeRef,
  knowledge: SentenceKnowledge,
  bind: (key: string) => string | null,
  flat: Record<string, string>,
  path: string,
): Record<string, unknown> | null {
  if (node.rmType === "DV_DURATION") {
    const iso = isoDuration(qualifier.number, qualifier.unit ?? qualifier.value);
    if (!iso) return null;
    bind(qualifier.unit ?? qualifier.value);
    flat[`${path}/value`] = iso;
    return element(node.nodeId, nodeLabel(node), { _type: "DV_DURATION", value: iso });
  }
  if (node.rmType === "DV_CODED_TEXT") {
    const codedValue = node.values?.[qualifier.value];
    if (!codedValue) return null;
    const og = bind(qualifier.value);
    flat[`${path}/value|code`] = codedValue.code;
    flat[`${path}/value|value`] = codedValue.text;
    flat[`${path}/value|terminology`] = "local";
    return element(node.nodeId, nodeLabel(node), dvCoded(codedValue.text, "local", codedValue.code, og));
  }
  const text = display(knowledge, qualifier.value);
  const og = bind(qualifier.value);
  flat[`${path}/${og ? "value|value" : "value"}`] = text;
  if (og) {
    flat[`${path}/value|code`] = og;
    flat[`${path}/value|terminology`] = "OpenGALEN";
  }
  return element(node.nodeId, nodeLabel(node), og ? dvCoded(text, "OpenGALEN", og) : dvText(text));
}

/** Problems found when checking a result against the web template and the map. Empty means it fits. */
export function validate(result: OpenEhrResult, template: WebTemplate, map: DescriptorMap): string[] {
  const problems: string[] = [];
  const canonical = result.canonical;
  if (canonical._type !== "COMPOSITION") problems.push("root is not a COMPOSITION");
  const category = asRecord(canonical.category);
  const code = asRecord(category.defining_code);
  if (code.code_string !== map.composition.category.code) {
    problems.push(`category code ${String(code.code_string)} is not ${map.composition.category.code}`);
  }
  if (canonical.archetype_node_id !== map.composition.archetype) {
    problems.push("composition archetype id does not match the map");
  }
  const content = Array.isArray(canonical.content) ? canonical.content as Yaml[] : [];
  if (content[0]?.archetype_node_id !== map.story.archetype) problems.push("story archetype is missing");
  const nodes = indexTemplate(template.tree);
  for (const key of Object.keys(result.flat)) {
    if (key.startsWith("ctx/")) continue;
    const structural = key.split("|")[0].replace(/:\d+/g, "");
    if (!pathKnown(structural, template, nodes)) problems.push(`FLAT path is not in the web template: ${key}`);
  }
  for (const [key, value] of Object.entries(result.flat)) {
    if (!key.endsWith("|code")) continue;
    const allowed = codesFor(key, template);
    if (allowed && !allowed.includes(value)) problems.push(`code ${value} is not allowed at ${key}`);
  }
  return problems;
}

export interface WebTemplate {
  templateId: string;
  tree: WebNode;
}
export interface WebNode {
  id: string;
  rmType: string;
  nodeId?: string;
  aqlPath?: string;
  children?: WebNode[];
  inputs?: { list?: { value: string }[] }[];
}

function indexTemplate(node: WebNode, acc = new Map<string, WebNode>()): Map<string, WebNode> {
  if (node.nodeId) acc.set(node.nodeId, node);
  if (node.aqlPath) acc.set(node.aqlPath, node);
  for (const child of node.children ?? []) indexTemplate(child, acc);
  return acc;
}

function pathKnown(flatPath: string, template: WebTemplate, nodes: Map<string, WebNode>): boolean {
  const body = flatPath.startsWith(template.templateId + "/")
    ? flatPath.slice(template.templateId.length + 1)
    : flatPath;
  if (body.startsWith("category") || body.startsWith("context/") || body.startsWith("composer")) return true;
  const ids = [...body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return ids.every((id) => nodes.has(id) || id.startsWith("openEHR-"));
}

function codesFor(flatKey: string, template: WebTemplate): string[] | null {
  const match = flatKey.match(/\[(at\d+)\][^[]*\|code$/);
  if (!match) return null;
  const node = findNode(template.tree, match[1]);
  const list = node?.inputs?.flatMap((input) => input.list ?? []) ?? [];
  return list.length ? list.map((item) => item.value) : null;
}

function findNode(node: WebNode, nodeId: string): WebNode | undefined {
  if (node.nodeId === nodeId) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, nodeId);
    if (found) return found;
  }
  return undefined;
}

// --- RM construction -------------------------------------------------------

function composition(
  map: DescriptorMap,
  language: string,
  territory: string,
  composer: string,
  time: string,
  storyItems: Record<string, unknown>[],
  clusters: (Record<string, unknown> | null)[],
): Record<string, unknown> {
  const observation = {
    _type: "OBSERVATION",
    name: dvText("Story/History"),
    archetype_node_id: map.story.archetype,
    archetype_details: archetyped(map.story.archetype, map.templateId),
    language: codePhrase("ISO_639-1", language),
    encoding: codePhrase("IANA_character-sets", "UTF-8"),
    subject: { _type: "PARTY_SELF" },
    data: {
      _type: "HISTORY",
      name: dvText("Event Series"),
      archetype_node_id: "at0001",
      origin: dvDateTime(time),
      events: [{
        _type: "POINT_EVENT",
        name: dvText("Any event"),
        archetype_node_id: "at0002",
        time: dvDateTime(time),
        data: {
          _type: "ITEM_TREE",
          name: dvText("Tree"),
          archetype_node_id: "at0003",
          items: [...storyItems, ...clusters.filter((c): c is Record<string, unknown> => c !== null)],
        },
      }],
    },
  };
  return {
    _type: "COMPOSITION",
    name: dvText("Encounter"),
    archetype_node_id: map.composition.archetype,
    archetype_details: archetyped(map.composition.archetype, map.templateId),
    language: codePhrase("ISO_639-1", language),
    territory: codePhrase("ISO_3166-1", territory),
    category: dvCoded(
      map.composition.category.text,
      map.composition.category.terminology,
      map.composition.category.code,
    ),
    composer: { _type: "PARTY_IDENTIFIED", name: composer },
    context: {
      _type: "EVENT_CONTEXT",
      start_time: dvDateTime(time),
      setting: dvCoded(map.composition.setting.text, map.composition.setting.terminology, map.composition.setting.code),
    },
    content: [observation],
  };
}

const storyBase = (templateId: string) => `${templateId}/content[openEHR-EHR-OBSERVATION.story.v1:0]`;

function element(nodeId: string, name: string, value: Record<string, unknown>): Record<string, unknown> {
  return { _type: "ELEMENT", name: dvText(name), archetype_node_id: nodeId, value };
}
function cluster(archetype: string, name: string, items: Record<string, unknown>[]): Record<string, unknown> {
  return {
    _type: "CLUSTER",
    name: dvText(name),
    archetype_node_id: archetype,
    archetype_details: archetyped(archetype),
    items,
  };
}
function archetyped(archetype: string, templateId?: string): Record<string, unknown> {
  return {
    _type: "ARCHETYPED",
    archetype_id: { _type: "ARCHETYPE_ID", value: archetype },
    ...(templateId ? { template_id: { _type: "TEMPLATE_ID", value: templateId } } : {}),
    rm_version: "1.1.0",
  };
}
function dvText(value: string): Record<string, unknown> {
  return { _type: "DV_TEXT", value };
}
function dvDateTime(value: string): Record<string, unknown> {
  return { _type: "DV_DATE_TIME", value };
}
function codePhrase(terminology: string, code: string): Record<string, unknown> {
  return {
    _type: "CODE_PHRASE",
    terminology_id: { _type: "TERMINOLOGY_ID", value: terminology },
    code_string: code,
  };
}
function dvCoded(value: string, terminology: string, code: string, opengalen?: string | null): Record<string, unknown> {
  const out: Record<string, unknown> = {
    _type: "DV_CODED_TEXT",
    value,
    defining_code: codePhrase(terminology, code),
  };
  if (opengalen) {
    // term_mapping_purpose in the published terminology is only 669 public
    // health, 670 reimbursement and 671 research study. None of those is a
    // clinical terminology binding, so the purpose text says what this mapping
    // is and the code is left local rather than borrowing one of those three.
    out.mappings = [{
      _type: "TERM_MAPPING",
      match: "=",
      purpose: dvCoded("terminology binding", "local", "terminology-binding"),
      target: codePhrase("OpenGALEN", opengalen),
    }];
  }
  return out;
}

function resolveGalenKey(key: string, opengalen: Record<string, OpenGalenMapping>): string {
  if (key === "left" || key === "right") {
    const direct = opengalen[key];
    if (direct?.opengalen && VERIFIED_METHODS.has(direct.method)) return key;
    const selection = `${key}Selection`;
    const alt = opengalen[selection];
    if (alt?.opengalen && VERIFIED_METHODS.has(alt.method)) return selection;
  }
  return key;
}

function symptomName(finding: Finding, knowledge: SentenceKnowledge): string {
  if (!finding.location) return display(knowledge, finding.topic);
  const topic = display(knowledge, finding.topic);
  const loc = display(knowledge, finding.location);
  if (loc && topic.toLowerCase().startsWith(loc.toLowerCase() + " ")) return topic.slice(loc.length).trim();
  return topic;
}

function display(knowledge: SentenceKnowledge, name: string): string {
  return knowledge.concepts[name]?.display || name;
}

function isoDuration(n: number | undefined, unit: string | undefined): string | null {
  if (n == null || !unit) return null;
  const designator: Record<string, string> = {
    second: "PT{n}S",
    seconds: "PT{n}S",
    minute: "PT{n}M",
    minutes: "PT{n}M",
    hour: "PT{n}H",
    hours: "PT{n}H",
    day: "P{n}D",
    days: "P{n}D",
    week: "P{n}W",
    weeks: "P{n}W",
    month: "P{n}M",
    months: "P{n}M",
    year: "P{n}Y",
    years: "P{n}Y",
  };
  const pattern = designator[unit.toLowerCase()];
  return pattern ? pattern.replace("{n}", String(n)) : null;
}

function nodeLabel(node: NodeRef): string {
  return node.path || node.nodeId;
}

function nodeFrom(raw: Yaml): NodeRef {
  const values: Record<string, CodedValue> = {};
  for (const [name, value] of Object.entries(asRecord(raw.values))) values[name] = coded(asRecord(value));
  return {
    nodeId: String(raw.nodeId ?? ""),
    path: String(raw.path ?? ""),
    rmType: String(raw.rmType ?? ""),
    status: optionalString(raw.status),
    note: optionalString(raw.note),
    values: Object.keys(values).length ? values : undefined,
  };
}
function coded(raw: Yaml): CodedValue & { terminology: string } {
  return {
    code: String(raw.code ?? ""),
    text: String(raw.text ?? ""),
    terminology: String(raw.terminology ?? "local"),
  };
}
function dedupeBindings(rows: TermBinding[]): TermBinding[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.key}\n${row.opengalen}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function dedupe(rows: Unmapped[]): Unmapped[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.key}\n${row.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function optionalString(v: unknown): string | undefined {
  return typeof v === "string" && v !== "" ? v : undefined;
}
function asRecord(v: unknown): Yaml {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Yaml : {};
}
