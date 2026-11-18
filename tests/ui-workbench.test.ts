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
});