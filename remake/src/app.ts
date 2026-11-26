import {
  conceptDisplay,
  formOf,
  implementedTopics,
  selectorTitles,
  topicDisplay,
  topicsForSelector,
  type SelectorKind,
  type MapRegion,
  type BodyMapData,
} from "./knowledge-data.ts";
import { anatomyMapFor, hitTest, insetForConcept, regionsOf, type Hotspot } from "./selector/hit.ts";
import { imageUrl, setActivePack } from "./images/source.ts";
import {
  installPackZip,
  resolveStartupPack,
  revertToBuiltin,
  type ActivePack,
} from "./pack/load.ts";
import { PATIENTS, ageInYears, patientById, type Patient } from "./patients.ts";
import {
  emptyStore,
  loadStore,
  newRecordId,
  resetDemo,
  saveStore,
  todayIso,
  type RemakeStore,
} from "./storage.ts";
import {
  DURATION_UNITS,
  emptyFormState,
  featureLabel,
  findingsFromForm,
  hasMoreLayer,
  isFormDirty,
  lateralityPhrase,
  linkLabel,
  rowsOf,
  setDuration,
  setFeatureValue,
  setLinkSummary,
  toggleLaterality,
  valueLabel,
  type FormState,
  type LateralityChoice,
  type LinkSelection,
} from "./form/engine.ts";
import { renderSentence } from "./sentence/render.ts";
import { sentenceKnowledge } from "./knowledge-data.ts";
import type { RemakeForm, FormLink } from "./knowledge-data.ts";

type Screen = "host" | "selector" | "form" | "about";

interface Hover {
  concept: string;
  box: { left: number; top: number; width: number; height: number };
}

interface MenuItem {
  label: string;
  action: () => void;
}

interface Confirm {
  title: string;
  message: string;
  yes: string;
  onYes: () => void;
}

interface AppState {
  store: RemakeStore;
  screen: Screen;
  selectorKind: SelectorKind;
  system: string;
  location: string | null;
  openInset: MapRegion | null;
  hover: Hover | null;
  topicQuery: string;
  selectedTopic: string | null;
  form: RemakeForm | null;
  formState: FormState | null;
  formStack: Array<{ parent: FormState; bag: "associated" | "diagnoses"; key: string; form: RemakeForm }>;
  menu: { x: number; y: number; items: MenuItem[] } | null;
  confirm: Confirm | null;
  pack: ActivePack;
  packError: string | null;
  localFallback: boolean;
}

const LAUNCH: Array<{ kind: SelectorKind; key: string; hint: string }> = [
  { kind: "QDE", key: "QDE", hint: "F4" },
  { kind: "SYM", key: "SYM", hint: "S" },
  { kind: "DIS", key: "DIS", hint: "D" },
  { kind: "CHK", key: "CHK", hint: "C" },
  { kind: "FH", key: "FH", hint: "F" },
  { kind: "PMH", key: "PMH", hint: "P" },
  { kind: "INT", key: "INT", hint: "I" },
];

let state: AppState;
let root: HTMLElement;

export function mount(el: HTMLElement): void {
  void mountAsync(el);
}

export async function mountAsync(el: HTMLElement): Promise<void> {
  root = el;
  root.textContent = "Loading image pack…";
  let pack: ActivePack;
  try {
    pack = await resolveStartupPack();
  } catch (err) {
    root.textContent = err instanceof Error ? err.message : String(err);
    throw err;
  }
  setActivePack(pack);
  const wantedLocal = typeof window !== "undefined" &&
    ["local", "local-originals", "originals"].includes(new URL(window.location.href).searchParams.get("images") ?? "");
  state = {
    store: typeof localStorage === "undefined" ? emptyStore() : loadStore(),
    screen: "host",
    selectorKind: "SYM",
    system: "FunctionalSystem",
    location: null,
    openInset: null,
    hover: null,
    topicQuery: "",
    selectedTopic: null,
    form: null,
    formState: null,
    formStack: [],
    menu: null,
    confirm: null,
    pack,
    packError: null,
    localFallback: wantedLocal && pack.origin !== "local",
  };
  render();
  window.addEventListener("keydown", onKey);
}

function maps(): BodyMapData {
  return state.pack.bodyMap;
}

function canvas(): { width: number; height: number } {
  return state.pack.config.canvas;
}

function currentMapName(): string {
  const sex = patient().sex === "female" ? "F" : "M";
  const selector = maps().selectors.find((s) => s.tsFlagType === (state.selectorKind === "DIS" ? "disease" : "symptom"))
    ?? maps().selectors[0];
  const opt = selector?.options.find((o) => o.sex === sex && o.system === state.system);
  if (opt?.anatomyMap) return opt.anatomyMap;
  return anatomyMapFor(maps(), patient().sex);
}

