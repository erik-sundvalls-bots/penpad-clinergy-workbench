import { describe, expect, it } from "vitest";
import { gpVisitState, emptyState, findingsFromState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { painForm } from "../src/knowledge.ts";
import { historyNarrativeText } from "../src/summary.ts";
import {
  canonicalToZipehrHtml5,
  buildQuietZipehrPreviewDocument,
  composeQuietStructureCss,
  ZIP_QUIET_DOM_SCRIPT,
} from "../src/openehr/zipehr.ts";
import { formatIsoDateTimeFriendly } from "../src/openehr/zipehr-preview.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

const ENGLISH_LEAK = [
  "On Examination",
  "Right thumb",
  "full range",
  "mildly painful",
  "Thumb sprain",
  "Review the right thumb",
  "not examined",
  "not painful",
  "Physical examination findings",
  "Story/History",
  "Symptom/Sign",
  "Examination not done: true",
  "Examination not done:true",
  "Episode duration",
  "Body site name",
  "Laterality",
  "Character",
  "Severity category",
  "Clinical interpretation",
  "Movement",
  "Problem/Diagnosis name",
  "Symptom/Sign name",
  "Onset timing",
  "Pattern",
  "Progression",
  "2 weeks",
  "weeks",
  "primary medical care",
  "Encounter event",
  "Encounter",
  "Range of motion of a joint",
  "Clinical description",
  "Problem/Diagnosis",
  "Recommendation",
  "Topic",
  "Clinical management",
  "Clinical interpretation",
  "21 Oct 2021",
];

function quietCompositionHeaderText(
  html: string,
  templateRenderLang: "en" | "sv" = "en",
): string {
  const { text, win } = renderQuietPreview(html, templateRenderLang);
  const co = win.document.querySelector("o-co") as HTMLElement | null;
  const header = co?.innerText?.replace(/\s+/g, " ").trim() ?? text;
  return header;
}

function renderQuietPreview(
  html: string,
  templateRenderLang: "en" | "sv" = "en",
): { text: string; win: Window } {
  const base = readFileSync(
    join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"),
    "utf8",
  );
  const quiet = readFileSync(
    join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"),
    "utf8",
  );
  const doc = buildQuietZipehrPreviewDocument(html, composeQuietStructureCss(base, quiet), {
    quietStructureTooltips: true,
    templateRenderLang,
  });
  const win = new Window({ url: "https://example.test/" });
  win.document.write(doc);
  const script = win.document.createElement("script");
  script.textContent = ZIP_QUIET_DOM_SCRIPT;
  win.document.body.appendChild(script);
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
    const { text: view, win } = renderQuietPreview(html);
    expect(win.document.querySelector("[data-opt-visibility='pass-through']")).toBeTruthy();
    expect((view.match(/Physical examination findings/g) ?? []).length).toBe(1);
    expect(view).not.toMatch(/Examination not done:\s*true/i);
    expect(view).not.toMatch(/,\s*present\b/i);
    const header = quietCompositionHeaderText(html, "en");
    expect(header).toContain("Encounter event Dr J Brown");
    expect(header).toContain("21 Oct 2021 14:21 primary medical care");
    expect(view).toContain("21 Oct 2021 14:21");
    expect(view).not.toContain("2021-10-21T14:21:00+01:00");
    expect(formatIsoDateTimeFriendly("2021-10-21T14:21:00+01:00", "en")).toBe("21 Oct 2021 14:21");
    expect(html).toContain('data-antn-hide-on-form="true"');
    expect(win.document.querySelector("[data-antn-hide-on-form='true']")).toBeTruthy();
  });

  it("Swedish quiet view uses L10n and does not leak English UI labels", async () => {
    const state = gpVisitState();
    const history = historyNarrativeText(
      findingsFromState(state, painForm.diagnoses).filter(
        (f) => f.topic === "ThumbPainSymptom" || f.topic === "ThumbSwellingSymptom",
      ),
      "sv",
    );
    const built = buildVisit(state, history, "sv");
    const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: "sv" });
    const { text: view } = renderQuietPreview(html, "sv");
    expect(view).toContain("Status");
    expect(view).not.toContain("Physical examination findings");
    expect(view).toContain("2 veckor");
    const header = quietCompositionHeaderText(html, "sv");
    expect(header).toContain("Möte händelse Dr J Brown");
    expect(header).toContain("21 okt 2021 14:21 primärvård");
    expect(view).toContain("21 okt 2021 14:21");
    expect(view).not.toContain("2021-10-21T14:21:00+01:00");
    const svLeak = ENGLISH_LEAK.filter((f) => f !== "Physical examination findings");
    for (const fragment of svLeak) {
      expect(view, fragment).not.toContain(fragment);
    }
  });

  it("formats exclusion boolean with a display label, not raw true", async () => {
    const state = emptyState();
    state.exam.left.status = "notExamined";
    const built = buildVisit(state, "Thumb pain", "en");
    const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: "en" });
    const { text: view } = renderQuietPreview(html);
    expect(view).not.toMatch(/Examination not done:\s*true/i);
    expect(view).toMatch(/Examination not done|Yes|Ja/i);
  });
});