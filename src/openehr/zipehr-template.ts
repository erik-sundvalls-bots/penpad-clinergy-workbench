import gpOptXml from "../../templates/gp-encounter.opt?raw";
import thumbOptXml from "../../templates/thumb-pain.opt?raw";
import { loadEhrtslib } from "./ehrtslib-loader.ts";
import { GP_TEMPLATE_ID } from "./template.ts";

export interface ZipehrTemplateContext {
  operationalTemplate: unknown;
  webTemplate: unknown;
}

let thumbTemplate: ZipehrTemplateContext | null = null;
let gpTemplate: ZipehrTemplateContext | null = null;

async function ensureTemplates(): Promise<{ thumb: ZipehrTemplateContext; gp: ZipehrTemplateContext }> {
  if (thumbTemplate && gpTemplate) return { thumb: thumbTemplate, gp: gpTemplate };
  const vendor = await loadEhrtslib();
  const thumbParsed = vendor.parser.parseOptXml(thumbOptXml);
  const gpParsed = vendor.parser.parseOptXml(gpOptXml);
  thumbTemplate = {
    operationalTemplate: thumbParsed.operationalTemplate,
    webTemplate: vendor.serialization.buildWebTemplate(thumbParsed.operationalTemplate),
  };
  gpTemplate = {
    operationalTemplate: gpParsed.operationalTemplate,
    webTemplate: vendor.serialization.buildWebTemplate(gpParsed.operationalTemplate),
  };
  return { thumb: thumbTemplate, gp: gpTemplate };
}

export async function zipehrTemplateForCanonical(
  canonical: Record<string, unknown>,
): Promise<ZipehrTemplateContext> {
  const { thumb, gp } = await ensureTemplates();
  const details = canonical.archetype_details as { template_id?: { value?: string } } | undefined;
  return details?.template_id?.value === GP_TEMPLATE_ID ? gp : thumb;
}

export { languageFromCanonical } from "./zipehr-lang.ts";