function patient(): Patient {
  return patientById(state.store.currentPatientId);
}

function persist(): void {
  saveStore(state.store);
}

function render(): void {
  root.innerHTML = "";
  const shell = el("div", { class: "shell" });
  shell.append(mast());
  const packBanner = packBannerText();
  if (packBanner) shell.append(banner(packBanner));
  if (state.screen === "host") shell.append(hostView());
  else if (state.screen === "selector") shell.append(selectorView());
  else if (state.screen === "form") shell.append(formView());
  else shell.append(aboutView());
  if (state.menu) shell.append(menuView());
  if (state.confirm) shell.append(confirmView());
  root.append(shell);
}

function mast(): HTMLElement {
  const m = el("header", { class: "mast" });
  const left = el("div");
  left.append(
    el("h1", {}, "PEN&PAD-style body-map remake"),
    el("div", { class: "tag" }, "Independent recreation · mouse and keyboard · not the 1998 Clinergy program"),
  );
  const right = el("div", { class: "row" });
  right.append(
    btn(state.screen === "about" ? "Back" : "About / credits", () => {
      state.screen = state.screen === "about" ? "host" : "about";
      render();
    }),
  );
  const workbench = el("p", { class: "workbench-link" });
  const a = el("a", { href: "../" }, "Experimental workbench");
  workbench.append(a);
  right.append(workbench);
  m.append(left, right);
  return m;
}

function packBannerText(): string | null {
  if (state.localFallback) {
    return "No pack.yaml was found under remake/local-originals/, so the built-in CC0 pack is shown. Unzip a local image pack into that folder (gitignored) and reload with ?images=local. Original 1998 images must never be committed or published.";
  }
  if (state.pack.origin === "local") {
    return `Local dev pack “${state.pack.config.name}” is loaded from remake/local-originals/ (gitignored, ?images=local). This is for private machines only — original 1998 images must never be committed or published.`;
  }
  if (state.pack.origin === "idb") {
    const notice = state.pack.config.license.notice ? ` ${state.pack.config.license.notice}` : "";
    return `Using uploaded image pack “${state.pack.config.name}” (stored in this browser’s IndexedDB).${notice}`;
  }
  return null;
}

function hostView(): HTMLElement {
  const p = patient();
  const panel = el("div", { class: "panel" });
  const who = el("div", { class: "spread" });
  const pats = el("div", { class: "row patients" });
  pats.append(el("span", { class: "note" }, "Patient:"));
  for (const cand of PATIENTS) {
    const b = btn(cand.name, () => {
      state.store.currentPatientId = cand.id;
      persist();
      render();
    });
    if (cand.id === p.id) b.classList.add("on");
    pats.append(b);
  }
  const dem = el("div", { class: "demog" });
  dem.append(
    el("strong", {}, p.name),
    document.createTextNode(
      ` · ${p.sex} · born ${p.born} (year only, age about ${ageInYears(p.born)}) · ${p.id}`,
    ),
  );
  who.append(pats, dem);
  panel.append(who);
  panel.append(
    el(
      "p",
      { class: "note" },
      "Fictitious patients from the TermViz V8 demo. No full birth date or personal identifier was published there, so none is invented here.",
    ),
  );

  const recs = el("div", { class: "records" });
  recs.append(el("h2", {}, "Record"));
  const list = state.store.patients[p.id]?.records ?? [];
  if (!list.length) {
    recs.append(el("p", { class: "empty" }, "No entries yet. Launch SYM and record a finding, then Accept."));
  } else {
    const ul = el("ul");
    for (const row of [...list].reverse()) {
      const li = el("li");
      li.append(el("span", { class: "when" }, row.date));
      li.append(document.createTextNode(row.sentences.join(" / ")));
      ul.append(li);
    }
    recs.append(ul);
  }
  panel.append(recs);

  const launch = el("div", { class: "launch" });
  for (const item of LAUNCH) {
    const b = btn(item.key, () => openSelector(item.kind));
    b.append(el("span", { class: "khint" }, item.hint));
    b.title = selectorTitles[item.kind];
    launch.append(b);
  }
  panel.append(launch);

  const tools = el("div", { class: "actions" });
  tools.append(
    btn("Reset demo", () => {
      state.confirm = {
        title: "Reset demo?",
        message: "This clears every saved record for Lars and Eva in this browser (localStorage). It does not change a form you are mid-edit — use Reset on the form for that.",
        yes: "Reset demo",
        onYes: () => {
          state.store = resetDemo();
          state.screen = "host";
          state.form = null;
          state.formState = null;
          state.formStack = [];
        },
      };
      render();
    }, "danger"),
    packControls(),
  );
  panel.append(tools);
  return panel;
}

function clearImagesQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("images");
  window.history.replaceState(null, "", url);
}

function applyPack(next: ActivePack): void {
  setActivePack(next);
  state.pack = next;
  state.packError = null;
  state.localFallback = false;
  state.openInset = null;
  state.hover = null;
}

function packControls(): HTMLElement {
  const wrap = el("div", { class: "pack-controls" });
  const origin = state.pack.origin === "builtin"
    ? "Built-in pack"
    : state.pack.origin === "local"
      ? "Local dev pack"
      : "Uploaded pack";
  wrap.append(el("div", { class: "note" }, `${origin}: ${state.pack.config.name} (${state.pack.config.id} v${state.pack.config.version})`));
  const row = el("div", { class: "row" });
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".zip,application/zip";
  file.className = "pack-file";
  file.addEventListener("change", () => {
    const f = file.files?.[0];
    if (!f) return;
    void (async () => {
      try {
        const bytes = new Uint8Array(await f.arrayBuffer());
        applyPack(await installPackZip(bytes));
        clearImagesQuery();
      } catch (err) {
        state.packError = err instanceof Error ? err.message : String(err);
      }
      render();
    })();
  });
  row.append(btn("Upload image pack…", () => file.click()), file);
  if (state.pack.origin !== "builtin") {
    row.append(btn("Revert to built-in pack", () => {
      void (async () => {
        applyPack(await revertToBuiltin());
        clearImagesQuery();
        render();
      })();
    }));
  }
  wrap.append(row);
  if (state.packError) wrap.append(el("p", { class: "pack-error" }, state.packError));
  return wrap;
}

function openSelector(kind: SelectorKind): void {
  state.selectorKind = kind;
  state.system = "FunctionalSystem";
  state.location = null;
  state.openInset = null;
  state.hover = null;
  state.topicQuery = "";
  state.selectedTopic = null;
  state.screen = "selector";
  render();
}

function showsMap(kind: SelectorKind): boolean {
  return kind === "SYM" || kind === "DIS" || kind === "QDE";
}

function selectorView(): HTMLElement {
  const p = patient();
  const panel = el("div", { class: "panel" });
  panel.append(el("h2", {}, selectorTitles[state.selectorKind] + ` — ${p.name}`));
  if (state.selectorKind !== "SYM") {
    panel.append(
      el(
        "p",
        { class: "note" },
        "This slice implements the symptom path (body map → thumb → thumb pain form) in full. Other launch buttons list topics from the extracted catalogues; opening a form other than the implemented thumb set shows a stub.",
      ),
    );
  }
  const body = el("div", { class: "selector" });
  const left = el("div");
  if (showsMap(state.selectorKind)) {
    left.append(systemBar(), graphic(), locationMeta());
  } else {
    left.append(el("p", { class: "note" }, "This selector has no body map in the 1998 layout (list only)."));
  }
  body.append(left, topicList());
  panel.append(body);
  const actions = el("div", { class: "actions" });
  const formBtn = btn("Form", () => openSelectedForm(), "primary");
  if (!state.selectedTopic) formBtn.disabled = true;
  actions.append(
    formBtn,
    btn("None (clear location)", () => {
      state.location = null;
      state.openInset = null;
      render();
    }),
    btn("Cancel", () => {
      state.screen = "host";
      render();
    }),
  );
  panel.append(actions);
  return panel;
}

function systemBar(): HTMLElement {
  const bar = el("div", { class: "sysbar" });
  const sex = patient().sex === "female" ? "F" : "M";
  const selector = maps().selectors.find((s) => s.tsFlagType === (state.selectorKind === "DIS" ? "disease" : "symptom"))
    ?? maps().selectors[0];
  const options = selector.options.filter((o) => o.sex === sex);
  for (const opt of options) {
    const id = state.system === opt.system ? opt.buttonIds[1] ?? opt.buttonIds[0] : opt.buttonIds[0];
    const b = el("button", { class: "icon-btn", type: "button", title: opt.label }) as HTMLButtonElement;
    if (state.system === opt.system) b.classList.add("on");
    const img = document.createElement("img");
    img.alt = opt.label;
    img.width = 32;
    img.height = 32;
    applySrc(img, id);
    b.append(img);
    b.addEventListener("click", () => {
      const prevMap = currentMapName();
      state.system = opt.system;
      if (currentMapName() !== prevMap) {
        state.openInset = null;
        state.hover = null;
      }
      render();
    });
    bar.append(b);
  }
  return bar;
}

