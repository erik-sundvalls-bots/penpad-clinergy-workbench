import type { NoteLanguage } from "../exam/phrases.ts";
import { loadEhrtslib } from "./ehrtslib-loader.ts";

/**
 * Strip direct label text/spans from `pass-through` containers so wrapped
 * exam clusters do not repeat their parent observation heading in quiet view.
 * (Display localization is handled natively by ehrtslib >= 0.17 via
 * `.zs-display-value` / `.zs-canonical-value` spans.)
 */
export const ZIP_QUIET_DOM_SCRIPT = `(() => {
  for (const pt of document.querySelectorAll("[data-opt-visibility='pass-through']")) {
    for (const node of [...pt.childNodes]) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim()) {
        node.remove();
      } else if (
        node.nodeType === Node.ELEMENT_NODE &&
        (node.classList.contains("zs-structural-label") ||
          node.classList.contains("zs-canonical-value") ||
          node.classList.contains("zs-display-value"))
      ) {
        node.remove();
      }
    }
  }
})();`;

/** Run upstream quiet preview script and workbench pass-through strip (for happy-dom tests). */
export async function applyZipQuietDomScript(win: {
  eval: (source: string) => unknown;
}): Promise<void> {
  const vendor = await loadEhrtslib();
  win.eval(vendor.ZIP_QUIET_PREVIEW_SCRIPT);
  win.eval(ZIP_QUIET_DOM_SCRIPT);
}

export type QuietZipehrPreviewOptions = {
  quietStructureTooltips?: boolean;
  templateRenderLang?: NoteLanguage;
};

export async function buildQuietZipehrPreviewDocument(
  markup: string,
  css: string,
  options?: QuietZipehrPreviewOptions,
): Promise<string> {
  const lang = options?.templateRenderLang ?? "en";
  const vendor = await loadEhrtslib();
  const doc = vendor.buildZipehrPreviewDocument(markup, css, {
    quietStructureTooltips: options?.quietStructureTooltips,
  });
  const domScript = options?.quietStructureTooltips
    ? `<script>${ZIP_QUIET_DOM_SCRIPT}</script>`
    : "";
  return doc
    .replace(/<html lang="[^"]*">/, `<html lang="${lang}">`)
    .replace("</body>", `${domScript}</body>`);
}