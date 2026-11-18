import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const basePath = "/penpad-clinergy-workbench/";
const baseUrl = `http://127.0.0.1:4173${basePath}`;
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const commit = process.env.CAPTURE_COMMIT ?? "unknown";
console.log(`capture-log commit=${commit}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-gp").click();
await page.waitForTimeout(800);

await page.locator("#openehr-panel").screenshot({
  path: join(outDir, "zipehr-defaults-panel.png"),
});

const frame = page.frameLocator("#zipehr-document");
await frame.locator("body").waitFor({ state: "attached", timeout: 15_000 });
await page.locator("#zipehr-document").screenshot({
  path: join(outDir, "zipehr-quiet-encounter-header.png"),
});

await browser.close();