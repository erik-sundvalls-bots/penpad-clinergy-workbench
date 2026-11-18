import { readFileSync } from "node:fs";
import { loadEhrtslib } from "../src/openehr/ehrtslib-loader.ts";

const vendor = await loadEhrtslib();
for (const f of ["templates/thumb-pain.opt", "templates/gp-encounter.opt"]) {
  const ot = vendor.parser.parseOptXml(readFileSync(f, "utf8")).operationalTemplate;
  console.log(`${f}: OK root=${ot.archetype_id?.value ?? ot.definition?.rm_root?.archetype_id?.value}`);
}