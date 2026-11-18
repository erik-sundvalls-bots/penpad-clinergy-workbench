import { examPhrases, type ExamPhrases, type NoteLanguage } from "./phrases.ts";
import { examsByName, examinationsOf, displayOf, type ExamDefinition } from "../forms/catalog.ts";
import type { ExamSide, WorkbenchState } from "../model.ts";

export type { NoteLanguage };

/**
 * On Examination block, in the shape of the 1998 summary:
 * a heading, one line per examined side, and an indented joint line
 * whose movements are separated by semicolons.
 *
 * The wording of range and pain-on-movement follows the public walkthrough
 * (https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/), for example
 * "flexion full range, mildly painful".
 */

function phrase(book: ExamPhrases, group: "movements" | "range" | "pain" | "sides" | "site", key: string): string {
  const table = book[group] as Record<string, string>;
  return table[key] ?? key;
}

function presencePhrase(sign: string, value: string, book: ExamPhrases): string {
  const row = book.signs[sign];
  if (row && (value === "presence" || value === "absence") && row[value]) return row[value];
  const name = displayOf(sign).toLowerCase();
  if (value === "presence") return `${name} present`;
  if (value === "absence") return `${name} absent`;
  return `${name} ${value}`;
}

function movementPhrase(
  sign: string,
  range: string | null,
  pain: string | null,
  book: ExamPhrases,
): string | null {
  if (!range && !pain) return null;
  const name = book.movements[sign] ?? displayOf(sign).replace(/ sign$/i, "").toLowerCase();
  const bits: string[] = [];
  if (range) bits.push(`${phrase(book, "range", range)} ${book.rangeNoun}`.trim());
  if (pain) bits.push(book.pain[pain] ?? pain);
  return `${name} ${bits.join(", ")}`;
}

function fieldOn(exam: ExamSide, key: string): string | null {
  if (!(key in exam)) return null;
  return exam[key as keyof ExamSide];
}

export function movementKeys(sign: string): { range: string; pain: string } | null {
  const base = sign.replace(/Sign$/, "");
  const camel = base.charAt(0).toLowerCase() + base.slice(1);
  const range = `${camel}Range`;
  const pain = `${camel}Pain`;
  const sample: ExamSide = {
    status: null,
    tenderness: null,
    flexionRange: null,
    flexionPain: null,
    extensionRange: null,
    extensionPain: null,
    abductionRange: null,
    abductionPain: null,
    adductionRange: null,
    adductionPain: null,
  };
  if (!(range in sample) || !(pain in sample)) return null;
  return { range, pain };
}

export function presenceKey(sign: string): keyof ExamSide | null {
  const base = sign.replace(/Sign$/, "");
  const key = (base.charAt(0).toLowerCase() + base.slice(1)) as keyof ExamSide;
  if (key === "tenderness") return key;
  return null;
}

export interface ExamMovement {
  sign: string;
  range: string | null;
  pain: string | null;
}

export interface SideExamination {
  side: "left" | "right";
  /** Body-site key, for example Thumb. */
  siteKey: string;
  prose: string;
  status: string | null;
  signs: { sign: string; value: string }[];
  movements: ExamMovement[];
}

function examineSide(
  side: string,
  exam: ExamSide,
  definition: ExamDefinition,
  book: ExamPhrases,
): SideExamination | null {
  const place = book.site[definition.baseLocation] ?? displayOf(definition.baseLocation).toLowerCase();
  const sideLabel = book.sides[side] ?? side;
  const header = `${sideLabel} ${place}`;
  const bits: string[] = [];
  const signs: { sign: string; value: string }[] = [];
  if (exam.status === "normal") bits.push(book.normal);
  if (exam.status === "notExamined") bits.push(book.notExamined);
  for (const sign of definition.signs0 ?? []) {
    const key = presenceKey(sign);
    if (!key) continue;
    const value = exam[key];
    if (!value) continue;
    bits.push(presencePhrase(sign, value, book));
    signs.push({ sign, value });
  }
  const movements: ExamMovement[] = [];
  const jointParts: string[] = [];
  let jointLabel = "";
  for (const subName of definition.subExams ?? []) {
    const sub = examsByName[subName];
    if (!sub) continue;
    jointLabel = `${sideLabel} ${book.joint}`;
    for (const sign of sub.signs0 ?? []) {
      const keys = movementKeys(sign);
      if (!keys) continue;
      const range = fieldOn(exam, keys.range);
      const pain = fieldOn(exam, keys.pain);
      const line = movementPhrase(sign, range, pain, book);
      if (!line) continue;
      jointParts.push(line);
      movements.push({ sign, range, pain });
    }
  }
  if (!bits.length && !jointParts.length) return null;
  const lines: string[] = [];
  lines.push(bits.length ? `${header}: ${bits.join(", ")}` : `${header}:`);
  if (jointParts.length && jointLabel) lines.push(` ${jointLabel}: ${jointParts.join("; ")}`);
  const typedSide = side === "left" ? "left" : "right";
  return {
    side: typedSide,
    siteKey: definition.baseLocation,
    prose: lines.join("\n"),
    status: exam.status,
    signs,
    movements,
  };
}

function activeExam(_state: WorkbenchState): { definition: ExamDefinition; perSide: string[] } | null {
  const declared = examinationsOf(["ThumbPainSymptom", "ThumbSwellingSymptom"]);
  const entry = declared[0];
  const definition = examsByName[entry?.exam ?? "ThumbExam"];
  if (!definition) return null;
  const perSide = entry?.perSide?.length ? entry.perSide : ["left", "right"];
  return { definition, perSide };
}

/** Structured examination for each answered side. */
export function sideExaminations(state: WorkbenchState, language: NoteLanguage = "en"): SideExamination[] {
  const active = activeExam(state);
  if (!active) return [];
  const book = examPhrases(language);
  return active.perSide
    .map((side) => examineSide(side, state.exam[side as "left" | "right"], active.definition, book))
    .filter((block): block is SideExamination => Boolean(block));
}

/** One side's examination prose, or "" when that side has no answers. */
export function examinationProseForSide(
  state: WorkbenchState,
  side: "left" | "right",
  language: NoteLanguage = "en",
): string {
  return sideExaminations(state, language).find((block) => block.side === side)?.prose ?? "";
}

/** The whole examination block, or "" when nothing was examined. */
export function onExamination(state: WorkbenchState, language: NoteLanguage = "en"): string {
  const blocks = sideExaminations(state, language);
  if (!blocks.length) return "";
  return [examPhrases(language).heading, ...blocks.map((block) => block.prose)].join("\n");
}
