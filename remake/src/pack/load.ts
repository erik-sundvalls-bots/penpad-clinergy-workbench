import { parse as parseYaml } from "yaml";
import { bodyMapFromPack } from "./geometry.ts";
import { assertValidPack } from "./validate.ts";
import { openPackZip } from "./zip.ts";
import { clearUserPack, loadUserPack, mimeForPath, saveUserPack } from "./idb.ts";
import type { ImagePack } from "./types.ts";
import type { BodyMapData } from "../knowledge-data.ts";

export type PackOrigin = "builtin" | "idb" | "local";

export interface ActivePack {
  origin: PackOrigin;
  config: ImagePack;
  bodyMap: BodyMapData;
  urlFor(id: string): string;
  dispose(): void;
}

const BUILTIN_DIR = "remake/packs/cc0-placeholders";
const LOCAL_DIR = "remake/local-originals";

function rootBase(base: string = import.meta.env.BASE_URL): string {
  return base.endsWith("/") ? base : `${base}/`;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function loadFolderPack(dir: string, origin: PackOrigin, base?: string): Promise<ActivePack | null> {
  const root = rootBase(base);
  const prefix = `${root}${dir.replace(/^\/+/, "")}/`;
  const yamlText = (await fetchText(`${prefix}pack.yaml`)) ?? (await fetchText(`${prefix}pack.yml`));
  const jsonText = yamlText ? null : await fetchText(`${prefix}pack.json`);
  if (!yamlText && !jsonText) return null;
  const raw = yamlText ? parseYaml(yamlText) : JSON.parse(jsonText!);
  const config = assertValidPack(raw);
  return {
    origin,
    config,
    bodyMap: bodyMapFromPack(config),
    urlFor(id: string) {
      const rec = config.images[id];
      if (!rec) return `${prefix}images/missing`;
      return `${prefix}${rec.path}`;
    },
    dispose() {},
  };
}

export async function loadBuiltinPack(base?: string): Promise<ActivePack> {
  const pack = await loadFolderPack(BUILTIN_DIR, "builtin", base);
  if (!pack) throw new Error("Built-in CC0 image pack is missing (remake/packs/cc0-placeholders/pack.yaml).");
  return pack;
}

export async function loadLocalDevPack(base?: string): Promise<ActivePack | null> {
  return loadFolderPack(LOCAL_DIR, "local", base);
}

function objectUrlsFromStored(files: Record<string, { mime: string; bytes: ArrayBuffer }>): { urls: Map<string, string>; dispose: () => void } {
  const urls = new Map<string, string>();
  for (const [path, rec] of Object.entries(files)) {
    const blob = new Blob([rec.bytes], { type: rec.mime || mimeForPath(path) });
    urls.set(path, URL.createObjectURL(blob));
  }
  return {
    urls,
    dispose() {
      for (const u of urls.values()) URL.revokeObjectURL(u);
      urls.clear();
    },
  };
}

export async function loadIdbPack(): Promise<ActivePack | null> {
  if (typeof indexedDB === "undefined") return null;
  const stored = await loadUserPack();
  if (!stored) return null;
  const config = assertValidPack(stored.config, Object.keys(stored.files));
  const { urls, dispose } = objectUrlsFromStored(stored.files);
  return {
    origin: "idb",
    config,
    bodyMap: bodyMapFromPack(config),
    urlFor(id: string) {
      const rec = config.images[id];
      return (rec && urls.get(rec.path)) || "";
    },
    dispose,
  };
}

export async function installPackZip(zipBytes: Uint8Array): Promise<ActivePack> {
  const opened = openPackZip(zipBytes);
  const files: Record<string, { mime: string; bytes: ArrayBuffer }> = {};
  for (const [path, bytes] of opened.files) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    files[path] = { mime: mimeForPath(path), bytes: copy.buffer };
  }
  await saveUserPack(opened.config, files);
  const { urls, dispose } = objectUrlsFromStored(files);
  return {
    origin: "idb",
    config: opened.config,
    bodyMap: bodyMapFromPack(opened.config),
    urlFor(id: string) {
      const rec = opened.config.images[id];
      return (rec && urls.get(rec.path)) || "";
    },
    dispose,
  };
}

export async function revertToBuiltin(base?: string): Promise<ActivePack> {
  if (typeof indexedDB !== "undefined") await clearUserPack();
  return loadBuiltinPack(base);
}

/**
 * Resolve the pack to use at startup.
 * `?images=local` tries remake/local-originals/pack.yaml (dev).
 * `?images=placeholders` / `cc0` forces the built-in pack.
 * Otherwise a previously uploaded pack in IndexedDB wins, else the built-in pack.
 */
export async function resolveStartupPack(win: Window = window, base?: string): Promise<ActivePack> {
  const q = new URL(win.location.href).searchParams.get("images");
  if (q === "local" || q === "local-originals" || q === "originals") {
    const local = await loadLocalDevPack(base);
    if (local) return local;
    return loadBuiltinPack(base);
  }
  if (q === "placeholders" || q === "cc0" || q === "placeholder") {
    return loadBuiltinPack(base);
  }
  const idb = await loadIdbPack();
  if (idb) return idb;
  return loadBuiltinPack(base);
}
