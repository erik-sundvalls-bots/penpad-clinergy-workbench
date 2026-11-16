import "./style.css";
import handUrl from "../data/Mus_hand.png";
import {
  conceptLabel,
  knowledge,
  painForm,
  swellingForm,
  swedish,
} from "./knowledge.ts";
import {
  demoState,
  emptyState,
  findingsFromState,
  selectedConceptKeys,
  toggleChoice,
  toggleSide,
  type ExamSide,
  type FindingForm,
  type WorkbenchState,
} from "./model.ts";
import { buildThumbEncounter } from "./openehr/compose.ts";
import { validateComposition } from "./openehr/validate.ts";
import { term } from "./openehr/terms.ts";
import optUrl from "../templates/thumb-pain.opt?url";
import optPlainUrl from "../templates/thumb-pain-encounter.v2.opt?url";
import webTemplateUrl from "../templates/thumb-pain-encounter.v2.web-template.json?url";
import { render, renderReport, type Finding } from "../vendor/sentence.ts";

const FEATURE_LABEL: Record<string, string> = {
  laterality: "Laterality",
  sublocation: "Sublocation",
  QuantityDuration: "Duration",
  AbsolutePainDescriptor: "Character",
  AbsoluteSeverity: "Severity",
  AbsoluteFrequency: "Frequency",
  AbsoluteOnset: "Onset",
  AbsoluteProgress: "Progress",
  AbsoluteProcessPattern: "Pattern",
  AbsoluteConsistency: "Consistency",
  AbsoluteTexture: "Texture",
};

const UNITS: Array<[string, string]> = [
  ["second", "seconds"],
  ["minute", "minutes"],
  ["hour", "hours"],
  ["day", "days"],
  ["week", "weeks"],
  ["month", "months"],
  ["year", "years"],
];

const SUMMARY_WORDS: Record<string, string> = {
  presence: "present",
  absence: "absent",
  possible: "possible",
  excluded: "excluded",
};

const GALEN_BROWSER = "https://erik-sundvalls-bots.github.io/opengalen-browser/#concept=";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("missing #app");
const root: HTMLElement = app;

let state = emptyState();
let flatMode = false;

root.innerHTML = page();
wire();
paint();

function page(): string {
  return `
  <div class="wrap">
    <header class="mast">
      <h1>PEN&amp;PAD + Clinergy experimental workbench</h1>
      <p>Fill the thumb pain form the way the 1998 Clinergy demo did. Summary sentences, OpenGALEN bindings and openEHR output update as you click. Nothing is installed and nothing is saved on a server.</p>
    </header>
    <div class="layout">
      <section class="window" aria-label="Thumb pain form">
        <div class="titlebar"><span>Clinergy GP</span><span>experimental</span></div>
        <p class="patient">No 13459. Mr John Parsons — demo patient from the public walkthrough</p>
        <div class="tabs">
          <button type="button" class="tab" aria-selected="false" disabled>Topics</button>
          <button type="button" class="tab" aria-selected="true">Thumb pain</button>
        </div>
        <div class="form-grid">
          <div>
            ${descriptors(painForm.firstLayer, painForm.moreLayer)}
            ${associated()}
            ${historyAndExam()}
            ${diagnoses()}
            <h2 class="side-label">Comment</h2>
            <textarea class="comment-box" aria-label="Comment" placeholder="Not part of the generated sentence"></textarea>
          </div>
        </div>
        <div class="actions">
          <button type="button" id="load-demo">Load the 1998 demo</button>
          <button type="button" id="reset">Reset</button>
          <button type="button" id="copy-summary">Copy English summary</button>
        </div>
      </section>
      <aside>
        <section class="panel">
          <h2>Summary</h2>
          <p id="summary-en" class="sv-sentence" aria-live="polite">Thumb pain</p>
        </section>
        <section class="panel">
          <h2>Svenska (Swedish)</h2>
          <p id="summary-sv" class="sv-sentence" lang="sv" aria-live="polite"></p>
          <p id="sv-missing" class="missing"></p>
        </section>
        <section class="panel">
          <h2>OpenGALEN</h2>
          <p class="note">Reviewed bindings for the values you have selected. Unverified means the code was not confirmed and is not written into the composition.</p>
          <div id="galen"></div>
        </section>
        <section class="panel">
          <h2>openEHR</h2>
          <div class="downloads">
            <a href="${optUrl}" download="thumb-pain-encounter.v2-coded.opt">Thumb pain OPT</a>
            <a href="${optPlainUrl}" download="thumb-pain-encounter.v2.opt">Uncoded OPT</a>
            <a href="${webTemplateUrl}" download="thumb-pain-encounter.v2.web-template.json">Web template</a>
          </div>
          <div class="tabs-mini">
            <button type="button" id="tab-canonical" aria-pressed="true">Canonical JSON</button>
            <button type="button" id="tab-flat" aria-pressed="false">FLAT</button>
            <button type="button" id="copy-ehr">Copy</button>
          </div>
          <p id="ehr-badge" class="note"></p>
          <pre id="ehr" class="json"></pre>
          <p id="ehr-errors" class="missing"></p>
        </section>
        <section class="panel" id="exam-note">
          <h2>On Examination</h2>
          <p class="note">The 1998 summary put examination findings in their own block. This generator does not render that block. Selected examination values are listed here as data.</p>
          <div id="exam-list"></div>
        </section>
      </aside>
    </div>
    ${about()}
    ${swellingDialog()}
    ${examDialog()}
  </div>`;
}

