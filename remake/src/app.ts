import {
  conceptDisplay,
  formOf,
  selectorTitles,
  topicDisplay,
  topicsForSelector,
  type SelectorKind,
  type MapRegion,
  type BodyMapData,
} from "./knowledge-data.ts";
import { hitTest, insetForConcept, regionsOf, type Hotspot } from "./selector/hit.ts";
import { DEFAULT_SYSTEM, mapNameForSelector, tsFlagForKind } from "./selector/anatomy-map.ts";
import { imageUrl, setActivePack } from "./images/source.ts";
import {
  installPackFromUrl,
  installPackZip,
  listAvailablePacks,
  removeUserPack,
  resolveStartupPack,
  revertToBuiltin,
  switchToPack,
  type ActivePack,
} from "./pack/load.ts";
import { formatPackError } from "./pack/errors.ts";
import { DEFAULT_BUILTIN_KEY, type PackListItem } from "./pack/catalog.ts";
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
  lateralityPhrase,
  linkLabel,
  rowKey,
  rowsOf,
  setFeatureValue,
  setLinkSummary,
  setQuantity,
  setSubLocation,
  toggleLaterality,
  valueKey,
  valueLabel,
  type FormState,
  type LateralityChoice,
} from "./form/engine.ts";
import { isQuantityRow } from "./form/generate.ts";
import { loadGeneratedForms } from "./form/catalog.ts";
import {
  acceptTopPopup,
  cancelTopPopup,
  linkHasAcceptedForm,
  openPopup,
  popupAcceptEnabled,
  popupTitle,
  resetTopPopup,
  updateTopPopup,
  type FormPopup,
  type PopupParent,
} from "./form/popups.ts";
import { renderSentence } from "./sentence/render.ts";
import { sentenceKnowledge } from "./knowledge-data.ts";
import type { RemakeForm, FormLink, FormRow } from "./knowledge-data.ts";


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
  /** Data-entry window (topic selector + form tabs) open over the host. */
  gpOpen: boolean;
  gpTab: "topics" | "form";
  aboutOpen: boolean;
  selectorKind: SelectorKind;
  system: string;
  location: string | null;
  openInset: MapRegion | null;
  hover: Hover | null;
  topicQuery: string;
  selectedTopic: string | null;
  form: RemakeForm | null;
  formState: FormState | null;
  popups: FormPopup[];
  menu: { x: number; y: number; items: MenuItem[] } | null;
  confirm: Confirm | null;
  pack: ActivePack;
  packError: string | null;
  packWindowOpen: boolean;
  packList: PackListItem[] | null;
  packBusy: boolean;
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
  let started;
  try {
    started = await resolveStartupPack();
  } catch (err) {
    root.textContent = err instanceof Error ? err.message : String(err);
    throw err;
  }
  await loadGeneratedForms();
  const pack = started.pack;
  setActivePack(pack);
  state = {
    store: typeof localStorage === "undefined" ? emptyStore() : loadStore(),
    gpOpen: false,
    gpTab: "topics",
    aboutOpen: false,
    selectorKind: "SYM",
    system: DEFAULT_SYSTEM,
    location: null,
    openInset: null,
    hover: null,
    topicQuery: "",
    selectedTopic: null,
    form: null,
    formState: null,
    popups: [],
    menu: null,
    confirm: null,
    pack,
    packError: started.error,
    packWindowOpen: !!started.error,
    packList: null,
    packBusy: false,
    localFallback: started.localFallback,
  };
  if (state.packWindowOpen) void refreshPackList();
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
  return mapNameForSelector(maps(), tsFlagForKind(state.selectorKind), sex, state.system);
}

function patient(): Patient {
  return patientById(state.store.currentPatientId);
}

function persist(): void {
  saveStore(state.store);
}

