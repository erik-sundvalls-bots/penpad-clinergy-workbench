/**
 * Quiet ZipEHR: problem_qualifier progression/healing (EN + SV).
 * npx vite-node scripts/capture-problem-qualifier.mjs
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { emptyFinding, emptyState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import {
  buildQuietZipehrPreviewDocument,
  canonicalToZipehrHtml5,
  composeQuietStructureCss,
} from "../src/openehr/zipehr.ts";

const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const css = await composeQuietStructureCss(
  readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8"),
  readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8"),
);

function sprainState(progress) {
  const state = emptyState();
  state.diagnoses.ThumbSprain = "presence";
  const answer = emptyFinding();
  answer.laterality = ["right"];
  answer.choices.AbsoluteSeverity = "moderate";
  answer.choices.AbsoluteProgress = progress;
  state.formAnswers.ThumbSprain = answer;
  return state;
}

async function preview(lang, state, narrative) {
  const built = buildVisit(state, narrative, lang);
  const markup = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: lang });
  return buildQuietZipehrPreviewDocument(markup, css, {
    quietStructureTooltips: true,
    templateRenderLang: lang,
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1480, height: 900 } });
const md5s = {};

for (const [lang, narrative, needles] of [
  ["en", "Sprain", ["Worsening", "Sprain of right thumb"]],
  ["sv", "Stukning", ["Försämras", "Stukning av höger tumme"]],
]) {
  const doc = await preview(lang, sprainState("worse"), narrative);
  const page = await context.newPage();
  await page.setContent(doc, { waitUntil: "load" });
  const bodyText = await page.locator("body").innerText();
  for (const needle of needles) {
    if (!bodyText.includes(needle)) throw new Error(`${lang} missing “${needle}”`);
  }
  const scrollHeight = await page.locator("body").evaluate((n) => n.scrollHeight);
  await page.setViewportSize({ width: 1480, height: Math.min(scrollHeight + 80, 3600) });
  const path = join(outDir, `problem-qualifier-zipehr-${lang}.png`);
  await page.locator("body").screenshot({ path });
  md5s[lang] = createHash("md5").update(readFileSync(path)).digest("hex");
  await page.close();
}

await browser.close();
if (md5s.en === md5s.sv) throw new Error("EN and SV screenshots are identical");
console.log(`saved problem-qualifier-zipehr-{en,sv}.png md5 en=${md5s.en} sv=${md5s.sv}`);