function descriptors(first: { feature?: string; values: unknown[]; multiple?: boolean }[], more: typeof first): string {
  const rows = first.map((row) => featureRow("pain", row)).join("");
  const moreRows = more.map((row) => featureRow("pain", row)).join("");
  return `<fieldset class="group">
    <h2>Descriptors</h2>
    <div class="hand"><img src="${handUrl}" alt="Line drawing of a hand, palm up, thumb on the left" /><span>Location: thumb</span></div>
    <div class="field">
      <span class="field-name">Thumb pain</span>
      <button type="button" class="choice" data-group="pain" data-feature="summary" data-value="presence" aria-pressed="false">present</button>
      <button type="button" class="choice" data-group="pain" data-feature="summary" data-value="absence" aria-pressed="false">absent</button>
      <span class="note" id="pain-answer">Not answered</span>
    </div>
    ${rows}
    <button type="button" class="choice" id="pain-more" aria-expanded="false">more &gt;&gt;</button>
    <div id="pain-more-layer" hidden>${moreRows}</div>
  </fieldset>`;
}

function featureRow(group: "pain" | "swelling", row: { feature?: string; values: unknown[]; multiple?: boolean }): string {
  if (!row.feature) return "";
  const feature = row.feature;
  const label = FEATURE_LABEL[feature] ?? feature;
  const lat = feature === "laterality" ? " lat" : "";
  if (feature === "QuantityDuration") {
    return `<div class="field"><span class="field-name">${label}</span><span class="duration">
      <button type="button" class="spin" data-spin="${group}" data-dir="-1" aria-label="Decrease duration">◂</button>
      <input id="${group}-duration" inputmode="numeric" aria-label="${label}" data-duration="${group}" />
      <button type="button" class="spin" data-spin="${group}" data-dir="1" aria-label="Increase duration">▸</button>
      <select class="unit" data-unit="${group}" aria-label="Duration unit">${
      UNITS.map(([key, word]) => `<option value="${key}">${word}</option>`).join("")
    }</select>
    </span></div>`;
  }
  const values = (row.values ?? []).filter((value): value is string => typeof value === "string");
  const buttons = values.map((value) =>
    `<button type="button" class="choice" data-group="${group}" data-feature="${escapeAttr(feature)}" data-value="${
      escapeAttr(value)
    }" data-multiple="${row.multiple ? "true" : "false"}" aria-pressed="false">${escapeText(buttonLabel(value))}</button>`
  ).join("");
  return `<div class="field"><span class="field-name${lat}">${escapeText(label)}</span>${buttons}</div>`;
}

