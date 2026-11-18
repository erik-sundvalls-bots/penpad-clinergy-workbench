/**
 * Sidebar + EN/SV summaries with throbbing pain character.
 * npm run build && npm run preview &  npx vite-node scripts/capture-sidebar-character.mjs
 */
import { chromium } from "playwright";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:4173/penpad-clinergy-workbench/";
const outDir = "/opt/cursor/artifacts";
const commit = process.env.CAPTURE_COMMIT ?? "unknown";
console.log(`capture-log commit=${commit}`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1480, height: 1100 } });
await page.goto(baseUrl, { waitUntil: "networkidle" });
await page.locator("#load-gp").click();
await page.locator('[data-group="pain"][data-feature="AbsolutePainDescriptor"][data-value="throbbingPain"]').click();
await page.waitForTimeout(600);

await page.locator("aside").screenshot({ path: `${outDir}/sidebar-reordered.png` });
console.log(`${outDir}/sidebar-reordered.png`);

const en = await page.locator("#summary-en").innerText();
const sv = await page.locator("#summary-sv").innerText();
await page.setContent(`<!DOCTYPE html><html><head><meta charset=utf-8><style>
body{font-family:system-ui,sans-serif;max-width:42rem;margin:1.5rem;line-height:1.45}
h2{margin:1rem 0 .25rem;font-size:1rem}
pre{white-space:pre-wrap;margin:0 0 1rem;padding:.75rem;border:1px solid #ccc;border-radius:6px}
</style></head><body>
<h2>English</h2><pre id=en></pre>
<h2>Svenska</h2><pre id=sv lang=sv></pre>
<script>document.getElementById("en").textContent=${JSON.stringify(en)};
document.getElementById("sv").textContent=${JSON.stringify(sv)};</script></body></html>`, { waitUntil: "load" });
await page.screenshot({ path: `${outDir}/gp-character-en-sv-notes.png`, fullPage: true });
console.log(`${outDir}/gp-character-en-sv-notes.png`);

await browser.close();