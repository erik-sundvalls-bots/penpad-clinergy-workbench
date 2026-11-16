/**
 * Browser bundle entry for penpad-clinergy-workbench (ZipEHR HTML5 on the public import).
 * Place this file next to ehrtslib `mod.ts` and run `deno run -A scripts/build_workbench_bundle.ts`
 * from an ehrtslib checkout (see vendor/ehrtslib/README.md).
 */
export * from "./mod.ts";
export {
  serializeToHtml5Variant,
  zipehrHtml5ToCanonical,
  type Html5Layout,
  type Html5SerializeOptions,
  type Html5Dialect,
  type ZipehrSymbolVariant,
} from "./serialization/zipehr/mod.ts";