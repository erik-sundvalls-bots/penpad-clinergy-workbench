import {
  serializeToHtml5Variant,
  zipehrHtml5ToCanonical,
} from "../../vendor/ehrtslib/ehrtslib-0.13.0.min.js";

/** Same variant and serializer options as the ehrtslib demo ZipEHR output tab. */
export const ZIP_EHR_HTML5_VARIANT = "zipehr.html5.short" as const;

export const ZIP_EHR_SERIALIZE_OPTIONS = {
  symbolVariant: "emoji" as const,
  layout: "linesaving" as const,
  propertyMode: "comment" as const,
};

export const ZIP_DEFAULT_CSS = "zipehr-html5-short.css";

export const ZIP_QUIET_CSS = "zipehr-html5-short-quiet.css";

export const ZIP_CSS_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default for dialect" },
  { value: ZIP_QUIET_CSS, label: "Quiet (structure in tooltip)" },
  { value: "zipehr-xhtml.css", label: "zipehr-xhtml.css" },
  { value: "zipehr-html5-short.css", label: "zipehr-html5-short.css" },
  { value: "zipehr-html5-full.css", label: "zipehr-html5-full.css" },
  { value: "zipehr-html5-emoji.css", label: "zipehr-html5-emoji.css" },
];

const ZIP_QUIET_STRUCTURE_TAGS = [
  "o-se",
  "o-ob",
  "o-hi",
  "o-pe",
  "o-ie",
  "o-tr",
  "o-il",
  "o-is",
  "o-ta",
];

const ZIP_QUIET_TECH_TAGS = ["o-cph", "o-cnt"];

/** Strip meaningless structure labels; hide encoding/territory noise. */
export const ZIP_QUIET_PREVIEW_SCRIPT = `(() => {
  const structureTags = ${JSON.stringify(ZIP_QUIET_STRUCTURE_TAGS)};
  const techTags = ${JSON.stringify(ZIP_QUIET_TECH_TAGS)};
  for (const tag of structureTags) {
    for (const el of document.querySelectorAll(tag)) {
      let label = "";
      for (const node of [...el.childNodes]) {
        if (node.nodeType !== Node.TEXT_NODE) continue;
        const text = (node.textContent || "").trim();
        if (!text) continue;
        label = text;
        node.remove();
        break;
      }
      if (label) {
        el.setAttribute("title", label);
        el.setAttribute("tabindex", "0");
        el.classList.add("zipehr-struct-quiet");
        const tip = document.createElement("span");
        tip.className = "zipehr-structure-tip";
        tip.textContent = "Structure: " + label;
        el.appendChild(tip);
      }
    }
  }
  for (const tag of techTags) {
    for (const el of document.querySelectorAll(tag)) {
      const text = (el.textContent || "").trim();
      if (!text && !el.querySelector("*")) continue;
      el.classList.add("zipehr-tech-quiet");
      el.setAttribute("aria-hidden", "true");
    }
  }
})();`;

/** Inline base + quiet overlay (iframe srcdoc cannot resolve @import). */
export function mergeZipehrQuietStylesheet(baseCss: string, quietOverlayCss: string): string {
  const overlay = quietOverlayCss.replace(/@import[^;]+;\s*/g, "").trim();
  return `${baseCss}\n\n/* --- quiet structural overlay --- */\n${overlay}`;
}

export function resolveZipehrCssFile(selectValue: string): string | null {
  if (selectValue === "none" || selectValue === "custom") return null;
  if (selectValue === "default") return ZIP_DEFAULT_CSS;
  return selectValue;
}

export function buildZipehrPreviewDocument(
  markup: string,
  css: string,
  options?: { quietStructureTooltips?: boolean },
): string {
  const body = markup.trim() || "<!-- empty ZipEHR markup -->";
  const quietScript = options?.quietStructureTooltips
    ? `<script>${ZIP_QUIET_PREVIEW_SCRIPT}</script>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ZipEHR preview</title>
<style>
${css}
</style>
</head>
<body>
${body}
${quietScript}
</body>
</html>`;
}

export function zipehrTextStats(text: string): { characters: number; lines: number } {
  const characters = [...text].length;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  return { characters, lines };
}

export async function canonicalToZipehrHtml5(
  canonical: Record<string, unknown>,
): Promise<string> {
  return serializeToHtml5Variant(canonical, ZIP_EHR_HTML5_VARIANT, ZIP_EHR_SERIALIZE_OPTIONS);
}

export function zipehrHtml5ToCanonicalRecord(html: string): Record<string, unknown> {
  const value = zipehrHtml5ToCanonical(html);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ZipEHR HTML5 did not deserialize to a canonical object");
  }
  return value as Record<string, unknown>;
}