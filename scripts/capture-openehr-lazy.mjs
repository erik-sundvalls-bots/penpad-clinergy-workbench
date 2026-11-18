/**
 * Screenshot openEHR panel after ehrtslib lazy load (Playwright + preview).
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-gp").click();
await page.locator("#ehr-badge").waitFor({ state: "visible" });
await page.waitForFunction(
  () => {
    const t = document.querySelector("#ehr-badge")?.textContent ?? "";
    return t.startsWith("ehrtslib:");
  },
  { timeout: 30_000 },
);
const panel = page.locator('aside section.panel').filter({ has: page.locator("#ehr-badge") });
await panel.screenshot({ path: `${outDir}/hackathon-openehr-lazy-loaded.png` });
await browser.close();
console.log(`saved ${outDir}/hackathon-openehr-lazy-loaded.png`);