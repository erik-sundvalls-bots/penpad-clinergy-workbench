import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";
import { buildFhirBundle, expressionCoding, SNOMED } from "../src/fhir/bundle.ts";
import { validateFhirBundle } from "../src/fhir/validate.ts";
import { painForm, snomedMap } from "../src/knowledge.ts";
import { emptyFinding, emptyState, findingsFromState, gpVisitState, type WorkbenchState } from "../src/model.ts";
import { buildThumbEncounter, buildVisit } from "../src/openehr/compose.ts";
import { loadEhrtslib } from "../src/openehr/ehrtslib-loader.ts";
import { canonicalToSimplifiedJson, canonicalToXml, xmlToCanonicalRecord } from "../src/openehr/serialization-views.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import {
  buildQuietZipehrPreviewDocument,
  canonicalToZipehrHtml5,
  composeQuietStructureCss,
  zipehrHtml5ToCanonicalRecord,
} from "../src/openehr/zipehr.ts";
import { applyZipQuietDomScript } from "../src/openehr/zipehr-preview.ts";
import { expressionsFor } from "../src/snomed/expressions.ts";
import { narrativeMappings } from "../src/snomed/narrative-mappings.ts";
import { historyFindings, historyNarrativeText } from "../src/summary.ts";
import type { SnomedMap } from "../vendor/snomed.ts";

type Json = Record<string, unknown>;
const LANGS = ["en", "sv"] as const;

/** Every ELEMENT with this node id, depth first. */
function elements(node: unknown, nodeId: string, out: Json[] = []): Json[] {
  if (!node || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) elements(child, nodeId, out);
    return out;
  }
  const record = node as Json;
  if (record._type === "ELEMENT" && record.archetype_node_id === nodeId) out.push(record);
  for (const value of Object.values(record)) elements(value, nodeId, out);
  return out;
}

function inArchetype(canonical: Json, archetype: string, nodeId: string): Json[] {
  const hits: Json[] = [];
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const record = node as Json;
    if (record.archetype_node_id === archetype) elements(record, nodeId, hits);
    else Object.values(record).forEach(walk);
  };
  walk(canonical);
  return hits;
}

function snomedRows(value: unknown): { match: string; code: string }[] {
  const mappings = (value as { mappings?: Json[] }).mappings ?? [];
  return mappings.map((row) => {
    const target = row.target as { terminology_id: { value: string }; code_string: string };
    expect(row._type).toBe("TERM_MAPPING");
    expect(target.terminology_id.value).toBe("SNOMED-CT");
    return { match: String(row.match), code: target.code_string };
  });
}

function storyValue(canonical: Json): Json {
  const story = inArchetype(canonical, "openEHR-EHR-OBSERVATION.story.v1", "at0004");
  expect(story).toHaveLength(1);
  return story[0].value as Json;
}

function painOnly(): WorkbenchState {
  const state = emptyState();
  state.pain.summary = "presence";
  state.pain.laterality = ["right"];
  return state;
}

/** Fixture map: a made-up verified sprain concept, to reach the diagnosis path. */
function mapWithSprain(): SnomedMap {
  return {
    ...snomedMap,
    concepts: {
      ...snomedMap.concepts,
      ThumbSprain: { key: "ThumbSprain", code: "1000001", term: "Test sprain", verified: true },
    },
  };
}

function withSprain(status: "presence" | "possible"): WorkbenchState {
  const state = painOnly();
  state.diagnoses.ThumbSprain = status;
  const sprain = emptyFinding();
  sprain.laterality = ["right"];
  state.formAnswers.ThumbSprain = sprain;
  return state;
}

function resources(bundle: Json): Json[] {
  return (bundle.entry as { resource: Json }[]).map((entry) => entry.resource);
}

