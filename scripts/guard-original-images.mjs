#!/usr/bin/env node
/**
 * Fail if a 1998 Clinergy original image (by SHA-256) is in the git tree or
 * in dist/. See scripts/guard-original-images.ts for the testable copy.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const hashesDoc = JSON.parse(readFileSync(join(repoRoot, "remake/data/original-image-hashes.json"), "utf8"));
const ALLOWLIST = new Set(["data/Mus_hand.png"]);
const LOCAL_ORIGINALS_PREFIX = "remake/local-originals/";

const byHash = new Map();
const originalNames = new Set();
for (const row of hashesDoc.files) {
  const list = byHash.get(row.sha256) ?? [];
  list.push(row);
  byHash.set(row.sha256, list);
  originalNames.add(row.name.toLowerCase());
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

function walkDir(root, out) {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    let st;
    try {
      st = statSync(p);
    } catch {
      // Skip broken symlinks (e.g. a local remake/local-originals/ pointer).
      continue;
    }
    if (st.isDirectory()) walkDir(p, out);
    else out.push(p);
  }
}

function trackedFiles() {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot }).toString();
  return out.split("\0").filter(Boolean);
}

const findings = [];
const seen = new Set();
const extraRoots = process.argv.includes("--dist") || existsSync(join(repoRoot, "dist")) ? ["dist"] : [];

function consider(abs, repoRel, fromGit) {
  const norm = repoRel.split(sep).join("/");
  if (seen.has(norm)) return;
  seen.add(norm);
  if (!fromGit && norm.startsWith(LOCAL_ORIGINALS_PREFIX) && !norm.startsWith("dist/")) return;
  if (fromGit && norm.startsWith(LOCAL_ORIGINALS_PREFIX) && !norm.endsWith("README.md")) {
    findings.push(`${norm}: git-tracked file under remake/local-originals/ (must stay gitignored except README.md)`);
  }
  if (norm.startsWith("dist/") && norm.includes("/local-originals/")) {
    findings.push(`${norm}: originals folder was copied into the published dist/`);
  }
  if (!existsSync(abs) || !statSync(abs).isFile()) return;
  const hash = sha256(readFileSync(abs));
  const hits = byHash.get(hash);
  if (hits?.length) {
    if (ALLOWLIST.has(norm)) return;
    findings.push(`${norm}: file matches original image hash (${hits.map((h) => h.path).join(", ")})`);
    return;
  }
  const inRemakeTree = norm.startsWith("remake/") || norm.startsWith("public/remake/") || norm.startsWith("dist/remake/");
  const base = (norm.split("/").pop() ?? "").toLowerCase();
  const raster = /\.(png|bmp|gif|jpe?g|tiff?|ico)$/i.test(base);
  if (inRemakeTree && raster && originalNames.has(base) && !norm.startsWith(LOCAL_ORIGINALS_PREFIX)) {
    findings.push(`${norm}: raster file in the remake tree uses an original Clinergy image filename (${base})`);
  }
}

for (const rel of trackedFiles()) consider(join(repoRoot, rel), rel, true);
for (const root of ["remake", "public/remake", ...extraRoots]) {
  const files = [];
  walkDir(join(repoRoot, root), files);
  for (const abs of files) consider(abs, relative(repoRoot, abs), false);
}

if (findings.length) {
  console.error("Original Clinergy images must not be committed or published.");
  for (const f of findings) console.error(" -", f);
  process.exit(1);
}
console.log("image guard: no original Clinergy images in the checked paths");
