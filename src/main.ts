import "./style.css";
import handUrl from "../data/Mus_hand.png";
import { onExamination } from "./exam/prose.ts";
import { buildFhirBundle } from "./fhir/bundle.ts";
import { validateFhirBundle } from "./fhir/validate.ts";
import { formOf } from "./forms/catalog.ts";
import {
  choiceButtonLabel,
  diagnosisRowLabel,
  diseaseFormHeading,
  durationUnitKeys,
  durationUnitLabel,
  featureLabel,
  skipFeatureRow,
  uiString,
  type UiLang,
} from "./form-labels.ts";
import { syncDiseaseFormAnswers, visibleDiseaseDetailTopics } from "./visit-forms.ts";
import {
  conceptLabel,
  knowledge,
  painForm,
  swellingForm,
  swedish,
} from "./knowledge.ts";
import {
  demoState,
  emptyFinding,
  emptyState,
  findingsFromState,
  gpVisitState,
  selectedConceptKeys,
  toggleChoice,
  toggleSide,
  type ExamSide,
  type FindingForm,
  type WorkbenchState,
} from "./model.ts";
import { buildVisit } from "./openehr/compose.ts";
import {
  applyEhrFormatTab,
  downloadBasenameForTab,
  type EhrFormatTab,
} from "./openehr/ehr-format-tabs.ts";
import type { CdrProfile, SimplifiedViewFlavour } from "./openehr/view-types.ts";
import { validateComposition } from "./openehr/validate.ts";
import {
  ZIP_CSS_SELECT_OPTIONS,
  ZIP_EHR_HTML5_VARIANT,
  ZIP_VARIANT_OPTIONS,
  buildQuietZipehrPreviewDocument,
  canonicalToZipehr,
  composeQuietStructureCss,
  isZipehrMarkupVariant,
  resolveZipehrCssFile,
  zipehrDownloadBasename,
  zipehrDownloadMime,
  ZIP_DEFAULT_CSS,
  ZIP_QUIET_CSS,
  zipehrTextStats,
  type ZipehrVariant,
} from "./openehr/zipehr.ts";
import { languageFromCanonical } from "./openehr/zipehr-template.ts";
import { term } from "./openehr/terms.ts";
import gpOptUrl from "../templates/gp-encounter.opt?url";
import { buildQuestionnaireExport } from "./fhir/questionnaire.ts";
import { buildSymptomExport } from "./fhir/symptoms.ts";
import { validateQuestionnaire, validateQuestionnaireResponse, validateSymptomExport } from "./fhir/validate.ts";
import optUrl from "../templates/thumb-pain.opt?url";
import optPlainUrl from "../templates/thumb-pain-encounter.v2.opt?url";
import { renderSwedishGp } from "./sv/gp-sentence.ts";
import { expressionsFor, UNMAPPED_INFO } from "./snomed/expressions.ts";
import { render, type Finding } from "../vendor/sentence.ts";
import { examMoreFilled, painMoreLayerFilled, swellingMoreFilled } from "./form-fill.ts";
import { historyNarrativeText, summaryLines } from "./summary.ts";

const GALEN_BROWSER = "https://erik-sundvalls-bots.github.io/opengalen-browser/#concept=";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("missing #app");
const root: HTMLElement = app;

let state = emptyState();
let uiLang: UiLang = "en";
let ehrFormatTab: EhrFormatTab = "zipehr";
let simplifiedCdrProfile: CdrProfile = "better";
let simplifiedFlavour: SimplifiedViewFlavour = "structured";
let zipehrVariant: ZipehrVariant = ZIP_EHR_HTML5_VARIANT;
let zipehrViewMode: "code" | "document" = "document";
let zipehrStylesheet: string = ZIP_QUIET_CSS;
let cachedCanonicalJson = "";
let cachedXml = "";
let cachedSimplified = "";
let cachedZipehrHtml = "";
let cachedZipehrCss = "";
let cachedZipehrRenderLang: "en" | "sv" = "en";
let canonicalForSimplified: Record<string, unknown> | null = null;
let cachedSnomedExpressions: string[] = [];
let fhirTab: "bundle" | "questionnaire" | "response" | "symptoms" = "bundle";
let fhirJson = "";
let fhirCanonical: Record<string, unknown> | null = null;
let fhirNarrative = "";
root.innerHTML = page();
wire();
paint();