function associated(): string {
  return `<fieldset class="group">
    <h2>Associated symptoms</h2>
    <div class="field">
      <span class="field-name">Thumb swelling</span>
      <button type="button" class="choice" data-group="swelling" data-feature="summary" data-value="absence" aria-pressed="false">absent</button>
      <button type="button" class="choice" data-group="swelling" data-feature="summary" data-value="presence" aria-pressed="false">present</button>
      <button type="button" class="choice" id="open-swelling">more…</button>
      <span class="note" id="swelling-answer">Not answered</span>
    </div>
  </fieldset>`;
}

function historyAndExam(): string {
  return `<fieldset class="group">
    <h2>Examinations</h2>
    <div class="field"><span class="field-name">Left thumb</span>
      ${examStatusButtons("left")}
      <button type="button" class="choice" data-exam-open="left">more…</button>
    </div>
    <div class="field"><span class="field-name">Right thumb</span>
      ${examStatusButtons("right")}
      <button type="button" class="choice" data-exam-open="right">more…</button>
    </div>
    <p class="note">Further history (FH, PMH, SH) is on the 1998 form and is not in this extract.</p>
  </fieldset>`;
}

function examStatusButtons(side: "left" | "right"): string {
  return ["normal", "not examined"].map((word) =>
    `<button type="button" class="choice" data-group="exam" data-side="${side}" data-feature="status" data-value="${
      word === "not examined" ? "notExamined" : "normal"
    }" aria-pressed="false">${word}</button>`
  ).join("");
}

function diagnoses(): string {
  const rows = painForm.diagnoses.map((link) => {
    const label = link.item.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    const buttons = ["presence", "possible", "excluded"].map((value) =>
      `<button type="button" class="choice" data-group="diagnosis" data-item="${escapeAttr(link.item)}" data-value="${value}" aria-pressed="false">${
        SUMMARY_WORDS[value]
      }</button>`
    ).join("");
    return `<div class="field"><span class="field-name">${escapeText(label)}</span>${buttons}</div>`;
  }).join("");
  return `<fieldset class="group"><h2>Diagnoses</h2>${rows}</fieldset>`;
}

function swellingDialog(): string {
  const layers = [...swellingForm.firstLayer, ...swellingForm.moreLayer];
  const rows = layers.map((row) => featureRow("swelling", row)).join("");
  const consequences = [
    ["ConseqPain", "Pain"],
    ["ConseqTendernessSign", "Tenderness"],
    ["ConseqErythemaSign", "Erythema"],
  ].map(([key, label]) => `<div class="field"><span class="field-name">${label}</span>
      <button type="button" class="choice" data-group="consequence" data-feature="${key}" data-value="absence" aria-pressed="false">absent</button>
      <button type="button" class="choice" data-group="consequence" data-feature="${key}" data-value="presence" aria-pressed="false">present</button>
    </div>`).join("");
  return `<dialog id="swelling-dialog" aria-label="More on thumb swelling">
    <header><span>More on Thumb swelling</span><button type="button" id="swelling-cancel" class="ghost">Close</button></header>
    <div class="body">
      <fieldset class="group">
        <h2>Thumb swelling</h2>
        <div class="field">
          <button type="button" class="choice" data-group="swelling" data-feature="summary" data-value="absence" aria-pressed="false">absent</button>
          <button type="button" class="choice" data-group="swelling" data-feature="summary" data-value="presence" aria-pressed="false">present</button>
        </div>
        ${rows}
      </fieldset>
      <fieldset class="group">
        <h2>Also on this form</h2>
        ${consequences}
        <div class="field"><span class="field-name">Joint stiffness</span>
          <button type="button" class="choice" data-group="stiffness" data-value="absence" aria-pressed="false">absent</button>
          <button type="button" class="choice" data-group="stiffness" data-value="presence" aria-pressed="false">present</button>
        </div>
        <p class="note">Pain, tenderness and erythema are criterial links. The sentence generator does not turn them into summary prose (the rule token descAdverb is not handled). Joint stiffness is a separate finding and does get a sentence.</p>
      </fieldset>
    </div>
    <div class="actions">
      <button type="button" id="swelling-accept">Accept</button>
      <button type="button" id="swelling-reset">Reset swelling</button>
    </div>
  </dialog>`;
}

