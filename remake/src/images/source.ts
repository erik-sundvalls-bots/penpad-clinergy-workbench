import { imageManifest } from "../knowledge-data.ts";

export type ImageMode = "placeholders" | "local-originals";

const STORAGE_KEY = "penpad-remake-image-mode";

export function modeFromWindow(win: Window = window): ImageMode {
  const q = new URL(win.location.href).searchParams.get("images");
  if (q === "local" || q === "local-originals" || q === "originals") return "local-originals";
  if (q === "placeholders" || q === "cc0" || q === "placeholder") return "placeholders";
  const stored = win.localStorage.getItem(STORAGE_KEY);
  if (stored === "local-originals" || stored === "placeholders") return stored;
  return "placeholders";
}

export function persistMode(mode: ImageMode, win: Window = window): void {
  win.localStorage.setItem(STORAGE_KEY, mode);
  const url = new URL(win.location.href);
  if (mode === "local-originals") url.searchParams.set("images", "local");
  else url.searchParams.delete("images");
  win.history.replaceState(null, "", url);
}

export function imageUrl(id: string, mode: ImageMode, base: string = import.meta.env.BASE_URL): string {
  const rec = imageManifest.images[id];
  const root = base.endsWith("/") ? base : `${base}/`;
  if (mode === "local-originals" && rec) {
    return `${root}remake/local-originals/${rec.originalRel}`;
  }
  if (rec) return `${root}remake/placeholders/${rec.placeholder}`;
  return `${root}remake/placeholders/fallback.svg`;
}

export function placeholderUrl(id: string, base: string = import.meta.env.BASE_URL): string {
  return imageUrl(id, "placeholders", base);
}

export function imageSize(id: string): { width: number; height: number } | null {
  const rec = imageManifest.images[id];
  if (!rec?.width || !rec?.height) return null;
  return { width: rec.width, height: rec.height };
}
