import { describe, expect, it } from "vitest";
import { gpVisitState, emptyState, findingsFromState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { painForm } from "../src/knowledge.ts";
import { historyNarrativeText } from "../src/summary.ts";
import {
  canonicalToZipehrHtml5,
  buildQuietZipehrPreviewDocument,
  composeQuietStructureCss,
  zipehrHtml5ToCanonicalRecord,
} from "../src/openehr/zipehr.ts";
import { applyZipQuietDomScript } from "../src/openehr/zipehr-preview.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

const SV_ENGLISH_STRUCTURE = [
  "On Examination",
  "Physical examination findings",
  "Story/History",
  "Symptom/Sign",
  "Encounter event",
  "Möte händelse",
  "Encounter",
  "primary medical care",
  "Moderate",
  "Right",
  "Abduction",
  "Range of motion of a joint",
  "Clinical description",
  "Problem/Diagnosis",
  "Recommendation",
  "Topic",
  "Clinical interpretation",
  "21 Oct 2021",
  "2 weeks",
];

const EN_SWEDISH_STRUCTURE = [
  "Besök",
  "primärvård",
  "Berättelse",
  "Symtom/tecken",
  "Status",
  "Ledrörelse",
  "veckor",
  "21 okt",
];

async function quietCompositionHeaderText(
  html: string,
  templateRenderLang: "en" | "sv" = "en",
): Promise<string> {
  const { win } = await renderQuietPreview(html, templateRenderLang);
  const co = win.document.querySelector("o-co") as HTMLElement | null;
  return co?.innerText?.replace(/\s+/g, " ").trim() ?? "";
}

async function renderQuietPreview(
  html: string,
  templateRenderLang: "en" | "sv" = "en",
): Promise<{ text: string; win: Window }> {
  const base = readFileSync(
    join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"),
    "utf8",
  );
  const quiet = readFileSync(
    join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"),
    "utf8",
  );
  const doc = await buildQuietZipehrPreviewDocument(
    html,
    await composeQuietStructureCss(base, quiet),
    {
      quietStructureTooltips: true,
      templateRenderLang,
    },
  );
  const win = new Window({ url: "https://example.test/" });
  win.document.write(doc.replace(/<script>[\s\S]*?<\/script>\s*(?=<\/body>)/g, ""));
  await applyZipQuietDomScript(win);
  return {
    win,
    text: win.document.body.innerText.replace(/\s+/g, " ").trim(),
  };
}

describe("ZipEHR quiet GP visit", () => {
  it("English quiet view shows one exam heading and no raw boolean", async () => {
    const state = gpVisitState();
    const narrative = historyNarrativeText(findingsFromState(state, painForm.diagnoses), "en");
    const built = buildVisit(state, narrative);
    const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: "en" });
    expect(html).toContain('data-opt-visibility="pass-through"');
    const { text: view, win } = await renderQuietPreview(html);
    expect(win.document.querySelector("[data-opt-visibility='pass-through']")).toBeTruthy();
    expect((view.match(/Physical examination findings/g) ?? []).length).toBe(1);
    expect(view).not.toMatch(/Examination not done:\s*true/i);
    expect(view).not.toMatch(/,\s*present\b/i);
    const header = await quietCompositionHeaderText(html, "en");
    expect(header).toContain("Encounter event Dr J Brown");
    expect(header).toContain("21 Oct 2021 14:21 primary medical care");
    expect(view).toContain("21 Oct 2021 14:21");
    expect(view).not.toContain("2021-10-21T14:21:00+01:00");
    for (const fragment of EN_SWEDISH_STRUCTURE) {
      expect(view, fragment).not.toContain(fragment);
    }
  });

  it("Swedish quiet view uses native ehrtslib 0.15 L10n and does not leak English UI labels", async () => {
    const state = gpVisitState();
    const history = historyNarrativeText(
      findingsFromState(state, painForm.diagnoses).filter(
        (f) => f.topic === "ThumbPainSymptom" || f.topic === "ThumbSwellingSymptom",
      ),
      "sv",
    );
    const built = buildVisit(state, history, "sv");
    const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: "sv" });
    expect(html).toContain('<span class="zs-display-value">Besök</span>');
    expect(html).toContain('<span class="zs-display-value">primärvård</span>');
    const { text: view } = await renderQuietPreview(html, "sv");
    expect(view).toContain("Status");
    expect(view).not.toContain("Physical examination findings");
    expect(view).toContain("2 veckor");
    expect(view).toContain("ytterfalang");
    expect(view).not.toContain("Ytterfalang av tummen");
    expect(view).toContain("Höger");
    expect(view).toContain("Måttlig");
    expect(view).toContain("Abduktion");
    const header = await quietCompositionHeaderText(html, "sv");
    expect(header).toContain("Besök händelse Dr J Brown");
    expect(header).not.toMatch(/Möte händelse/i);
    expect(header).not.toMatch(/Encounter event/i);
    expect(header).toContain("21 okt 2021 14:21 primärvård");
    expect(view).toMatch(/21 okt 2021 14:21/);
    expect(view).not.toContain("2021-10-21T14:21:00+01:00");
    for (const fragment of SV_ENGLISH_STRUCTURE) {
      expect(view, fragment).not.toContain(fragment);
    }
  });

  it("localizes English composition labels and coded values to Swedish losslessly (#323)", async () => {
    const state = gpVisitState();
    const narrative = historyNarrativeText(findingsFromState(state, painForm.diagnoses), "en");
    const built = buildVisit(state, narrative, "en");
    const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: "sv" });
    expect(html).toContain('<span class="zs-display-value">Besök</span>');
    expect(html).toContain('<span class="zs-display-value">händelse</span>');
    expect(html).toContain('<span class="zs-display-value">primärvård</span>');
    expect(html).toContain('<span class="zs-display-value">Höger</span>');
    expect(html).toContain('<span class="zs-display-value">Måttlig</span>');
    expect(html).toContain('<span class="zs-display-value">Abduktion</span>');
    expect(await zipehrHtml5ToCanonicalRecord(html)).toEqual(built.canonical);
  });

  it("formats exclusion boolean with a display label, not raw true", async () => {
    const state = emptyState();
    state.exam.left.status = "notExamined";
    const built = buildVisit(state, "Thumb pain", "en");
    const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: "en" });
    const { text: view } = await renderQuietPreview(html);
    expect(view).not.toMatch(/Examination not done:\s*true/i);
    expect(view).toMatch(/Examination not done|Yes|Ja/i);
  });
});