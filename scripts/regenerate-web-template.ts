import { writeFileSync } from "node:fs";
import { loadEhrtslib } from "../src/openehr/ehrtslib-loader.ts";
import optXml from "../templates/thumb-pain.opt?raw";

const vendor = await loadEhrtslib();
const operationalTemplate = vendor.parser.parseOptXml(optXml).operationalTemplate;
const webTemplate = vendor.serialization.buildWebTemplate(operationalTemplate);
const path = "templates/thumb-pain-encounter.v2.web-template.json";
writeFileSync(path, `${JSON.stringify(webTemplate)}\n`);
console.log(`wrote ${path}`);