function render(): void {
  root.innerHTML = "";
  const desktop = el("div", { class: "desktop" });
  desktop.append(mast());
  const packBanner = packBannerText();
  if (packBanner) desktop.append(banner(packBanner));
  const stage = el("div", { class: "desktop-stage" });
  const host = windowFrame({
    title: "Host system — mock-up",
    className: "win-host",
    fill: hostView(),
    close: null,
    inert: state.popups.length > 0 || state.packWindowOpen,
    menuItems: windowMenuItems(),
  });
  stage.append(host);
  if (state.gpOpen) stage.append(gpWindow());
  state.popups.forEach((popup, i) => stage.append(popupWindow(popup, i)));
  if (state.aboutOpen) {
    stage.append(windowFrame({
      title: "About / credits",
      className: "win-about",
      fill: aboutView(),
      close: () => { state.aboutOpen = false; render(); },
      inert: state.popups.length > 0 || state.packWindowOpen,
    }));
  }
  if (state.packWindowOpen) {
    const packWin = windowFrame({
      title: "Image pack",
      className: "win-pack",
      fill: packWindowView(),
      close: () => { state.packWindowOpen = false; render(); },
      inert: state.popups.length > 0,
      z: 6,
    });
    packWin.setAttribute("role", "dialog");
    packWin.setAttribute("aria-modal", "true");
    trapFocus(packWin, !state.packList && !state.packBusy);
    stage.append(packWin);
  }
  desktop.append(stage);
  if (state.menu) desktop.append(menuView());
  if (state.confirm) desktop.append(confirmView());
  root.append(desktop);
}

interface WindowOpts {
  title: string;
  className: string;
  fill: HTMLElement;
  close: (() => void) | null;
  inert?: boolean;
  top?: string;
  left?: string;
  z?: number;
  menuItems?: MenuItem[];
}

function windowFrame(opts: WindowOpts): HTMLElement {
  const win = el("div", { class: `win ${opts.className}` });
  if (opts.top) win.style.top = opts.top;
  if (opts.left) win.style.left = opts.left;
  if (opts.z != null) win.style.zIndex = String(opts.z);
  if (opts.inert) {
    win.classList.add("inert");
    win.setAttribute("aria-hidden", "true");
  }
  const title = el("div", { class: "win-title" });
  if (opts.menuItems?.length) {
    const sys = el("button", { class: "btn win-sys", type: "button", title: "Window menu", "aria-label": "Window menu" }, "▾") as HTMLButtonElement;
    sys.addEventListener("click", (ev) => {
      ev.stopPropagation();
      const r = sys.getBoundingClientRect();
      openMenu(r.left, r.bottom + 2, opts.menuItems!);
    });
    title.append(sys);
  }
  title.append(el("span", { class: "win-title-text" }, opts.title));
  if (opts.close) {
    const x = btn("×", opts.close);
    x.classList.add("win-close");
    x.setAttribute("aria-label", "Close");
    title.append(x);
  }
  if (!opts.inert) makeDraggable(win, title);
  const body = el("div", { class: "win-body" });
  body.append(opts.fill);
  win.append(title, body);
  return win;
}

