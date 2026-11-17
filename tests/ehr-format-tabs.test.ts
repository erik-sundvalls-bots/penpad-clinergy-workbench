import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import {
  applyEhrFormatTab,
  EHR_FORMAT_TABS,
  type EhrFormatDocument,
  type EhrFormatTab,
} from "../src/openehr/ehr-format-tabs.ts";

function fixtureHtml(): string {
  return `
    <div class="ehr-format-tabs">
      ${EHR_FORMAT_TABS.map(
        (tab) =>
          `<button type="button" class="ehr-format-tab" data-ehr-format="${tab}" aria-selected="false"></button>`,
      ).join("")}
    </div>
    <div id="ehr-canonical-pane"></div>
    <div id="ehr-xml-pane"></div>
    <div id="ehr-simplified-pane">
      <div id="ehr-simplified-controls" hidden></div>
    </div>
    <div id="ehr-zipehr-pane"></div>
  `;
}

describe("openEHR output format tabs", () => {
  for (const tab of EHR_FORMAT_TABS) {
    it(`shows only the ${tab} pane when selected`, () => {
      const window = new Window();
      const doc = window.document;
      doc.body.innerHTML = fixtureHtml();
      applyEhrFormatTab(doc as unknown as EhrFormatDocument, tab);
      for (const candidate of EHR_FORMAT_TABS) {
        const pane = doc.getElementById(
          candidate === "canonical"
            ? "ehr-canonical-pane"
            : candidate === "xml"
              ? "ehr-xml-pane"
              : candidate === "simplified"
                ? "ehr-simplified-pane"
                : "ehr-zipehr-pane",
        );
        expect(pane?.hasAttribute("hidden")).toBe(candidate !== tab);
      }
      const active = doc.querySelector(`[data-ehr-format="${tab}"]`);
      expect(active?.classList.contains("active")).toBe(true);
      expect(active?.getAttribute("aria-selected")).toBe("true");
    });
  }

  it("shows dialect and flavour controls only on Simplified", () => {
    const window = new Window();
    const doc = window.document;
    doc.body.innerHTML = fixtureHtml();
    const controls = doc.getElementById("ehr-simplified-controls");
    for (const tab of EHR_FORMAT_TABS) {
      applyEhrFormatTab(doc as unknown as EhrFormatDocument, tab as EhrFormatTab);
      expect(controls?.hasAttribute("hidden")).toBe(tab !== "simplified");
    }
  });
});