function page(): string {
  return `
  <div class="wrap">
    <header class="mast">
      <h1>PEN&amp;PAD + Clinergy experimental workbench</h1>
      <p>Fill a Clinergy general-practice visit: thumb pain, swelling and examination are always here; use Diagnoses (present/possible) to open sprain or fracture detail. Summary sentences, On Examination, OpenGALEN bindings, SNOMED CT expressions, openEHR and FHIR update as you click. Nothing is installed and nothing is saved on a server.</p>
    </header>
    <div class="layout">
      <section class="window" aria-label="Thumb pain form">
        <div class="titlebar"><span>Clinergy GP</span><span>experimental</span></div>
        <p class="patient">No 13459. Mr John Parsons — demo patient from the public walkthrough</p>
        <div class="form-grid">
          <div>
            ${descriptors(painForm.firstLayer, painForm.moreLayer)}
            ${associated()}
            ${historyAndExam()}
            ${diagnoses()}
            <div id="disease-details"></div>
            <h2 class="side-label" id="comment-heading">Comment</h2>
            <textarea id="comment" class="comment-box" aria-label="Comment" placeholder="Free-text comment"></textarea>
          </div>
        </div>
        <div class="actions">
          <button type="button" id="load-demo">Load the 1998 demo</button>
          <button type="button" id="load-gp">Load a GP visit</button>
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
          <label class="ui-lang-toggle"><input type="checkbox" id="ui-sv-labels" /> Swedish form labels</label>
        </section>
        <section class="panel" id="openehr-panel">
          <h2>openEHR</h2>
          <div class="downloads">
            <a href="${optUrl}" download="thumb-pain-encounter.v2-coded.opt">Thumb encounter OPT</a>
            <a href="${gpOptUrl}" download="gp-encounter.v1.opt">GP encounter OPT</a>
            <a href="${optPlainUrl}" download="thumb-pain-encounter.v2.opt">Uncoded OPT</a>
          </div>
          <div class="ehr-format-tabs" role="tablist" aria-label="openEHR representation">
            <button type="button" class="ehr-format-tab" data-ehr-format="canonical" role="tab" aria-selected="false">Canonical JSON</button>
            <button type="button" class="ehr-format-tab" data-ehr-format="xml" role="tab" aria-selected="false">Canonical XML</button>
            <button type="button" class="ehr-format-tab" data-ehr-format="simplified" role="tab" aria-selected="false">Simplified</button>
            <button type="button" class="ehr-format-tab active" data-ehr-format="zipehr" role="tab" aria-selected="true">ZipEHR</button>
          </div>
          <div id="ehr-canonical-pane" hidden>
            <div class="tabs-mini">
              <button type="button" id="copy-ehr">Copy</button>
              <button type="button" id="download-ehr">Download</button>
              <span id="ehr-canonical-stats" class="output-stats"></span>
            </div>
            <pre id="ehr" class="json"></pre>
          </div>
          <div id="ehr-xml-pane" hidden>
            <div class="tabs-mini">
              <button type="button" id="copy-ehr-xml">Copy</button>
              <button type="button" id="download-ehr-xml">Download</button>
              <span id="ehr-xml-stats" class="output-stats"></span>
            </div>
            <pre id="ehr-xml" class="json xml-output"></pre>
          </div>
          <div id="ehr-simplified-pane" hidden>
            <div id="ehr-simplified-controls" class="ehr-simplified-controls" hidden>
              <label class="ehr-simplified-label" for="ehr-cdr-profile">CDR dialect:</label>
              <select id="ehr-cdr-profile" class="ehr-simplified-select" aria-label="CDR vendor dialect for simplified view">
                <option value="better">Better</option>
                <option value="ehrbase">EHRbase</option>
                <option value="ferroehr">FerroEHR</option>
              </select>
              <span class="ehr-simplified-label">Format:</span>
              <button type="button" class="ehr-simplified-flavour active" data-simplified-flavour="structured" aria-pressed="true">Structured</button>
              <button type="button" class="ehr-simplified-flavour" data-simplified-flavour="flat" aria-pressed="false">Flat</button>
              <p class="note ehr-simplified-note">View and export only — CDR posting uses Canonical JSON.</p>
            </div>
            <div class="tabs-mini">
              <button type="button" id="copy-ehr-simplified">Copy</button>
              <button type="button" id="download-ehr-simplified">Download</button>
              <span id="ehr-simplified-stats" class="output-stats"></span>
            </div>
            <pre id="ehr-simplified" class="json"></pre>
          </div>
          <div id="ehr-zipehr-pane">
            <div class="tabs-mini zipehr-toolbar">
              <label class="zipehr-field-label" for="zipehr-variant">ZipEHR variant:</label>
              <select id="zipehr-variant" class="zipehr-variant-select" aria-label="ZipEHR variant">
                ${ZIP_VARIANT_OPTIONS.map(
                  (opt) =>
                    `<option value="${escapeAttr(opt.value)}"${opt.value === zipehrVariant ? " selected" : ""}>${escapeText(opt.label)}</option>`,
                ).join("")}
              </select>
              <label class="zipehr-css-label" for="zipehr-css-select">Stylesheet:</label>
              <select id="zipehr-css-select" class="zipehr-css-select" aria-label="ZipEHR stylesheet">
                ${ZIP_CSS_SELECT_OPTIONS.map(
                  (opt) =>
                    `<option value="${escapeAttr(opt.value)}"${opt.value === zipehrStylesheet ? " selected" : ""}>${escapeText(opt.label)}</option>`,
                ).join("")}
              </select>
              <div id="zipehr-view-tabs" class="output-view-tabs output-view-tabs--inline" role="tablist" aria-label="ZipEHR view">
                <button type="button" class="output-view-tab" data-zipehr-view="code" role="tab" aria-selected="false" aria-label="Code view">
                  <svg class="output-view-tab-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="m4.72 12.53 2.52-3.58L4.72 5.47a.75.75 0 0 1 1.06-1.06l3.12 3.18a.75.75 0 0 1 0 1.06l-3.12 3.18a.75.75 0 0 1-1.06-1.06Zm6.56-7.06a.75.75 0 0 0-1.06-1.06L7.1 7.65a.75.75 0 0 0 0 1.06l3.12 3.18a.75.75 0 1 0 1.06-1.06L8.31 8.53l2.97-3.06Z"/></svg>
                  <span>Code</span>
                </button>
                <button type="button" class="output-view-tab active" data-zipehr-view="document" role="tab" aria-selected="true" aria-label="Document view">
                  <svg class="output-view-tab-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.772.513 1.237v9.586A1.75 1.75 0 0 1 13 16H3.75A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Z"/></svg>
                  <span>Document</span>
                </button>
              </div>
              <button type="button" id="copy-zipehr">Copy</button>
              <button type="button" id="download-zipehr">Download</button>
              <span id="zipehr-stats" class="output-stats"></span>
            </div>
            <pre id="zipehr-code" class="json zipehr-code" hidden></pre>
            <iframe id="zipehr-document" class="zipehr-document" title="ZipEHR document view" sandbox="allow-same-origin"></iframe>
          </div>
          <p id="ehr-badge" class="note"></p>
          <p id="ehr-errors" class="missing"></p>
        </section>
        <section class="panel" id="fhir-panel">
          <h2>FHIR</h2>
          <p class="note">The Visit bundle is an R4 collection for the same visit; examination findings are Observations in category exam. Posting to a CDR still uses canonical openEHR JSON. The thumb-form exports are generated at runtime from the approved public thumb-pain extract: <a href="https://github.com/erik-sundvalls-bots/clinergy-extractor/issues/7">Questionnaire / QuestionnaireResponse (extractor #7)</a>, SDC-style, and <a href="https://github.com/erik-sundvalls-bots/clinergy-extractor/issues/8">Symptom Logical Model (extractor #8)</a>. Codes are only written when the mapping is verified; gaps are listed with the Symptoms export.</p>
          <div class="tabs-mini">
            <button type="button" id="tab-fhir-bundle" aria-pressed="true">Visit bundle</button>
            <button type="button" id="tab-fhir-q" aria-pressed="false">Questionnaire</button>
            <button type="button" id="tab-fhir-qr" aria-pressed="false">Response</button>
            <button type="button" id="tab-fhir-symptom" aria-pressed="false">Symptoms IG</button>
            <button type="button" id="copy-fhir">Copy</button>
            <button type="button" id="download-fhir">Download</button>
          </div>
          <p id="fhir-badge" class="note"></p>
          <pre id="fhir" class="json"></pre>
          <p id="fhir-errors" class="missing"></p>
        </section>
        <section class="panel">
          <h2>Possible Terminology system similarities</h2>
          <p class="note">Reviewed bindings for the values you have selected. Unverified means the code was not confirmed and is not written into the composition. Post-coordinated SNOMED CT expressions use the same reviewed map and update as you click. Duration has no MRCM attribute and is listed as unmapped. Nothing is sent to a terminology server.</p>
          <div id="galen"></div>
          <div id="snomed-expressions"></div>
        </section>
      </aside>
    </div>
    ${about()}
    ${swellingDialog()}
    ${examDialog()}
  </div>`;
}

