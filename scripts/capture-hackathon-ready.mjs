/**
 * Hackathon screenshots (no topic bar, diagnosis-driven disease forms).
 * npm run build && npm run preview, then:
 * CAPTURE_COMMIT=<sha> npx vite-node scripts/capture-hackathon-ready.mjs
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });
const commit = process.env.CAPTURE_COMMIT ?? "unknown";
writeFileSync(join(outDir, "hackathon-commit.txt"), `${commit}\n`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator(".window").screenshot({ path: join(outDir, "hackathon-top-no-topic-bar.png") });

await page.locator("#load-gp").click();
await page.waitForTimeout(400);
await page.locator('[data-group="diagnosis"][data-item="ThumbFracture"][data-value="possible"]').click();
await page.waitForTimeout(400);
await page.locator(".form-grid").screenshot({ path: join(outDir, "hackathon-fracture-possible-form.png") });
await page.locator(".layout > aside").screenshot({ path: join(outDir, "hackathon-notes-en-sv-gp.png") });

await page.locator('[data-group="diagnosis"][data-item="ThumbFracture"][data-value="excluded"]').click();
await page.waitForTimeout(300);
await page.locator(".form-grid").screenshot({ path: join(outDir, "hackathon-fracture-excluded-hidden.png") });

await page.locator('[data-group="diagnosis"][data-item="ThumbFracture"][data-value="possible"]').click();
await page.locator("#ui-sv-labels").check();
await page.waitForTimeout(400);
await page.locator("#disease-details").screenshot({ path: join(outDir, "hackathon-fracture-form-sv.png") });

await browser.close();
console.log(`hackathon capture commit=${commit}`);