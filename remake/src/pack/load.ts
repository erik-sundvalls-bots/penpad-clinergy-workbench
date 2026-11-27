import { parse as parseYaml } from "yaml";
import { bodyMapFromPack } from "./geometry.ts";
import { assertValidPack } from "./validate.ts";
import { openPackZip } from "./zip.ts";
import {
  clearUserPack,
  deleteUserPack,
  getActiveKey,
  listUserPacks,
  loadUserPack,
  mimeForPath,
  saveUserPack,
  setActiveKey,
  type StoredUserPack,
} from "./idb.ts";
import {
  BUILTIN_CATALOG,
  DEFAULT_BUILTIN_KEY,
  builtinByKey,
  defaultBuiltin,
  itemFromConfig,
  mergePackList,
  resolvePackQueryUrl,
  type PackListItem,
} from "./catalog.ts";
import { blobPreviewUrl, folderPreviewUrl, forgetListedPreviewUrls } from "./preview.ts";
import { formatPackError } from "./errors.ts";
import type { ImagePack } from "./types.ts";
import type { BodyMapData } from "../knowledge-data.ts";

export type PackOrigin = "builtin" | "idb" | "local";

export interface ActivePack {
  origin: PackOrigin;
  key: string;
  config: ImagePack;
  bodyMap: BodyMapData;
  urlFor(id: string): string;
  dispose(): void;
}

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

