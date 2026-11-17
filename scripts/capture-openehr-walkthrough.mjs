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
const hoverAnchor = deskFrame
  .locator('button.zipehr-structure-anchor[aria-label="Structure: History"]')
  .first();
await hoverAnchor.waitFor({ timeout: 15_000 });
await hoverAnchor.scrollIntoViewIfNeeded();
const box = await hoverAnchor.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}
await page.waitForFunction(
  () => {
    const tip = document
      .querySelector("#zipehr-document")
      ?.contentDocument?.querySelector(
        'button.zipehr-structure-anchor[aria-label="Structure: History"] .zipehr-structure-tip',
      );
    if (!tip) return false;
    const st = tip.ownerDocument.defaultView?.getComputedStyle(tip);
    return st?.display === "block" && tip.getBoundingClientRect().height > 0;
  },
  { timeout: 10_000 },
);
await page.waitForTimeout(200);
const hoverClip = await hoverAnchor.evaluate((anchor) => {
  const tip = anchor.querySelector(".zipehr-structure-tip");
  const rects = [anchor.getBoundingClientRect(), tip?.getBoundingClientRect()].filter(Boolean);
  const left = Math.min(...rects.map((r) => r.left)) - 12;
  const top = Math.min(...rects.map((r) => r.top)) - 12;
  const right = Math.max(...rects.map((r) => r.right)) + 12;
  const bottom = Math.max(...rects.map((r) => r.bottom)) + 12;
  return { x: left, y: top, width: right - left, height: bottom - top };
});
const iframeBox = await page.locator("#zipehr-document").boundingBox();
if (iframeBox) {
  await page.screenshot({
    path: `${outDir}/zipehr-quiet-tooltip-hover.png`,
    animations: "disabled",
    clip: {
      x: iframeBox.x + hoverClip.x,
      y: iframeBox.y + hoverClip.y,
      width: hoverClip.width,
      height: hoverClip.height,
    },
  });
}
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
const tapAnchor = mobFrame
  .locator('button.zipehr-structure-anchor[aria-label="Structure: History"]')
  .first();
await tapAnchor.waitFor({ timeout: 15_000 });
await tapAnchor.scrollIntoViewIfNeeded();
await tapAnchor.tap();
await mobile.waitForFunction(
  () => {
    const tip = document
      .querySelector("#zipehr-document")
      ?.contentDocument?.querySelector(
        'button.zipehr-structure-anchor.zipehr-tip-pinned .zipehr-structure-tip',
      );
    if (!tip) return false;
    const st = tip.ownerDocument.defaultView?.getComputedStyle(tip);
    return st?.display === "block" && tip.getBoundingClientRect().height > 0;
  },
  { timeout: 10_000 },
);
await mobile.waitForTimeout(200);
const tapClip = await tapAnchor.evaluate((anchor) => {
  const tip = anchor.querySelector(".zipehr-structure-tip");
  const rects = [anchor.getBoundingClientRect(), tip?.getBoundingClientRect()].filter(Boolean);
  const left = Math.min(...rects.map((r) => r.left)) - 12;
  const top = Math.min(...rects.map((r) => r.top)) - 12;
  const right = Math.max(...rects.map((r) => r.right)) + 12;
  const bottom = Math.max(...rects.map((r) => r.bottom)) + 12;
  return { x: left, y: top, width: right - left, height: bottom - top };
});
const mobIframeBox = await mobile.locator("#zipehr-document").boundingBox();
if (mobIframeBox) {
  await mobile.screenshot({
    path: `${outDir}/zipehr-quiet-tooltip-mobile-tap.png`,
    animations: "disabled",
    clip: {
      x: mobIframeBox.x + tapClip.x,
      y: mobIframeBox.y + tapClip.y,
      width: tapClip.width,
      height: tapClip.height,
    },
  });
}
console.log(`${outDir}/zipehr-quiet-tooltip-mobile-tap.png`);
await mobile.close();
await browser.close();