function examDialog(): string {
  const ranges = ["full", "reduced", "limited", "minimal"].map((value) =>
    `<button type="button" class="choice" data-group="exam-detail" data-feature="RANGE" data-value="${value}" aria-pressed="false">${value}</button>`
  ).join("");
  const pains = ["absence", "mild", "moderate", "severe"].map((value) =>
    `<button type="button" class="choice" data-group="exam-detail" data-feature="PAIN" data-value="${value}" aria-pressed="false">${
      value === "absence" ? "absent" : value
    }</button>`
  ).join("");
  const movements = ["flexion", "extension", "abduction", "adduction"].map((name) =>
    `<div class="field"><span class="field-name">${name}</span>
      <span class="note">Range</span> ${ranges.replaceAll("RANGE", `${name}Range`)}
      <span class="note">Pain on movement</span> ${pains.replaceAll("PAIN", `${name}Pain`)}
    </div>`
  ).join("");
  return `<dialog id="exam-dialog" aria-label="More on thumb examination">
    <header><span id="exam-title">More on thumb</span><button type="button" id="exam-close" class="ghost">Close</button></header>
    <div class="body">
      <fieldset class="group">
        <h2>Thumb</h2>
        <div class="field" id="exam-status-slot"></div>
        <div class="field"><span class="field-name">Tenderness</span>
          <button type="button" class="choice" data-group="exam-detail" data-feature="tenderness" data-value="absence" aria-pressed="false">absent</button>
          <button type="button" class="choice" data-group="exam-detail" data-feature="tenderness" data-value="presence" aria-pressed="false">present</button>
        </div>
      </fieldset>
      <fieldset class="group">
        <h2>Thumb joint</h2>
        ${movements}
        <p class="note">These movement rows are the ones in the 1998 demo. They are stored here and listed under On Examination. They are not passed through the summary-sentence generator.</p>
      </fieldset>
    </div>
  </dialog>`;
}

function about(): string {
  return `<section class="about" id="about">
    <h2>About</h2>
    <p>This is an experimental workbench for hackathon participants. It is part of the <a href="https://pen-pad-revival.github.io">PEN&amp;PAD revival</a>. The form follows the 1998 Clinergy thumb pain demo, screen by screen, as written up at <a href="https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/">the public walkthrough</a>. The sentence generator is vendored from <a href="https://github.com/erik-sundvalls-bots/clinergy-extractor">clinergy-extractor</a> main. The openEHR encounter is built in this page and checked with <a href="https://github.com/ErikSundvall/ehrtslib">ehrtslib</a>.</p>
    <p>Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. Only a small extract (the thumb pain, swelling, sign and diagnosis forms, the sentence rules those forms need, and the terminology bindings) is included, and only for demonstration.</p>
    <p>OpenGALEN names link to the <a href="https://erik-sundvalls-bots.github.io/opengalen-browser/">OpenGALEN browser</a> (<code>#concept=Name</code>). SNOMED CT codes link to the public browser. Swedish wording is ours and has not had a native-speaker review. The English summary is the only narrative stored in the composition.</p>
  </section>`;
}

