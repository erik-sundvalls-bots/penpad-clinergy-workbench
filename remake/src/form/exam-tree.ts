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
import EXAM_SUBLOCATIONS from "./exam-sublocations.json";
import EXAM_EXTRA_SIGNS from "./exam-extra-signs.json";
import type { FormRow } from "../knowledge-data.ts";


const LOCATIVE_PAIRS = new Set(
  ((EXAM_LOCATIVE_SIGNS as { pairs: { sign: string; location: string }[] }).pairs ?? [])
    .map((row) => `${row.sign}|${row.location}`),
);

const FORM_LOCATIVE_PAIRS = new Set(
  ((EXAM_LOCATIVE_SIGNS as { formPairs?: { form: string; sign: string; location: string }[] }).formPairs ?? [])
    .map((row) => `${row.form}|${row.sign}|${row.location}`),
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


const FEATURE_ATTRS = new Set([
  "AbsoluteSize",
  "AbsoluteTexture",
  "AbsoluteConsistency",
  "AbsolutePatency",
  "contains",
]);

/** Nested signs whose folder caption is not Features or Appearance. */
const SIGN_FOLDER_CAPTIONS: Record<string, string> = {
  UrineFeature: "character",
  ProstateGlandSign: "prostate gland",
};

/** Appearance sites that keep that folder even when the Features triad is present. */
const APPEARANCE_OVER_FEATURES = new Set(["tongue", "breast", "tonsil"]);

/** Body-part exams whose nested base sign is captioned Appearance in the original. */
const APPEARANCE_SITES = new Set([
  "vulva", "penis", "mouth", "tongue", "lip", "outer ear", "tympanic membrane", "nose",
  "eye", "cornea", "iris", "breast", "foot", "hand", "chest", "face", "arm", "leg", "jaw",
  "finger nail", "head", "kidney", "tonsil",
]);

function appearanceKey(display: string): string {
  return display.trim().toLowerCase().replace(/^(left|right)\s+/, "").replace(/\s+/g, " ");
}

export function isAppearanceSite(examDisplay: string): boolean {
  const d = appearanceKey(examDisplay);
  if (APPEARANCE_SITES.has(d)) return true;
  if (d.endsWith("s") && d.length > 3 && APPEARANCE_SITES.has(d.slice(0, -1))) return true;
  return false;
}

function appearanceKeys(display: string): string[] {
  const d = appearanceKey(display);
  const keys = [d];
  if (d.endsWith("s") && d.length > 3) keys.push(d.slice(0, -1));
  return keys;
}

function prefersAppearanceFolder(display: string): boolean {
  // Loin kidney exams are catalogued as "kidney" (then sided). Named left/right
  // kidney exams keep the Features triad, which the harness hoists.
  if (display.trim().toLowerCase() === "kidney") return true;
  return appearanceKeys(display).some((key) => APPEARANCE_OVER_FEATURES.has(key));
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
  const folder = SIGN_FOLDER_CAPTIONS[sign];
  if (folder) return folder;
  if (isNestedBaseSign(examDisplay, baseSign, sign, signDisplay)) {
    if (prefersAppearanceFolder(examDisplay) || prefersAppearanceFolder(signDisplay)) return "Appearance";
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
/** Contraception and HRT vulva exams keep the short "inflammation" caption. */
function skipLocativeCaption(sign: string, location: string, examName?: string | null): boolean {
  if (sign === "InflammationSign" && location === "Vulva" && examName && /^(Contra|HRT)/.test(examName)) return true;
  return false;
}

export function locativeExamSignCaption(
  sign: string,
  caption: string,
  location: string | null | undefined,
  examName?: string | null,
  examDisplay?: string | null,
  formTopic?: string | null,
): string {
  const cap = (caption || "").trim();
  if (!location || !cap || FOLDER_CAPTIONS.has(cap.toLowerCase())) return cap;
  if (skipLocativeCaption(sign, location, examName)) return cap;
  const allowed = LOCATIVE_PAIRS.has(`${sign}|${location}`)
    || Boolean(formTopic && FORM_LOCATIVE_PAIRS.has(`${formTopic}|${sign}|${location}`));
  if (!allowed) return cap;
  const locDisp = locativeSiteDisplay(location, examDisplay);
  if (!locDisp || cap.toLowerCase().includes(locDisp.toLowerCase()) || cap.toLowerCase().includes(appearanceKey(locDisp))) return cap;
  const prep = locativePreposition(sign, location);
  if (!prep) return cap;
  return `${cap} ${prep} ${locDisp}`;
}

function locativeSiteDisplay(location: string, examDisplay?: string | null): string {
  const fromConcept = conceptDisplay(location);
  const exam = (examDisplay || "").trim();
  if (!exam) return fromConcept;
  if (appearanceKey(exam) === appearanceKey(fromConcept)) return exam;
  return fromConcept;
}

export function examSignTreeCaption(
  examDisplay: string,
  baseSign: string | null | undefined,
  sign: string,
  signDisplay: string,
  hasFeatures: boolean,
  location?: string | null,
  examName?: string | null,
  formTopic?: string | null,
): string {
  const cap = signTreeCaption(examDisplay, baseSign, sign, signDisplay, hasFeatures);
  return locativeExamSignCaption(sign, cap, location, examName, examDisplay, formTopic);
}

const EXTRA_SIGNS = (EXAM_EXTRA_SIGNS as { signs: Record<string, string[]> }).signs ?? {};

/** Signs the original exam tree includes on a form beyond the catalogue exam list. */
export function extraExamSigns(formTopic: string | null | undefined, examName: string): string[] {
  if (!formTopic) return [];
  return EXTRA_SIGNS[`${formTopic}|${examName}`] ?? [];
}

export function examSignsFor(formTopic: string | null | undefined, examName: string, listed: string[] | null | undefined): string[] {
  const out = [...(listed ?? [])];
  const seen = new Set(out);
  for (const sign of extraExamSigns(formTopic, examName)) {
    if (!seen.has(sign)) {
      seen.add(sign);
      out.push(sign);
    }
  }
  return out;
}

type ExamSiteRef = { name?: string | null; baseLocation?: string | null; super?: string | null };

const SUBLOCATION_SITES = (EXAM_SUBLOCATIONS as { sites: Record<string, string[]> }).sites;
const SUBLOCATION_EXAM_SITES = (EXAM_SUBLOCATIONS as { examSites: Record<string, string> }).examSites;
const SUBLOCATION_SIGNS = new Set((EXAM_SUBLOCATIONS as { signs: string[] }).signs);

/** Walk an exam (and its supers) to the body site whose sublocation list applies. */
export function resolveExamSiteLocation(
  exam: ExamSiteRef | null | undefined,
  examOf: (name: string) => ExamSiteRef | null,
): string | null {
  const seen = new Set<string>();
  let current = exam ?? null;
  while (current) {
    const name = current.name ?? "";
    if (name && SUBLOCATION_EXAM_SITES[name]) return SUBLOCATION_EXAM_SITES[name];
    if (current.baseLocation) return current.baseLocation;
    const superName = current.super ?? "";
    if (!superName || seen.has(superName)) break;
    seen.add(superName);
    current = examOf(superName);
  }
  return null;
}

export function examSiteSublocationValues(location: string | null | undefined): string[] | null {
  if (!location) return null;
  const values = SUBLOCATION_SITES[location];
  return values?.length ? values : null;
}

/**
 * Signs such as lump, tenderness and inflammation pick up the exam site's
 * Sublocation list when their own form does not already have one.
 */
export function inheritedSublocationRow(sign: string, location: string | null | undefined): FormRow | null {
  if (!SUBLOCATION_SIGNS.has(sign)) return null;
  const values = examSiteSublocationValues(location);
  if (!values) return null;
  return { caption: "Sublocation", feature: "sublocation", values };
}

