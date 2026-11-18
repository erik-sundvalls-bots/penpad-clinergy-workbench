import type { NoteLanguage } from "../exam/phrases.ts";
import { buildZipehrPreviewDocument } from "../../vendor/ehrtslib/ehrtslib-0.14.0.min.js";
import { WORKBENCH_ZIPEHR_LABEL_SV } from "./workbench-zipehr-l10n.ts";

/** Wall-clock DV_DATE_TIME for tests (aligns with ehrtslib ZipEHR display, not host TZ). */
export function formatIsoDateTimeFriendly(iso: string, lang: NoteLanguage): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const locale = lang === "sv" ? "sv-SE" : "en-GB";
  const date = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])),
  );
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  })
    .format(date)
    .replace(/\u00A0/g, " ")
    .replace(/,/g, "")
    .replace(/\./g, "")
    .trim();
}

const zipQuietDomScriptBody = `(() => {
  const lang = (document.documentElement.lang || "en").toLowerCase();
  const l10nAttr = "data-antn-l10n-" + lang;
  if (lang !== "en") {
    for (const el of document.querySelectorAll("[" + l10nAttr + "]")) {
      const replacement = el.getAttribute(l10nAttr);
      if (!replacement) continue;
      const enLabel = el.getAttribute("data-antn-l10n-en");
      for (const heading of el.querySelectorAll(".zs-structural-label")) {
        heading.textContent = replacement;
      }
      const twL10n = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let nL10n;
      while ((nL10n = twL10n.nextNode())) {
        let raw = nL10n.textContent || "";
        if (!raw.trim()) continue;
        if (enLabel && raw.includes(enLabel)) raw = raw.split(enLabel).join(replacement);
        else if (raw.trim() === (enLabel || "")) raw = replacement;
        nL10n.textContent = raw;
      }
    }
    const labelMap = __WORKBENCH_LABELS__;
    const entries = Object.entries(labelMap).sort((a, b) => b[0].length - a[0].length);
    const labelWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let labelNode;
    while ((labelNode = labelWalker.nextNode())) {
      let raw = labelNode.textContent || "";
      let next = raw;
      for (const [en, sv] of entries) {
        if (en && next.includes(en)) next = next.split(en).join(sv);
      }
      next = next.replace(/\\s{2,}/g, " ");
      if (next !== raw) labelNode.textContent = next;
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

/** Injected into quiet iframe previews. */
export const ZIP_QUIET_DOM_SCRIPT = zipQuietDomScriptBody.replace(
  "__WORKBENCH_LABELS__",
  JSON.stringify(WORKBENCH_ZIPEHR_LABEL_SV),
);

/** Run quiet-view DOM fixes (happy-dom and iframe both support eval). */
export function applyZipQuietDomScript(win: { eval: (source: string) => unknown }): void {
  win.eval(ZIP_QUIET_DOM_SCRIPT);
}

export const ZIP_L10N_PREVIEW_SCRIPT = ZIP_QUIET_DOM_SCRIPT;

export type QuietZipehrPreviewOptions = {
  quietStructureTooltips?: boolean;
  templateRenderLang?: NoteLanguage;
};

function postprocessQuietMarkup(markup: string, lang: NoteLanguage): string {
  let out = markup;
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