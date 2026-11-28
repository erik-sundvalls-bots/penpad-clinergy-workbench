/**
 * Exam-tree captions and Features / Appearance folders.
 * Short names are harvested from the original engine's runtime form specs
 * (caption vs full concept name). A nested base sign whose display matches
 * the parent exam becomes a Features folder when it has size/texture/
 * consistency rows, otherwise Appearance.
 */
import type { RemakeForm } from "../knowledge-data.ts";
import { conceptDisplay } from "../knowledge-data.ts";
import { locativePreposition } from "./engine.ts";
import EXAM_CAPTIONS from "./exam-captions.json";
import EXAM_LOCATIVE_SIGNS from "./exam-locative-signs.json";
import EXAM_INLINE_VALUES from "./exam-inline-values.json";

const LOCATIVE_PAIRS = new Set(
  ((EXAM_LOCATIVE_SIGNS as { pairs: { sign: string; location: string }[] }).pairs ?? [])
    .map((row) => `${row.sign}|${row.location}`),
);


type InlineSpec = { inline: string; hide?: string[] };
const INLINE_SPECS = EXAM_INLINE_VALUES as Record<string, InlineSpec>;

export interface InlineExamSign {
  feature: string;
  hide: Set<string>;
}

/**
 * Some signs show their exclusive quality list on the sign itself
 * (brisk/normal/sluggish/absent on "Left biceps reflex") rather than as a
 * child row. Plantar, corneal, glabellar, snout and cremasteric reflexes keep
 * an activity child, so they are not in this map.
 */
export function inlineExamSign(topic: string | null | undefined): InlineExamSign | null {
  if (!topic) return null;
  const spec = INLINE_SPECS[topic];
  if (!spec) return null;
  return { feature: spec.inline, hide: new Set(spec.hide ?? [spec.inline]) };
}


const FEATURE_ATTRS = new Set(["AbsoluteSize", "AbsoluteTexture", "AbsoluteConsistency"]);

/** Body-part exams whose nested base sign is captioned Appearance in the original. */
const APPEARANCE_SITES = new Set([
  "vulva", "penis", "mouth", "tongue", "lip", "outer ear", "tympanic membrane", "nose",
  "eye", "cornea", "iris", "breast", "foot", "hand", "chest", "face", "arm", "leg", "jaw",
  "finger nail", "head", "kidney",
]);

export function isAppearanceSite(examDisplay: string): boolean {
  const d = examDisplay.trim().toLowerCase().replace(/^(left|right)\s+/, "");
  return APPEARANCE_SITES.has(d);
}

export function examTreeCaption(display: string): string {
  const key = display.trim().toLowerCase();
  return (EXAM_CAPTIONS as Record<string, string>)[key] ?? display;
}

export function sameExamLabel(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(a) === norm(b);
}

/** True when the sign's visible attributes are the typical Features triad. */
export function signHasFeatureFolder(form: RemakeForm | null | undefined): boolean {
  if (!form) return false;
  const keys = new Set(
    [...(form.firstLayer ?? []), ...(form.moreLayer ?? [])]
      .map((row) => row.feature ?? "")
      .filter(Boolean),
  );
  let n = 0;
  for (const attr of FEATURE_ATTRS) if (keys.has(attr)) n += 1;
  return n >= 2;
}

export function isNestedBaseSign(
  examDisplay: string,
  baseSign: string | null | undefined,
  sign: string,
  signDisplay: string,
): boolean {
  if (baseSign && sign === baseSign) return true;
  return sameExamLabel(examDisplay, signDisplay);
}

export function signTreeCaption(
  examDisplay: string,
  baseSign: string | null | undefined,
  sign: string,
  signDisplay: string,
  hasFeatures: boolean,
): string {
  if (isNestedBaseSign(examDisplay, baseSign, sign, signDisplay)) {
    if (hasFeatures) return "Features";
    const shortened = examTreeCaption(signDisplay);
    if (shortened !== signDisplay) return shortened;
    if (isAppearanceSite(examDisplay) || isAppearanceSite(signDisplay)) return "Appearance";
    return signDisplay;
  }
  return examTreeCaption(signDisplay);
}

/** Original engine captions a per-side exam as "Left groin", "Right ear". */
export function sidedExamCaption(display: string, side: "left" | "right"): string {
  const d = display.trim();
  if (/^(left|right)\s+/i.test(d)) return d[0].toUpperCase() + d.slice(1);
  const label = side === "left" ? "Left" : "Right";
  return `${label} ${d}`;
}

const FOLDER_CAPTIONS = new Set(["appearance", "features"]);

/**
 * Incomplete signs in an exam pick up the exam site, using the sanctioned
 * locative ("inflammation of vulva", "abscess on vulva", "foreign body in eyelid").
 * Features / Appearance folders and captions that already name the site stay as they are.
 */
export function locativeExamSignCaption(
  sign: string,
  caption: string,
  location: string | null | undefined,
): string {
  const cap = (caption || "").trim();
  if (!location || !cap || FOLDER_CAPTIONS.has(cap.toLowerCase())) return cap;
  if (!LOCATIVE_PAIRS.has(`${sign}|${location}`)) return cap;
  const locDisp = conceptDisplay(location);
  if (!locDisp || cap.toLowerCase().includes(locDisp.toLowerCase())) return cap;
  const prep = locativePreposition(sign, location);
  if (!prep) return cap;
  return `${cap} ${prep} ${locDisp}`;
}

export function examSignTreeCaption(
  examDisplay: string,
  baseSign: string | null | undefined,
  sign: string,
  signDisplay: string,
  hasFeatures: boolean,
  location?: string | null,
): string {
  const cap = signTreeCaption(examDisplay, baseSign, sign, signDisplay, hasFeatures);
  return locativeExamSignCaption(sign, cap, location);
}

