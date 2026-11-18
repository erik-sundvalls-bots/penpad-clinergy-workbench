/**
 * Quiet ZipEHR screenshots: frequency, palpation, ROM/pain (EN + SV).
 * npm run build && npm run preview, then: npx vite-node scripts/capture-reusable-clusters.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

async function capture(lang, file) {
  const page = await browser.newPage({ viewport: { width: 1480, height: 900 } });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("#load-gp").click();
  if (lang === "sv") {
    await page.locator("#ui-sv-labels").check();
    await page.waitForTimeout(200);
  }
  await page.locator("#pain-more").click();
  await page.waitForTimeout(150);
  await page.locator('[data-group="pain"][data-feature="AbsoluteFrequency"][data-value="occasional"]').click();
  await page.locator("#open-swelling").click();
  await page.locator("#swelling-dialog").waitFor({ state: "visible" });
  await page.locator('[data-group="swelling"][data-feature="AbsoluteConsistency"][data-value="firm"]').click();
  await page.locator('[data-group="swelling"][data-feature="AbsoluteTexture"][data-value="smooth"]').click();
  await page.locator("#swelling-accept").click();
  await page.locator("#ehr-badge").waitFor({ state: "visible" });
  await page.waitForFunction(
    () => (document.querySelector("#ehr-badge")?.textContent ?? "").startsWith("ehrtslib:"),
    { timeout: 30_000 },
  );
  const frame = page.frameLocator("#zipehr-document");
  await frame.locator("body").waitFor({ state: "visible" });
  await page.waitForTimeout(400);
  const iframeEl = page.locator("#zipehr-document");
  const scrollHeight = await iframeEl.evaluate((iframe) => {
    const doc = iframe.contentDocument;
    const h = Math.max(doc?.body?.scrollHeight ?? 0, doc?.documentElement?.scrollHeight ?? 0);
    iframe.style.height = `${h}px`;
    iframe.style.maxHeight = "none";
    return h;
  });
  const height = Math.min(Math.max(scrollHeight + 120, 900), 3600);
  await page.setViewportSize({ width: 1480, height });
  await page.waitForTimeout(200);
  await frame.locator("body").screenshot({ path: `${outDir}/${file}` });
  await page.close();
}

await capture("en", "reusable-clusters-zipehr-en.png");
await capture("sv", "reusable-clusters-zipehr-sv.png");
await browser.close();
console.log(`saved ${outDir}/reusable-clusters-zipehr-*.png`);