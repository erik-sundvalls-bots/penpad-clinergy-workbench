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
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
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

await shot("zipehr-quiet-tooltip-hover.png", async () => {
  await page.getByRole("tab", { name: "ZipEHR" }).click();
  await page.locator("#zipehr-css-select").selectOption("zipehr-html5-short-quiet.css");
  await page.waitForTimeout(1200);
  const frame = page.frameLocator("#zipehr-document");
  const quiet = frame.locator("o-hi.zipehr-struct-quiet[title]").first();
  await quiet.waitFor({ timeout: 15_000 });
  await quiet.hover();
  await page.waitForTimeout(400);
});

await browser.close();