function wire(): void {
  root.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("button");
    if (!button) return;
    if (button.id === "load-demo") {
      state = demoState();
      paint();
      return;
    }
    if (button.id === "reset") {
      state = emptyState();
      paint();
      return;
    }
    if (button.id === "copy-summary") {
      void navigator.clipboard?.writeText(englishText());
      return;
    }
    if (button.id === "pain-more") {
      state.painMore = !state.painMore;
      paint();
      return;
    }
    if (button.id === "open-swelling" || button.id === "swelling-accept" || button.id === "swelling-cancel") {
      const dialog = document.querySelector<HTMLDialogElement>("#swelling-dialog");
      if (button.id === "open-swelling") dialog?.showModal();
      else dialog?.close();
      if (button.id === "swelling-accept" || button.id === "swelling-cancel") paint();
      return;
    }
    if (button.id === "swelling-reset") {
      state.swelling = emptyState().swelling;
      state.consequences = {};
      state.stiffness = null;
      paint();
      return;
    }
    if (button.dataset.examOpen) {
      state.examOpen = button.dataset.examOpen === "right" ? "right" : "left";
      document.querySelector<HTMLDialogElement>("#exam-dialog")?.showModal();
      paint();
      return;
    }
    if (button.id === "exam-close") {
      state.examOpen = null;
      document.querySelector<HTMLDialogElement>("#exam-dialog")?.close();
      return;
    }
    if (button.id === "tab-canonical") {
      flatMode = false;
      paint();
      return;
    }
    if (button.id === "tab-flat") {
      flatMode = true;
      paint();
      return;
    }
    if (button.id === "copy-ehr") {
      void navigator.clipboard?.writeText(document.querySelector("#ehr")?.textContent ?? "");
      return;
    }
    if (button.dataset.spin && button.dataset.dir) {
      const group = button.dataset.spin === "swelling" ? state.swelling : state.pain;
      const next = (group.durationNumber ?? 0) + Number(button.dataset.dir);
      group.durationNumber = Math.max(0, next);
      if (group.durationNumber === 0) group.durationNumber = null;
      paint();
      return;
    }
    if (button.dataset.group === "pain" || button.dataset.group === "swelling") {
      const form = button.dataset.group === "pain" ? state.pain : state.swelling;
      applyFormClick(form, button);
      paint();
      return;
    }
    if (button.dataset.group === "diagnosis" && button.dataset.item && button.dataset.value) {
      state.diagnoses[button.dataset.item] = toggleChoice(state.diagnoses[button.dataset.item] ?? null, button.dataset.value);
      paint();
      return;
    }
    if (button.dataset.group === "stiffness" && button.dataset.value) {
      state.stiffness = toggleChoice(state.stiffness, button.dataset.value);
      paint();
      return;
    }
    if (button.dataset.group === "consequence" && button.dataset.feature && button.dataset.value) {
      state.consequences[button.dataset.feature] = toggleChoice(
        state.consequences[button.dataset.feature] ?? null,
        button.dataset.value,
      );
      paint();
      return;
    }
    if (button.dataset.group === "exam" && button.dataset.side && button.dataset.value) {
      const side = examSide(button.dataset.side);
      side.status = toggleChoice(side.status, button.dataset.value);
      paint();
      return;
    }
    if (button.dataset.group === "exam-detail" && button.dataset.feature && button.dataset.value && state.examOpen) {
      const side = state.exam[state.examOpen];
      const feature = button.dataset.feature as keyof ExamSide;
      if (feature in side) side[feature] = toggleChoice(side[feature], button.dataset.value);
      paint();
    }
  });

  root.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.dataset.duration) return;
    const form = target.dataset.duration === "swelling" ? state.swelling : state.pain;
    const parsed = Number(target.value);
    form.durationNumber = target.value.trim() === "" || !Number.isFinite(parsed) ? null : Math.max(0, Math.floor(parsed));
    if (form.durationNumber === 0) form.durationNumber = null;
    paintOutputs();
  });
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) || !target.dataset.unit) return;
    const form = target.dataset.unit === "swelling" ? state.swelling : state.pain;
    form.durationUnit = target.value;
    paintOutputs();
  });
}

