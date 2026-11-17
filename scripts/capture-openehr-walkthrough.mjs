/**
 * Full openEHR panel screenshots for walkthrough artifacts.
 * Usage: npm run preview (4173) then npx playwright@1.49.0 install chromium && node scripts/capture-openehr-walkthrough.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const baseUrl = "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const desktop = await browser.newContext({ viewport: { width: 1480, height: 1100 } });
const page = await desktop.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-demo").click();
await page.waitForTimeout(800);

const panel = page.locator("#openehr-panel");
await panel.scrollIntoViewIfNeeded();

async function waitPane(id) {
  await page.locator(`#${id}:not([hidden])`).waitFor({ timeout: 15_000 });
}

async function shot(name, prep) {
  await prep();
  await page.waitForTimeout(500);
  const path = `${outDir}/${name}`;
  await panel.screenshot({ path });
  console.log(path);
}

await shot("ehr-canonical-xml-tab.png", async () => {
  await page.getByRole("tab", { name: "Canonical XML" }).click();
  await waitPane("ehr-xml-pane");
  await page.locator("#ehr-xml").evaluate((el) => el.textContent?.includes("<?xml"));
  await page.waitForFunction(() => {
    const el = document.querySelector("#ehr-xml");
    return el && (el.textContent?.length ?? 0) > 200;
  });
});

await shot("ehr-simplified-tab-controls.png", async () => {
  await page.getByRole("tab", { name: "Simplified" }).click();
  await waitPane("ehr-simplified-pane");
  await page.waitForFunction(() => {
    const el = document.querySelector("#ehr-simplified");
    return el && (el.textContent?.length ?? 0) > 80;
  });
  await page.locator("[data-simplified-flavour='structured']").click();
});

await shot("ehr-simplified-flat-tab.png", async () => {
  await page.getByRole("tab", { name: "Simplified" }).click();
  await waitPane("ehr-simplified-pane");
  await page.locator("[data-simplified-flavour='flat']").click();
  await page.waitForFunction(() => {
    const el = document.querySelector("#ehr-simplified");
    return el && el.textContent?.includes("/");
  });
});

await shot("zipehr-default-document-view.png", async () => {
  await page.getByRole("tab", { name: "ZipEHR" }).click();
  await page.locator("#zipehr-css-select").selectOption("default");
  await page.locator("[data-zipehr-view='document']").click();
  const frame = page.frameLocator("#zipehr-document");
  await frame.locator("o-co").waitFor({ timeout: 15_000 });
  await frame.locator("o-e").filter({ hasText: "Pain" }).first().waitFor({ timeout: 15_000 });
});

await shot("zipehr-quiet-document-view.png", async () => {
  await page.getByRole("tab", { name: "ZipEHR" }).click();
  await page.locator("#zipehr-css-select").selectOption("zipehr-html5-short-quiet.css");
  await page.waitForTimeout(1200);
  const frame = page.frameLocator("#zipehr-document");
  await frame.locator("o-co").waitFor({ timeout: 15_000 });
  await frame.locator("o-e").filter({ hasText: "Pain" }).first().waitFor({ timeout: 15_000 });
});

await page.getByRole("tab", { name: "ZipEHR" }).click();
await page.locator("#zipehr-css-select").selectOption("zipehr-html5-short-quiet.css");
await page.waitForTimeout(1200);
const deskFrame = page.frameLocator("#zipehr-document");
const quiet = deskFrame.locator("o-se.zipehr-struct-quiet[title]").first();
await quiet.waitFor({ timeout: 15_000 });
await quiet.evaluate((el) => {
  el.classList.add("zipehr-tip-pinned");
  el.scrollIntoView({ block: "center" });
});
await page.waitForTimeout(400);
await page.locator("#zipehr-document").screenshot({
  path: `${outDir}/zipehr-quiet-tooltip-hover.png`,
});
console.log(`${outDir}/zipehr-quiet-tooltip-hover.png`);

// Mobile tap tooltip (separate viewport)
const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
const mobile = await touch.newPage();
await mobile.goto(baseUrl, { waitUntil: "networkidle" });
await mobile.locator("#load-demo").click();
await mobile.waitForTimeout(800);
await mobile.getByRole("tab", { name: "ZipEHR" }).click();
await mobile.locator("#zipehr-css-select").selectOption("zipehr-html5-short-quiet.css");
await mobile.waitForTimeout(1200);
const mobPanel = mobile.locator("#openehr-panel");
await mobPanel.scrollIntoViewIfNeeded();
const mobFrame = mobile.frameLocator("#zipehr-document");
const tapTarget = mobFrame.locator("o-se.zipehr-struct-quiet[title]").first();
await tapTarget.waitFor({ timeout: 15_000 });
await tapTarget.tap();
await tapTarget.evaluate((el) => el.classList.add("zipehr-tip-pinned"));
await mobile.waitForTimeout(400);
await mobile.locator("#zipehr-document").screenshot({
  path: `${outDir}/zipehr-quiet-tooltip-mobile-tap.png`,
});
console.log(`${outDir}/zipehr-quiet-tooltip-mobile-tap.png`);
await mobile.close();
await browser.close();