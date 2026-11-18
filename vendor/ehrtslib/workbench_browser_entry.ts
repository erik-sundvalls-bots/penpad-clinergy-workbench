/**
 * Browser bundle entry for penpad-clinergy-workbench (ZipEHR HTML5 on the public import).
 * Place this file next to ehrtslib `mod.ts` and run `deno run -A scripts/build_workbench_bundle.ts`
 * from an ehrtslib checkout (see vendor/ehrtslib/README.md).
 */
export * from "./mod.ts";
export {
  serializeToHtml5Variant,
  serializeToJZipehr,
  serializeToYZipehr,
  serializeToXZipehr,
  zipehrHtml5ToCanonical,
  zipehrTextToCanonical,
  type Html5Layout,
  type Html5SerializeOptions,
  type Html5Dialect,
  type ZipehrSymbolVariant,
} from "./serialization/zipehr/mod.ts";
export { XmlSerializer, XmlDeserializer } from "./serialization/xml/mod.ts";
export {
  resolveCdrProfile,
  type CdrProfile,
} from "./serialization/simplified/cdr_profiles.ts";
export {
  ZIP_QUIET_STRUCTURE_CSS,
  ZIP_QUIET_PREVIEW_SCRIPT,
  buildZipehrPreviewDocument,
  composeQuietStructureCss,
  stripCssImports,
  type ZipehrPreviewDocumentOptions,
} from "./serialization/zipehr/css/compose_quiet_css.ts";