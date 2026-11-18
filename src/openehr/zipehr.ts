import {
  buildZipehrPreviewDocument,
  composeQuietStructureCss,
  serializeToHtml5Variant,
  zipehrHtml5ToCanonical,
  ZIP_QUIET_STRUCTURE_CSS,
} from "../../vendor/ehrtslib/ehrtslib-0.13.0.min.js";

/** Same variant and serializer options as the ehrtslib demo ZipEHR output tab. */
export const ZIP_EHR_HTML5_VARIANT = "zipehr.html5.short" as const;

export const ZIP_EHR_SERIALIZE_OPTIONS = {
  symbolVariant: "emoji" as const,
  layout: "linesaving" as const,
  propertyMode: "comment" as const,
};

export const ZIP_DEFAULT_CSS = "zipehr-html5-short.css";

/** Upstream quiet overlay filename (composed on dialect default in iframe srcdoc). */
export const ZIP_QUIET_CSS = ZIP_QUIET_STRUCTURE_CSS;

export const ZIP_CSS_SELECT_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Default for dialect" },
  { value: ZIP_QUIET_CSS, label: "Quiet (structure in tooltip)" },
  { value: "zipehr-xhtml.css", label: "zipehr-xhtml.css" },
  { value: "zipehr-html5-short.css", label: "zipehr-html5-short.css" },
  { value: "zipehr-html5-full.css", label: "zipehr-html5-full.css" },
  { value: "zipehr-html5-emoji.css", label: "zipehr-html5-emoji.css" },
];

export { buildZipehrPreviewDocument, composeQuietStructureCss };

export function resolveZipehrCssFile(selectValue: string): string | null {
  if (selectValue === "none" || selectValue === "custom") return null;
  if (selectValue === "default") return ZIP_DEFAULT_CSS;
  return selectValue;
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