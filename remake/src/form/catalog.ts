import { setGeneratedForms, type RemakeForm } from "../knowledge-data.ts";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog } from "./generate.ts";

/** Committed remake form catalogue (public/remake/generated/forms.json). */
export function generatedFormsUrl(): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}remake/generated/forms.json`;
}

export async function loadGeneratedForms(): Promise<number> {
  try {
    const res = await fetch(generatedFormsUrl());
    if (res.status === 404) {
      setGeneratedForms(null);
      return 0;
    }
    if (!res.ok) {
      setGeneratedForms(null);
      return 0;
    }
    const data = (await res.json()) as GeneratedCatalog;
    if (data?.schema !== GENERATED_FORMS_SCHEMA || !data.forms || typeof data.forms !== "object") {
      setGeneratedForms(null);
      return 0;
    }
    setGeneratedForms(data.forms as Record<string, RemakeForm>);
    return Object.keys(data.forms).length;
  } catch {
    setGeneratedForms(null);
    return 0;
  }
}