function graphic(): HTMLElement {
  const wrap = el("div", { class: "graphic-wrap" });
  const { width: cw, height: ch } = canvas();
  wrap.style.width = `${cw}px`;
  wrap.style.height = `${ch}px`;
  const mapName = currentMapName();
  const graphicId = maps().mainGraphics[mapName]?.imageId ?? (patient().sex === "female" ? "F_main" : "M_main");
  const main = document.createElement("img");
  main.className = "main";
  main.width = cw;
  main.height = ch;
  main.style.width = `${cw}px`;
  main.style.height = `${ch}px`;
  main.alt = `${patient().sex} surface anatomy`;
  applySrc(main, graphicId);
  wrap.append(main);

  if (state.openInset?.insetRect && state.openInset.insetImageId) {
    const [left, top, width, height] = state.openInset.insetRect;
    const inset = document.createElement("img");
    inset.className = "inset";
    inset.alt = conceptDisplay(state.openInset.concept);
    inset.style.left = `${left}px`;
    inset.style.top = `${top}px`;
    inset.style.width = `${width}px`;
    inset.style.height = `${height}px`;
    applySrc(inset, state.openInset.insetImageId);
    wrap.append(inset);
  }

  if (state.hover) {
    const hl = el("div", { class: "hot-hl" });
    hl.style.left = `${state.hover.box.left}px`;
    hl.style.top = `${state.hover.box.top}px`;
    hl.style.width = `${state.hover.box.width}px`;
    hl.style.height = `${state.hover.box.height}px`;
    wrap.append(hl);
    wrap.append(el("div", { class: "hot-label" }, conceptDisplay(state.hover.concept)));
  } else {
    wrap.append(el("div", { class: "hot-label" }, state.location ? conceptDisplay(state.location) : "Location: none"));
  }

  const toLocal = (ev: MouseEvent) => {
    const r = wrap.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
  };
  const map = regionsOf(maps(), mapName);
  const paintHover = (next: Hover | null) => {
    state.hover = next;
    wrap.querySelectorAll(".hot-hl, .hot-label").forEach((n) => n.remove());
    if (next) {
      const hl = el("div", { class: "hot-hl" });
      hl.style.left = `${next.box.left}px`;
      hl.style.top = `${next.box.top}px`;
      hl.style.width = `${next.box.width}px`;
      hl.style.height = `${next.box.height}px`;
      wrap.append(hl);
      wrap.append(el("div", { class: "hot-label" }, conceptDisplay(next.concept)));
    } else {
      wrap.append(el("div", { class: "hot-label" }, state.location ? conceptDisplay(state.location) : "Location: none"));
    }
  };
  wrap.addEventListener("mousemove", (ev) => {
    const { x, y } = toLocal(ev);
    const hit = hitTest(x, y, map, state.openInset);
    if (!hit.concept) {
      if (state.hover) paintHover(null);
      return;
    }
    let box: Hover["box"];
    if (hit.kind === "sublocation" && hit.sublocation && state.openInset?.insetRect) {
      const [t0, b, l, rgt] = hit.sublocation.hotspot;
      box = {
        left: state.openInset.insetRect[0] + l,
        top: state.openInset.insetRect[1] + t0,
        width: rgt - l,
        height: b - t0,
      };
    } else if (hit.region) {
      const [t0, b, l, rgt] = hit.region.hotspot as Hotspot;
      if (state.openInset && hit.region === state.openInset && state.openInset.insetRect) {
        const [il, it, iw, ih] = state.openInset.insetRect;
        box = { left: il, top: it, width: iw, height: ih };
      } else {
        box = { left: l, top: t0, width: rgt - l, height: b - t0 };
      }
    } else {
      return;
    }
    const next = { concept: hit.concept, box };
    if (JSON.stringify(next) !== JSON.stringify(state.hover)) paintHover(next);
  });
  wrap.addEventListener("mouseleave", () => {
    if (state.hover) paintHover(null);
  });
  wrap.addEventListener("click", (ev) => {
    const { x, y } = toLocal(ev);
    const hit = hitTest(x, y, map, state.openInset);
    if (hit.kind === "none" || !hit.concept) {
      state.location = null;
      state.openInset = null;
      state.hover = null;
      render();
      return;
    }
    state.location = hit.concept;
    const nextInset = insetForConcept(map, hit.concept, state.openInset?.insetImageId);
    if (hit.kind === "region" && nextInset && nextInset !== state.openInset) {
      state.openInset = nextInset;
    } else if (hit.kind === "sublocation") {
      const deeper = insetForConcept(map, hit.concept, state.openInset?.insetImageId);
      if (deeper && deeper !== state.openInset) state.openInset = deeper;
    }
    state.hover = null;
    render();
  });
  return wrap;
}