function applyFormClick(form: FindingForm, button: HTMLButtonElement): void {
  const feature = button.dataset.feature ?? "";
  const value = button.dataset.value ?? "";
  if (feature === "summary") {
    form.summary = toggleChoice(form.summary, value);
    return;
  }
  if (feature === "laterality") {
    const side = value === "rightSelection" ? "right" : "left";
    form.laterality = toggleSide(form.laterality, side);
    return;
  }
  if (feature === "sublocation") {
    form.sublocation = toggleChoice(form.sublocation, value);
    return;
  }
  form.choices[feature] = toggleChoice(form.choices[feature] ?? null, value);
}

function examSide(name: string): ExamSide {
  return name === "right" ? state.exam.right : state.exam.left;
}

function paint(): void {
  const more = document.querySelector<HTMLElement>("#pain-more-layer");
  const moreButton = document.querySelector<HTMLButtonElement>("#pain-more");
  if (more) more.hidden = !state.painMore;
  if (moreButton) moreButton.setAttribute("aria-expanded", state.painMore ? "true" : "false");
  paintPressed();
  paintDurations();
  paintOutputs();
}

function paintPressed(): void {
  document.querySelectorAll<HTMLButtonElement>(".choice[data-group]").forEach((button) => {
    button.setAttribute("aria-pressed", pressed(button) ? "true" : "false");
  });
  const title = document.querySelector("#exam-title");
  if (title && state.examOpen) title.textContent = `More on ${state.examOpen === "left" ? "Left" : "Right"} thumb`;
}

function pressed(button: HTMLButtonElement): boolean {
  const group = button.dataset.group;
  const feature = button.dataset.feature ?? "";
  const value = button.dataset.value ?? "";
  if (group === "pain" || group === "swelling") {
    const form = group === "pain" ? state.pain : state.swelling;
    if (feature === "summary") return form.summary === value;
    if (feature === "laterality") {
      const side = value === "rightSelection" ? "right" : "left";
      return form.laterality.includes(side);
    }
    if (feature === "sublocation") return form.sublocation === value;
    return form.choices[feature] === value;
  }
  if (group === "diagnosis") return state.diagnoses[button.dataset.item ?? ""] === value;
  if (group === "stiffness") return state.stiffness === value;
  if (group === "consequence") return state.consequences[feature] === value;
  if (group === "exam") return examSide(button.dataset.side ?? "").status === value;
  if (group === "exam-detail" && state.examOpen) {
    const side = state.exam[state.examOpen];
    const key = feature as keyof ExamSide;
    return key in side && side[key] === value;
  }
  return false;
}

function paintDurations(): void {
  for (const group of ["pain", "swelling"] as const) {
    const form = group === "pain" ? state.pain : state.swelling;
    const input = document.querySelector<HTMLInputElement>(`#${group}-duration`);
    if (input && document.activeElement !== input) input.value = form.durationNumber == null ? "" : String(form.durationNumber);
    const unit = document.querySelector<HTMLSelectElement>(`select[data-unit="${group}"]`);
    if (unit) unit.value = form.durationUnit;
  }
}

function paintOutputs(): void {
  swedish.missing.length = 0;
  const findings = currentFindings();
  const english = findings.map((finding) => render(finding, knowledge));
  const swedishLines = findings.map((finding) => renderReport(finding, knowledge, swedish));
  const enBox = document.querySelector("#summary-en");
  const svBox = document.querySelector("#summary-sv");
  if (enBox) enBox.textContent = english.join("\n");
  if (svBox) svBox.textContent = swedishLines.map((line) => line.sentence).join("\n");
  const missing = [...new Set(swedishLines.flatMap((line) => line.missing))];
  const missingEl = document.querySelector("#sv-missing");
  if (missingEl) {
    missingEl.textContent = missing.length ? `Swedish pack has no word for: ${missing.join(", ")}` : "";
  }
  const swellingAnswer = document.querySelector("#swelling-answer");
  if (swellingAnswer) {
    swellingAnswer.textContent = state.swelling.summary === "presence"
      ? "Answered: present"
      : state.swelling.summary === "absence"
      ? "Answered: absent"
      : "Not answered";
  }
  const painAnswer = document.querySelector("#pain-answer");
  if (painAnswer) {
    painAnswer.textContent = state.pain.summary === "presence"
      ? "Answered: present"
      : state.pain.summary === "absence"
      ? "Answered: absent"
      : "Not answered";
  }
  paintGalen(findings);
  paintEhr(findings, english);
  paintExam();
}

