import { examsByName, examinationsOf, displayOf, type ExamDefinition } from "../forms/catalog.ts";
import type { ExamSide, WorkbenchState } from "../model.ts";

/**
 * On Examination block, in the shape of the 1998 summary:
 * a heading, one line per examined side, and an indented joint line
 * whose movements are separated by semicolons.
 *
 * The wording of range and pain-on-movement follows the public walkthrough
 * (https://pen-pad-revival.github.io/docs/clinergy-thumb-pain-demo/), for example
 * "flexion full range, mildly painful".
 */

const PAIN_WORD: Record<string, string> = {
  absence: "not painful",
  mild: "mildly painful",
  moderate: "moderately painful",
  severe: "severely painful",
};

function sideWord(side: string): string {
  return side === "left" ? "Left" : side === "right" ? "Right" : side;
}

function presencePhrase(sign: string, value: string): string {
  const name = displayOf(sign).toLowerCase();
  if (value === "presence") return `${name} present`;
  if (value === "absence") return `${name} absent`;
  return `${name} ${value}`;
}

function movementPhrase(sign: string, range: string | null, pain: string | null): string | null {
  if (!range && !pain) return null;
  const name = displayOf(sign).replace(/ sign$/i, "").toLowerCase();
  const bits: string[] = [];
  if (range) bits.push(`${range} range`);
  if (pain && PAIN_WORD[pain]) bits.push(PAIN_WORD[pain]);
  else if (pain) bits.push(pain);
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

export interface SideProse {
  side: string;
  /** Lines for this side, without the "On Examination" heading. */
  lines: string[];
  text: string;
}

function sideProse(side: string, exam: ExamSide, definition: ExamDefinition): SideProse | null {
  const place = displayOf(definition.baseLocation).toLowerCase();
  const header = `${sideWord(side)} ${place}`;
  const bits: string[] = [];
  if (exam.status === "normal") bits.push("normal");
  if (exam.status === "notExamined") bits.push("not examined");
  for (const sign of definition.signs0 ?? []) {
    const key = presenceKey(sign);
    if (!key) continue;
    const value = exam[key];
    if (value) bits.push(presencePhrase(sign, value));
  }
  const jointParts: string[] = [];
  let jointLabel = "";
  for (const subName of definition.subExams ?? []) {
    const sub = examsByName[subName];
    if (!sub) continue;
    jointLabel = `${sideWord(side)} ${displayOf(sub.baseSign).toLowerCase()}`;
    for (const sign of sub.signs0 ?? []) {
      const keys = movementKeys(sign);
      if (!keys) continue;
      const phrase = movementPhrase(sign, fieldOn(exam, keys.range), fieldOn(exam, keys.pain));
      if (phrase) jointParts.push(phrase);
    }
  }
  if (!bits.length && !jointParts.length) return null;
  const lines: string[] = [];
  lines.push(bits.length ? `${header}: ${bits.join(", ")}` : `${header}:`);
  if (jointParts.length && jointLabel) lines.push(` ${jointLabel}: ${jointParts.join("; ")}`);
  return { side, lines, text: lines.join("\n") };
}

function activeExam(state: WorkbenchState): { definition: ExamDefinition; perSide: string[] } | null {
  if (state.selectedForms.length && !state.selectedForms.includes("ThumbExam")) return null;
  const topics = state.selectedForms.filter((topic) => topic !== "ThumbExam");
  const declared = examinationsOf(topics.length ? topics : ["ThumbPainSymptom"]);
  const entry = declared[0];
  const definition = examsByName[entry?.exam ?? "ThumbExam"];
  if (!definition) return null;
  const perSide = entry?.perSide?.length ? entry.perSide : ["left", "right"];
  return { definition, perSide };
}

/** One side's examination prose, or "" when that side has no answers. */
export function examinationProseForSide(state: WorkbenchState, side: "left" | "right"): string {
  const active = activeExam(state);
  if (!active) return "";
  return sideProse(side, state.exam[side], active.definition)?.text ?? "";
}

/** The whole On Examination block, or "" when nothing was examined. */
export function onExamination(state: WorkbenchState): string {
  const active = activeExam(state);
  if (!active) return "";
  const blocks = active.perSide
    .map((side) => sideProse(side, state.exam[side as "left" | "right"], active.definition))
    .filter((block): block is SideProse => Boolean(block));
  if (!blocks.length) return "";
  return ["On Examination", ...blocks.flatMap((block) => block.lines)].join("\n");
}