function locationMeta(): HTMLElement {
  const m = el("div", { class: "loc-meta" });
  m.append(
    el("div", {}, `Location: ${state.location ? conceptDisplay(state.location) : "none"}`),
    el("div", { class: "note" }, state.openInset ? `Inset: ${conceptDisplay(state.openInset.concept)}` : "Click a region to zoom. Click empty space for none."),
  );
  return m;
}

function topicList(): HTMLElement {
  const pane = el("div", { class: "list-pane" });
  const search = document.createElement("input");
  search.type = "search";
  search.placeholder = "Search topics (keyboard)";
  search.value = state.topicQuery;
  search.addEventListener("input", () => {
    state.topicQuery = search.value;
    render();
    const again = root.querySelector<HTMLInputElement>("input[type=search]");
    if (again) {
      again.focus();
      again.setSelectionRange(state.topicQuery.length, state.topicQuery.length);
    }
  });
  pane.append(search);
  const list = el("div", { class: "topics" });
  const q = state.topicQuery.trim().toLowerCase();
  const system = state.system === "FunctionalSystem" ? null : state.system;
  let ids = topicsForSelector(state.selectorKind, state.location, system);
  if (q) ids = ids.filter((id) => topicDisplay(id).toLowerCase().includes(q) || id.toLowerCase().includes(q));
  if (state.selectorKind === "SYM" && !state.location && !q) {
    // Keep the thumb path obvious at the top when browsing the full list.
    const pin = ["ThumbPainSymptom", "ThumbSwellingSymptom"];
    ids = [...pin.filter((id) => ids.includes(id)), ...ids.filter((id) => !pin.includes(id))];
  }
  if (!ids.length) list.append(el("p", { class: "empty" }, "No topics match this location, system, or search."));
  for (const id of ids) {
    const implemented = !!formOf(id);
    const b = el("button", { type: "button" }, topicDisplay(id) + (implemented ? "" : "  (stub)")) as HTMLButtonElement;
    if (!implemented) b.classList.add("stub");
    if (state.selectedTopic === id) b.classList.add("sel");
    b.addEventListener("click", () => {
      state.selectedTopic = id;
      render();
    });
    b.addEventListener("dblclick", () => {
      state.selectedTopic = id;
      openSelectedForm();
    });
    list.append(b);
  }
  pane.append(el("p", { class: "note" }, `${ids.length} topics` + (state.location ? ` at ${conceptDisplay(state.location)}` : "")));
  pane.append(list);
  return pane;
}

function openSelectedForm(): void {
  const id = state.selectedTopic;
  if (!id) return;
  const form = formOf(id);
  if (!form) {
    state.confirm = {
      title: "Form not in this slice",
      message: `“${topicDisplay(id)}” is in the extracted topic catalogue, but only the thumb-path forms are implemented so far (${implementedTopics.join(", ")}). The engine is data-driven: adding the YAML later should light the form up.`,
      yes: "OK",
      onYes: () => {},
    };
    render();
    return;
  }
  state.form = form;
  state.formState = emptyFormState(form, {
    location: state.location ?? form.location,
  });
  state.formStack = [];
  state.screen = "form";
  render();
}

function formView(): HTMLElement {
  const form = state.form;
  const fs = state.formState;
  if (!form || !fs) return el("div", {}, "Missing form");
  const panel = el("div", { class: "panel" });
  const title = state.formStack.length ? `More on ${form.display}` : form.display;
  panel.append(el("h2", {}, title[0].toUpperCase() + title.slice(1)));
  const grid = el("div", { class: "form-grid" });
  grid.append(formFields(form, fs), summaryPane(form, fs));
  panel.append(grid);
  const actions = el("div", { class: "actions" });
  actions.append(
    btn("Accept", () => acceptForm(), "primary"),
    btn("Reset", () => {
      state.confirm = {
        title: "Reset this form?",
        message: "Clear the values on this form only. Saved records and the other patient's data are left alone. This is not Reset demo.",
        yes: "Reset form",
        onYes: () => {
          if (state.form) state.formState = emptyFormState(state.form, { location: fs.location });
        },
      };
      render();
    }),
    btn("Cancel", () => cancelForm()),
  );
  panel.append(actions);
  return panel;
}