function descriptors(first: { feature?: string; values: unknown[]; multiple?: boolean }[], more: typeof first): string {
  const rows = first.map((row) => featureRow("pain", row, "en")).join("");
  const moreRows = more.map((row) => featureRow("pain", row, "en")).join("");
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

function answerForm(group: string): FindingForm {
  if (group === "pain") return state.pain;
  if (group === "swelling") return state.swelling;
  if (!state.formAnswers[group]) state.formAnswers[group] = emptyFinding();
  return state.formAnswers[group];
}

function featureRow(
  group: string,
  row: { feature?: string; values: unknown[]; multiple?: boolean },
  lang: UiLang = uiLang,
): string {
  if (!row.feature || skipFeatureRow(row.feature)) return "";
  const feature = row.feature;
  const label = featureLabel(feature, lang);
  const lat = feature === "laterality" ? " lat" : "";
  if (feature === "QuantityDuration") {
    return `<div class="field"><span class="field-name">${escapeText(label)}</span><span class="duration">
      <button type="button" class="spin" data-spin="${group}" data-dir="-1" aria-label="${escapeAttr(uiString("decreaseDuration", lang))}">◂</button>
      <input id="${group}-duration" inputmode="numeric" aria-label="${escapeAttr(label)}" data-duration="${group}" />
      <button type="button" class="spin" data-spin="${group}" data-dir="1" aria-label="${escapeAttr(uiString("increaseDuration", lang))}">▸</button>
      <select class="unit" data-unit="${group}" aria-label="${escapeAttr(uiString("durationUnitAria", lang))}">${
      durationUnitKeys().map((key) =>
        `<option value="${key}">${escapeText(durationUnitLabel(key, lang))}</option>`
      ).join("")
    }</select>
    </span></div>`;
  }
  const values = (row.values ?? []).filter((value): value is string => typeof value === "string");
  const buttons = values.map((value) =>
    `<button type="button" class="choice" data-group="${group}" data-feature="${escapeAttr(feature)}" data-value="${
      escapeAttr(value)
    }" data-multiple="${row.multiple ? "true" : "false"}" aria-pressed="false">${escapeText(choiceButtonLabel(value, lang))}</button>`
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
  </fieldset>`;
}

function examStatusButtons(side: "left" | "right"): string {
  return ["normal", "not examined"].map((word) =>
    `<button type="button" class="choice" data-group="exam" data-side="${side}" data-feature="status" data-value="${
      word === "not examined" ? "notExamined" : "normal"
    }" aria-pressed="false">${word}</button>`
  ).join("");
}

