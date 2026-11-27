/**
 * Build a deterministic remake form catalogue from a clinergy-extractor output tree.
 *
 *   npx vite-node scripts/generate-remake-forms.ts --in /path/to/extract --out public/remake/generated
 *
 * Writes public/remake/generated/forms.json, which is committed. coverage.json
 * in that folder is gitignored. See docs/remake-form-generator.md.
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { parse } from "yaml";
import {
  generateRemakeForms,
  loadExtractFromDir,
  assessCoverage,
  stableStringify,
  type DirReader,
  type CoverageReport,
} from "../remake/src/form/generate.ts";

function arg(flag: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return fallback;
}

function nodeReader(): DirReader {
  return {
    read: (path) => readFileSync(path, "utf8"),
    exists: (path) => existsSync(path),
    listFiles: (dir) => {
      if (!existsSync(dir)) return [];
      return readdirSync(dir).filter((name) => {
        try {
          const s = statSync(join(dir, name));
          return s.isFile() || s.isDirectory();
        } catch {
          return false;
        }
      });
    },
  };
}

function slimCoverage(report: CoverageReport) {
  return {
    total: report.total,
    full: report.full,
    partial: report.partial,
    none: report.none,
    empty: report.empty,
    constructs: report.constructs,
    // Keep the per-form list out of the default stdout; it is in coverage.json.
  };
}

function main(): number {
  const input = arg("--in") ?? arg("-i");
  const outDir = arg("--out") ?? arg("-o") ?? "public/remake/generated";
  if (!input) {
    console.error("usage: npx vite-node scripts/generate-remake-forms.ts --in <extract-dir> [--out public/remake/generated]");
    return 2;
  }
  if (!existsSync(input)) {
    console.error(`extract directory not found: ${input}`);
    return 2;
  }
  const extract = loadExtractFromDir(input, nodeReader(), (text) => parse(text));
  const catalog = generateRemakeForms(extract);
  const coverage = assessCoverage(catalog.forms);
  mkdirSync(outDir, { recursive: true });
  const formsPath = join(outDir, "forms.json");
  const coveragePath = join(outDir, "coverage.json");
  writeFileSync(formsPath, stableStringify(catalog));
  writeFileSync(coveragePath, stableStringify(coverage));
  console.log(`wrote ${formsPath} (${Object.keys(catalog.forms).length} forms)`);
  console.log(`wrote ${coveragePath}`);
  console.log(JSON.stringify(slimCoverage(coverage), null, 2));
  void basename;
  return 0;
}

process.exit(main());
