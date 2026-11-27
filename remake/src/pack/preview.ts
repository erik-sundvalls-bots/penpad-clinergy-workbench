import type { ImagePack } from "./types.ts";
import { mimeForPath } from "./idb.ts";

/** Pack image id for the installed-packs thumbnail: the male full-body main map. */
export const PACK_PREVIEW_IMAGE_ID = "M_main";

const blobUrls: string[] = [];

/** Path of the male full-body main map in a pack, if that image is present. */
export function maleMainImagePath(config: ImagePack): string | undefined {
  const rec = config.images[PACK_PREVIEW_IMAGE_ID];
  if (!rec?.path || rec.path.includes("..") || rec.path.startsWith("/")) return undefined;
  return rec.path;
}

/** URL of a file inside a folder pack (built-in or local-originals). */
export function folderAssetUrl(dir: string, relativePath: string, base = "/"): string {
  const root = base.endsWith("/") ? base : `${base}/`;
  const folder = dir.replace(/^\/+|\/+$/g, "");
  const rel = relativePath.replace(/^\/+/, "");
  return `${root}${folder}/${rel}`;
}

export function folderPreviewUrl(dir: string, config: ImagePack, base?: string): string | undefined {
  const path = maleMainImagePath(config);
  if (!path) return undefined;
  return folderAssetUrl(dir, path, base);
}

/** Object URL for an uploaded pack's male main map. Call forgetListedPreviewUrls() before building a new list. */
export function blobPreviewUrl(
  files: Record<string, { mime: string; bytes: ArrayBuffer }>,
  config: ImagePack,
): string | undefined {
  const path = maleMainImagePath(config);
  if (!path) return undefined;
  const rec = files[path];
  if (!rec) return undefined;
  const url = URL.createObjectURL(new Blob([rec.bytes], { type: rec.mime || mimeForPath(path) }));
  blobUrls.push(url);
  return url;
}

export function forgetListedPreviewUrls(): void {
  for (const url of blobUrls) {
    if (url.startsWith("blob:")) URL.revokeObjectURL(url);
  }
  blobUrls.length = 0;
}