describe("SNOMED CT expressions on generated story text", () => {
  for (const lang of LANGS) {
    it(`${lang}: one mapping per finding, byte-identical to the sidebar, ">" when the story has two findings`, async () => {
      const state = gpVisitState();
      const built = buildVisit(state, undefined, lang);
      const value = storyValue(built.canonical);
      expect(value._type).toBe("DV_TEXT");
      const sidebar = expressionsFor(findingsFromState(state, painForm.diagnoses))
        .filter((row) => row.topic === "ThumbPainSymptom" || row.topic === "ThumbSwellingSymptom")
        .map((row) => row.expression);
      expect(sidebar.every((expression) => typeof expression === "string" && expression.length > 0)).toBe(true);
      expect(snomedRows(value)).toEqual(sidebar.map((code) => ({ match: ">", code })));
      const checked = await validateComposition(built.canonical);
      expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
      expect(checked.warnings, JSON.stringify(checked.warnings)).toEqual([]);
    });

    it(`${lang}: "=" when the story is one finding with nothing unmapped`, () => {
      const state = painOnly();
      const value = storyValue(buildVisit(state, undefined, lang).canonical);
      const [sidebar] = expressionsFor(findingsFromState(state, painForm.diagnoses));
      expect(sidebar.unmapped).toEqual([]);
      expect(snomedRows(value)).toEqual([{ match: "=", code: sidebar.expression }]);
    });

    it(`${lang}: ">" when the one finding has unmapped parts (duration)`, () => {
      const state = painOnly();
      state.pain.durationNumber = 3;
      state.pain.durationUnit = "day";
      const value = storyValue(buildVisit(state, undefined, lang).canonical);
      const [sidebar] = expressionsFor(findingsFromState(state, painForm.diagnoses));
      expect(sidebar.unmapped.map((row) => row.key)).toEqual(["Duration"]);
      expect(snomedRows(value)).toEqual([{ match: ">", code: sidebar.expression }]);
    });
  }

  it("absent findings and findings without a verified focus get no mapping", () => {
    const state = emptyState();
    state.pain.summary = "absence";
    state.stiffness = "presence";
    const findings = historyFindings(findingsFromState(state, painForm.diagnoses));
    expect(expressionsFor(findings).find((row) => row.topic === "JointStiffnessSymptom")?.expression).toBeNull();
    expect(narrativeMappings(findings)).toEqual([]);
    const value = storyValue(buildVisit(state, undefined, "en").canonical);
    expect(value).toEqual({ _type: "DV_TEXT", value: historyNarrativeText(findingsFromState(state, painForm.diagnoses), "en") });
  });

  it("a story the caller wrote is not mapped", () => {
    const value = storyValue(buildVisit(painOnly(), "Typed by the clinician.", "en").canonical);
    expect(value).toEqual({ _type: "DV_TEXT", value: "Typed by the clinician." });
  });

  it("the examination description has no sidebar expression and stays plain DV_TEXT", () => {
    const built = buildVisit(gpVisitState(), undefined, "en");
    const exam = inArchetype(built.canonical, "openEHR-EHR-CLUSTER.exam.v2", "at0003");
    expect(exam.length).toBeGreaterThan(0);
    for (const item of exam) expect(item.value).toEqual({ _type: "DV_TEXT", value: (item.value as Json).value });
  });
});

describe("SNOMED CT expressions on the diagnosis description", () => {
  it("no verified focus for the sprain: at0009 has no mapping", () => {
    const built = buildVisit(gpVisitState(), undefined, "en");
    const [description] = inArchetype(built.canonical, "openEHR-EHR-EVALUATION.problem_diagnosis.v1", "at0009");
    expect((description.value as Json).value).toBe("Sprain of right thumb.");
    expect((description.value as Json).mappings).toBeUndefined();
  });

  for (const lang of LANGS) {
    it(`${lang}: with a verified focus, at0009 carries the expression with "="`, async () => {
      const map = mapWithSprain();
      const state = withSprain("presence");
      const built = buildThumbEncounter(state, "Typed.", {
        clinicalDescription: true, embedDiagnosisText: true, language: lang, snomed: map,
      });
      const finding = findingsFromState(state, painForm.diagnoses).find((row) => row.topic === "ThumbSprain");
      const [sidebar] = expressionsFor(finding ? [finding] : [], map);
      expect(sidebar.expression).toContain("1000001 |Test sprain|");
      const [description] = inArchetype(built.canonical, "openEHR-EHR-EVALUATION.problem_diagnosis.v1", "at0009");
      expect(snomedRows(description.value)).toEqual([{ match: "=", code: sidebar.expression }]);
      const checked = await validateComposition(built.canonical);
      expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);

      const bundle = buildFhirBundle(state, built.canonical);
      expect(validateFhirBundle(bundle)).toEqual([]);
      const condition = resources(bundle).find((resource) => resource.resourceType === "Condition");
      const codings = (condition?.code as { coding: Json[] }).coding;
      expect(codings).toContainEqual(expressionCoding(String(sidebar.expression)));
      expect(codings.at(-1)?.display).toBe(sidebar.expression);
    });
  }

  it("a possible diagnosis gets no mapping, even with a verified focus", () => {
    const built = buildThumbEncounter(withSprain("possible"), "Typed.", {
      clinicalDescription: true, embedDiagnosisText: true, language: "en", snomed: mapWithSprain(),
    });
    const [description] = inArchetype(built.canonical, "openEHR-EHR-EVALUATION.problem_diagnosis.v1", "at0009");
    expect((description.value as Json).mappings).toBeUndefined();
  });
});

