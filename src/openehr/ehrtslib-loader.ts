export type EhrtslibModule = typeof import("../../vendor/ehrtslib/ehrtslib-0.14.0.min.js");

let loadPromise: Promise<EhrtslibModule> | null = null;

/** Single cached dynamic import of the browser ehrtslib bundle. */
export function loadEhrtslib(): Promise<EhrtslibModule> {
  if (!loadPromise) {
    loadPromise = import("../../vendor/ehrtslib/ehrtslib-0.14.0.min.js");
  }
  return loadPromise;
}

export function prefetchEhrtslib(): void {
  void loadEhrtslib();
}

export function ehrtslibLoadStarted(): boolean {
  return loadPromise !== null;
}