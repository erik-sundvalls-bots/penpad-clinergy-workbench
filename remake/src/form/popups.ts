import type { FormLink, RemakeForm } from "../knowledge-data.ts";
import { formOf } from "../knowledge-data.ts";
import { emptyFormState, isFormDirty, type FormState, type LinkSelection } from "./engine.ts";

export type PopupParent = "main" | number;

export interface FormPopup {
  bag: "associated" | "diagnoses";
  key: string;
  form: RemakeForm;
  formState: FormState;
  /** Snapshot when the window was opened; Accept stays disabled until this differs. */
  openedState: FormState;
  /** Write back to the main topic form, or to the popup at this index. */
  parent: PopupParent;
}

export function cloneFormState(state: FormState): FormState {
  return structuredClone(state);
}

export function statesEqual(a: FormState, b: FormState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function popupAcceptEnabled(popup: FormPopup): boolean {
  return !statesEqual(popup.formState, popup.openedState);
}

export function targetFormState(main: FormState, popups: FormPopup[], parent: PopupParent): FormState {
  return parent === "main" ? main : popups[parent].formState;
}

/** Open a more… window on the main form or on the current top popup. */
export function openPopup(
  mainForm: RemakeForm,
  mainState: FormState,
  popups: FormPopup[],
  bag: "associated" | "diagnoses",
  link: FormLink,
  from: PopupParent,
): FormPopup[] | { error: string } {
  const topic = link.preCoordinated ?? link.concept;
  const nested = formOf(topic);
  if (!nested) return { error: `No form for ${topic}` };
  const parentState = targetFormState(mainState, popups, from);
  const existing = parentState[bag][link.item]?.form;
  const formState = cloneFormState(
    existing ??
      emptyFormState(nested, {
        location: link.location ?? nested.location ?? parentState.location,
      }),
  );
  const popup: FormPopup = {
    bag,
    key: link.item,
    form: nested,
    formState,
    openedState: cloneFormState(formState),
    parent: from,
  };
  return [...popups, popup];
}

export function writePopupBack(
  main: FormState,
  popups: FormPopup[],
  popup: FormPopup,
  formState: FormState,
): { main: FormState; popups: FormPopup[] } {
  const sel: LinkSelection = {
    summary: targetFormState(main, popups, popup.parent)[popup.bag][popup.key]?.summary ??
      (isFormDirty(formState) ? "presence" : undefined),
    form: formState,
  };
  if (!sel.summary && !isFormDirty(formState)) {
    return { main, popups };
  }
  if (popup.parent === "main") {
    return {
      main: { ...main, [popup.bag]: { ...main[popup.bag], [popup.key]: sel } },
      popups,
    };
  }
  const parent = popups[popup.parent];
  const nextParent: FormPopup = {
    ...parent,
    formState: { ...parent.formState, [popup.bag]: { ...parent.formState[popup.bag], [popup.key]: sel } },
  };
  const next = popups.slice();
  next[popup.parent] = nextParent;
  return { main, popups: next };
}

/** Accept the top popup and close it. No-op (still closes) if nothing changed and no prior data. */
export function acceptTopPopup(main: FormState, popups: FormPopup[]): { main: FormState; popups: FormPopup[] } {
  if (!popups.length) return { main, popups };
  const top = popups[popups.length - 1];
  const written = writePopupBack(main, popups.slice(0, -1), top, top.formState);
  return written;
}

export function cancelTopPopup(popups: FormPopup[]): FormPopup[] {
  return popups.slice(0, -1);
}

export function resetTopPopup(popups: FormPopup[]): FormPopup[] {
  if (!popups.length) return popups;
  const top = popups[popups.length - 1];
  const next = popups.slice();
  next[next.length - 1] = { ...top, formState: cloneFormState(top.openedState) };
  return next;
}

export function updateTopPopup(popups: FormPopup[], formState: FormState): FormPopup[] {
  if (!popups.length) return popups;
  const next = popups.slice();
  next[next.length - 1] = { ...next[next.length - 1], formState };
  return next;
}

export function popupTitle(form: RemakeForm): string {
  const name = form.display[0].toUpperCase() + form.display.slice(1);
  return `More on ${name}`;
}

export function linkHasAcceptedForm(state: FormState, bag: "associated" | "diagnoses", key: string): boolean {
  return !!state[bag][key]?.form;
}