function currentFindings(): Finding[] {
  return findingsFromState(state, painForm.diagnoses);
}

function englishText(): string {
  return currentFindings().map((finding) => render(finding, knowledge)).join("\n");
}

function paintGalen(findings: Finding[]): void {
  const host = document.querySelector("#galen");
  if (!host) return;
  const keys = selectedConceptKeys(findings);
  if (!keys.length) {
    host.innerHTML = "<p class='note'>Select a value to see its bindings.</p>";
    return;
  }
  const rows = keys.map((key) => {
    const row = term(key);
    const og = row?.opengalen.verified && row.opengalen.name
      ? `<a href="${GALEN_BROWSER}${encodeURIComponent(row.opengalen.name)}">${escapeText(row.opengalen.name)}</a>`
      : "unverified";
    const snomed = row?.snomed.verified && row.snomed.code
      ? `<a href="https://browser.ihtsdotools.org/?perspective=full&conceptId1=${row.snomed.code}&edition=MAIN">${escapeText(row.snomed.code)}</a>`
      : "unverified";
    return `<tr><td><code>${escapeText(key)}</code></td><td>${og}</td><td>${snomed}</td></tr>`;
  }).join("");
  host.innerHTML = `<table class="bindings"><thead><tr><th>Clinergy</th><th>OpenGALEN</th><th>SNOMED CT</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function paintEhr(_findings: Finding[], english: string[]): void {
  const result = buildThumbEncounter(state, english.join("\n"));
  const checked = validateComposition(result.canonical, result.flat);
  const pre = document.querySelector("#ehr");
  if (pre) {
    pre.textContent = flatMode
      ? Object.entries(result.flat).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}: ${value}`).join("\n")
      : JSON.stringify(result.canonical, null, 2);
  }
  document.querySelector("#tab-canonical")?.setAttribute("aria-pressed", flatMode ? "false" : "true");
  document.querySelector("#tab-flat")?.setAttribute("aria-pressed", flatMode ? "true" : "false");
  const badge = document.querySelector("#ehr-badge");
  if (badge) {
    badge.textContent = checked.valid
      ? `ehrtslib: valid (${checked.warnings.length} warnings)`
      : `ehrtslib: invalid (${checked.errors.length} errors)`;
  }
  const errors = document.querySelector("#ehr-errors");
  if (errors) {
    const lines = checked.errors.concat(checked.warnings).map((issue) => `${issue.severity}: ${issue.path} — ${issue.message}`);
    errors.textContent = lines.join("\n");
  }
}

function paintExam(): void {
  const host = document.querySelector("#exam-list");
  if (!host) return;
  const lines: string[] = [];
  for (const side of ["left", "right"] as const) {
    const exam = state.exam[side];
    const bits = Object.entries(exam).filter(([, value]) => value).map(([key, value]) => `${key} ${value}`);
    if (bits.length) lines.push(`${side} thumb: ${bits.join(", ")}`);
  }
  host.innerHTML = lines.length ? `<ul>${lines.map((line) => `<li>${escapeText(line)}</li>`).join("")}</ul>` : "<p class='note'>Nothing selected.</p>";
}

function buttonLabel(value: string): string {
  if (value === "leftSelection") return "left";
  if (value === "rightSelection") return "right";
  return conceptLabel(value);
}

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function escapeAttr(value: string): string {
  return escapeText(value);
}
