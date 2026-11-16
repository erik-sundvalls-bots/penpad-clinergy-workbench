import webTemplateJson from "../../templates/thumb-pain-encounter.v2.web-template.json";

/** Registered id of templates/thumb-pain.opt and of archetype_details.template_id. */
export const TEMPLATE_ID = "thumb-pain-encounter.v2";

/**
 * Web template exported by FerroEHR 5.5.0 for the coded OPT.
 * Its tree id is `encounter`. serializeToFlat uses this file, not buildWebTemplate.
 */
const wrapped = webTemplateJson as { webTemplate?: unknown };
export const webTemplate = wrapped.webTemplate ?? webTemplateJson;
