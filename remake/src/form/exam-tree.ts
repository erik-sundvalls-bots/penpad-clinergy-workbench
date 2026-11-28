/**
 * Exam-tree captions and Features / Appearance folders.
 * Short names are harvested from the original engine's runtime form specs
 * (caption vs full concept name). A nested base sign whose display matches
 * the parent exam becomes a Features folder when it has size/texture/
 * consistency rows, otherwise Appearance.
 */
import type { RemakeForm } from "../knowledge-data.ts";
import EXAM_CAPTIONS from "./exam-captions.json";
import EXAM_INLINE_VALUES from "./exam-inline-values.json";

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