function formFields(form: RemakeForm, fs: FormState): HTMLElement {
  const col = el("div");
  const desc = el("section", { class: "section" });
  desc.append(el("h3", {}, "Descriptors"));
  for (const row of rowsOf(form, fs.moreOpen)) {
    desc.append(featureRow(form, fs, row.feature ?? "", row.multiple === true, row.values));
  }
  if (hasMoreLayer(form)) {
    const more = btn(fs.moreOpen ? "<< hide" : ">> more", () => {
      state.formState = { ...fs, moreOpen: !fs.moreOpen };
      render();
    });
    desc.append(more);
  }
  col.append(desc);

  if (form.associatedSymptomsAndSigns?.length) {
    col.append(linkSection("Associated symptoms and signs", "associated", form.associatedSymptomsAndSigns, fs));
  }
  if (form.diagnoses?.length) {
    col.append(linkSection("Diagnoses", "diagnoses", form.diagnoses, fs));
  }
  if (form.examinations?.length) {
    const sec = el("section", { class: "section" });
    sec.append(el("h3", {}, "Examinations"));
    sec.append(
      el(
        "p",
        { class: "note" },
        "Examination entry (thumb exam, nested joint signs) is stubbed in this slice. The section is shown because the form lists it; a later slice should drive it from exams.yaml.",
      ),
    );
    for (const ex of form.examinations) {
      sec.append(el("div", { class: "link-row" }, ex.exam.replace(/([a-z0-9])([A-Z])/g, "$1 $2")));
    }
    col.append(sec);
  }

  const com = el("section", { class: "section" });
  com.append(el("h3", {}, "Comment"));
  const ta = document.createElement("textarea");
  ta.className = "comment";
  ta.value = fs.comment;
  ta.addEventListener("input", () => {
    if (state.formState) state.formState = { ...state.formState, comment: ta.value };
  });
  com.append(ta);
  col.append(com);
  return col;
}

function featureRow(form: RemakeForm, fs: FormState, feature: string, multiple: boolean, values: unknown[]): HTMLElement {
  const wrap = el("div", { class: "feat" });
  wrap.append(el("div", { class: "name" }, featureLabel(feature)));
  if (feature === "laterality") {
    const chips = el("div", { class: "chips" });
    for (const side of ["left", "right"] as LateralityChoice[]) {
      const b = btn(side, () => {
        state.formState = toggleLaterality(fs, side, multiple);
        render();
      });
      if (fs.laterality.includes(side)) b.classList.add("on");
      chips.append(b);
    }
    wrap.append(chips);
    wrap.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      openMenu(ev.clientX, ev.clientY, [
        { label: "left", action: () => { state.formState = toggleLaterality({ ...fs, laterality: [] }, "left", false); } },
        { label: "right", action: () => { state.formState = toggleLaterality({ ...fs, laterality: [] }, "right", false); } },
        { label: "Clear", action: () => { state.formState = { ...fs, laterality: [] }; } },
      ]);
    });
    return wrap;
  }
  if (feature === "QuantityDuration" || values.includes("TemporalValue")) {
    const dur = el("div", { class: "duration" });
    const sel = fs.features[feature];
    const num = document.createElement("input");
    num.type = "number";
    num.min = "0";
    num.step = "1";
    num.value = sel?.number ? String(sel.number) : "";
    const unit = document.createElement("select");
    for (const u of DURATION_UNITS) {
      const opt = document.createElement("option");
      opt.value = u;
      opt.textContent = u + "s";
      if ((sel?.unit ?? "day") === u) opt.selected = true;
      unit.append(opt);
    }
    const apply = () => {
      const n = num.value === "" ? undefined : Number(num.value);
      state.formState = setDuration(fs, feature, Number.isFinite(n as number) ? n : undefined, unit.value);
    };
    num.addEventListener("change", () => { apply(); render(); });
    unit.addEventListener("change", () => { apply(); render(); });
    dur.append(num, unit);
    wrap.append(dur);
    return wrap;
  }
  const chips = el("div", { class: "chips" });
  const selected = new Set(fs.features[feature]?.values ?? []);
  for (const raw of values) {
    const value = String(raw);
    const b = btn(valueLabel(value), () => {
      state.formState = setFeatureValue(fs, feature, value, multiple);
      render();
    });
    if (selected.has(value)) b.classList.add("on");
    chips.append(b);
  }
  wrap.append(chips);
  wrap.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    const items: MenuItem[] = values.map((raw) => ({
      label: valueLabel(String(raw)),
      action: () => { state.formState = setFeatureValue({ ...fs, features: { ...fs.features, [feature]: { values: [] } } }, feature, String(raw), false); },
    }));
    items.push({ label: "Clear", action: () => { state.formState = setFeatureValue({ ...fs, features: { ...fs.features, [feature]: { values: [fs.features[feature]?.values[0] ?? ""] } } }, feature, fs.features[feature]?.values[0] ?? "", false); } });
    openMenu(ev.clientX, ev.clientY, items);
  });
  void form;
  return wrap;
}

