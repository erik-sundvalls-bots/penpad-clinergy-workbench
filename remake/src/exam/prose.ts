/**
 * "On Examination" narrative. The layout and wording follow the public
 * thumb-pain walkthrough (heading, one line per examined side, indented
 * sub-exam line with movements joined by semicolons; e.g. "flexion full
 * range, mildly painful"). One indented line is emitted per examined site,
 * never collapsing several sites onto the last label. Feature values come from the extract (range
 * tokens and ConseqPainOnMovement painless / mildly painful / moderately painful / severely painful).
 *
 * The 1998 engine source is not in this repository. Phrases that the
 * walkthrough does not illustrate are composed from concept displays and
 * the sentence generator, and should be treated as less certain.
 */
import type { ExamDefinition } from "../form/exams.ts";
import {
  findingsFromForm,
  getExamSign,
  getExamSiteStatus,
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

function hasFeatureValues(state: FormState): boolean {
  return Object.values(state.features).some((f) => f.values.length || (f.number ?? 0) > 0);
}

function signSentence(sign: string, state: FormState, form: RemakeForm, laterality: Finding["laterality"], location: string | null): string | null {
  if (!isFormDirty(state) && !state.summary) return null;
  // Compact presence/absence when no qualifiers are set.
  if (state.summary && !hasFeatureValues(state)) {
    const name = (form.display || conceptDisplay(sign)).toLowerCase();
    if (state.summary === "presence") return `${name} present`;
    if (state.summary === "absence") return `no ${name}`;
  }
  // Drop the locative: the On Examination site label already names the place
  // ("Right kidney: tender, medium size, … lump present").
  void laterality;
  void location;
  const localized: FormState = {
    ...state,
    location: null,
    laterality: [],
    subLocation: undefined,
  };
  const nested = findingsFromForm(form, localized, { includeExams: false });
  const finding = nested[0];
  if (!finding) {
    const name = (form.display || conceptDisplay(sign)).toLowerCase();
    if (state.summary === "presence") return `${name} present`;
    if (state.summary === "absence") return `no ${name}`;
    return null;
  }
  const rendered = renderSentence(finding, getSentenceKnowledge());
  return rendered || null;
}

function sideState(formState: FormState, exam: string, side: ExamSideKey): ExamSideState | undefined {
  return formState.exams?.[exam]?.sides?.[side];
}

function siteName(definition: ExamDefinition): string {
  // Prefer the exam display (original site label, e.g. "Right kidney") over the
  // concept display, which is often uncapitalised.
  return definition.display || (definition.baseLocation && conceptDisplay(definition.baseLocation)) || definition.name;
}

function lateralityOf(side: ExamSideKey): Finding["laterality"] {
  return side === "left" || side === "right" ? side : undefined;
}

function statusPhrases(status: string | undefined): string[] {
  if (!status) return [];
  if (status === "normal") return ["normal"];
  if (status === "notExamined") return ["not examined"];
  return [status.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase()];
}

function signPhrases(
  signs: string[],
  state: ExamSideState,
  siteExam: string | undefined,
  laterality: Finding["laterality"],
  location: string | null,
): string[] {
  const parts: string[] = [];
  for (const sign of signs) {
    const form = formOf(sign);
    const st = getExamSign(state, sign, siteExam);
    if (!st) continue;
    if (isMovementSign(form)) {
      const phrase = movementPhrase(sign, st, form);
      if (phrase) parts.push(phrase);
      continue;
    }
    if (form) {
      const phrase = signSentence(sign, st, form, laterality, location);
      if (phrase) parts.push(uncapitalise(phrase));
    }
  }
  return parts;
}

function formatExamLine(label: string, parts: string[], indent: string, joinWith: string): string {
  const statusOnly = parts.length > 0 && parts.every((b) => b === "normal" || b === "not examined");
  if (statusOnly) return `${indent}${label} ${parts.join(", ")}`;
  return `${indent}${label}: ${parts.join(joinWith)}`;
}

function sideLines(
  entry: FormExam,
  definition: ExamDefinition,
  formState: FormState,
  side: ExamSideKey,
): string[] | null {
  const state = sideState(formState, entry.exam, side);
  if (!state) return null;
  const place = siteName(definition);
  const label = sideLabel(side);
  const headerHead = label ? `${label} ${place}` : place;
  const laterality = lateralityOf(side);
  const bits = [
    ...statusPhrases(state.status),
    ...signPhrases(definition.signs, state, entry.exam, laterality, definition.baseLocation),
  ];
  const siteLines: string[] = [];
  const walk = (def: ExamDefinition) => {
    for (const subName of def.subExams) {
      const sub = examOf(subName);
      if (!sub) continue;
      const subPlace = siteName(sub);
      const jointLabel = label ? `${label} ${subPlace}` : subPlace;
      const parts = [
        ...statusPhrases(getExamSiteStatus(state, subName)),
        ...signPhrases(sub.signs, state, subName, laterality, sub.baseLocation ?? definition.baseLocation),
      ];
      if (parts.length) siteLines.push(formatExamLine(jointLabel, parts, "  ", "; "));
      walk(sub);
    }
  };
  walk(definition);
  if (!bits.length && !siteLines.length) return null;
  const header = !bits.length
    ? `${headerHead}:`
    : formatExamLine(headerHead, bits, "", ", ");
  return [header, ...siteLines];
}

/** The whole examination block, or "" when nothing was examined. */
export function onExamination(form: RemakeForm, formState: FormState): string {
  const lines: string[] = [];
  for (const entry of form.examinations ?? []) {
    const definition = examOf(entry.exam);
    if (!definition) continue;
    for (const side of examSidesFor(entry, definition)) {
      const block = sideLines(entry, definition, formState, side);
      if (!block) continue;
      lines.push(...block);
    }
  }
  if (!lines.length) return "";
  return ["On Examination", ...lines.map(capitaliseLine)].join("\n");
}

function capitaliseLine(line: string): string {
  const match = /^(\s*)(.*)$/.exec(line);
  if (!match || !match[2]) return line;
  return match[1] + match[2].charAt(0).toUpperCase() + match[2].slice(1);
}