function makeDraggable(win: HTMLElement, handle: HTMLElement): void {
  handle.addEventListener("mousedown", (ev) => {
    if ((ev.target as HTMLElement).closest("button")) return;
    ev.preventDefault();
    const r = win.getBoundingClientRect();
    const parent = win.offsetParent as HTMLElement | null;
    const pr = parent?.getBoundingClientRect();
    const dx = ev.clientX - r.left;
    const dy = ev.clientY - r.top;
    const move = (e: MouseEvent) => {
      const left = e.clientX - dx - (pr?.left ?? 0);
      const top = e.clientY - dy - (pr?.top ?? 0);
      win.style.left = `${Math.max(0, left)}px`;
      win.style.top = `${Math.max(0, top)}px`;
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  });
}

function gpWindow(): HTMLElement {
  const fill = el("div");
  const tabs = el("div", { class: "win-tabs" });
  const topics = btn("Topics", () => { state.gpTab = "topics"; render(); });
  if (state.gpTab === "topics") topics.classList.add("on");
  tabs.append(topics);
  if (state.form) {
    const label = state.form.display[0].toUpperCase() + state.form.display.slice(1);
    const formTab = btn(label, () => { state.gpTab = "form"; render(); });
    if (state.gpTab === "form") formTab.classList.add("on");
    tabs.append(formTab);
  } else if (state.selectedTopic && formOf(state.selectedTopic)) {
    const label = topicDisplay(state.selectedTopic);
    const cap = label[0].toUpperCase() + label.slice(1);
    tabs.append(btn(cap, () => openSelectedForm()));
  } else {
    const stub = btn("Form", () => {});
    stub.disabled = true;
    tabs.append(stub);
  }
  fill.append(tabs);
  fill.append(state.gpTab === "form" && state.form && state.formState ? formView() : selectorView());
  return windowFrame({
    title: "Data entry",
    className: "win-gp",
    fill,
    close: () => closeGpWindow(),
    inert: state.popups.length > 0 || state.packWindowOpen,
    z: 3,
    menuItems: windowMenuItems(),
  });
}

function closeGpWindow(): void {
  state.gpOpen = false;
  state.gpTab = "topics";
  state.form = null;
  state.formState = null;
  state.popups = [];
  render();
}

function popupWindow(popup: FormPopup, index: number): HTMLElement {
  const top = index === state.popups.length - 1;
  const fill = el("div");
  fill.append(formFields(popup.form, popup.formState, (fs) => {
    if (!top) return;
    state.popups = updateTopPopup(state.popups, fs);
    render();
  }, index));
  const actions = el("div", { class: "actions" });
  const accept = btn("Accept", () => acceptPopup(), "primary");
  accept.disabled = !top || !popupAcceptEnabled(popup);
  actions.append(
    accept,
    btn("Reset", () => {
      if (!top) return;
      state.confirm = {
        title: "Reset this window?",
        message: "Clear the values in this more… window only. The parent form is left alone.",
        yes: "Reset",
        onYes: () => { state.popups = resetTopPopup(state.popups); },
      };
      render();
    }),
    btn("Cancel", () => { if (top) { state.popups = cancelTopPopup(state.popups); render(); } }),
  );
  fill.append(actions);
  const win = windowFrame({
    title: popupTitle(popup.form),
    className: "win-popup",
    fill,
    close: top ? () => { state.popups = cancelTopPopup(state.popups); render(); } : null,
    inert: !top,
    top: `${88 + index * 28}px`,
    left: `${240 + index * 28}px`,
    z: 10 + index,
  });
  if (top) {
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-modal", "true");
    trapFocus(win);
  }
  return win;
}

function trapFocus(box: HTMLElement, autofocus = true): void {
  const focusables = () =>
    [...box.querySelectorAll<HTMLElement>('button:not([disabled]), input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')];
  box.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab") return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    if (ev.shiftKey && document.activeElement === first) {
      last.focus();
      ev.preventDefault();
    } else if (!ev.shiftKey && document.activeElement === last) {
      first.focus();
      ev.preventDefault();
    }
  });
  if (autofocus) setTimeout(() => focusables()[0]?.focus(), 0);
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
    btn("Image pack…", () => { void openPackWindow(); }, "primary"),
    btn(state.aboutOpen ? "Back to host" : "About / credits", () => {
      state.aboutOpen = !state.aboutOpen;
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
    const b = btn("", () => openSelector(item.kind));
    const keyrow = el("span", { class: "launch-keyrow" });
    keyrow.append(el("span", { class: "launch-key" }, item.key), el("span", { class: "khint" }, item.hint));
    b.append(keyrow, el("span", { class: "launch-name" }, selectorTitles[item.kind]));
    b.title = selectorTitles[item.kind];
    b.setAttribute("aria-label", `${item.key}: ${selectorTitles[item.kind]}`);
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
          state.gpOpen = false;
          state.gpTab = "topics";
          state.form = null;
          state.formState = null;
          state.popups = [];
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
  if (state.pack && state.pack !== next) state.pack.dispose();
  setActivePack(next);
  state.pack = next;
  state.packError = null;
  state.localFallback = false;
  state.openInset = null;
  state.hover = null;
}

function windowMenuItems(): MenuItem[] {
  return [
    { label: "Image pack…", action: () => { void openPackWindow(); } },
    { label: "About / credits", action: () => { state.aboutOpen = true; } },
  ];
}

async function refreshPackList(): Promise<void> {
  try {
    state.packList = await listAvailablePacks(state.pack.key);
  } catch (err) {
    state.packError = formatPackError(err);
  }
  render();
}

async function openPackWindow(): Promise<void> {
  state.packWindowOpen = true;
  state.menu = null;
  render();
  await refreshPackList();
}

function clearPackQuery(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("pack");
  window.history.replaceState(null, "", url);
}

async function ingestPackBytes(bytes: Uint8Array): Promise<void> {
  state.packBusy = true;
  state.packError = null;
  render();
  try {
    applyPack(await installPackZip(bytes));
    clearImagesQuery();
    clearPackQuery();
    state.packList = await listAvailablePacks(state.pack.key);
  } catch (err) {
    state.packError = formatPackError(err);
  } finally {
    state.packBusy = false;
    render();
  }
}

async function ingestPackFile(file: File): Promise<void> {
  if (!file) return;
  if (file.name && !file.name.toLowerCase().endsWith(".zip") && file.type && file.type !== "application/zip" && file.type !== "application/x-zip-compressed") {
    state.packError = "Please choose a .zip image pack.";
    render();
    return;
  }
  await ingestPackBytes(new Uint8Array(await file.arrayBuffer()));
}

function packControls(): HTMLElement {
  const wrap = el("div", { class: "pack-controls" });
  const origin = state.pack.origin === "builtin"
    ? "Built-in pack"
    : state.pack.origin === "local"
      ? "Local dev pack"
      : "Uploaded pack";
  wrap.append(el("div", { class: "note" }, `${origin}: ${state.pack.config.name} (${state.pack.config.id} v${state.pack.config.version})`));
  wrap.append(btn("Image pack…", () => { void openPackWindow(); }));
  return wrap;
}

function packWindowView(): HTMLElement {
  const panel = el("div", { class: "panel pack-window" });
  panel.append(el("p", { class: "note" }, "Artwork and click-area coordinates come from an image pack. The packs listed below stay in this browser until you remove them."));

  const zone = el("div", { class: "pack-drop" });
  zone.append(
    el("strong", {}, "Drop a pack .zip here"),
    el("div", { class: "note" }, "or choose a file from your computer"),
  );
  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".zip,application/zip";
  file.className = "pack-file";
  file.addEventListener("change", () => {
    const f = file.files?.[0];
    if (f) void ingestPackFile(f);
    file.value = "";
  });
  zone.addEventListener("dragover", (ev) => {
    ev.preventDefault();
    zone.classList.add("over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (ev) => {
    ev.preventDefault();
    zone.classList.remove("over");
    const f = ev.dataTransfer?.files?.[0];
    if (f) void ingestPackFile(f);
  });
  const choose = btn("Choose .zip…", () => file.click(), "primary");
  if (state.packBusy) choose.disabled = true;
  const row = el("div", { class: "row" });
  row.append(choose, file);
  zone.append(row);
  panel.append(zone);

  const urlRow = el("div", { class: "row pack-url-row" });
  const urlInput = el("input", { type: "url", placeholder: "https://…/pack.zip", "aria-label": "Pack zip URL" }) as HTMLInputElement;
  const loadUrl = btn("Load from URL", () => {
    const href = urlInput.value.trim();
    if (!href) {
      state.packError = "That pack address is empty.";
      render();
      return;
    }
    void (async () => {
      state.packBusy = true;
      state.packError = null;
      render();
      try {
        applyPack(await installPackFromUrl(href, window.location.href));
        clearImagesQuery();
        clearPackQuery();
        state.packList = await listAvailablePacks(state.pack.key);
      } catch (err) {
        state.packError = formatPackError(err);
      } finally {
        state.packBusy = false;
        render();
      }
    })();
  });
  if (state.packBusy) loadUrl.disabled = true;
  urlRow.append(el("span", { class: "note" }, "Or load a pack zip from a URL:"), urlInput, loadUrl);
  panel.append(urlRow);

  if (state.packError) panel.append(el("p", { class: "pack-error" }, state.packError));
  if (state.packBusy) panel.append(el("p", { class: "note" }, "Working…"));

  panel.append(el("h3", {}, "Installed packs"));
  const list = el("div", { class: "pack-list" });
  const items = state.packList;
  if (!items) {
    list.append(el("p", { class: "note" }, "Loading pack list…"));
  } else if (!items.length) {
    list.append(el("p", { class: "note" }, "No packs were found."));
  } else {
    for (const item of items) {
      list.append(packListRow(item));
    }
  }
  panel.append(list);

  const actions = el("div", { class: "actions" });
  const revert = btn("Revert to built-in pack", () => {
    void (async () => {
      state.packBusy = true;
      render();
      try {
        applyPack(await revertToBuiltin());
        clearImagesQuery();
        clearPackQuery();
        state.packList = await listAvailablePacks(state.pack.key);
      } catch (err) {
        state.packError = formatPackError(err);
      } finally {
        state.packBusy = false;
        render();
      }
    })();
  });
  const onDefault = state.pack.key === DEFAULT_BUILTIN_KEY;
  revert.disabled = onDefault || state.packBusy;
  actions.append(
    revert,
    btn("Close", () => { state.packWindowOpen = false; render(); }),
  );
  panel.append(actions);
  return panel;
}

function packListRow(item: PackListItem): HTMLElement {
  const row = el("div", { class: "pack-item" + (item.active ? " active" : "") });
  if (item.previewUrl) {
    const thumb = document.createElement("img");
    thumb.className = "pack-thumb";
    thumb.src = item.previewUrl;
    thumb.alt = `${item.name}: male full-body preview`;
    thumb.width = 48;
    thumb.height = 66;
    thumb.addEventListener("error", () => thumb.remove());
    row.append(thumb);
  }
  const body = el("div", { class: "pack-item-body" });
  const head = el("div", { class: "spread" });
  const title = el("div");
  const name = el("strong", {}, item.name);
  const marks: string[] = [];
  if (item.active) marks.push("active");
  if (item.origin === "builtin") marks.push("built-in");
  else if (item.origin === "idb") marks.push("uploaded");
  else marks.push("local dev");
  title.append(name, el("span", { class: "pack-flags" }, ` · ${marks.join(" · ")}`));
  title.append(el("div", { class: "note" }, `${item.id} v${item.version} · ${item.imageCount} pictures`));
  head.append(title);
  const btns = el("div", { class: "row" });
  if (!item.active) {
    const use = btn("Use this pack", () => {
      void (async () => {
        state.packBusy = true;
        state.packError = null;
        render();
        try {
          applyPack(await switchToPack(item.key));
          clearImagesQuery();
          if (item.origin !== "idb") clearPackQuery();
          state.packList = await listAvailablePacks(state.pack.key);
        } catch (err) {
          state.packError = formatPackError(err);
        } finally {
          state.packBusy = false;
          render();
        }
      })();
    }, "primary");
    if (state.packBusy) use.disabled = true;
    btns.append(use);
  } else {
    btns.append(el("span", { class: "note" }, "This is the pack in use."));
  }
  if (item.removable) {
    const rm = btn("Remove", () => {
      state.confirm = {
        title: "Remove this pack?",
        message: `“${item.name}” will be deleted from this browser’s storage. The built-in packs are not deleted.`,
        yes: "Remove",
        onYes: () => {
          void (async () => {
            try {
              applyPack(await removeUserPack(item.key));
              state.packList = await listAvailablePacks(state.pack.key);
            } catch (err) {
              state.packError = formatPackError(err);
            }
            render();
          })();
        },
      };
      render();
    }, "danger");
    if (state.packBusy) rm.disabled = true;
    btns.append(rm);
  }
  head.append(btns);
  body.append(head);
  const credits: string[] = [];
  credits.push(`Licence: ${item.license.name}` + (item.license.spdx ? ` (${item.license.spdx})` : ""));
  if (item.license.notice) credits.push(item.license.notice);
  if (item.attribution) credits.push(item.attribution);
  if (item.description) credits.push(item.description);
  body.append(el("p", { class: "note pack-credits" }, credits.join(" ")));
  row.append(body);
  return row;
}

function openSelector(kind: SelectorKind): void {
  state.selectorKind = kind;
  state.system = DEFAULT_SYSTEM;
  state.location = null;
  state.openInset = null;
  state.hover = null;
  state.topicQuery = "";
  state.selectedTopic = null;
  state.gpOpen = true;
  state.gpTab = "topics";
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
        "Hand-built thumb-path forms are always available. Other topics open a form when a generated catalogue has been loaded; otherwise they show as stubs.",
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
    btn("Cancel", () => closeGpWindow()),
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
    inset.width = width;
    inset.height = height;
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
      message: `“${topicDisplay(id)}” is in the topic catalogue, but no form definition is loaded for it. Hand-built forms always apply; a locally generated catalogue fills the rest when present.`,
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
  state.popups = [];
  state.gpOpen = true;
  state.gpTab = "form";
  render();
}

function formView(): HTMLElement {
  const form = state.form;
  const fs = state.formState;
  if (!form || !fs) return el("div", {}, "Missing form");
  const panel = el("div", { class: "form-panel" });
  const grid = el("div", { class: "form-grid" });
  grid.append(
    formFields(form, fs, (next) => { state.formState = next; render(); }, "main"),
    summaryPane(form, fs),
  );
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

function formFields(form: RemakeForm, fs: FormState, commit: (next: FormState) => void, from: PopupParent): HTMLElement {
  const col = el("div");
  const desc = el("section", { class: "section" });
  desc.append(el("h3", {}, "Descriptors"));
  for (const row of rowsOf(form, fs.moreOpen, fs)) {
    desc.append(featureRow(form, fs, row, commit));
  }
  if (hasMoreLayer(form)) {
    const more = btn(fs.moreOpen ? "<< hide" : ">> more", () => {
      commit({ ...fs, moreOpen: !fs.moreOpen });
    });
    desc.append(more);
  }
  col.append(desc);

  if (form.associatedSymptomsAndSigns?.length) {
    col.append(linkSection("Associated symptoms and signs", "associated", form.associatedSymptomsAndSigns, fs, commit, from));
  }
  if (form.diagnoses?.length) {
    col.append(linkSection("Diagnoses", "diagnoses", form.diagnoses, fs, commit, from));
  }
  if (form.otherLinks?.length) {
    col.append(linkSection("Other", "associated", form.otherLinks, fs, commit, from));
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
    // Do not re-render on each keystroke (that would steal focus).
    const next = { ...fs, comment: ta.value };
    if (from === "main") {
      if (state.formState) state.formState = next;
    } else {
      state.popups = updateTopPopup(state.popups, next);
    }
  });
  com.append(ta);
  col.append(com);
  return col;
}

function featureRow(form: RemakeForm, fs: FormState, row: FormRow, commit: (next: FormState) => void): HTMLElement {
  const feature = rowKey(row);
  const multiple = row.multiple === true;
  const values = row.values ?? [];
  const wrap = el("div", { class: "feat" });
  wrap.append(el("div", { class: "name" }, featureLabel(row.criterialLink ?? row.feature ?? feature)));
  if (feature === "laterality") {
    const chips = el("div", { class: "chips" });
    for (const side of ["left", "right"] as LateralityChoice[]) {
      const b = btn(side, () => {
        commit(toggleLaterality(fs, side, multiple));
      });
      if (fs.laterality.includes(side)) b.classList.add("on");
      chips.append(b);
    }
    wrap.append(chips);
    wrap.addEventListener("contextmenu", (ev) => {
      ev.preventDefault();
      openMenu(ev.clientX, ev.clientY, [
        { label: "left", action: () => { commit(toggleLaterality({ ...fs, laterality: [] }, "left", false)); } },
        { label: "right", action: () => { commit(toggleLaterality({ ...fs, laterality: [] }, "right", false)); } },
        { label: "Clear", action: () => { commit({ ...fs, laterality: [] }); } },
      ]);
    });
    return wrap;
  }
  if (feature === "sublocation") {
    const chips = el("div", { class: "chips" });
    const selected = new Set(fs.features.sublocation?.values ?? (fs.subLocation ? [fs.subLocation] : []));
    for (const raw of values) {
      const value = valueKey(raw);
      const b = btn(valueLabel(value), () => {
        commit(setSubLocation(fs, value, multiple));
      });
      if (selected.has(value)) b.classList.add("on");
      chips.append(b);
    }
    wrap.append(chips);
    return wrap;
  }
  if (feature === "QuantityDuration" || values.includes("TemporalValue") || isQuantityRow(row)) {
    const dur = el("div", { class: "duration" });
    const sel = fs.features[feature];
    const token = typeof values[0] === "string" ? String(values[0]) : "TemporalValue";
    const timeLike = token === "TemporalValue" || token === "PastHistoryValue" || /Duration|Time/.test(token) || feature === "QuantityDuration";
    const num = document.createElement("input");
    num.type = "number";
    num.min = "0";
    num.step = "1";
    num.value = sel?.number ? String(sel.number) : "";
    const apply = (unit: string) => {
      const n = num.value === "" ? undefined : Number(num.value);
      commit(setQuantity(fs, feature, token, Number.isFinite(n as number) ? n : undefined, unit));
    };
    if (timeLike) {
      const unit = document.createElement("select");
      for (const u of DURATION_UNITS) {
        const opt = document.createElement("option");
        opt.value = u;
        opt.textContent = u + "s";
        if ((sel?.unit ?? "day") === u) opt.selected = true;
        unit.append(opt);
      }
      num.addEventListener("change", () => { apply(unit.value); });
      unit.addEventListener("change", () => { apply(unit.value); });
      dur.append(num, unit);
    } else {
      const unit = document.createElement("input");
      unit.type = "text";
      unit.className = "qty-unit";
      unit.placeholder = "unit";
      unit.value = sel?.unit ?? "";
      num.addEventListener("change", () => { apply(unit.value); });
      unit.addEventListener("change", () => { apply(unit.value); });
      dur.append(num, unit);
    }
    wrap.append(dur);
    return wrap;
  }
  const chips = el("div", { class: "chips" });
  const selected = new Set(fs.features[feature]?.values ?? []);
  for (const raw of values) {
    const value = valueKey(raw);
    const b = btn(valueLabel(raw), () => {
      commit(setFeatureValue(fs, feature, value, multiple));
    });
    if (selected.has(value)) b.classList.add("on");
    chips.append(b);
  }
  wrap.append(chips);
  wrap.addEventListener("contextmenu", (ev) => {
    ev.preventDefault();
    const items: MenuItem[] = values.map((raw) => ({
      label: valueLabel(raw),
      action: () => { commit(setFeatureValue({ ...fs, features: { ...fs.features, [feature]: { values: [] } } }, feature, valueKey(raw), false)); },
    }));
    items.push({ label: "Clear", action: () => { commit(setFeatureValue({ ...fs, features: { ...fs.features, [feature]: { values: [fs.features[feature]?.values[0] ?? ""] } } }, feature, fs.features[feature]?.values[0] ?? "", false)); } });
    openMenu(ev.clientX, ev.clientY, items);
  });
  void form;
  return wrap;
}

function linkSection(title: string, bag: "associated" | "diagnoses", links: FormLink[], fs: FormState, commit: (next: FormState) => void, from: PopupParent): HTMLElement {
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
        commit(setLinkSummary(fs, bag, link.item, cur === s ? undefined : s));
      });
      if (cur === s) b.classList.add("on");
      row.append(b);
    }
    const more = btn("more…", () => openNested(bag, link, from));
    if (linkHasAcceptedForm(fs, bag, link.item)) more.classList.add("on");
    if (!formOf(link.preCoordinated ?? link.concept)) more.disabled = true;
    row.append(more);
    sec.append(row);
  }
  return sec;
}