describe("FHIR carries the story expressions on the symptom Observations", () => {
  for (const lang of LANGS) {
    it(`${lang}: extra SNOMED coding on Observation.code, existing coding and text kept`, () => {
      const state = gpVisitState();
      const built = buildVisit(state, undefined, lang);
      const bundle = buildFhirBundle(state, built.canonical);
      expect(validateFhirBundle(bundle)).toEqual([]);
      const sidebar = new Map(expressionsFor(findingsFromState(state, painForm.diagnoses))
        .map((row) => [row.topic, row.expression]));
      const symptoms = resources(bundle).filter((resource) => String(resource.id).startsWith("symptom-"));
      const pain = symptoms.find((resource) => JSON.stringify(resource.code).includes("300955002\""));
      const painCode = pain?.code as { coding: Json[]; text: string };
      expect(painCode.coding[0]).toEqual({ system: SNOMED, code: "300955002", display: "Pain in thumb" });
      expect(painCode.coding[1]).toEqual(expressionCoding(String(sidebar.get("ThumbPainSymptom"))));
      expect(painCode.coding[1].display).toBe(sidebar.get("ThumbPainSymptom"));
      expect(painCode.text.length).toBeGreaterThan(0);
      const swelling = symptoms.find((resource) => JSON.stringify(resource.code).includes("65124004 |Swelling|"));
      expect((swelling?.code as { coding: Json[] }).coding).toEqual([
        expressionCoding(String(sidebar.get("ThumbSwellingSymptom"))),
      ]);
      const story = resources(bundle).find((resource) => resource.id === "history-story");
      expect(story?.code).toEqual({ text: "Story" });
      for (const exam of resources(bundle).filter((resource) => String(resource.id).startsWith("exam-"))) {
        expect(JSON.stringify(exam.code)).not.toContain("|");
      }
    });
  }

  it("the FHIR code collapses whitespace only; the display is the expression as is", () => {
    const expression = "65124004 |Swelling| :\n  { 246112005 |Severity| = 6736007 |Moderate severity| }";
    expect(expressionCoding(expression)).toEqual({
      system: SNOMED,
      code: "65124004 |Swelling| : { 246112005 |Severity| = 6736007 |Moderate severity| }",
      display: expression,
    });
  });

  it("the validator rejects a coding code with line breaks", () => {
    const state = painOnly();
    const bundle = buildFhirBundle(state, buildVisit(state, undefined, "en").canonical);
    const symptom = resources(bundle).find((resource) => resource.id === "symptom-1");
    (symptom?.code as { coding: Json[] }).coding.push({ system: SNOMED, code: "1 :\n  2" });
    expect(validateFhirBundle(bundle).map((issue) => issue.message)).toContain(
      "Coding.code must be a FHIR code (no line breaks or repeated spaces)",
    );
  });

  it("a caller-written story adds no expression coding", () => {
    const state = painOnly();
    const bundle = buildFhirBundle(state, buildVisit(state, "Typed.", "en").canonical);
    expect(JSON.stringify(bundle)).not.toContain("|Pain in thumb|");
  });
});

