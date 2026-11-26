import type { ActivePack } from "../pack/load.ts";

/**
 * Image URLs and sizes come from the active image pack (built-in CC0 pack,
 * a zip uploaded into IndexedDB, or `?images=local` unpacked under
 * remake/local-originals/). The previous two-mode helper is kept only as a
 * thin wrapper around the pack.
 */

let active: ActivePack | null = null;

export function setActivePack(pack: ActivePack): void {
  active?.dispose();
  active = pack;
}

export function getActivePack(): ActivePack | null {
  return active;
}

export function imageUrl(id: string, _mode?: unknown, _base?: string): string {
  if (!active) return "";
  return active.urlFor(id);
}

export function imageSize(id: string): { width: number; height: number } | null {
  const rec = active?.config.images[id];
  if (!rec) return null;
  return { width: rec.width, height: rec.height };
}

/** @deprecated pack mechanism replaced mode persistence; kept so old calls compile during the transition */
export function persistMode(_mode: unknown, _win?: Window): void {}
export function modeFromWindow(_win?: Window): "placeholders" | "local-originals" {
  return "placeholders";
}

export type ImageMode = "placeholders" | "local-originals";
