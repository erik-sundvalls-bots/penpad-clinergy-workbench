export type EhrFormatTab = "canonical" | "xml" | "simplified" | "zipehr";

export const EHR_FORMAT_TABS: readonly EhrFormatTab[] = [
  "canonical",
  "xml",
  "simplified",
  "zipehr",
];

const PANE_IDS: Record<EhrFormatTab, string> = {
  canonical: "ehr-canonical-pane",
  xml: "ehr-xml-pane",
  simplified: "ehr-simplified-pane",
  zipehr: "ehr-zipehr-pane",
};

export type EhrFormatDocument = {
  getElementById(id: string): Element | null;
  querySelectorAll<E extends Element = Element>(selectors: string): NodeListOf<E>;
};

/** Sync tab buttons, pane visibility, and simplified-only controls in the live DOM. */
export function applyEhrFormatTab(doc: EhrFormatDocument, tab: EhrFormatTab): void {
  for (const paneTab of EHR_FORMAT_TABS) {
    const pane = doc.getElementById(PANE_IDS[paneTab]) as HTMLElement | null;
    if (pane) pane.hidden = paneTab !== tab;
  }
  for (const button of doc.querySelectorAll<HTMLButtonElement>("[data-ehr-format]")) {
    const on = button.dataset.ehrFormat === tab;
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  }
  const simplifiedControls = doc.getElementById("ehr-simplified-controls") as HTMLElement | null;
  if (simplifiedControls) {
    simplifiedControls.hidden = tab !== "simplified";
  }
}

export function downloadBasenameForTab(
  tab: EhrFormatTab,
  simplifiedFlavour?: "flat" | "structured",
): string {
  switch (tab) {
    case "canonical":
      return "thumb-encounter.canonical.json";
    case "xml":
      return "thumb-encounter.canonical.xml";
    case "simplified":
      return simplifiedFlavour === "flat"
        ? "thumb-encounter.flat.json"
        : "thumb-encounter.structured.json";
    case "zipehr":
      return "thumb-encounter.zipehr.html5";
  }
}