describe("round-trips keep the mappings", () => {
  for (const lang of LANGS) {
    it(`${lang}: canonical JSON through ehrtslib typed RM`, async () => {
      const built = buildVisit(gpVisitState(), undefined, lang);
      const vendor = await loadEhrtslib();
      const typed = new vendor.serialization.JsonConfigurableDeserializer(
        vendor.serialization.CANONICAL_JSON_DESERIALIZE_CONFIG,
      ).deserialize(JSON.stringify(built.canonical));
      const json = new vendor.serialization.JsonConfigurableSerializer(vendor.serialization.CANONICAL_JSON_CONFIG)
        .serialize(typed);
      expect(JSON.parse(json)).toEqual(built.canonical);
    });

    it(`${lang}: XML`, async () => {
      const built = buildVisit(gpVisitState(), undefined, lang);
      expect(await xmlToCanonicalRecord(await canonicalToXml(built.canonical))).toEqual(built.canonical);
    });

    it(`${lang}: FLAT keeps byte-identical expressions and is stable FLAT -> RM -> FLAT`, async () => {
      const state = gpVisitState();
      const built = buildVisit(state, undefined, lang);
      const expressions = snomedRows(storyValue(built.canonical)).map((row) => row.code);
      for (const profile of ["better", "ehrbase", "ferroehr"] as const) {
        const flat = JSON.parse(await canonicalToSimplifiedJson(built.canonical, profile, "flat")) as Record<string, string>;
        const codes = Object.entries(flat)
          .filter(([key]) => /\/story[^/]*\/_mapping:\d+\/target\|code$/.test(key))
          .map(([, value]) => value);
        expect(codes, profile).toEqual(expressions);
        const vendor = await loadEhrtslib();
        const resolved = vendor.resolveCdrProfile({ cdrProfile: profile });
        const { parseOptXml } = vendor.parser;
        const opt = parseOptXml(readFileSync(join(process.cwd(), "templates/gp-encounter.opt"), "utf8")).operationalTemplate;
        const webTemplate = vendor.serialization.buildWebTemplate(opt, resolved.webTemplate);
        const flatApi = vendor.serialization as unknown as {
          deserializeFromFlat(flat: Record<string, unknown>, webTemplate: unknown, options?: unknown): unknown;
        };
        const flatOnly = JSON.parse(vendor.serialization.serializeToFlatJson(
          vendor.serialization.toTypedRm(built.canonical), webTemplate, resolved.flat,
        )) as Record<string, unknown>;
        const back = flatApi.deserializeFromFlat(flatOnly, webTemplate, resolved.flat);
        const again = JSON.parse(vendor.serialization.serializeToFlatJson(back, webTemplate, resolved.flat));
        expect(again, profile).toEqual(flatOnly);
      }
    });

    it(`${lang}: ZipEHR html5`, async () => {
      const built = buildVisit(gpVisitState(), undefined, lang);
      const html = await canonicalToZipehrHtml5(built.canonical);
      expect(await zipehrHtml5ToCanonicalRecord(html)).toEqual(built.canonical);
    });

    it(`${lang}: the Quiet ZipEHR view does not show the expressions`, async () => {
      const built = buildVisit(gpVisitState(), undefined, lang);
      const html = await canonicalToZipehrHtml5(built.canonical);
      const base = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8");
      const quiet = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8");
      const css = await composeQuietStructureCss(base, quiet);
      const doc = await buildQuietZipehrPreviewDocument(html, css, { quietStructureTooltips: true, templateRenderLang: lang });
      const win = new Window({ url: "https://example.test/" });
      win.document.write(doc.replace(/<script>[\s\S]*?<\/script>\s*(?=<\/body>)/, ""));
      applyZipQuietDomScript(win);
      const text = win.document.body.innerText;
      expect(text).toContain(lang === "sv" ? "Smärta i höger tumme." : "Pain in right thumb.");
      expect(text).not.toContain("363698007");
      expect(text).not.toContain("|Finding site|");
    });
  }
});