function linkSection(title: string, bag: "associated" | "diagnoses", links: FormLink[], fs: FormState): HTMLElement {
  const sec = el("section", { class: "section" });
  sec.append(el("h3", {}, title));
  const summaries = bag === "diagnoses"
    ? ["presence", "possible", "excluded"]
    : ["presence", "absence"];
  for (const link of links) {
    const row = el("div", { class: "link-row" });
    row.append(el("span", { class: "lab" }, linkLabel(link)));
    const cur = fs[bag][link.item]?.summary;
    for (const s of summaries) {
      const b = btn(s === "presence" ? "present" : s, () => {
        state.formState = setLinkSummary(fs, bag, link.item, cur === s ? undefined : s);
        render();
      });
      if (cur === s) b.classList.add("on");
      row.append(b);
    }
    const more = btn("more…", () => openNested(bag, link));
    if (!formOf(link.preCoordinated ?? link.concept)) more.disabled = true;
    row.append(more);
    sec.append(row);
  }
  return sec;
}

function openNested(bag: "associated" | "diagnoses", link: FormLink): void {
  const fs = state.formState;
  const parentForm = state.form;
  if (!fs || !parentForm) return;
  const topic = link.preCoordinated ?? link.concept;
  const nested = formOf(topic);
  if (!nested) return;
  const existing = fs[bag][link.item]?.form;
  state.formStack.push({ parent: fs, bag, key: link.item, form: parentForm });
  state.form = nested;
  state.formState = existing ?? emptyFormState(nested, {
    location: link.location ?? nested.location ?? fs.location,
  });
  render();
}

function acceptForm(): void {
  const form = state.form;
  const fs = state.formState;
  if (!form || !fs) return;
  if (state.formStack.length) {
    const frame = state.formStack.pop()!;
    const parent = frame.parent;
    const sel: LinkSelection = {
      summary: parent[frame.bag][frame.key]?.summary ?? (isFormDirty(fs) ? "presence" : undefined),
      form: fs,
    };
    if (!sel.summary && !isFormDirty(fs)) {
      state.form = frame.form;
      state.formState = parent;
      render();
      return;
    }
    state.formState = { ...parent, [frame.bag]: { ...parent[frame.bag], [frame.key]: sel } };
    state.form = frame.form;
    render();
    return;
  }
  const findings = findingsFromForm(form, fs);
  const sentences = findings.map((f) => renderSentence(f, sentenceKnowledge));
  if (fs.comment.trim()) sentences.push(fs.comment.trim());
  const rec = {
    id: newRecordId(),
    date: todayIso(),
    topic: form.topic,
    sentences,
    comment: fs.comment.trim() || undefined,
  };
  const pid = state.store.currentPatientId;
  state.store.patients[pid].records = [...state.store.patients[pid].records, rec];
  persist();
  state.screen = "host";
  state.form = null;
  state.formState = null;
  render();
}

function cancelForm(): void {
  if (state.formStack.length) {
    const frame = state.formStack.pop()!;
    state.form = frame.form;
    state.formState = frame.parent;
    render();
    return;
  }
  state.screen = "host";
  state.form = null;
  state.formState = null;
  render();
}

function summaryPane(form: RemakeForm, fs: FormState): HTMLElement {
  const pane = el("div", { class: "summary-pane" });
  pane.append(el("h3", {}, "Summary"));
  const findings = findingsFromForm(form, fs);
  if (!findings.length) pane.append(el("p", { class: "empty" }, "Nothing entered yet."));
  for (const f of findings) {
    pane.append(el("p", {}, renderSentence(f, sentenceKnowledge)));
  }
  const sides = lateralityPhrase(fs.laterality);
  if (sides === "left-and-right") {
    pane.append(el("p", { class: "note" }, "Both sides are selected, so the remake writes one sentence per side (the generator has no “both” token)."));
  }
  return pane;
}

