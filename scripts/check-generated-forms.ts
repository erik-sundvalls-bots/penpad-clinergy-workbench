/**
 * Validate the committed remake form catalogue.
 *
 * If PENPAD_EXTRACT_DIR points at an extractor output tree, regenerate and
 * require a byte-identical forms.json. Otherwise only check that the
 * committed catalogue is present and valid.
 *
 *   npm run check:forms-catalog
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog, type RemakeForm } from "../remake/src/form/generate.ts";

const CATALOG = resolve("public/remake/generated/forms.json");
const CLINERGY = /clinergy/i;
const FORBIDDEN = /readCode|read_code|Read2|\bCTV3\b|extractedAt|generatedAt/i;

function fail(msg: string): never {
  console.error(`check:forms-catalog: ${msg}`);
  process.exit(1);
}

function validateCatalog(bytes: string, label: string): GeneratedCatalog {
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
  if (FORBIDDEN.test(bytes) || CLINERGY.test(bytes)) {
    fail(`${label} contains a forbidden token (Read code, timestamp, or program name)`);
  }
  return data;
}

function main(): void {
  if (!existsSync(CATALOG)) fail(`missing committed catalogue at ${CATALOG}`);
  const committed = readFileSync(CATALOG, "utf8");
  const catalog = validateCatalog(committed, CATALOG);
  console.log(`ok: ${CATALOG} schema=${catalog.schema} forms=${Object.keys(catalog.forms).length} bytes=${committed.length}`);

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
    const regenerated = readFileSync(join(out, "forms.json"), "utf8");
    validateCatalog(regenerated, "regenerated forms.json");
    if (regenerated !== committed) {
      fail("regenerating the catalogue produced a diff; commit the regenerated public/remake/generated/forms.json");
    }
    console.log("ok: regenerating from PENPAD_EXTRACT_DIR produced no diff");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

main();
