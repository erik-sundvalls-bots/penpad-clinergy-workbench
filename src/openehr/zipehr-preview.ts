import type { NoteLanguage } from "../exam/phrases.ts";
import { buildZipehrPreviewDocument } from "../../vendor/ehrtslib/ehrtslib-0.14.0.min.js";
import { ZIP_SV_QUIET_PHRASES_SORTED } from "./zipehr-sv-quiet-phrases.ts";

const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const SV_MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
/** Wall-clock date/time from an ISO string (EN: `21 Oct 2021 14:21`, SV: `21 okt 2021 14:21`). */
export function formatIsoDateTimeFriendly(iso: string, lang: NoteLanguage): string | null {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const day = Number(m[3]);
  const monthIdx = Number(m[2]) - 1;
  if (monthIdx < 0 || monthIdx > 11) return null;
  const month = lang === "sv" ? SV_MONTHS[monthIdx]! : EN_MONTHS[monthIdx]!;
  return `${day} ${month} ${m[1]} ${m[4]}:${m[5]}`;
}

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
  const isoRe = /\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2})?(?:[+-]\\d{2}:\\d{2}|Z)?/g;
  const enM = __EN_MONTHS__;
  const svM = __SV_MONTHS__;
  const fmtIso = (iso) => {
    const m = iso.match(/^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})/);
    if (!m) return iso;
    const monthIdx = Number(m[2]) - 1;
    if (monthIdx < 0 || monthIdx > 11) return iso;
    const month = (lang === "sv" ? svM : enM)[monthIdx];
    return Number(m[3]) + " " + month + " " + m[1] + " " + m[4] + ":" + m[5];
  };
  const isoWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let isoNode;
  while ((isoNode = isoWalker.nextNode())) {
    if (!isoRe.test(isoNode.textContent || "")) continue;
    isoNode.textContent = (isoNode.textContent || "").replace(isoRe, fmtIso);
  }
  if (lang === "sv") {
    const phrases = __SV_PHRASES__;
    const enMonthPattern = new RegExp(
      "\\\\b(\\\\d{1,2})\\\\s+(" + enM.join("|") + ")\\\\s+(\\\\d{4})\\\\s+(\\\\d{2}:\\\\d{2})\\\\b",
      "g",
    );
    const phraseWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let phraseNode;
    while ((phraseNode = phraseWalker.nextNode())) {
      let raw = phraseNode.textContent || "";
      let next = raw;
      for (const pair of phrases) {
        if (next.includes(pair[0])) next = next.split(pair[0]).join(pair[1]);
      }
      next = next.replace(enMonthPattern, (_, day, mon, year, hm) => {
        const idx = enM.indexOf(mon);
        const month = idx >= 0 ? svM[idx] : mon;
        return day + " " + month + " " + year + " " + hm;
      });
      if (next !== raw) phraseNode.textContent = next;
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

/** Injected into quiet iframe previews (month arrays built at module load). */
export const ZIP_QUIET_DOM_SCRIPT = zipQuietDomScriptBody
  .replace(
    "__EN_MONTHS__",
    JSON.stringify(EN_MONTHS),
  )
  .replace(
    "__SV_MONTHS__",
    JSON.stringify(SV_MONTHS),
  )
  .replace("__SV_PHRASES__", JSON.stringify(ZIP_SV_QUIET_PHRASES_SORTED));

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
    for (const [en, sv] of ZIP_SV_QUIET_PHRASES_SORTED) {
      if (out.includes(en)) out = out.split(en).join(sv);
    }
    const enMonthRe = new RegExp(
      `\\b(\\d{1,2})\\s+(${EN_MONTHS.join("|")})\\s+(\\d{4})\\s+(\\d{2}:\\d{2})\\b`,
      "g",
    );
    out = out.replace(enMonthRe, (_, day, mon, year, hm) => {
      const idx = EN_MONTHS.indexOf(mon);
      return `${day} ${idx >= 0 ? SV_MONTHS[idx] : mon} ${year} ${hm}`;
    });
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