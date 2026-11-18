import {
  buildZipehrPreviewDocument,
  composeQuietStructureCss,
  serializeToHtml5Variant,
  serializeToJZipehr,
  serializeToXZipehr,
  serializeToYZipehr,
  zipehrHtml5ToCanonical,
  ZIP_QUIET_STRUCTURE_CSS,
  ZIP_QUIET_PREVIEW_SCRIPT,
} from "../../vendor/ehrtslib/ehrtslib-0.14.0.min.js";
import type { NoteLanguage } from "../exam/phrases.ts";
import { languageFromCanonical, zipehrTemplateForCanonical } from "./zipehr-template.ts";

/** Default ZipEHR tab variant (ehrtslib demo: html5/short). */
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

export { buildZipehrPreviewDocument, composeQuietStructureCss, ZIP_QUIET_PREVIEW_SCRIPT };
export {
  buildQuietZipehrPreviewDocument,
  ZIP_L10N_PREVIEW_SCRIPT,
  ZIP_QUIET_DOM_SCRIPT,
} from "./zipehr-preview.ts";

export type ZipehrRenderOptions = {
  templateRenderLang?: NoteLanguage;
};

export function isZipehrMarkupVariant(variant: ZipehrVariant): boolean {
  return variant === "zipehr.xhtml" || variant.startsWith("zipehr.html5.");
}

export function defaultCssForZipehrVariant(variant: ZipehrVariant): string {
  switch (variant) {
    case "zipehr.xhtml":
      return "zipehr-xhtml.css";
    case "zipehr.html5.full":
      return "zipehr-html5-full.css";
    case "zipehr.html5.emoji":
      return "zipehr-html5-emoji.css";
    case "zipehr.html5.short":
      return ZIP_DEFAULT_CSS;
    default:
      return ZIP_DEFAULT_CSS;
  }
}

export function zipehrDownloadBasename(variant: ZipehrVariant): string {
  switch (variant) {
    case "zipehr.json":
      return "thumb-encounter.zipehr.json";
    case "zipehr.yaml":
      return "thumb-encounter.zipehr.yaml";
    case "zipehr.xhtml":
      return "thumb-encounter.zipehr.xhtml";
    case "zipehr.html5.short":
      return "thumb-encounter.zipehr.html5-short.html";
    case "zipehr.html5.full":
      return "thumb-encounter.zipehr.html5-full.html";
    case "zipehr.html5.emoji":
      return "thumb-encounter.zipehr.html5-emoji.html";
  }
}

export function zipehrDownloadMime(variant: ZipehrVariant): string {
  if (variant === "zipehr.json") return "application/json";
  if (variant === "zipehr.yaml") return "text/yaml";
  return "text/html";
}

export function resolveZipehrCssFile(selectValue: string, variant: ZipehrVariant): string | null {
  if (selectValue === "none" || selectValue === "custom") return null;
  if (selectValue === "default") return defaultCssForZipehrVariant(variant);
  return selectValue;
}

export function zipehrTextStats(text: string): { characters: number; lines: number } {
  const characters = [...text].length;
  const lines = text.length === 0 ? 0 : text.split(/\r\n|\r|\n/).length;
  return { characters, lines };
}

export async function canonicalToZipehr(
  canonical: Record<string, unknown>,
  variant: ZipehrVariant = ZIP_EHR_HTML5_VARIANT,
  options?: ZipehrRenderOptions,
): Promise<string> {
  const lang = options?.templateRenderLang ?? languageFromCanonical(canonical);
  const template = zipehrTemplateForCanonical(canonical);
  const shared = { lang, templateRenderLang: lang, template };

  switch (variant) {
    case "zipehr.json":
      return serializeToJZipehr(canonical, ZIP_EHR_SERIALIZE_OPTIONS.symbolVariant);
    case "zipehr.yaml":
      return serializeToYZipehr(canonical, ZIP_EHR_SERIALIZE_OPTIONS.symbolVariant);
    case "zipehr.xhtml":
      return serializeToXZipehr(canonical, {
        ...ZIP_EHR_SERIALIZE_OPTIONS,
        ...shared,
      } as never);
    case "zipehr.html5.short":
    case "zipehr.html5.full":
    case "zipehr.html5.emoji":
      return serializeToHtml5Variant(canonical, variant, {
        ...ZIP_EHR_SERIALIZE_OPTIONS,
        ...shared,
      } as never);
  }
}

export async function canonicalToZipehrHtml5(
  canonical: Record<string, unknown>,
  options?: ZipehrRenderOptions,
): Promise<string> {
  return canonicalToZipehr(canonical, ZIP_EHR_HTML5_VARIANT, options);
}

export function zipehrHtml5ToCanonicalRecord(html: string): Record<string, unknown> {
  const value = zipehrHtml5ToCanonical(html);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ZipEHR HTML5 did not deserialize to a canonical object");
  }
  return value as Record<string, unknown>;
}