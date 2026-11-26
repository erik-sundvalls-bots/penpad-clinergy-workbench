/**
 * Fail if a 1998 Clinergy original image (by SHA-256) is in the git tree or
 * in dist/. Placeholders are new CC0 SVGs. The only allowlisted original is
 * data/Mus_hand.png, the small extract already published in this workbench
 * (see data/README.md). The remake must not add any further originals.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import hashesDoc from "../remake/data/original-image-hashes.json";

const ALLOWLIST = new Set(["data/Mus_hand.png"]);
const LOCAL_ORIGINALS_PREFIX = "remake/local-originals/";

export interface GuardFinding {
  path: string;
  reason: string;
  sha256?: string;
}

interface HashRow {
  path: string;
  sha256: string;
  name: string;
  allowlistedRepoPath?: string;
}

export function collectHashIndex(): { byHash: Map<string, HashRow[]>; originalNames: Set<string> } {
  const byHash = new Map<string, HashRow[]>();
  const originalNames = new Set<string>();
  for (const row of hashesDoc.files as HashRow[]) {
    const list = byHash.get(row.sha256) ?? [];
    list.push(row);
    byHash.set(row.sha256, list);
    originalNames.add(row.name.toLowerCase());
  }
  return { byHash, originalNames };
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function walkDir(root: string, out: string[]): void {
  if (!existsSync(root)) return;
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    const st = statSync(p);
    if (st.isDirectory()) walkDir(p, out);
    else out.push(p);
  }
}

export function trackedFiles(repoRoot: string): string[] {
  const out = execFileSync("git", ["ls-files", "-z"], { cwd: repoRoot }).toString();
  return out.split("\0").filter(Boolean);
}

export function guardPaths(repoRoot: string, extraRoots: string[] = []): GuardFinding[] {
  const { byHash, originalNames } = collectHashIndex();
  const findings: GuardFinding[] = [];
  const seen = new Set<string>();

  const consider = (abs: string, repoRel: string, fromGit: boolean) => {
    const norm = repoRel.split(sep).join("/");
    if (seen.has(norm)) return;
    seen.add(norm);

    // Local originals may exist on disk; only a problem if git-tracked or in dist/.
    if (!fromGit && norm.startsWith(LOCAL_ORIGINALS_PREFIX) && !norm.startsWith("dist/")) return;

    if (fromGit && norm.startsWith(LOCAL_ORIGINALS_PREFIX) && !norm.endsWith("/README.md") && norm !== "remake/local-originals/README.md") {
      findings.push({ path: norm, reason: "git-tracked file under remake/local-originals/ (must stay gitignored except README.md)" });
    }
    if (norm.startsWith("dist/") && norm.includes("/local-originals/")) {
      findings.push({ path: norm, reason: "originals folder was copied into the published dist/" });
    }

    if (!existsSync(abs) || !statSync(abs).isFile()) return;
    const buf = readFileSync(abs);
    const hash = sha256(buf);
    const hits = byHash.get(hash);
    if (hits && hits.length) {
      if (ALLOWLIST.has(norm)) return;
      findings.push({
        path: norm,
        sha256: hash,
        reason: `file matches original image hash (${hits.map((h) => h.path).join(", ")})`,
      });
      return;
    }

    const inRemakeTree =
      norm.startsWith("remake/") ||
      norm.startsWith("public/remake/") ||
      norm.startsWith("dist/remake/");
    const lower = norm.toLowerCase();
    const base = lower.split("/").pop() ?? "";
    const raster = /\.(png|bmp|gif|jpe?g|tiff?|ico)$/i.test(base);
    if (inRemakeTree && raster && originalNames.has(base) && !norm.startsWith(LOCAL_ORIGINALS_PREFIX)) {
      findings.push({
        path: norm,
        reason: `raster file in the remake tree uses an original Clinergy image filename (${base})`,
      });
    }
  };

  for (const rel of trackedFiles(repoRoot)) {
    consider(join(repoRoot, rel), rel, true);
  }
  const always = ["remake", "public/remake", ...extraRoots];
  for (const root of always) {
    const absRoot = join(repoRoot, root);
    const files: string[] = [];
    walkDir(absRoot, files);
    for (const abs of files) {
      consider(abs, relative(repoRoot, abs), false);
    }
  }
  return findings;
}

export function assertNoOriginalImages(repoRoot: string, extraRoots: string[] = []): void {
  const findings = guardPaths(repoRoot, extraRoots);
  if (findings.length) {
    const lines = findings.map((f) => ` - ${f.path}: ${f.reason}`).join("\n");
    throw new Error(`Original Clinergy images must not be committed or published.\n${lines}`);
  }
}

const invoked = process.argv.some((a) => a.includes("guard-original-images"));
if (invoked) {
  const extra = process.argv.includes("--dist") || existsSync(join(process.cwd(), "dist")) ? ["dist"] : [];
  assertNoOriginalImages(process.cwd(), extra);
  console.log("image guard: no original Clinergy images in the checked paths");
}
