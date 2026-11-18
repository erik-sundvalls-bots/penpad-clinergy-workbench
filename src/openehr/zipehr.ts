import type { NoteLanguage } from "../exam/phrases.ts";
import { loadEhrtslib } from "./ehrtslib-loader.ts";
import {
  ZIP_DEFAULT_CSS,
  ZIP_EHR_HTML5_VARIANT,
  ZIP_EHR_SERIALIZE_OPTIONS,
  ZIP_QUIET_CSS,
  type ZipehrVariant,
  ZIP_CSS_SELECT_OPTIONS,
  ZIP_VARIANT_OPTIONS,
  zipehrTextStats,
} from "./zipehr-constants.ts";
import { languageFromCanonical, zipehrTemplateForCanonical } from "./zipehr-template.ts";

export type { ZipehrVariant } from "./zipehr-constants.ts";
export {
  ZIP_EHR_HTML5_VARIANT,
  ZIP_EHR_SERIALIZE_OPTIONS,
  ZIP_DEFAULT_CSS,
  ZIP_QUIET_CSS,
  ZIP_VARIANT_OPTIONS,
  ZIP_CSS_SELECT_OPTIONS,
  zipehrTextStats,
};
export {
  defaultCssForZipehrVariant,
  isZipehrMarkupVariant,
  resolveZipehrCssFile,
  zipehrDownloadBasename,
  zipehrDownloadMime,
} from "./zipehr-ui.ts";

export type ZipehrRenderOptions = {
  templateRenderLang?: NoteLanguage;
};

export async function canonicalToZipehr(
  canonical: Record<string, unknown>,
  variant: ZipehrVariant = ZIP_EHR_HTML5_VARIANT,
  options?: ZipehrRenderOptions,
): Promise<string> {
  const vendor = await loadEhrtslib();
  const {
    serializeToHtml5Variant,
    serializeToJZipehr,
    serializeToXZipehr,
    serializeToYZipehr,
  } = vendor;
  const lang = options?.templateRenderLang ?? languageFromCanonical(canonical);
  const template = await zipehrTemplateForCanonical(canonical);
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

export async function zipehrHtml5ToCanonicalRecord(html: string): Promise<Record<string, unknown>> {
  const vendor = await loadEhrtslib();
  const value = vendor.zipehrHtml5ToCanonical(html);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ZipEHR HTML5 did not deserialize to a canonical object");
  }
  return value as Record<string, unknown>;
}

export async function composeQuietStructureCss(
  baseCss: string,
  quietOverridesCss: string,
): Promise<string> {
  const vendor = await loadEhrtslib();
  return vendor.composeQuietStructureCss(baseCss, quietOverridesCss);
}

export {
  buildQuietZipehrPreviewDocument,
  ZIP_L10N_PREVIEW_SCRIPT,
  ZIP_QUIET_DOM_SCRIPT,
} from "./zipehr-preview.ts";