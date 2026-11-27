import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setGeneratedForms } from "../remake/src/knowledge-data.ts";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog } from "../remake/src/form/generate.ts";

/** Load the committed remake catalogue so formOf() works in unit tests. */
const catalogPath = resolve(dirname(fileURLToPath(import.meta.url)), "../public/remake/generated/forms.json");
if (existsSync(catalogPath)) {
  const catalog = JSON.parse(readFileSync(catalogPath, "utf8")) as GeneratedCatalog;
  if (catalog.schema !== GENERATED_FORMS_SCHEMA || !catalog.forms) {
    throw new Error(`invalid generated catalogue at ${catalogPath}`);
  }
  setGeneratedForms(catalog.forms);
}
