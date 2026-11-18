/**
 * Screenshots for form-controls branch.
 * npm run build && npm run preview (background), then:
 * CAPTURE_COMMIT=<sha> npx vite-node scripts/capture-form-controls.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
console.log(`capture-log commit=${process.env.CAPTURE_COMMIT ?? "unknown"}`);

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
await page.locator("aside").first().screenshot({ path: join(outDir, "form-controls-notes-pain-absent.png") });
await page.locator('[data-ehr-format="canonical"]').click();
await page.waitForTimeout(200);
await page.locator("#ehr-canonical-pane").screenshot({ path: join(outDir, "form-controls-openEHR-comment.png") });
await page.locator('[data-ehr-format="fhir"]').click();
await page.waitForTimeout(200);
await page.locator("#fhir-panel").screenshot({ path: join(outDir, "form-controls-fhir-comment.png") });
await browser.close();