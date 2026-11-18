/**
 * Quiet ZipEHR screenshots: frequency, palpation, ROM/pain (EN + SV).
 * Builds Swedish and English compositions with templateRenderLang (not the form-label toggle).
 * npx vite-node scripts/capture-reusable-clusters.mjs
 */
import { chromium } from "playwright";
import { createHash } from "node:crypto";
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

const css = await composeQuietStructureCss(
  readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8"),
  readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8"),
);

const state = gpVisitState();
state.pain.choices.AbsoluteFrequency = "occasional";
state.swelling.choices.AbsoluteConsistency = "firm";
state.swelling.choices.AbsoluteTexture = "smooth";
const findings = findingsFromState(state, painForm.diagnoses);

async function quietPreviewDocument(lang) {
  const narrative =
    lang === "sv"
      ? historyNarrativeText(
          findings.filter((f) => f.topic === "ThumbPainSymptom" || f.topic === "ThumbSwellingSymptom"),
          "sv",
        )
      : historyNarrativeText(findings, "en");
  const built = buildVisit(state, narrative, lang);
  const markup = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: lang });
  return buildQuietZipehrPreviewDocument(markup, css, {
    quietStructureTooltips: true,
    templateRenderLang: lang,
  });
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1480, height: 900 } });

const checks = {
  en: ["Occasional", "Firm", "Smooth", "Mild pain"],
  sv: ["Ibland", "Fast", "Slät", "Lätt smärta"],
};

const md5s = {};

for (const lang of ["en", "sv"]) {
  const doc = await quietPreviewDocument(lang);
  const htmlPath = join(outDir, `reusable-clusters-zipehr-${lang}.html`);
  writeFileSync(htmlPath, doc);
  const page = await context.newPage();
  await page.setContent(doc, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const bodyText = await page.locator("body").innerText();
  for (const needle of checks[lang]) {
    if (!bodyText.includes(needle)) {
      throw new Error(`${lang} quiet ZipEHR missing “${needle}”`);
    }
  }
  const png = join(outDir, `reusable-clusters-zipehr-${lang}.png`);
  const el = page.locator("body");
  const scrollHeight = await el.evaluate((node) => Math.max(node.scrollHeight, node.offsetHeight));
  await page.setViewportSize({ width: 1480, height: Math.min(scrollHeight + 80, 3600) });
  await page.waitForTimeout(150);
  await el.screenshot({ path: png });
  md5s[lang] = createHash("md5").update(readFileSync(png)).digest("hex");
  await page.close();
}

await browser.close();

if (md5s.en === md5s.sv) {
  throw new Error(`EN and SV screenshots are byte-identical (md5 ${md5s.en})`);
}
writeFileSync(
  join(outDir, "reusable-clusters-zipehr-capture.json"),
  JSON.stringify({ md5: md5s, checks }, null, 2),
);
console.log(`saved ${outDir}/reusable-clusters-zipehr-{en,sv}.png (md5 en=${md5s.en} sv=${md5s.sv})`);