async function loadFolderPack(dir: string, origin: PackOrigin, key: string, base?: string): Promise<ActivePack | null> {
  const root = rootBase(base);
  const prefix = `${root}${dir.replace(/^\/+/, "")}/`;
  const yamlText = (await fetchText(`${prefix}pack.yaml`)) ?? (await fetchText(`${prefix}pack.yml`));
  const jsonText = yamlText ? null : await fetchText(`${prefix}pack.json`);
  if (!yamlText && !jsonText) return null;
  const raw = yamlText ? parseYaml(yamlText) : JSON.parse(jsonText!);
  const config = assertValidPack(raw);
  return {
    origin,
    key,
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

export async function loadBuiltinPack(base?: string, key: string = DEFAULT_BUILTIN_KEY): Promise<ActivePack> {
  const info = builtinByKey(key) ?? defaultBuiltin();
  const pack = await loadFolderPack(info.dir, "builtin", info.key, base);
  if (!pack) throw new Error(`Built-in image pack is missing (${info.dir}/pack.yaml).`);
  return pack;
}

export async function loadLocalDevPack(base?: string): Promise<ActivePack | null> {
  return loadFolderPack(LOCAL_DIR, "local", "local", base);
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

function activeFromStored(stored: StoredUserPack): ActivePack {
  const config = assertValidPack(stored.config, Object.keys(stored.files));
  const { urls, dispose } = objectUrlsFromStored(stored.files);
  return {
    origin: "idb",
    key: stored.key,
    config,
    bodyMap: bodyMapFromPack(config),
    urlFor(id: string) {
      const rec = config.images[id];
      return (rec && urls.get(rec.path)) || "";
    },
    dispose,
  };
}

export async function loadIdbPack(key?: string): Promise<ActivePack | null> {
  if (typeof indexedDB === "undefined") return null;
  const stored = await loadUserPack(key);
  if (!stored) return null;
  return activeFromStored(stored);
}

export async function installPackZip(zipBytes: Uint8Array): Promise<ActivePack> {
  const opened = openPackZip(zipBytes);
  const files: Record<string, { mime: string; bytes: ArrayBuffer }> = {};
  for (const [path, bytes] of opened.files) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    files[path] = { mime: mimeForPath(path), bytes: copy.buffer };
  }
  const key = await saveUserPack(opened.config, files);
  const { urls, dispose } = objectUrlsFromStored(files);
  return {
    origin: "idb",
    key,
    config: opened.config,
    bodyMap: bodyMapFromPack(opened.config),
    urlFor(id: string) {
      const rec = opened.config.images[id];
      return (rec && urls.get(rec.path)) || "";
    },
    dispose,
  };
}

export async function installPackFromUrl(url: string, baseHref?: string, fetchFn: typeof fetch = fetch): Promise<ActivePack> {
  const href = resolvePackQueryUrl(url, baseHref);
  let res: Response;
  try {
    res = await fetchFn(href);
  } catch (err) {
    throw new Error(formatPackError(err));
  }
  if (!res.ok) throw new Error(`The pack could not be downloaded (HTTP ${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  return installPackZip(bytes);
}

export async function switchToPack(key: string, base?: string): Promise<ActivePack> {
  if (key === "local") {
    const local = await loadLocalDevPack(base);
    if (!local) throw new Error("No local dev pack is available.");
    if (typeof indexedDB !== "undefined") await setActiveKey(key);
    return local;
  }
  if (key.startsWith("builtin:")) {
    const pack = await loadBuiltinPack(base, key);
    if (typeof indexedDB !== "undefined") await setActiveKey(key);
    return pack;
  }
  const pack = await loadIdbPack(key);
  if (!pack) throw new Error("That uploaded pack is no longer in this browser.");
  if (typeof indexedDB !== "undefined") await setActiveKey(key);
  return pack;
}

export async function removeUserPack(key: string, base?: string): Promise<ActivePack> {
  if (typeof indexedDB !== "undefined") await deleteUserPack(key);
  const active = typeof indexedDB !== "undefined" ? await getActiveKey() : DEFAULT_BUILTIN_KEY;
  return switchToPack(active, base);
}

/** Keep uploaded packs, but make the default built-in pack active. */
export async function revertToBuiltin(base?: string): Promise<ActivePack> {
  if (typeof indexedDB !== "undefined") await setActiveKey(DEFAULT_BUILTIN_KEY);
  return loadBuiltinPack(base, DEFAULT_BUILTIN_KEY);
}

/** Remove every uploaded pack and return to the default built-in pack. */
export async function revertAndClearUploads(base?: string): Promise<ActivePack> {
  if (typeof indexedDB !== "undefined") await clearUserPack();
  return loadBuiltinPack(base, DEFAULT_BUILTIN_KEY);
}

export async function listAvailablePacks(activeKey: string, base?: string): Promise<PackListItem[]> {
  forgetListedPreviewUrls();
  const builtins: PackListItem[] = [];
  for (const info of BUILTIN_CATALOG) {
    const pack = await loadFolderPack(info.dir, "builtin", info.key, base);
    if (pack) {
      builtins.push(itemFromConfig(info.key, "builtin", pack.config, activeKey, folderPreviewUrl(info.dir, pack.config, base ?? rootBase())));
    }
  }
  let uploaded: PackListItem[] = [];
  if (typeof indexedDB !== "undefined") {
    const rows = await listUserPacks();
    uploaded = rows.map((row) => itemFromConfig(row.key, "idb", row.config, activeKey, blobPreviewUrl(row.files, row.config)));
  }
  const localPack = await loadLocalDevPack(base);
  const local = localPack
    ? itemFromConfig("local", "local", localPack.config, activeKey, folderPreviewUrl(LOCAL_DIR, localPack.config, base ?? rootBase()))
    : null;
  return mergePackList(builtins, uploaded, local, activeKey);
}

export interface StartupPack {
  pack: ActivePack;
  error: string | null;
  localFallback: boolean;
}

/**
 * Resolve the pack to use at startup.
 * `?images=local` tries remake/local-originals/pack.yaml (dev).
 * `?images=placeholders` / `cc0` forces the outline placeholder pack.
 * `?images=clinical` forces the CC0 clinical vector pack.
 * `?images=davinci` / `leonardo` forces the Leonardo-style folio pack.
 * `?pack=<url>` downloads a pack zip (http/https) and stores it in IndexedDB.
 * Otherwise the last active pack in IndexedDB wins; a fresh profile uses the default built-in pack.
 */
export async function resolveStartupPack(win: Window = window, base?: string): Promise<StartupPack> {
  const url = new URL(win.location.href);
  const images = url.searchParams.get("images");
  const packParam = url.searchParams.get("pack");
  let error: string | null = null;
  const wantedLocal = images === "local" || images === "local-originals" || images === "originals";

  if (wantedLocal) {
    const local = await loadLocalDevPack(base);
    if (local) return { pack: local, error: null, localFallback: false };
    return { pack: await loadBuiltinPack(base), error: null, localFallback: true };
  }
  if (images === "placeholders" || images === "cc0" || images === "placeholder") {
    return { pack: await loadBuiltinPack(base, "builtin:cc0-placeholders"), error: null, localFallback: false };
  }
  if (images === "clinical" || images === "clinical-vector") {
    return { pack: await loadBuiltinPack(base, "builtin:cc0-clinical-vector"), error: null, localFallback: false };
  }
  if (images === "davinci" || images === "da-vinci" || images === "leonardo") {
    return { pack: await loadBuiltinPack(base, DEFAULT_BUILTIN_KEY), error: null, localFallback: false };
  }
  if (packParam) {
    try {
      const pack = await installPackFromUrl(packParam, url.href);
      return { pack, error: null, localFallback: false };
    } catch (err) {
      error = formatPackError(err);
    }
  }
  if (typeof indexedDB !== "undefined") {
    const active = await getActiveKey();
    if (active.startsWith("user:")) {
      const idb = await loadIdbPack(active);
      if (idb) return { pack: idb, error, localFallback: false };
    } else if (active.startsWith("builtin:")) {
      try {
        return { pack: await loadBuiltinPack(base, active), error, localFallback: false };
      } catch {
        // fall through to default
      }
    }
  }
  return { pack: await loadBuiltinPack(base), error, localFallback: false };
}
