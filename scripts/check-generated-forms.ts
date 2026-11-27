/**
 * Validate the committed remake catalogues (forms, exams, sentences).
 *
 * If PENPAD_EXTRACT_DIR points at an extractor output tree, regenerate and
 * require byte-identical JSON. Otherwise only check that the committed
 * catalogues are present and valid.
 *
 *   npm run check:forms-catalog
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog, type RemakeForm } from "../remake/src/form/generate.ts";
import { GENERATED_EXAMS_SCHEMA, type GeneratedExamsCatalog } from "../remake/src/form/exams.ts";
import { GENERATED_SENTENCES_SCHEMA, type GeneratedSentenceKnowledge } from "../remake/src/sentence/generate.ts";

const FORMS = resolve("public/remake/generated/forms.json");
const EXAMS = resolve("public/remake/generated/exams.json");
const SENTENCES = resolve("public/remake/generated/sentences.json");
const CLINERGY = /clinergy/i;
const FORBIDDEN = /readCode|read_code|Read2|\bCTV3\b|extractedAt|generatedAt/i;

function fail(msg: string): never {
  console.error(`check:forms-catalog: ${msg}`);
  process.exit(1);
}

function assertClean(bytes: string, label: string): void {
  if (FORBIDDEN.test(bytes) || CLINERGY.test(bytes)) {
    fail(`${label} contains a forbidden token (Read code, timestamp, or program name)`);
  }
}

function validateForms(bytes: string, label: string): GeneratedCatalog {
  let data: GeneratedCatalog;
  try {
    data = JSON.parse(bytes) as GeneratedCatalog;
  } catch (err) {
    fail(`${label} is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }
  if (data.schema !== GENERATED_FORMS_SCHEMA) fail(`${label} has schema ${JSON.stringify(data.schema)}`);
  if (!data.forms || typeof data.forms !== "object") fail(`${label} has no forms object`);
  const topics = Object.keys(data.forms);
  if (topics.length < 1) fail(`${label} contains no forms`);
  for (const topic of topics) {
    const form = data.forms[topic] as RemakeForm;
    if (!form || form.topic !== topic) fail(`${label} form key ${topic} does not match topic field`);
    if (typeof form.display !== "string") fail(`${label} ${topic} has no display string`);
    if (CLINERGY.test(form.display) || CLINERGY.test(form.topic)) {
      fail(`${label} ${topic} display/topic contains a forbidden UI name`);
    }
  }
  assertClean(bytes, label);
  return data;
}

function validateExams(bytes: string, label: string): GeneratedExamsCatalog {
  let data: GeneratedExamsCatalog;
  try {
    data = JSON.parse(bytes) as GeneratedExamsCatalog;
  } catch (err) {
    fail(`${label} is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }
  if (data.schema !== GENERATED_EXAMS_SCHEMA) fail(`${label} has schema ${JSON.stringify(data.schema)}`);
  if (!data.exams || typeof data.exams !== "object") fail(`${label} has no exams object`);
  if (!data.signs || typeof data.signs !== "object") fail(`${label} has no signs object`);
  for (const name of Object.keys(data.exams)) {
    const exam = data.exams[name];
    if (!exam || exam.name !== name) fail(`${label} exam key ${name} does not match name field`);
    if (typeof exam.display !== "string") fail(`${label} ${name} has no display string`);
  }
  assertClean(bytes, label);
  return data;
}

function validateSentences(bytes: string, label: string): GeneratedSentenceKnowledge {
  let data: GeneratedSentenceKnowledge;
  try {
    data = JSON.parse(bytes) as GeneratedSentenceKnowledge;
  } catch (err) {
    fail(`${label} is not valid JSON: ${err instanceof Error ? err.message : err}`);
  }
  if (data.schema !== GENERATED_SENTENCES_SCHEMA) fail(`${label} has schema ${JSON.stringify(data.schema)}`);
  if (!data.rules || !data.concepts) fail(`${label} is missing rules or concepts`);
  assertClean(bytes, label);
  return data;
}

function main(): void {
  if (!existsSync(FORMS)) fail(`missing committed catalogue at ${FORMS}`);
  if (!existsSync(EXAMS)) fail(`missing committed catalogue at ${EXAMS}`);
  if (!existsSync(SENTENCES)) fail(`missing committed catalogue at ${SENTENCES}`);
  const formsBytes = readFileSync(FORMS, "utf8");
  const examsBytes = readFileSync(EXAMS, "utf8");
  const sentencesBytes = readFileSync(SENTENCES, "utf8");
  const forms = validateForms(formsBytes, FORMS);
  const exams = validateExams(examsBytes, EXAMS);
  const sentences = validateSentences(sentencesBytes, SENTENCES);
  console.log(`ok: ${FORMS} schema=${forms.schema} forms=${Object.keys(forms.forms).length} bytes=${formsBytes.length}`);
  console.log(`ok: ${EXAMS} schema=${exams.schema} exams=${Object.keys(exams.exams).length} signs=${Object.keys(exams.signs).length} bytes=${examsBytes.length}`);
  console.log(`ok: ${SENTENCES} schema=${sentences.schema} concepts=${Object.keys(sentences.concepts).length} bytes=${sentencesBytes.length}`);

  const extract = process.env.PENPAD_EXTRACT_DIR;
  if (!extract) {
    console.log("ok: no PENPAD_EXTRACT_DIR; skipped regenerate-and-diff");
    return;
  }
  if (!existsSync(extract)) fail(`PENPAD_EXTRACT_DIR does not exist: ${extract}`);
  const out = mkdtempSync(join(tmpdir(), "remake-forms-"));
  try {
    const run = spawnSync(
      "npx",
      ["vite-node", "scripts/generate-remake-forms.ts", "--in", extract, "--out", out],
      { encoding: "utf8", stdio: "inherit" },
    );
    if (run.status !== 0) fail(`generator exited ${run.status}`);
    for (const file of ["forms.json", "exams.json", "sentences.json"] as const) {
      const regenerated = readFileSync(join(out, file), "utf8");
      const committed = file === "forms.json" ? formsBytes : file === "exams.json" ? examsBytes : sentencesBytes;
      if (file === "forms.json") validateForms(regenerated, `regenerated ${file}`);
      else if (file === "exams.json") validateExams(regenerated, `regenerated ${file}`);
      else validateSentences(regenerated, `regenerated ${file}`);
      if (regenerated !== committed) {
        fail(`regenerating produced a diff in ${file}; commit the regenerated public/remake/generated/${file}`);
      }
    }
    console.log("ok: regenerating from PENPAD_EXTRACT_DIR produced no diff");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

main();
