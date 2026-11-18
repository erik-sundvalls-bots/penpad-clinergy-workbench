import { spawn, type ChildProcess } from "node:child_process";
import { execSync } from "node:child_process";
import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { chromium, type Browser } from "playwright";

const basePath = "/penpad-clinergy-workbench/";
const previewHost = "127.0.0.1";
const previewPort = 4173;
const baseUrl = `http://${previewHost}:${previewPort}${basePath}`;

let preview: ChildProcess | undefined;
let browser: Browser;

async function waitForPreview(timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(baseUrl);
      if (res.ok) return;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`preview not ready at ${baseUrl}`);
}

describe("workbench UI (preview)", () => {
  it("does not render the former topic bar", async () => {
    const page = await browser.newPage();
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    expect(await page.locator(".picks").count()).toBe(0);
    await page.close();
  });

  it("translates duration units in SV form-label mode", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#load-gp").click();
    await page.waitForTimeout(300);
    await page.locator("#ui-sv-labels").check();
    await page.waitForTimeout(300);
    expect(await page.locator('select[data-unit="ThumbSprain"] option[value="day"]').innerText()).toBe("dagar");
    expect(await page.locator('select[data-unit="ThumbSprain"] option[value="week"]').innerText()).toBe("veckor");
    expect(await page.locator("#diagnoses-heading").innerText()).toBe("Diagnoser");
    await page.close();
  });

  it("shows human labels on the fracture detail form", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('[data-group="diagnosis"][data-item="ThumbFracture"][data-value="possible"]').click();
    await page.waitForTimeout(300);
    const text = await page.locator("#disease-details").innerText();
    expect(text).toContain("Healing");
    expect(text).toContain("partially healed");
    expect(text).not.toMatch(/AbsoluteHealingCharacter/i);
    expect(text).not.toMatch(/partially Healed/);
    expect(await page.locator("#disease-details h2").innerText()).toBe("Thumb fracture");
    await page.close();
  });

  it("shows fracture detail when diagnosis is possible and hides it when excluded", async () => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator('[data-group="diagnosis"][data-item="ThumbFracture"][data-value="possible"]').click();
    await page.waitForTimeout(300);
    expect(await page.locator("#disease-details h2", { hasText: /fracture/i }).count()).toBe(1);
    await page.locator('[data-group="diagnosis"][data-item="ThumbFracture"][data-value="excluded"]').click();
    await page.waitForTimeout(300);
    expect(await page.locator("#disease-details h2", { hasText: /fracture/i }).count()).toBe(0);
    await page.close();
  });
  beforeAll(async () => {
    execSync("npm run build", { cwd: process.cwd(), stdio: "inherit" });
    preview = spawn("npm", ["run", "preview"], {
      cwd: process.cwd(),
      stdio: "pipe",
      env: { ...process.env },
    });
    await waitForPreview();
    browser = await chromium.launch();
  }, 120_000);

  afterAll(async () => {
    await browser?.close();
    preview?.kill("SIGTERM");
  });

  it("orders sidebar panels and reflects throbbing pain in Swedish summary", async () => {
    const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#load-gp").click();
    const titles = await page.locator("aside section.panel > h2").allTextContents();
    expect(titles).toEqual([
      "Summary",
      "Svenska (Swedish)",
      "openEHR",
      "FHIR",
      "Possible Terminology system similarities",
    ]);
    expect(titles.some((t) => /OpenGALEN/i.test(t))).toBe(false);
    expect(
      await page.locator("aside section.panel > h2").filter({ hasText: /^On Examination$/ }).count(),
    ).toBe(0);

    await page
      .locator('[data-group="pain"][data-feature="AbsolutePainDescriptor"][data-value="throbbingPain"]')
      .click();
    await page.waitForTimeout(300);
    const en = await page.locator("#summary-en").innerText();
    const sv = await page.locator("#summary-sv").innerText();
    expect(en.toLowerCase()).toContain("throbbing");
    expect(sv.toLowerCase()).toContain("bultande");
    expect(sv).toContain("Stukning av höger tumme");
    expect(sv).not.toContain("Tumstukning");
    await page.close();
  });

  it("defaults ZipEHR panel and toggles Code/Document visibility by variant", async () => {
    const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#load-gp").click();
    await page.waitForTimeout(500);

    const zipehrTab = page.locator('[data-ehr-format="zipehr"]');
    expect(await zipehrTab.getAttribute("class")).toContain("active");
    expect(await page.locator("#ehr-zipehr-pane").isVisible()).toBe(true);
    expect(await page.locator("#ehr-canonical-pane").isHidden()).toBe(true);

    const variant = page.locator("#zipehr-variant");
    expect(await variant.inputValue()).toBe("zipehr.html5.short");
    expect(await page.locator("#zipehr-css-select").inputValue()).toBe(
      "zipehr-html5-quiet-structure.css",
    );

    const options = await variant.locator("option").allTextContents();
    expect(options.length).toBe(6);
    for (const label of options) {
      expect(label).toContain("(lossless roundtrip)");
    }

    const viewTabs = page.locator("#zipehr-view-tabs");
    expect(await viewTabs.isVisible()).toBe(true);
    expect(await page.locator("#zipehr-document").isVisible()).toBe(true);
    expect(await page.locator("#zipehr-code").isHidden()).toBe(true);

    const quietFrame = page.frameLocator("#zipehr-document");
    const quietText = await quietFrame.locator("body").innerText();
    expect(quietText).toContain("21 Oct 2021 14:21");
    expect(quietText).not.toContain("2021-10-21T14:21:00+01:00");
    expect(quietText).toMatch(/Encounter event Dr J Brown/i);
    expect(quietText).not.toMatch(/Besök|primärvård|Anamnes|Symtom\/tecken/i);

    await variant.selectOption("zipehr.json");
    await page.waitForTimeout(400);
    expect(await viewTabs.isHidden()).toBe(true);
    expect(await page.locator("#zipehr-code").isVisible()).toBe(true);
    expect(await page.locator("#zipehr-document").isHidden()).toBe(true);

    await variant.selectOption("zipehr.xhtml");
    await page.waitForTimeout(400);
    expect(await viewTabs.isVisible()).toBe(true);

    await page.close();
  });

  it(
    "reflects pain absent, more-layer selection, and examination comment",
    async () => {
    const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.locator("#load-gp").click();
    await page.waitForTimeout(400);
    await page
      .locator('[data-group="pain"][data-feature="summary"][data-value="absence"]')
      .click();
    await page.waitForTimeout(300);
    const en = await page.locator("#summary-en").innerText();
    const sv = await page.locator("#summary-sv").innerText();
    expect(en).toMatch(/No pain in right thumb/i);
    expect(sv).toMatch(/Ingen smärta i höger tumme/i);

    await page.locator("#pain-more").click();
    await page
      .locator('[data-group="pain"][data-feature="AbsoluteOnset"][data-value="gradual"]')
      .click();
    await page.waitForTimeout(200);
    const moreButton = page.locator("#pain-more");
    expect(await moreButton.getAttribute("aria-pressed")).toBe("true");

    await page.locator("#comment").fill("Prefers morning appointments.");
    await page.waitForTimeout(400);
    const enAfterOnset = await page.locator("#summary-en").innerText();
    expect(enAfterOnset.split("\n")[0]).toMatch(/^No pain in right thumb\.?$/i);
    const svAfter = await page.locator("#summary-sv").innerText();
    expect(svAfter).toMatch(/Kommentar:\s*Prefers morning appointments/i);
    const canonical = await page.locator("#ehr").innerText();
    expect(canonical).toContain("Prefers morning appointments.");
    const fhir = await page.locator("#fhir").innerText();
    expect(fhir).toContain("Prefers morning appointments.");

    await page.close();
  },
  60_000);
});