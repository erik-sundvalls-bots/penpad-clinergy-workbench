import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import { parse as parseYaml } from "yaml";
import { assertValidPack } from "./validate.ts";
import type { ImagePack, PackFile } from "./types.ts";

const CONFIG_NAMES = ["pack.yaml", "pack.yml", "pack.json"];

export interface OpenedPack {
  config: ImagePack;
  /** Posix paths as stored in the zip (no leading slash). */
  files: Map<string, Uint8Array>;
  configPath: string;
}

function normalizeEntryPath(name: string): string | null {
  const path = name.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.endsWith("/")) return null;
  if (path.split("/").includes("..")) return null;
  return path;
}

/** If every entry is under a single top-level folder, return that prefix (with slash). */
export function wrapperPrefix(paths: string[]): string {
  const tops = new Set(paths.map((p) => p.split("/")[0]).filter(Boolean));
  if (tops.size !== 1) return "";
  const top = [...tops][0];
  if (CONFIG_NAMES.includes(top)) return "";
  return `${top}/`;
}

export function findConfigPath(paths: string[]): string | null {
  const prefix = wrapperPrefix(paths);
  for (const name of CONFIG_NAMES) {
    if (paths.includes(prefix + name)) return prefix + name;
  }
  return null;
}

export function parsePackConfig(bytes: Uint8Array, path: string): unknown {
  const text = strFromU8(bytes);
  if (path.endsWith(".json")) return JSON.parse(text);
  return parseYaml(text);
}

/** Unzip a pack zip, locate pack.yaml/json, and validate it against the files present. */
export function openPackZip(zipBytes: Uint8Array): OpenedPack {
  const raw = unzipSync(zipBytes);
  const files = new Map<string, Uint8Array>();
  for (const [name, data] of Object.entries(raw)) {
    const path = normalizeEntryPath(name);
    if (path) files.set(path, data);
  }
  const configPath = findConfigPath([...files.keys()]);
  if (!configPath) {
    throw new Error("This zip is not an image pack: missing pack.yaml or pack.json (at the root or inside a single folder).");
  }
  const parsed = parsePackConfig(files.get(configPath)!, configPath);
  const prefix = configPath.includes("/") ? configPath.slice(0, configPath.lastIndexOf("/") + 1) : "";
  const relativePaths = [...files.keys()].map((p) => (prefix && p.startsWith(prefix) ? p.slice(prefix.length) : p));
  const config = assertValidPack(parsed, relativePaths);
  // Re-key files relative to the pack root (next to pack.yaml).
  if (prefix) {
    const shifted = new Map<string, Uint8Array>();
    for (const [p, b] of files) {
      if (p.startsWith(prefix)) shifted.set(p.slice(prefix.length), b);
    }
    return { config, files: shifted, configPath: configPath.slice(prefix.length) };
  }
  return { config, files, configPath };
}

export function buildPackZip(configText: string, configName: "pack.yaml" | "pack.json", files: PackFile[]): Uint8Array {
  const entries: Record<string, Uint8Array> = {
    [configName]: strToU8(configText),
  };
  for (const f of files) {
    const path = f.path.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!path || path.split("/").includes("..")) throw new Error(`bad pack path: ${f.path}`);
    entries[path] = f.bytes;
  }
  return zipSync(entries, { level: 6 });
}
