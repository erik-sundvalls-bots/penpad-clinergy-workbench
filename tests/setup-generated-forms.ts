import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyGeneratedSentenceKnowledge, setGeneratedExams, setGeneratedForms } from "../remake/src/knowledge-data.ts";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog } from "../remake/src/form/generate.ts";
import { GENERATED_EXAMS_SCHEMA, type GeneratedExamsCatalog } from "../remake/src/form/exams.ts";
import { GENERATED_SENTENCES_SCHEMA, type GeneratedSentenceKnowledge } from "../remake/src/sentence/generate.ts";

const root = dirname(fileURLToPath(import.meta.url));

/** Load the committed remake catalogues so formOf() / examOf() work in unit tests. */
const catalogPath = resolve(root, "../public/remake/generated/forms.json");
if (existsSync(catalogPath)) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as GeneratedCatalog;
  if (catalog.schema !== GENERATED_FORMS_SCHEMA || !catalog.forms) {
    throw new Error(`invalid generated catalogue at ${catalogPath}`);
  }
  setGeneratedForms(catalog.forms);
}

const examsPath = resolve(root, "../public/remake/generated/exams.json");
if (existsSync(examsPath)) {
  const catalog = JSON.parse(readFileSync(examsPath, "utf8")) as GeneratedExamsCatalog;
  if (catalog.schema !== GENERATED_EXAMS_SCHEMA || !catalog.exams) {
    throw new Error(`invalid generated exam catalogue at ${examsPath}`);
  }
  setGeneratedExams(catalog);
}

const sentencesPath = resolve(root, "../public/remake/generated/sentences.json");
if (existsSync(sentencesPath)) {
  const catalog = JSON.parse(readFileSync(sentencesPath, "utf8")) as GeneratedSentenceKnowledge;
  if (catalog.schema !== GENERATED_SENTENCES_SCHEMA || !catalog.rules) {
    throw new Error(`invalid generated sentence knowledge at ${sentencesPath}`);
  }
  applyGeneratedSentenceKnowledge(catalog);
}
