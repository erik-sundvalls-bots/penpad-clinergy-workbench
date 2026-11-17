#!/usr/bin/env -S deno run -A
/**
 * Build vendor/ehrtslib/ehrtslib-0.13.0.min.js from an ehrtslib checkout.
 *
 *   EHR_TSLIB_ROOT=/path/to/ehrtslib deno run -A scripts/build_workbench_bundle.ts
 */
import * as esbuild from "https://deno.land/x/esbuild@v0.20.0/mod.js";
import { denoPlugins } from "https://deno.land/x/esbuild_deno_loader@0.9.0/mod.ts";
import {
  dirname,
  fromFileUrl,
  join,
  resolve,
  toFileUrl,
} from "https://deno.land/std@0.210.0/path/mod.ts";

const workbenchRoot = join(dirname(fromFileUrl(import.meta.url)), "..");
const ehrtslibRoot = resolve(
  Deno.env.get("EHR_TSLIB_ROOT") ?? join(workbenchRoot, "../ehrtslib"),
);

const jsonAsModulePlugin: esbuild.Plugin = {
  name: "json-as-module",
  setup(build) {
    build.onLoad({ filter: /\.json$/ }, async (args) => ({
      contents: `export default ${await Deno.readTextFile(args.path)}`,
      loader: "js",
    }));
  },
};

const entrySrc = join(workbenchRoot, "vendor/ehrtslib/workbench_browser_entry.ts");
const entryDest = join(ehrtslibRoot, "workbench_browser_entry.ts");
const entryText = await Deno.readTextFile(entrySrc);
await Deno.writeTextFile(entryDest, entryText);

const version = JSON.parse(await Deno.readTextFile(join(ehrtslibRoot, "deno.json"))).version;
const outfile = join(workbenchRoot, `vendor/ehrtslib/ehrtslib-${version}.min.js`);
const sourceCommit = (await new Deno.Command("git", {
  cwd: ehrtslibRoot,
  args: ["rev-parse", "HEAD"],
  stdout: "piped",
}).output()).stdout;
const commit = new TextDecoder().decode(sourceCommit).trim();

const banner = `/** ehrtslib ${version} (workbench bundle) @ ${commit} */`;

try {
  await esbuild.build({
    plugins: [jsonAsModulePlugin, ...denoPlugins({ configPath: join(ehrtslibRoot, "deno.json") })],
    entryPoints: [toFileUrl(entryDest).href],
    bundle: true,
    outfile,
    format: "esm",
    target: "es2022",
    platform: "browser",
    minifyWhitespace: true,
    minifySyntax: true,
    minifyIdentifiers: false,
    legalComments: "eof",
    banner: { js: banner },
    logLevel: "info",
  });
} finally {
  esbuild.stop();
}

console.log(`Wrote ${outfile} from ehrtslib ${commit}`);