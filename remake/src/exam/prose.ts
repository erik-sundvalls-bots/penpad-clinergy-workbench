/**
 * "On Examination" narrative. The layout and wording follow the public
 * thumb-pain walkthrough (heading, one line per examined side, indented
 * sub-exam line with movements joined by semicolons; e.g. "flexion full
 * range, mildly painful"). Feature values come from the extract (range
 * tokens and ConseqPainOnMovement painless / mildly painful / moderately painful / severely painful).
 *
 * The 1998 engine source is not in this repository. Phrases that the
 * walkthrough does not illustrate are composed from concept displays and
 * the sentence generator, and should be treated as less certain.
 */
import type { ExamDefinition } from "../form/exams.ts";
import {
  isFormDirty,
  rowKey,
  type ExamSideKey,
  type ExamSideState,
  type FormState,
} from "../form/engine.ts";
import type { FormExam, RemakeForm } from "../knowledge-data.ts";
import { conceptDisplay, examOf, formOf } from "../knowledge-data.ts";
import { renderSentence } from "../sentence/render.ts";
import { getSentenceKnowledge } from "../knowledge-data.ts";
import type { Finding } from "../sentence/types.ts";

const RANGE_NOUN = "range";

const PAIN_PHRASE: Record<string, string> = {
  absence: "painless",
  mild: "mildly painful",
  moderate: "moderately painful",
  severe: "severely painful",
};

export function examSidesFor(entry: FormExam, definition: ExamDefinition | null): ExamSideKey[] {
  if (entry.perSide?.length) {
    return entry.perSide.filter((s): s is ExamSideKey => s === "left" || s === "right" || s === "all");
  }
  if (definition?.lateral) return ["left", "right"];
  return ["all"];
}

export function sideLabel(side: ExamSideKey): string {
  if (side === "left") return "Left";
  if (side === "right") return "Right";
  return "";
}

function uncapitalise(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function rangePhrase(value: string): string {
  const key = value.replace(/Range$/i, "");
  const adjective = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  if (/\brange\b/i.test(adjective)) return adjective;
  return `${adjective} ${RANGE_NOUN}`.trim();
}

function isMovementSign(form: RemakeForm | null): boolean {
  if (!form) return false;
  const rows = [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])];
  return rows.some((row) => (row.feature ?? "").startsWith("RelativeRange") || row.criterialLink === "ConseqPainOnMovement");
}

function movementPhrase(sign: string, state: FormState | undefined, form: RemakeForm | null): string | null {
  if (!state || !form) return null;
  let range: string | null = null;
  let pain: string | null = null;
  for (const row of [...form.firstLayer, ...form.moreLayer]) {
    const key = rowKey(row);
    const selected = state.features[key]?.values ?? [];
    if ((row.feature ?? "").startsWith("RelativeRange") && selected[0]) range = rangePhrase(selected[0]);
    if (row.criterialLink === "ConseqPainOnMovement" && selected[0]) {
      pain = PAIN_PHRASE[selected[0]] ?? selected[0].replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
    }
  }
  if (!range && !pain) return null;
  const name = (form.display || conceptDisplay(sign)).replace(/ sign$/i, "").toLowerCase();
  const bits = [range, pain].filter((x): x is string => !!x);
  return `${name} ${bits.join(", ")}`;
}

function signSentence(sign: string, state: FormState, form: RemakeForm, laterality: Finding["laterality"], location: string | null): string | null {
  if (!isFormDirty(state) && !state.summary) return null;
  const finding: Finding = {
    topic: form.topic || sign,
    location: state.location ?? location ?? undefined,
    laterality,
    subLocation: state.subLocation,
    qualifiers: [],
    summary: state.summary,
  };
  // Prefer a compact presence phrase for the examination block.
  if (state.summary && !Object.values(state.features).some((f) => f.values.length || (f.number ?? 0) > 0)) {
    const name = (form.display || conceptDisplay(sign)).toLowerCase();
    if (state.summary === "presence") return `${name} present`;
    if (state.summary === "absence") return `no ${name}`;
  }
  const rendered = renderSentence(
    {
      ...finding,
      qualifiers: [],
    },
    getSentenceKnowledge(),
  );
  // Rebuild with features via findings is handled by callers that already
  // have a finding; here we only need a short clause.
  void rendered;
  const name = (form.display || conceptDisplay(sign)).toLowerCase();
  if (state.summary === "presence") return `${name} present`;
  if (state.summary === "absence") return `no ${name}`;
  if (state.summary) return `${name} ${state.summary.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()}`;
  return null;
}

