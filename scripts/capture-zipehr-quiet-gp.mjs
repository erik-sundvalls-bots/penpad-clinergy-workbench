/**
 * GP visit ZipEHR quiet EN/SV document screenshots (vite-node).
 * npx vite-node scripts/capture-zipehr-quiet-gp.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gpVisitState, findingsFromState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { painForm } from "../src/knowledge.ts";
import { historyNarrativeText } from "../src/summary.ts";
import {
  buildQuietZipehrPreviewDocument,
  canonicalToZipehrHtml5,
  composeQuietStructureCss,
} from "../src/openehr/zipehr.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const commit = process.env.CAPTURE_COMMIT ?? "unknown";
console.log(`capture-log commit=${commit}`);

const cssBase = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8");
const cssQuiet = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8");
const css = composeQuietStructureCss(cssBase, cssQuiet);

const state = gpVisitState();
const findings = findingsFromState(state, painForm.diagnoses);
const enNarrative = historyNarrativeText(findings, "en");
const svNarrative = historyNarrativeText(
  findings.filter((f) => f.topic === "ThumbPainSymptom" || f.topic === "ThumbSwellingSymptom"),
  "sv",
);

async function previewHtml(lang) {
  const narrative = lang === "sv" ? svNarrative : enNarrative;
  const built = buildVisit(state, narrative, lang);
  const markup = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: lang });
  return buildQuietZipehrPreviewDocument(markup, css, {
    quietStructureTooltips: true,
    templateRenderLang: lang,
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 980, height: 1400 } });

for (const lang of ["en", "sv"]) {
  const doc = await previewHtml(lang);
  const htmlPath = join(outDir, `zipehr-quiet-gp-${lang}.html`);
  writeFileSync(htmlPath, doc);
  const page = await context.newPage();
  await page.setContent(doc, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const shot = join(outDir, `zipehr-quiet-gp-${lang}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  console.log(shot);
  await page.close();
}

await browser.close();