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

export type QuietZipehrPreviewOptions = {
  quietStructureTooltips?: boolean;
  templateRenderLang?: NoteLanguage;
};

export function buildQuietZipehrPreviewDocument(
  markup: string,
  css: string,
  options?: QuietZipehrPreviewOptions,
): string {
  const lang = options?.templateRenderLang ?? "en";
  const doc = buildZipehrPreviewDocument(markup, css, {
    quietStructureTooltips: options?.quietStructureTooltips,
  });
  const l10nScript =
    lang !== "en"
      ? `<script>${ZIP_L10N_PREVIEW_SCRIPT}</script>`
      : "";
  return doc
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace("</body>", `${l10nScript}</body>`);
}