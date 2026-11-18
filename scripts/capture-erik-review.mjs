/**
 * Full screenshot set for Erik UI review (single preview session).
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

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const commit = process.env.CAPTURE_COMMIT ?? "unknown";
console.log(`capture-log commit=${commit}`);

const css = composeQuietStructureCss(
  readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8"),
  readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8"),
);

const state = gpVisitState();
const findings = findingsFromState(state, painForm.diagnoses);
const browser = await chromium.launch();

async function quietDoc(lang) {
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

const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-gp").click();
await page.locator('[data-group="pain"][data-feature="AbsolutePainDescriptor"][data-value="throbbingPain"]').click();
await page.waitForTimeout(600);

await page.locator("aside").screenshot({ path: join(outDir, "sidebar-reordered.png") });
const en = await page.locator("#summary-en").innerText();
const sv = await page.locator("#summary-sv").innerText();
await page.setContent(
  `<!DOCTYPE html><html><head><meta charset=utf-8><style>
body{font-family:system-ui,sans-serif;max-width:42rem;margin:1.5rem;line-height:1.45}
h2{margin:1rem 0 .25rem;font-size:1rem}
pre{white-space:pre-wrap;margin:0 0 1rem;padding:.75rem;border:1px solid #ccc;border-radius:6px}
</style></head><body>
<h2>English</h2><pre id=en></pre>
<h2>Svenska</h2><pre id=sv lang=sv></pre>
<script>document.getElementById("en").textContent=${JSON.stringify(en)};
document.getElementById("sv").textContent=${JSON.stringify(sv)};</script></body></html>`,
  { waitUntil: "load" },
);
await page.screenshot({ path: join(outDir, "gp-character-en-sv-notes.png"), fullPage: true });

await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-gp").click();
await page.waitForTimeout(800);
await page.locator("#openehr-panel").screenshot({ path: join(outDir, "zipehr-defaults-panel.png") });
await page.locator("#zipehr-document").screenshot({ path: join(outDir, "zipehr-quiet-encounter-header.png") });
const frameText = await page.frameLocator("#zipehr-document").locator("body").innerText();
writeFileSync(join(outDir, "zipehr-quiet-encounter-header.txt"), frameText);

const quietCtx = await browser.newContext({ viewport: { width: 980, height: 1400 } });
for (const lang of ["en", "sv"]) {
  const doc = await quietDoc(lang);
  const docPage = await quietCtx.newPage();
  await docPage.setContent(doc, { waitUntil: "load" });
  await docPage.waitForTimeout(400);
  await docPage.screenshot({ path: join(outDir, `zipehr-quiet-gp-${lang}.png`), fullPage: true });
  await docPage.close();
}

await browser.close();
console.log("captures complete");