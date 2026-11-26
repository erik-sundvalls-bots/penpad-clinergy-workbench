import type { ImagePack, PackLicense } from "./types.ts";

/** Shipped with the site. The first default entry is what a fresh browser loads. */
export interface BuiltinPackInfo {
  key: string;
  dir: string;
  isDefault: boolean;
}

export const DEFAULT_BUILTIN_KEY = "builtin:cc0-clinical-vector";

export const BUILTIN_CATALOG: BuiltinPackInfo[] = [
  { key: DEFAULT_BUILTIN_KEY, dir: "remake/packs/cc0-clinical-vector", isDefault: true },
  { key: "builtin:cc0-placeholders", dir: "remake/packs/cc0-placeholders", isDefault: false },
];

export function builtinByKey(key: string): BuiltinPackInfo | undefined {
  return BUILTIN_CATALOG.find((b) => b.key === key);
}

export function defaultBuiltin(): BuiltinPackInfo {
  return BUILTIN_CATALOG.find((b) => b.isDefault) ?? BUILTIN_CATALOG[0];
}

export type PackListOrigin = "builtin" | "idb" | "local";

export interface PackListItem {
  key: string;
  origin: PackListOrigin;
  id: string;
  name: string;
  version: string;
  license: PackLicense;
  attribution?: string;
  description?: string;
  imageCount: number;
  removable: boolean;
  active: boolean;
}

export function itemFromConfig(
  key: string,
  origin: PackListOrigin,
  config: ImagePack,
  activeKey: string,
): PackListItem {
  return {
    key,
    origin,
    id: config.id,
    name: config.name,
    version: config.version,
    license: config.license,
    attribution: config.attribution,
    description: config.description,
    imageCount: Object.keys(config.images).length,
    removable: origin === "idb",
    active: key === activeKey,
  };
}

/** Built-ins first (default at the top), then uploaded packs, then a local dev pack if present. */
export function mergePackList(
  builtins: PackListItem[],
  uploaded: PackListItem[],
  local: PackListItem | null,
  activeKey: string,
): PackListItem[] {
  const mark = (item: PackListItem): PackListItem => ({ ...item, active: item.key === activeKey });
  const out = [...builtins.map(mark), ...uploaded.map(mark)];
  if (local) out.push(mark(local));
  return out;
}

export function nextActiveAfterRemove(activeKey: string, removedKey: string, fallbackKey: string): string {
  return activeKey === removedKey ? fallbackKey : activeKey;
}

export function userPackKey(packId: string): string {
  const id = packId
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "uploaded";
  return `user:${id}`;
}

/**
 * A pack address from `?pack=` must be a normal http(s) URL.
 * Relative URLs are resolved against the page.
 */
export function resolvePackQueryUrl(raw: string, baseHref?: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("That pack address is empty.");
  let url: URL;
  try {
    url = new URL(trimmed, baseHref);
  } catch {
    throw new Error("That pack address is not a valid URL.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("A pack address must be an http or https URL.");
  }
  return url.href;
}