function openNested(bag: "associated" | "diagnoses", link: FormLink, from: PopupParent): void {
  if (!state.form || !state.formState) return;
  const opened = openPopup(state.form, state.formState, state.popups, bag, link, from);
  if ("error" in opened) return;
  state.popups = opened;
  render();
}

function acceptPopup(): void {
  if (!state.formState || !state.popups.length) return;
  const next = acceptTopPopup(state.formState, state.popups);
  state.formState = next.main;
  state.popups = next.popups;
  render();
}

function acceptForm(): void {
  const form = state.form;
  const fs = state.formState;
  if (!form || !fs) return;
  if (state.popups.length) {
    acceptPopup();
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
  closeGpWindow();
}

function cancelForm(): void {
  if (state.popups.length) {
    state.popups = cancelTopPopup(state.popups);
    render();
    return;
  }
  closeGpWindow();
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
      "Artwork in the public build defaults to a built-in CC0 Leonardo-style anatomical folio pack (made with Google Antigravity; newly created, dedicated to the public domain, not copied or traced from the 1998 bitmaps). A CC0 clinical vector pack and a simpler CC0 outline pack are also shipped and can be chosen in the Image pack window. You can upload further pack zips; they stay in this browser’s IndexedDB until you remove them. A pack produced locally from the 1998 demo (via the extractor’s --image-pack option) must never be committed or published. Developers can also load an unpacked pack from remake/local-originals/ with ?images=local, or pass ?pack= with the URL of a pack zip.",
    ),
  );
  panel.append(
    el("p", { class: "note" }, "Clinergy content that appears as form and rule data is © 1997–8 Semantic Technologies Ltd / Victoria University of Manchester. This page is part of the PEN&PAD revival."),
  );
  panel.append(
    btn("Close", () => {
      state.aboutOpen = false;
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
    if (state.popups.length) { state.popups = cancelTopPopup(state.popups); render(); ev.preventDefault(); return; }
    if (state.packWindowOpen) { state.packWindowOpen = false; render(); ev.preventDefault(); return; }
    if (state.aboutOpen) { state.aboutOpen = false; render(); ev.preventDefault(); return; }
    if (state.gpOpen && state.gpTab === "topics") { closeGpWindow(); ev.preventDefault(); return; }
    return;
  }
  if (ev.key === "Enter" && !typing && !state.menu && !state.confirm) {
    if (state.popups.length) {
      const top = state.popups[state.popups.length - 1];
      if (popupAcceptEnabled(top)) { acceptPopup(); ev.preventDefault(); }
      return;
    }
  }
  if (typing) return;
  if (!state.gpOpen && !state.aboutOpen && !state.packWindowOpen) {
    if (ev.key === "F4") { openSelector("QDE"); ev.preventDefault(); }
    else if (ev.key === "s" || ev.key === "S") openSelector("SYM");
    else if (ev.key === "d" || ev.key === "D") openSelector("DIS");
    else if (ev.key === "c" || ev.key === "C") openSelector("CHK");
    else if (ev.key === "f" || ev.key === "F") openSelector("FH");
    else if (ev.key === "p" || ev.key === "P") openSelector("PMH");
    else if (ev.key === "i" || ev.key === "I") openSelector("INT");
  }
}
