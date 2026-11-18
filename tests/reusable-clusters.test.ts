import { describe, expect, it } from "vitest";
import { emptyState, gpVisitState } from "../src/model.ts";
import { buildVisit } from "../src/openehr/compose.ts";
import { validateComposition } from "../src/openehr/validate.ts";
import { canonicalToZipehrHtml5 } from "../src/openehr/zipehr.ts";
import {
  buildQuietZipehrPreviewDocument,
  composeQuietStructureCss,
} from "../src/openehr/zipehr.ts";
import { applyZipQuietDomScript } from "../src/openehr/zipehr-preview.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

const FREQUENCY = ["infrequent", "occasional", "frequent"] as const;
const CONSISTENCY = ["soft", "firm", "hard", "fluctuant"] as const;
const TEXTURE = ["smooth", "rough", "nodular", "irregular"] as const;
const RANGE = ["full", "reduced", "limited", "fixed"] as const;
const PAIN = ["absence", "mild", "moderate", "severe"] as const;

function clusterJson(canonical: Record<string, unknown>, archetypeId: string): string {
  return JSON.stringify(canonical).includes(archetypeId) ? "yes" : "no";
}

async function quietText(html: string, lang: "en" | "sv"): Promise<string> {
  const base = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-short.css"), "utf8");
  const quiet = readFileSync(join(process.cwd(), "public/zipehr-css/zipehr-html5-quiet-structure.css"), "utf8");
  const css = await composeQuietStructureCss(base, quiet);
  const doc = await buildQuietZipehrPreviewDocument(html, css, {
    quietStructureTooltips: true,
    templateRenderLang: lang,
  });
  const win = new Window({ url: "https://example.test/" });
  win.document.write(doc.replace(/<script>[\s\S]*?<\/script>\s*(?=<\/body>)/, ""));
  applyZipQuietDomScript(win);
  return win.document.body.innerText.replace(/\s+/g, " ").trim();
}

describe("reusable cluster archetypes", () => {
  it("rejects unknown duration units", () => {
    const state = emptyState();
    state.pain.durationNumber = 2;
    state.pain.durationUnit = "fortnight";
    expect(() => buildVisit(state, "Pain")).toThrow(/Unknown duration unit/);
  });

  for (const value of FREQUENCY) {
    it(`maps frequency ${value} in English and Swedish`, async () => {
      for (const lang of ["en", "sv"] as const) {
        const state = emptyState();
        state.pain.summary = "presence";
        state.pain.choices.AbsoluteFrequency = value;
        const built = buildVisit(state, lang === "en" ? "Pain" : "Smärta", lang);
        expect(clusterJson(built.canonical, "symptom_sign_frequency.v0")).toBe("yes");
        expect(JSON.stringify(built.canonical)).not.toContain("clinergy_descriptor");
        const checked = await validateComposition(built.canonical);
        expect(checked.errors, JSON.stringify(checked.errors)).toEqual([]);
      }
    });
  }

  for (const consistency of CONSISTENCY) {
    for (const texture of TEXTURE) {
      it(`maps palpation ${consistency}/${texture}`, async () => {
        const state = emptyState();
        state.swelling.summary = "presence";
        state.swelling.choices.AbsoluteConsistency = consistency;
        state.swelling.choices.AbsoluteTexture = texture;
        const built = buildVisit(state, "Swelling");
        expect(clusterJson(built.canonical, "palpation_characteristics.v0")).toBe("yes");
        const checked = await validateComposition(built.canonical);
        expect(checked.errors).toEqual([]);
      });
    }
  }

  for (const range of RANGE) {
    for (const pain of PAIN) {
      it(`maps ROM qualitative ${range} / ${pain}`, async () => {
        const state = emptyState();
        state.exam.right.flexionRange = range;
        state.exam.right.flexionPain = pain;
        const built = buildVisit(state, "Thumb pain");
        const coded = JSON.stringify(built.canonical);
        expect(coded).toContain("range_of_motion-qualitative.v0");
        expect(coded).toContain(`"archetype_node_id":"at0.1"`);
        expect(coded).toContain(`"archetype_node_id":"at0.7"`);
        expect(coded).not.toContain("clinergy_descriptor");
        const checked = await validateComposition(built.canonical);
        expect(checked.errors).toEqual([]);
      });
    }
  }

  it("shows frequency and palpation labels in quiet ZipEHR EN and SV", async () => {
    const state = gpVisitState();
    state.pain.choices.AbsoluteFrequency = "occasional";
    state.swelling.choices.AbsoluteConsistency = "firm";
    state.swelling.choices.AbsoluteTexture = "smooth";
    const enBuilt = buildVisit(state, "Pain in right thumb", "en");
    const svBuilt = buildVisit(state, "Smärta i höger tumme", "sv");
    for (const [built, lang, needles] of [
      [enBuilt, "en", ["Occasional", "Firm", "Smooth", "Full", "Mild pain"]] as const,
      [svBuilt, "sv", ["Ibland", "Fast", "Slät", "Full", "Lätt smärta"]] as const,
    ]) {
      const html = await canonicalToZipehrHtml5(built.canonical, { templateRenderLang: lang });
      const text = await quietText(html, lang);
      for (const needle of needles) {
        expect(text, `${lang}: ${needle}`).toContain(needle);
      }
    }
  });
});