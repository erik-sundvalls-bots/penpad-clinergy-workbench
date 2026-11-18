import gpOptXml from "../../templates/gp-encounter.opt?raw";
import thumbOptXml from "../../templates/thumb-pain.opt?raw";
import { parser, serialization } from "../../vendor/ehrtslib/ehrtslib-0.14.0.min.js";
import { GP_TEMPLATE_ID } from "./template.ts";

const thumbParsed = parser.parseOptXml(thumbOptXml);
const gpParsed = parser.parseOptXml(gpOptXml);

const thumbTemplate = {
  operationalTemplate: thumbParsed.operationalTemplate,
  webTemplate: serialization.buildWebTemplate(thumbParsed.operationalTemplate),
};

const gpTemplate = {
  operationalTemplate: gpParsed.operationalTemplate,
  webTemplate: serialization.buildWebTemplate(gpParsed.operationalTemplate),
};

export type ZipehrTemplateContext = typeof thumbTemplate;

export function zipehrTemplateForCanonical(
  canonical: Record<string, unknown>,
): ZipehrTemplateContext {
  const details = canonical.archetype_details as { template_id?: { value?: string } } | undefined;
  return details?.template_id?.value === GP_TEMPLATE_ID ? gpTemplate : thumbTemplate;
}

export function languageFromCanonical(canonical: Record<string, unknown>): "en" | "sv" {
  const lang = canonical.language as { code_string?: string } | undefined;
  return lang?.code_string === "sv" ? "sv" : "en";
}