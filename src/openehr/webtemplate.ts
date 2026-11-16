import webTemplateJson from "../../templates/thumb-pain.webtemplate.json";

/** Composition template id requested for this workbench. The coded OPT file's registered id is thumb-pain-encounter.v2-coded. */
export const TEMPLATE_ID = "thumb-pain-encounter.v2";

/**
 * CDR simplified-format root. FerroEHR rejects the template id as a FLAT root.
 * ehrtslib treats webTemplate.templateId as that root, so the generated file uses "encounter".
 */
export const FLAT_ROOT = "encounter";

export const webTemplate = webTemplateJson;