function diagnosisRowsHtml(lang: UiLang = uiLang): string {
  return painForm.diagnoses.map((link) => {
    const label = diagnosisRowLabel(link, lang);
    const buttons = ["presence", "possible", "excluded"].map((value) =>
      `<button type="button" class="choice" data-group="diagnosis" data-item="${escapeAttr(link.item)}" data-value="${value}" aria-pressed="false">${
        escapeText(choiceButtonLabel(value, lang))
      }</button>`
    ).join("");
    return `<div class="field"><span class="field-name">${escapeText(label)}</span>${buttons}</div>`;
  }).join("");
}

function diagnoses(): string {
  return `<fieldset class="group"><h2 id="diagnoses-heading">Diagnoses</h2><div id="diagnosis-rows">${diagnosisRowsHtml("en")}</div></fieldset>`;
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
      </fieldset>
    </div>
  </dialog>`;
}

function about(): string {
  return `<section class="about" id="about">
    <h2>About</h2>
    <p>This is an experimental workbench for hackathon participants. It is part of the <a href="https://pen-pad-revival.github.io">PEN&amp;PAD revival</a>. The form follows the 1998 Clinergy thumb pain demo, screen by screen, as written up at <a href="https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/">the public walkthrough</a>. The sentence generator is vendored from <a href="https://github.com/erik-sundvalls-bots/clinergy-extractor">clinergy-extractor</a> main. The openEHR encounter is built in this page and checked with <a href="https://github.com/ErikSundvall/ehrtslib">ehrtslib</a>. Examination findings are a separate On Examination block, as in the 1998 summary.</p>
    <p>Clinergy content is © 1997-8 Semantic Technologies Ltd / Victoria University of Manchester. Only a small extract (the thumb pain, swelling, sign and diagnosis forms, the sentence rules those forms need, and the terminology bindings) is included, and only for demonstration.</p>
    <p>OpenGALEN names link to the <a href="https://erik-sundvalls-bots.github.io/opengalen-browser/">OpenGALEN browser</a> (<code>#concept=Name</code>). Pre-coordinated SNOMED CT codes link to the public browser. Post-coordinated expressions are built in the page from a reviewed map (clinergy-extractor PR #13); they are not sent to a terminology server, and unverified codes are listed as unmapped rather than guessed. Swedish wording is ours and has not had a native-speaker review. The English summary is the only narrative stored in the composition, and it is also the QuestionnaireResponse narrative and the Symptom Logical Model <code>symptomDescription</code>.</p>
    <p>The FHIR panel exports the whole visit as an R4 collection Bundle, a FHIR R4 Questionnaire and a live QuestionnaireResponse for the published thumb form (<a href="https://github.com/erik-sundvalls-bots/clinergy-extractor/issues/7">clinergy-extractor #7</a>), and a <a href="https://build.fhir.org/ig/HL7/fhir-symptoms-ig/en/StructureDefinition-SymptomLogicalModel.html">Symptoms IG Symptom Logical Model</a> instance for the current finding (<a href="https://github.com/erik-sundvalls-bots/clinergy-extractor/issues/8">#8</a>). Unmapped elements are listed rather than guessed. These are shape-checked in the page; they are not sent to a FHIR server.</p>
    <p>This extract omits further history (family, past medical and social history) and interventions from the full 1998 screen. Fracture time-of-occurrence is not stored in openEHR here (the published extract has no clock time). Swelling consequence toggles are criterial links only; they do not appear in generated sentences. Joint stiffness does. Examination movements follow the public walkthrough demo.</p>
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
    if (button.id === "load-gp") {
      state = gpVisitState();
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
    if (button.dataset.copySnomed != null) {
      const text = cachedSnomedExpressions[Number(button.dataset.copySnomed)] ?? "";
      if (text) void navigator.clipboard?.writeText(text);
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
    if (button.id === "copy-ehr") {
      void navigator.clipboard?.writeText(cachedCanonicalJson);
      return;
    }
    if (button.id === "download-ehr") {
      downloadTextFile(
        downloadBasenameForTab("canonical"),
        cachedCanonicalJson,
        "application/json",
      );
      return;
    }
    if (button.id === "copy-ehr-xml") {
      void navigator.clipboard?.writeText(cachedXml);
      return;
    }
    if (button.id === "download-ehr-xml") {
      downloadTextFile(downloadBasenameForTab("xml"), cachedXml, "application/xml");
      return;
    }
    if (button.id === "copy-ehr-simplified") {
      void navigator.clipboard?.writeText(cachedSimplified);
      return;
    }
    if (button.id === "download-ehr-simplified") {
      downloadTextFile(
        downloadBasenameForTab("simplified", simplifiedFlavour),
        cachedSimplified,
        "application/json",
      );
      return;
    }
    if (button.id === "copy-zipehr") {
      void navigator.clipboard?.writeText(cachedZipehrHtml);
      return;
    }
    if (button.id === "download-zipehr") {
      downloadTextFile(
        zipehrDownloadBasename(zipehrVariant),
        cachedZipehrHtml,
        zipehrDownloadMime(zipehrVariant),
      );
      return;
    }
    if (
      button.dataset.ehrFormat === "canonical" ||
      button.dataset.ehrFormat === "xml" ||
      button.dataset.ehrFormat === "simplified" ||
      button.dataset.ehrFormat === "zipehr"
    ) {
      setEhrFormatTab(button.dataset.ehrFormat);
      return;
    }
    if (button.dataset.simplifiedFlavour === "flat" || button.dataset.simplifiedFlavour === "structured") {
      setSimplifiedFlavour(button.dataset.simplifiedFlavour);
      return;
    }
    if (button.dataset.zipehrView === "code" || button.dataset.zipehrView === "document") {
      setZipehrViewMode(button.dataset.zipehrView);
      return;
    }
    if (button.id === "tab-fhir-bundle" || button.id === "tab-fhir-q" || button.id === "tab-fhir-qr" || button.id === "tab-fhir-symptom") {
      fhirTab = button.id === "tab-fhir-bundle" ? "bundle"
        : button.id === "tab-fhir-q" ? "questionnaire"
        : button.id === "tab-fhir-qr" ? "response"
        : "symptoms";
      if (fhirCanonical) paintFhir(fhirCanonical, fhirNarrative);
      return;
    }
    if (button.id === "copy-fhir") {
      void navigator.clipboard?.writeText(fhirJson);
      return;
    }
    if (button.id === "download-fhir") {
      const name = fhirTab === "bundle" ? "gp-visit.fhir.json"
        : fhirTab === "questionnaire" ? "thumb-pain-questionnaire.json"
        : fhirTab === "response" ? "thumb-pain-questionnaireresponse.json"
        : "thumb-pain-symptom-logical-model.json";
      const blob = new Blob([fhirJson], { type: "application/fhir+json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (button.dataset.spin && button.dataset.dir) {
      const group = answerForm(button.dataset.spin);
      const next = (group.durationNumber ?? 0) + Number(button.dataset.dir);
      group.durationNumber = Math.max(0, next);
      if (group.durationNumber === 0) group.durationNumber = null;
      paint();
      return;
    }
    if (button.dataset.group && button.dataset.feature) {
      const group = button.dataset.group;
      if (group === "pain" || group === "swelling" || formOf(group)) {
        applyFormClick(answerForm(group), button);
        paint();
        return;
      }
    }
    if (button.dataset.group === "diagnosis" && button.dataset.item && button.dataset.value) {
      const item = button.dataset.item;
      state.diagnoses[item] = toggleChoice(state.diagnoses[item] ?? null, button.dataset.value);
      syncDiseaseFormAnswers(state, item);
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
    if (target instanceof HTMLTextAreaElement && target.id === "comment") {
      state.comment = target.value;
      paintOutputs();
      return;
    }
    if (!(target instanceof HTMLInputElement) || !target.dataset.duration) return;
    const form = answerForm(target.dataset.duration);
    const parsed = Number(target.value);
    form.durationNumber = target.value.trim() === "" || !Number.isFinite(parsed) ? null : Math.max(0, Math.floor(parsed));
    if (form.durationNumber === 0) form.durationNumber = null;
    paintOutputs();
  });
  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLSelectElement && target.id === "zipehr-variant") {
      const value = target.value;
      if (ZIP_VARIANT_OPTIONS.some((opt) => opt.value === value)) {
        setZipehrVariant(value as ZipehrVariant);
      }
      return;
    }
    if (target instanceof HTMLSelectElement && target.id === "zipehr-css-select") {
      zipehrStylesheet = target.value;
      void refreshZipehrDocument();
      return;
    }
    if (target instanceof HTMLSelectElement && target.id === "ehr-cdr-profile") {
      const value = target.value;
      if (value === "better" || value === "ehrbase" || value === "ferroehr") {
        simplifiedCdrProfile = value;
        refreshSimplifiedOutput();
      }
      return;
    }
    if (!(target instanceof HTMLSelectElement) || !target.dataset.unit) return;
    const form = answerForm(target.dataset.unit);
    form.durationUnit = target.value;
    paintOutputs();
  });

  root.addEventListener("change", (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.id === "ui-sv-labels") {
      uiLang = target.checked ? "sv" : "en";
      paint();
    }
  });

  applyEhrFormatTab(document, ehrFormatTab);
  syncZipehrRenderableUi();
  setZipehrViewMode(zipehrViewMode);
}

function downloadTextFile(filename: string, text: string, mime: string): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function setEhrFormatTab(tab: EhrFormatTab): void {
  ehrFormatTab = tab;
  applyEhrFormatTab(document, tab);
  if (tab === "zipehr") void refreshZipehrDocument();
}

function setSimplifiedFlavour(flavour: SimplifiedViewFlavour): void {
  simplifiedFlavour = flavour;
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-simplified-flavour]")) {
    const on = button.dataset.simplifiedFlavour === flavour;
    button.classList.toggle("active", on);
    button.setAttribute("aria-pressed", on ? "true" : "false");
  }
  refreshSimplifiedOutput();
}