function aboutView(): HTMLElement {
  const panel = el("div", { class: "panel about" });
  panel.append(el("h2", {}, "About and credits"));
  panel.append(
    el(
      "p",
      {},
      "This is the PEN&PAD-style body-map remake: an independent recreation of a 1990s primary-care data-entry experience, so people can try the interaction in a web browser without installing the original software.",
    ),
  );
  panel.append(el("h3", {}, "Ideas this work draws on"));
  const ul = el("ul");
  ul.append(
    el("li", {}, "PEN&PAD research at the University of Manchester (Alan Rector and colleagues)."),
    el("li", {}, "The 1998 Clinergy demonstration system (Semantic Technologies Ltd / Victoria University of Manchester)."),
  );
  panel.append(ul);
  panel.append(el("h3", {}, "What this remake is — and is not"));
  panel.append(
    el(
      "p",
      {},
      "It is not the Clinergy program, and it is not named Clinergy. Logic is reimplemented from extracted rule and form data (YAML produced by the clinergy-extractor project). No original source code is copied. The English summary sentences are produced by a new original-equivalent generator written from those rules and checked against five walkthrough sentences.",
    ),
  );
  panel.append(
    el(
      "p",
      {},
      "Artwork in the public build comes from the built-in CC0 placeholder image pack (newly made outlines, marked PLACEHOLDER · CC0, not traced from the 1998 bitmaps). You can upload a different image pack zip in the browser; it is stored only in this browser’s IndexedDB. A pack produced locally from the 1998 demo (via the extractor’s --image-pack option) must never be committed or published. Developers can also load an unpacked pack from remake/local-originals/ with ?images=local.",
    ),
  );
  panel.append(
    el("p", { class: "note" }, "Clinergy content that appears as form and rule data is © 1997–8 Semantic Technologies Ltd / Victoria University of Manchester. This page is part of the PEN&PAD revival."),
  );
  panel.append(
    btn("Back to the host", () => {
      state.screen = "host";
      render();
    }, "primary"),
  );
  return panel;
}

function applySrc(img: HTMLImageElement, id: string): void {
  if (!id) return;
  img.src = imageUrl(id);
  img.addEventListener("error", () => {
    img.alt = `${id} (missing in this pack)`;
  });
}

function openMenu(x: number, y: number, items: MenuItem[]): void {
  state.menu = { x, y, items };
  render();
}

function menuView(): HTMLElement {
  const m = state.menu!;
  const box = el("div", { class: "menu" });
  box.style.left = `${m.x}px`;
  box.style.top = `${m.y}px`;
  for (const item of m.items) {
    const b = el("button", { type: "button" }, item.label) as HTMLButtonElement;
    b.addEventListener("click", () => {
      item.action();
      state.menu = null;
      render();
    });
    box.append(b);
  }
  setTimeout(() => {
    const close = (ev: MouseEvent) => {
      if (!box.contains(ev.target as Node)) {
        state.menu = null;
        window.removeEventListener("mousedown", close);
        render();
      }
    };
    window.addEventListener("mousedown", close);
  }, 0);
  return box;
}

function confirmView(): HTMLElement {
  const c = state.confirm!;
  const back = el("div", { class: "modal-back" });
  const modal = el("div", { class: "modal" });
  modal.append(el("h2", {}, c.title), el("p", {}, c.message));
  const row = el("div", { class: "actions" });
  row.append(
    btn(c.yes, () => {
      c.onYes();
      state.confirm = null;
      render();
    }, "primary"),
    btn("Cancel", () => {
      state.confirm = null;
      render();
    }),
  );
  modal.append(row);
  back.append(modal);
  return back;
}

function banner(text: string): HTMLElement {
  return el("div", { class: "banner" }, text);
}

function btn(label: string, onClick: () => void, kind?: "primary" | "danger"): HTMLButtonElement {
  const b = el("button", { class: "btn", type: "button" }, label) as HTMLButtonElement;
  if (kind) b.classList.add(kind);
  b.addEventListener("click", onClick);
  return b;
}

function el(tag: string, attrs: Record<string, string> = {}, text?: string): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text) node.textContent = text;
  return node;
}

function onKey(ev: KeyboardEvent): void {
  const typing = ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLSelectElement;
  if (ev.key === "Escape") {
    if (state.menu) { state.menu = null; render(); ev.preventDefault(); return; }
    if (state.confirm) { state.confirm = null; render(); ev.preventDefault(); return; }
    if (state.screen === "form") { cancelForm(); ev.preventDefault(); return; }
    if (state.screen === "selector" || state.screen === "about") { state.screen = "host"; render(); ev.preventDefault(); return; }
  }
  if (typing) return;
  if (state.screen === "host") {
    if (ev.key === "F4") { openSelector("QDE"); ev.preventDefault(); }
    else if (ev.key === "s" || ev.key === "S") openSelector("SYM");
    else if (ev.key === "d" || ev.key === "D") openSelector("DIS");
    else if (ev.key === "c" || ev.key === "C") openSelector("CHK");
    else if (ev.key === "f" || ev.key === "F") openSelector("FH");
    else if (ev.key === "p" || ev.key === "P") openSelector("PMH");
    else if (ev.key === "i" || ev.key === "I") openSelector("INT");
  }
}
