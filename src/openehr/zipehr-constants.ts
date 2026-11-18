/** ZipEHR UI constants — no ehrtslib import (keeps main chunk small). */

export const ZIP_EHR_HTML5_VARIANT = "zipehr.html5.short" as const;

export type ZipehrVariant =
  | "zipehr.json"
  | "zipehr.yaml"
  | "zipehr.xhtml"
  | "zipehr.html5.short"
  | "zipehr.html5.full"
  | "zipehr.html5.emoji";

export const ZIP_VARIANT_OPTIONS: { value: ZipehrVariant; label: string }[] = [
  { value: "zipehr.json", label: "zipehr.json (lossless roundtrip)" },
  { value: "zipehr.yaml", label: "zipehr.yaml (lossless roundtrip)" },
  { value: "zipehr.xhtml", label: "zipehr.xhtml (lossless roundtrip)" },
  { value: "zipehr.html5.short", label: "zipehr.html5/short (lossless roundtrip)" },
  { value: "zipehr.html5.full", label: "zipehr.html5/full (lossless roundtrip)" },
  { value: "zipehr.html5.emoji", label: "zipehr.html5/emoji (lossless roundtrip)" },
];

export const ZIP_EHR_SERIALIZE_OPTIONS = {
  symbolVariant: "emoji" as const,
  layout: "linesaving" as const,
  propertyMode: "comment" as const,
};

export const ZIP_QUIET_STRUCTURE_CSS = "zipehr-html5-quiet-structure.css";

export const ZIP_DEFAULT_CSS = "zipehr-html5-short.css";

export const ZIP_QUIET_CSS = ZIP_QUIET_STRUCTURE_CSS;

export const ZIP_CSS_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default for dialect" },
  { value: ZIP_QUIET_CSS, label: "Quiet (structure in tooltip)" },
  { value: "zipehr-xhtml.css", label: "zipehr-xhtml.css" },
  { value: "zipehr-html5-short.css", label: "zipehr-html5-short.css" },
  { value: "zipehr-html5-full.css", label: "zipehr-html5-full.css" },
  { value: "zipehr-html5-emoji.css", label: "zipehr-html5-emoji.css" },
];

export function zipehrTextStats(text: string): { characters: number; lines: number } {
  const characters = [...text].length;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  return { characters, lines };
}