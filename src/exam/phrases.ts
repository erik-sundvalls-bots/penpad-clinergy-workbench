import { parse } from "yaml";
import svRaw from "../../lang/sv.yaml?raw";

export type NoteLanguage = "en" | "sv";

export interface ExamPhrases {
  heading: string;
  rangeNoun: string;
  normal: string;
  notExamined: string;
  joint: string;
  sides: Record<string, string>;
  site: Record<string, string>;
  movements: Record<string, string>;
  range: Record<string, string>;
  pain: Record<string, string>;
  signs: Record<string, { presence?: string; absence?: string }>;
}

interface SwedishPackDoc {
  examination?: ExamPhrases & { plans?: Record<string, string> };
}

const swedishDoc = parse(svRaw) as SwedishPackDoc;

/** English phrases are the 1998 walkthrough wording, not a pack. */
const ENGLISH: ExamPhrases = {
  heading: "On Examination",
  rangeNoun: "range",
  normal: "normal",
  notExamined: "not examined",
  joint: "thumb joint",
  sides: { left: "Left", right: "Right" },
  site: { Thumb: "thumb" },
  movements: {
    FlexionSign: "flexion",
    ExtensionSign: "extension",
    AbductionSign: "abduction",
    AdductionSign: "adduction",
  },
  range: { full: "full", reduced: "reduced", limited: "limited", minimal: "minimal" },
  pain: {
    absence: "not painful",
    mild: "mildly painful",
    moderate: "moderately painful",
    severe: "severely painful",
  },
  signs: {},
};

export function examPhrases(language: NoteLanguage): ExamPhrases {
  if (language === "en" || !swedishDoc.examination) return ENGLISH;
  const block = swedishDoc.examination;
  return {
    heading: block.heading,
    rangeNoun: block.rangeNoun,
    normal: block.normal,
    notExamined: block.notExamined,
    joint: block.joint,
    sides: block.sides ?? {},
    site: block.site ?? {},
    movements: block.movements ?? {},
    range: block.range ?? {},
    pain: block.pain ?? {},
    signs: block.signs ?? {},
  };
}

/** Known plan sentences. An unknown plan is returned unchanged. */
export function localizePlan(plan: string, language: NoteLanguage): string {
  if (language !== "sv" || !plan) return plan;
  return swedishDoc.examination?.plans?.[plan] ?? plan;
}
