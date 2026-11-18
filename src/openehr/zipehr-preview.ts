import type { NoteLanguage } from "../exam/phrases.ts";
import { buildZipehrPreviewDocument } from "../../vendor/ehrtslib/ehrtslib-0.14.0.min.js";

/** Apply OPT `L10n.*` attrs emitted as `data-antn-l10n-{lang}` onto visible ZipEHR labels. */
export const ZIP_L10N_PREVIEW_SCRIPT = `(() => {
  const lang = (document.documentElement.lang || "en").toLowerCase();
  const attr = "data-antn-l10n-" + lang;
  if (lang === "en") return;
  for (const el of document.querySelectorAll("[" + attr + "]")) {
    const replacement = el.getAttribute(attr);
    if (!replacement) continue;
    const heading = el.querySelector(":scope > .zs-structural-label");
    if (heading) {
      heading.textContent = replacement;
      continue;
    }
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE) continue;
      const trimmed = (node.textContent || "").trim();
      if (!trimmed) continue;
      node.textContent = (node.textContent || "").replace(trimmed, replacement);
      break;
    }
  }
})();`;

/** Quiet document view: L10n, collapse duplicate exam headings, localise durations. */
export const ZIP_QUIET_DOM_SCRIPT = `(() => {
  const lang = (document.documentElement.lang || "en").toLowerCase();
  const l10nAttr = "data-antn-l10n-" + lang;
  if (lang !== "en") {
    for (const el of document.querySelectorAll("[" + l10nAttr + "]")) {
      const replacement = el.getAttribute(l10nAttr);
      if (!replacement) continue;
      const heading = el.querySelector(":scope > .zs-structural-label");
      if (heading) {
        heading.textContent = replacement;
        continue;
      }
      for (const node of el.childNodes) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const trimmed = (node.textContent || "").trim();
        if (!trimmed) continue;
        node.textContent = (node.textContent || "").replace(trimmed, replacement);
        break;
      }
    }
  }
  for (const ob of document.querySelectorAll("o-ob")) {
    const innerPt = ob.querySelector(":scope > o-cl[data-opt-visibility='pass-through']");
    if (!innerPt) continue;
    const obLabel = ob.querySelector(":scope > .zs-structural-label")?.textContent?.trim();
    const innerLabel = innerPt.querySelector(":scope > .zs-structural-label")?.textContent?.trim();
    if (obLabel && innerLabel && obLabel === innerLabel) {
      innerPt.querySelector(":scope > .zs-structural-label")?.remove();
    }
  }
  if (lang === "sv") {
    const replaceWeeks = (raw) =>
      raw.replace(/(\\d+)\\s+weeks?\\b/gi, (_, n) => {
        const num = Number(n);
        return num + " " + (num === 1 ? "vecka" : "veckor");
      });
  let html = document.body.innerHTML;
    if (/\\d+\\s+weeks?/i.test(html)) {
      document.body.innerHTML = replaceWeeks(html);
    }
  }
  const examTitle = lang === "sv" ? "Status" : "Physical examination findings";
  const text = document.body.innerText;
  const matches = text.split(examTitle).length - 1;
  if (matches > 1) {
    let seen = false;
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const t = node.textContent?.trim();
      if (t !== examTitle) continue;
      if (seen) {
        node.textContent = "";
      } else {
        seen = true;
      }
    }
  }
})();`;

export type QuietZipehrPreviewOptions = {
  quietStructureTooltips?: boolean;
  templateRenderLang?: NoteLanguage;
};

function postprocessQuietMarkup(markup: string, lang: NoteLanguage): string {
  let out = markup;
  if (lang === "sv") {
    out = out.replace(/(\d+)\s+weeks?\b/gi, (_, raw) => {
      const num = Number(raw);
      return `${num} ${num === 1 ? "vecka" : "veckor"}`;
    });
    out = out.replace(/\bRight\b/g, "Höger");
    out = out.replace(/\bLeft\b/g, "Vänster");
    out = out.replace(/\bModerate\b/g, "Måttlig");
    out = out.replace(/\bAbduction\b/g, "Abduktion");
  }
  const examTitle = lang === "sv" ? "Status" : "Physical examination findings";
  const first = out.indexOf(examTitle);
  if (first >= 0) {
    const second = out.indexOf(examTitle, first + examTitle.length);
    if (second >= 0) {
      out = `${out.slice(0, second)}${out.slice(second + examTitle.length)}`;
    }
  }
  return out;
}

export function buildQuietZipehrPreviewDocument(
  markup: string,
  css: string,
  options?: QuietZipehrPreviewOptions,
): string {
  const lang = options?.templateRenderLang ?? "en";
  const processed = options?.quietStructureTooltips ? postprocessQuietMarkup(markup, lang) : markup;
  const doc = buildZipehrPreviewDocument(processed, css, {
    quietStructureTooltips: options?.quietStructureTooltips,
  });
  const domScript = `<script>${ZIP_QUIET_DOM_SCRIPT}</script>`;
  return doc
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace("</body>", `${domScript}</body>`);
}