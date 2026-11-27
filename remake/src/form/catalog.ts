import {
  applyGeneratedSentenceKnowledge,
  setGeneratedExams,
  setGeneratedForms,
  type RemakeForm,
} from "../knowledge-data.ts";
import { GENERATED_FORMS_SCHEMA, type GeneratedCatalog } from "./generate.ts";
import { GENERATED_EXAMS_SCHEMA, type GeneratedExamsCatalog } from "./exams.ts";
import {
  GENERATED_SENTENCES_SCHEMA,
  type GeneratedSentenceKnowledge,
} from "../sentence/generate.ts";

function generatedUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? "/";
  return `${base}remake/generated/${file}`;
}

/** Committed remake form catalogue (public/remake/generated/forms.json). */
export function generatedFormsUrl(): string {
  return generatedUrl("forms.json");
}

export function generatedExamsUrl(): string {
  return generatedUrl("exams.json");
}

export function generatedSentencesUrl(): string {
  return generatedUrl("sentences.json");
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function loadGeneratedForms(): Promise<number> {
  const data = (await fetchJson(generatedFormsUrl())) as GeneratedCatalog | null;
  if (!data || data.schema !== GENERATED_FORMS_SCHEMA || !data.forms || typeof data.forms !== "object") {
    setGeneratedForms(null);
    return 0;
  }
  setGeneratedForms(data.forms as Record<string, RemakeForm>);
  return Object.keys(data.forms).length;
}

export async function loadGeneratedExams(): Promise<number> {
  const data = (await fetchJson(generatedExamsUrl())) as GeneratedExamsCatalog | null;
  if (!data || data.schema !== GENERATED_EXAMS_SCHEMA || !data.exams || typeof data.exams !== "object") {
    setGeneratedExams(null);
    return 0;
  }
  setGeneratedExams(data);
  return Object.keys(data.exams).length;
}

export async function loadGeneratedSentences(): Promise<boolean> {
  const data = (await fetchJson(generatedSentencesUrl())) as GeneratedSentenceKnowledge | null;
  if (!data || data.schema !== GENERATED_SENTENCES_SCHEMA || !data.rules || !data.concepts) {
    applyGeneratedSentenceKnowledge(null);
    return false;
  }
  applyGeneratedSentenceKnowledge(data);
  return true;
}

/** Load forms, exams, and sentence knowledge in parallel. */
export async function loadGeneratedCatalogs(): Promise<{ forms: number; exams: number; sentences: boolean }> {
  const [forms, exams, sentences] = await Promise.all([
    loadGeneratedForms(),
    loadGeneratedExams(),
    loadGeneratedSentences(),
  ]);
  return { forms, exams, sentences };
}
