/**
 * Screenshots for form-controls branch.
 * npm run build && npm run preview (background), then:
 * CAPTURE_COMMIT=<sha> npx vite-node scripts/capture-form-controls.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const commit = process.env.CAPTURE_COMMIT ?? "unknown";
console.log(`capture-log commit=${commit}`);
writeFileSync(join(outDir, "form-controls-commit.txt"), `${commit}\n`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-gp").click();
await page.waitForTimeout(400);
await page.locator('[data-group="pain"][data-feature="summary"][data-value="absence"]').click();
await page.locator("#pain-more").click();
await page.locator('[data-group="pain"][data-feature="AbsoluteOnset"][data-value="gradual"]').click();
await page.locator("#comment").fill("Prefers morning appointments.");
await page.waitForTimeout(500);
await page.screenshot({ path: join(outDir, "form-controls-filled-more.png"), fullPage: true });

await page.locator("#pain-more").screenshot({ path: join(outDir, "form-controls-more-dark.png") });

await page.locator("#ehr-format").selectOption("canonical");
await page.locator('[data-ehr-format="canonical"]').click();
await page.waitForTimeout(300);
await page.evaluate(() => {
  const pane = document.querySelector("#ehr-canonical-pane");
  const text = pane?.textContent ?? "";
  const idx = text.indexOf("at0007");
  if (pane && idx >= 0) pane.scrollTop = Math.max(0, idx / 4);
});
await page.waitForTimeout(200);
await page.locator("#ehr-canonical-pane").screenshot({ path: join(outDir, "form-controls-openEHR-comment.png") });

const canonicalText = await page.locator("#ehr-canonical-pane").innerText();
const at7 = canonicalText.match(/[\s\S]{0,220}at0007[\s\S]{0,220}/);
if (at7) writeFileSync(join(outDir, "form-controls-openEHR-comment-snippet.txt"), at7[0]);

await page.locator("aside").first().screenshot({ path: join(outDir, "form-controls-notes-pain-absent.png") });

await page.locator("#fhir-format").selectOption("json");
await page.waitForTimeout(300);
const fhirText = await page.locator("#fhir").innerText();
const noteHit = fhirText.match(/"note"[\s\S]{0,400}Prefers morning appointments[\s\S]{0,200}/);
const qrHit = fhirText.match(/"comment"[\s\S]{0,400}Prefers morning appointments[\s\S]{0,200}/);
const snippet = [noteHit?.[0], qrHit?.[0]].filter(Boolean).join("\n---\n");
if (snippet) writeFileSync(join(outDir, "form-controls-fhir-comment-snippet.txt"), snippet);
await page.locator("#fhir-panel").screenshot({ path: join(outDir, "form-controls-fhir-comment.png") });

await page.locator('[data-group="pain"][data-feature="AbsoluteOnset"][data-value="gradual"]').click();
await page.waitForTimeout(200);
await page.locator("#pain-more").screenshot({ path: join(outDir, "form-controls-more-cleared.png") });

await browser.close();