import { ZIP_DEFAULT_CSS, type ZipehrVariant } from "./zipehr-constants.ts";

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