function sideState(formState: FormState, exam: string, side: ExamSideKey): ExamSideState | undefined {
  return formState.exams?.[exam]?.sides?.[side];
}

function siteName(definition: ExamDefinition): string {
  if (definition.baseLocation) return conceptDisplay(definition.baseLocation) || definition.display;
  return definition.display;
}

function lateralityOf(side: ExamSideKey): Finding["laterality"] {
  return side === "left" || side === "right" ? side : undefined;
}

function sideLine(
  entry: FormExam,
  definition: ExamDefinition,
  formState: FormState,
  side: ExamSideKey,
): { header: string; joint: string | null } | null {
  const state = sideState(formState, entry.exam, side);
  if (!state) return null;
  const place = siteName(definition);
  const label = sideLabel(side);
  const headerHead = label ? `${label} ${place}` : place;
  const bits: string[] = [];
  if (state.status === "normal") bits.push("normal");
  if (state.status === "notExamined") bits.push("not examined");
  if (state.status && state.status !== "normal" && state.status !== "notExamined") {
    bits.push(state.status.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase());
  }
  for (const sign of definition.signs) {
    const form = formOf(sign);
    const st = state.signs[sign];
    if (!st || !form) continue;
    if (isMovementSign(form)) continue;
    const phrase = signSentence(sign, st, form, lateralityOf(side), definition.baseLocation);
    if (phrase) bits.push(uncapitalise(phrase));
  }
  const jointParts: string[] = [];
  let jointLabel = "";
  for (const subName of definition.subExams) {
    const sub = examOf(subName);
    if (!sub) continue;
    const subPlace = siteName(sub);
    jointLabel = label ? `${label} ${subPlace}` : subPlace;
    for (const sign of sub.signs) {
      const form = formOf(sign);
      const st = state.signs[sign];
      if (!st) continue;
      if (isMovementSign(form)) {
        const phrase = movementPhrase(sign, st, form);
        if (phrase) jointParts.push(phrase);
        continue;
      }
      if (form) {
        const phrase = signSentence(sign, st, form, lateralityOf(side), sub.baseLocation ?? definition.baseLocation);
        if (phrase) jointParts.push(uncapitalise(phrase));
      }
    }
  }
  if (!bits.length && !jointParts.length) return null;
  const statusOnly = bits.length > 0 && bits.every((b) => b === "normal" || b === "not examined") && !jointParts.length;
  const header = !bits.length
    ? `${headerHead}:`
    : statusOnly
      ? `${headerHead} ${bits.join(", ")}`
      : `${headerHead}: ${bits.join(", ")}`;
  return {
    header,
    joint: jointParts.length && jointLabel ? `  ${jointLabel}: ${jointParts.join("; ")}` : null,
  };
}

/** The whole examination block, or "" when nothing was examined. */
export function onExamination(form: RemakeForm, formState: FormState): string {
  const lines: string[] = [];
  for (const entry of form.examinations ?? []) {
    const definition = examOf(entry.exam);
    if (!definition) continue;
    for (const side of examSidesFor(entry, definition)) {
      const block = sideLine(entry, definition, formState, side);
      if (!block) continue;
      lines.push(block.header);
      if (block.joint) lines.push(block.joint);
    }
  }
  if (!lines.length) return "";
  return ["On Examination", ...lines].join("\n");
}
