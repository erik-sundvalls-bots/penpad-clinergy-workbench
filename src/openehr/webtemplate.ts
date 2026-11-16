import webTemplateJson from "../../templates/thumb-pain.webtemplate.json";

/** Registered id of templates/thumb-pain.opt and of archetype_details.template_id. */
export const TEMPLATE_ID = "thumb-pain-encounter.v2";

/**
 * FLAT root is the web-template tree id, not the template id.
 * ehrtslib using the template id as the root is https://github.com/ErikSundvall/ehrtslib/issues/312.
 */
export const FLAT_ROOT = "encounter";

export const webTemplate = webTemplateJson;