function refreshSimplifiedOutput(): void {
  if (!canonicalForSimplified) return;
  void (async () => {
    try {
      const { canonicalToSimplifiedJson } = await import("./openehr/serialization-views.ts");
      cachedSimplified = await canonicalToSimplifiedJson(
        canonicalForSimplified!,
        simplifiedCdrProfile,
        simplifiedFlavour,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cachedSimplified = `/* Simplified serialize failed: ${message} */`;
    }
    const pre = document.querySelector("#ehr-simplified");
    if (pre) pre.textContent = cachedSimplified;
    const stats = document.querySelector("#ehr-simplified-stats");
    if (stats) {
      const lineStats = zipehrTextStats(cachedSimplified);
      stats.textContent = `${lineStats.characters.toLocaleString()} characters · ${lineStats.lines.toLocaleString()} lines`;
    }
  })();
}

function syncZipehrRenderableUi(): void {
  const tabs = document.querySelector<HTMLElement>("#zipehr-view-tabs");
  const renderable = isZipehrMarkupVariant(zipehrVariant);
  if (tabs) tabs.hidden = !renderable;
  if (!renderable) {
    const code = document.querySelector<HTMLElement>("#zipehr-code");
    const frame = document.querySelector<HTMLElement>("#zipehr-document");
    if (code) code.hidden = false;
    if (frame) frame.hidden = true;
    return;
  }
  setZipehrViewMode(zipehrViewMode);
}

function setZipehrVariant(variant: ZipehrVariant): void {
  zipehrVariant = variant;
  syncZipehrRenderableUi();
  void refreshZipehrSerializedOutput();
}

async function refreshZipehrSerializedOutput(): Promise<void> {
  if (!canonicalForSimplified) return;
  try {
    cachedZipehrHtml = await canonicalToZipehr(canonicalForSimplified, zipehrVariant, {
      templateRenderLang: cachedZipehrRenderLang,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    cachedZipehrHtml = `<!-- ZipEHR serialize failed: ${message} -->`;
  }
  const code = document.querySelector("#zipehr-code");
  if (code) code.textContent = cachedZipehrHtml;
  const zipehrStats = document.querySelector("#zipehr-stats");
  if (zipehrStats) {
    const stats = zipehrTextStats(cachedZipehrHtml);
    zipehrStats.textContent = `${stats.characters.toLocaleString()} characters · ${stats.lines.toLocaleString()} lines`;
  }
  syncZipehrRenderableUi();
  if (ehrFormatTab === "zipehr" && isZipehrMarkupVariant(zipehrVariant)) {
    await refreshZipehrDocument();
  }
}

function setZipehrViewMode(mode: "code" | "document"): void {
  if (!isZipehrMarkupVariant(zipehrVariant)) {
    mode = "code";
  }
  zipehrViewMode = mode;
  const code = document.querySelector<HTMLElement>("#zipehr-code");
  const frame = document.querySelector<HTMLElement>("#zipehr-document");
  if (code) code.hidden = mode !== "code";
  if (frame) frame.hidden = mode !== "document";
  for (const button of document.querySelectorAll<HTMLButtonElement>("[data-zipehr-view]")) {
    const on = button.dataset.zipehrView === mode;
    button.classList.toggle("active", on);
    button.setAttribute("aria-selected", on ? "true" : "false");
  }
}

async function loadZipehrStylesheet(): Promise<string> {
  const file = resolveZipehrCssFile(zipehrStylesheet, zipehrVariant);
  if (!file) return "";
  const baseUrl = import.meta.env.BASE_URL || "/";
  const fetchCss = async (name: string) => {
    const res = await fetch(`${baseUrl}zipehr-css/${name}`);
    if (!res.ok) throw new Error(`ZipEHR stylesheet ${name}: HTTP ${res.status}`);
    return res.text();
  };
  if (file === ZIP_QUIET_CSS) {
    const [base, quiet] = await Promise.all([fetchCss(ZIP_DEFAULT_CSS), fetchCss(ZIP_QUIET_CSS)]);
    return composeQuietStructureCss(base, quiet);
  }
  return fetchCss(file);
}

async function refreshZipehrDocument(): Promise<void> {
  const frame = document.querySelector<HTMLIFrameElement>("#zipehr-document");
  if (!frame || !cachedZipehrHtml) return;
  const cssFile = resolveZipehrCssFile(zipehrStylesheet, zipehrVariant);
  const quiet = cssFile === ZIP_QUIET_CSS;
  frame.sandbox = quiet ? "allow-same-origin allow-scripts" : "allow-same-origin";
  try {
    const css = await loadZipehrStylesheet();
    cachedZipehrCss = css;
    frame.srcdoc = buildQuietZipehrPreviewDocument(cachedZipehrHtml, css, {
      quietStructureTooltips: quiet,
      templateRenderLang: cachedZipehrRenderLang,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    frame.srcdoc = buildQuietZipehrPreviewDocument(
      cachedZipehrHtml,
      `/* ${message} */\n`,
      { templateRenderLang: cachedZipehrRenderLang },
    );
  }
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

function paintDurationUnitLabels(): void {
  for (const select of document.querySelectorAll<HTMLSelectElement>("select[data-unit]")) {
    const value = select.value;
    for (const option of select.options) {
      option.textContent = durationUnitLabel(option.value, uiLang);
    }
    select.setAttribute("aria-label", uiString("durationUnitAria", uiLang));
    if (value) select.value = value;
  }
}

function paint(): void {
  const diag = document.querySelector("#diagnosis-rows");
  if (diag) diag.innerHTML = diagnosisRowsHtml(uiLang);
  const details = document.querySelector("#disease-details");
  if (details) details.innerHTML = diseaseDetails();
  const svToggle = document.querySelector<HTMLInputElement>("#ui-sv-labels");
  if (svToggle) svToggle.checked = uiLang === "sv";
  const diagHeading = document.querySelector("#diagnoses-heading");
  if (diagHeading) diagHeading.textContent = uiString("diagnosesHeading", uiLang);
  const commentHeading = document.querySelector("#comment-heading");
  if (commentHeading) commentHeading.textContent = uiString("commentAria", uiLang);
  const comment = document.querySelector<HTMLTextAreaElement>("#comment");
  if (comment) {
    comment.placeholder = uiString("commentPlaceholder", uiLang);
    comment.setAttribute("aria-label", uiString("commentAria", uiLang));
  }
  paintDurationUnitLabels();
  if (comment && document.activeElement !== comment) comment.value = state.comment;
  const more = document.querySelector<HTMLElement>("#pain-more-layer");
  const moreButton = document.querySelector<HTMLButtonElement>("#pain-more");
  if (more) more.hidden = !state.painMore;
  if (moreButton) moreButton.setAttribute("aria-expanded", state.painMore ? "true" : "false");
  if (moreButton) moreButton.setAttribute("aria-pressed", painMoreLayerFilled(state) ? "true" : "false");
  const swellingMore = document.querySelector<HTMLButtonElement>("#open-swelling");
  if (swellingMore) swellingMore.setAttribute("aria-pressed", swellingMoreFilled(state) ? "true" : "false");
  paintPressed();
  paintDurations();
  paintOutputs();
}

function paintPressed(): void {
  document.querySelectorAll<HTMLButtonElement>(".choice[data-group]").forEach((button) => {
    button.setAttribute("aria-pressed", pressed(button) ? "true" : "false");
  });
  for (const side of ["left", "right"] as const) {
    const opener = document.querySelector<HTMLButtonElement>(`[data-exam-open="${side}"]`);
    if (opener) opener.setAttribute("aria-pressed", examMoreFilled(examSide(side)) ? "true" : "false");
  }
  const title = document.querySelector("#exam-title");
  if (title && state.examOpen) title.textContent = `More on ${state.examOpen === "left" ? "Left" : "Right"} thumb`;
}

function pressed(button: HTMLButtonElement): boolean {
  const group = button.dataset.group;
  const feature = button.dataset.feature ?? "";
  const value = button.dataset.value ?? "";
  if (group === "pain" || group === "swelling" || (group && formOf(group))) {
    const form = answerForm(group);
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
  const groups = ["pain", "swelling", ...Object.keys(state.formAnswers)];
  for (const group of groups) {
    const form = answerForm(group);
    const input = document.querySelector<HTMLInputElement>(`#${group}-duration`);
    if (input && document.activeElement !== input) input.value = form.durationNumber == null ? "" : String(form.durationNumber);
    const unit = document.querySelector<HTMLSelectElement>(`select[data-unit="${group}"]`);
    if (unit) unit.value = form.durationUnit;
  }
}

function paintOutputs(): void {
  swedish.missing.length = 0;
  const findings = currentFindings();
  const english = summaryLines(findings, "en");
  const swedishLines = summaryLines(findings, "sv");
  const enBox = document.querySelector("#summary-en");
  const svBox = document.querySelector("#summary-sv");
  if (enBox) enBox.textContent = englishNote(english);
  if (svBox) svBox.textContent = swedishNote(swedishLines);
  const missing = [...swedish.missing];
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
  paintSnomed(findings);
  paintEhr(findings, english);
}

function currentFindings(): Finding[] {
  return findingsFromState(state, painForm.diagnoses);
}

function englishNote(lines: string[]): string {
  const exam = onExamination(state, "en");
  const comment = state.comment.trim();
  const parts = [lines.join("\n"), exam];
  if (comment) parts.push(`Comment: ${comment}`);
  return parts.filter((part) => part.length > 0).join("\n\n");
}

function swedishNote(lines: string[]): string {
  const exam = onExamination(state, "sv");
  const comment = state.comment.trim();
  const parts = [lines.join("\n"), exam];
  if (comment) parts.push(`Kommentar: ${comment}`);
  return parts.filter((part) => part.length > 0).join("\n\n");
}

function englishText(): string {
  return englishNote(summaryLines(currentFindings(), "en"));
}

function diseaseDetails(): string {
  const topics = visibleDiseaseDetailTopics(state);
  return topics.map((topic) => {
    const form = formOf(topic);
    if (!form) return "";
    const rows = [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])]
      .map((row) => featureRow(topic, row, uiLang))
      .join("");
    return `<fieldset class="group"><h2>${escapeText(diseaseFormHeading(topic, uiLang))}</h2>${rows}</fieldset>`;
  }).join("");
}

function paintSnomed(findings: Finding[]): void {
  const host = document.querySelector("#snomed-expressions");
  if (!host) return;
  const results = expressionsFor(findings);
  cachedSnomedExpressions = results.map((row) => row.expression ?? "");
  if (!results.length) {
    host.innerHTML = "";
    return;
  }
  const blocks = results.map((row, index) => {
    const title = escapeText(conceptLabel(row.topic));
    const expr = row.expression
      ? `<pre class="snomed-expr" id="snomed-expr-${index}">${escapeText(row.expression)}</pre>`
      : `<p class="note">No expression: no verified SNOMED focus for <code>${escapeText(row.topic)}</code>.</p>`;
    const copy = row.expression
      ? `<button type="button" data-copy-snomed="${index}">Copy</button>`
      : "";
    const unmapped = row.unmapped.length
      ? `<aside class="snomed-info">
          <span class="snomed-info-icon" aria-hidden="true">ⓘ</span>
          <div>
            <ul class="snomed-unmapped">${row.unmapped.map((item) =>
              `<li><code>${escapeText(item.key)}</code> — ${escapeText(item.reason)}</li>`
            ).join("")}</ul>
            <p>${escapeText(UNMAPPED_INFO)}</p>
          </div>
        </aside>`
      : `<p class="note">No unmapped parts.</p>`;
    return `<article class="snomed-block">
      <div class="snomed-head"><h3>${title}</h3>${copy}</div>
      ${expr}
      ${unmapped}
    </article>`;
  }).join("");
  host.innerHTML = `<h3 class="snomed-title">SNOMED CT expressions</h3>${blocks}`;
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

function paintEhr(findings: Finding[], _english: string[]): void {
  const narrative = historyNarrativeText(findings, "en");
  const result = buildVisit(state, narrative);
  canonicalForSimplified = result.canonical;
  cachedZipehrRenderLang = languageFromCanonical(result.canonical);
  const checked = validateComposition(result.canonical);
  const jsonText = JSON.stringify(result.canonical, null, 2);
  cachedCanonicalJson = jsonText;
  const pre = document.querySelector("#ehr");
  if (pre) pre.textContent = jsonText;
  refreshSimplifiedOutput();
  const canonicalStats = document.querySelector("#ehr-canonical-stats");
  if (canonicalStats) {
    const stats = zipehrTextStats(jsonText);
    canonicalStats.textContent = `${stats.characters.toLocaleString()} characters · ${stats.lines.toLocaleString()} lines`;
  }
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
  paintFhir(result.canonical, narrative);
  void (async () => {
    try {
      const { canonicalToXml } = await import("./openehr/serialization-views.ts");
      cachedXml = await canonicalToXml(result.canonical);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      cachedXml = `<!-- XML serialize failed: ${message} -->`;
    }
    const xmlPre = document.querySelector("#ehr-xml");
    if (xmlPre) xmlPre.textContent = cachedXml;
    const xmlStats = document.querySelector("#ehr-xml-stats");
    if (xmlStats) {
      const stats = zipehrTextStats(cachedXml);
      xmlStats.textContent = `${stats.characters.toLocaleString()} characters · ${stats.lines.toLocaleString()} lines`;
    }
    await refreshZipehrSerializedOutput();
  })();
}

function paintFhir(canonical: Record<string, unknown>, narrative: string): void {
  fhirCanonical = canonical;
  fhirNarrative = narrative;
  document.querySelector("#tab-fhir-bundle")?.setAttribute("aria-pressed", fhirTab === "bundle" ? "true" : "false");
  if (fhirTab === "bundle") {
    const bundle = buildFhirBundle(state, canonical);
    const issues = validateFhirBundle(bundle);
    fhirJson = JSON.stringify(bundle, null, 2);
    const pre = document.querySelector("#fhir");
    if (pre) pre.textContent = fhirJson;
    for (const id of ["#tab-fhir-q", "#tab-fhir-qr", "#tab-fhir-symptom"]) {
      document.querySelector(id)?.setAttribute("aria-pressed", "false");
    }
    const badge = document.querySelector("#fhir-badge");
    if (badge) badge.textContent = issues.length ? `Visit bundle: shape errors (${issues.length})` : "Visit bundle: shape ok";
    const errors = document.querySelector("#fhir-errors");
    if (errors) errors.textContent = issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    return;
  }
  const built = buildQuestionnaireExport(state, narrative);
  const symptoms = buildSymptomExport(state, narrative);
  const qCheck = validateQuestionnaire(built.questionnaire);
  const rCheck = validateQuestionnaireResponse(built.response, built.questionnaire);
  const sCheck = validateSymptomExport(symptoms);
  const doc = fhirTab === "questionnaire" ? built.questionnaire
    : fhirTab === "response" ? built.response
    : symptoms;
  fhirJson = JSON.stringify(doc, null, 2);
  const pre = document.querySelector("#fhir");
  if (pre) pre.textContent = fhirJson;
  document.querySelector("#tab-fhir-q")?.setAttribute("aria-pressed", fhirTab === "questionnaire" ? "true" : "false");
  document.querySelector("#tab-fhir-qr")?.setAttribute("aria-pressed", fhirTab === "response" ? "true" : "false");
  document.querySelector("#tab-fhir-symptom")?.setAttribute("aria-pressed", fhirTab === "symptoms" ? "true" : "false");
  const check = fhirTab === "questionnaire" ? qCheck : fhirTab === "response" ? rCheck : sCheck;
  const badge = document.querySelector("#fhir-badge");
  if (badge) {
    const label = fhirTab === "questionnaire" ? "Questionnaire" : fhirTab === "response" ? "QuestionnaireResponse" : "Symptom Logical Model";
    badge.textContent = check.valid
      ? `${label}: shape ok (${check.warnings.length} warnings)`
      : `${label}: shape errors (${check.errors.length})`;
  }
  const errors = document.querySelector("#fhir-errors");
  if (errors) {
    const extra = fhirTab === "symptoms" && symptoms.gaps.length
      ? symptoms.gaps.map((gap) => `gap: ${gap.path} — ${gap.reason}`)
      : [];
    const lines = check.errors.concat(check.warnings).map((issue) => `${issue.path} — ${issue.message}`).concat(extra);
    errors.textContent = lines.join("\n");
  }
}

function escapeText(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] ?? ch);
}

function escapeAttr(value: string): string {
  return escapeText(value);
}
